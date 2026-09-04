#!/usr/bin/env python3
"""
Safely initialize and recover AMCL from a valid UWB position fix.

AMCL remains authoritative. UWB supplies an occasional map x/y seed, while
LiDAR resolves heading. Recovery is only attempted after the motion interlock
is active and measured odometry confirms that the vehicle has stopped.
"""

import json
import math
import time

from geometry_msgs.msg import PoseWithCovarianceStamped
from nav_msgs.msg import Odometry
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


def localization_topics(vehicle_name, main_vehicle="my_robot"):
    """Return localization and recovery topics for one vehicle."""
    root = f"/traffic/{vehicle_name}"
    return {
        "uwb_pose": f"{root}/uwb_pose",
        "uwb_status": f"{root}/uwb_status",
        "initialization_status": f"{root}/initialization_status",
        "validation": f"{root}/localization_validation",
        "initialpose": (
            "/initialpose"
            if vehicle_name == main_vehicle
            else f"{root}/initialpose"
        ),
        "amcl_pose": (
            "/amcl_pose"
            if vehicle_name == main_vehicle
            else f"{root}/amcl_pose"
        ),
        "odom": (
            "/odom"
            if vehicle_name == main_vehicle
            else f"{root}/odom"
        ),
    }


def localization_loss_reason(validation_state, amcl_age, loss_timeout):
    """Return a recovery reason when ready localization is no longer safe."""
    if amcl_age is None or amcl_age > loss_timeout:
        return "amcl_missing"
    if validation_state == "disagreement":
        return "persistent_uwb_disagreement"
    return None


def odometry_is_stopped(entry, now, stale_after, linear_limit, angular_limit):
    """Require fresh measured odometry below both stop thresholds."""
    if entry is None:
        return False
    linear_speed, angular_speed, received_at = entry
    return (
        now - received_at <= stale_after
        and linear_speed <= linear_limit
        and angular_speed <= angular_limit
    )


class UwbAmclInitializer(Node):
    """Coordinate UWB-assisted AMCL startup and stopped-only recovery."""

    def __init__(self):
        super().__init__("uwb_amcl_initializer")
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("vehicle_prefix", "vehicle_")
        self.declare_parameter("include_main_vehicle", True)
        self.declare_parameter("main_vehicle_id", "my_robot")
        self.declare_parameter("minimum_tags", 3)
        self.declare_parameter("maximum_uwb_residual", 0.75)
        self.declare_parameter("acceptance_distance", 2.0)
        self.declare_parameter("required_amcl_samples", 3)
        self.declare_parameter("retry_period", 2.0)
        self.declare_parameter("stale_after", 2.0)
        self.declare_parameter("yaw_variance", math.pi * math.pi)
        self.declare_parameter("amcl_loss_timeout", 3.0)
        self.declare_parameter("validation_grace_period", 1.0)
        self.declare_parameter("stop_settle_time", 1.0)
        self.declare_parameter("odometry_stale_after", 1.0)
        self.declare_parameter("stopped_linear_speed", 0.03)
        self.declare_parameter("stopped_angular_speed", 0.08)

        count = int(self.get_parameter("vehicle_count").value)
        prefix = str(self.get_parameter("vehicle_prefix").value)
        self.main_vehicle = str(self.get_parameter("main_vehicle_id").value)
        self.vehicle_names = [f"{prefix}{index}" for index in range(1, count + 1)]
        if bool(self.get_parameter("include_main_vehicle").value):
            self.vehicle_names.insert(0, self.main_vehicle)
        self.minimum_tags = max(3, int(self.get_parameter("minimum_tags").value))
        self.maximum_residual = max(
            0.0, float(self.get_parameter("maximum_uwb_residual").value)
        )
        self.acceptance_distance = max(
            0.1, float(self.get_parameter("acceptance_distance").value)
        )
        self.required_samples = max(
            1, int(self.get_parameter("required_amcl_samples").value)
        )
        self.retry_period = max(0.5, float(self.get_parameter("retry_period").value))
        self.stale_after = max(0.2, float(self.get_parameter("stale_after").value))
        self.yaw_variance = max(0.1, float(self.get_parameter("yaw_variance").value))
        self.amcl_loss_timeout = max(
            0.5, float(self.get_parameter("amcl_loss_timeout").value)
        )
        self.validation_grace_period = max(
            0.0, float(self.get_parameter("validation_grace_period").value)
        )
        self.stop_settle_time = max(
            0.5, float(self.get_parameter("stop_settle_time").value)
        )
        self.odometry_stale_after = max(
            0.2, float(self.get_parameter("odometry_stale_after").value)
        )
        self.stopped_linear_speed = max(
            0.0, float(self.get_parameter("stopped_linear_speed").value)
        )
        self.stopped_angular_speed = max(
            0.0, float(self.get_parameter("stopped_angular_speed").value)
        )

        now = time.monotonic()
        self.uwb_poses = {}
        self.uwb_status = {}
        self.amcl_received_at = {}
        self.validation_states = {}
        self.odometry = {}
        self.attempts = {name: 0 for name in self.vehicle_names}
        self.last_attempt = {name: 0.0 for name in self.vehicle_names}
        self.accepted_samples = {name: 0 for name in self.vehicle_names}
        self.phases = {name: "waiting" for name in self.vehicle_names}
        self.phase_started = {name: now for name in self.vehicle_names}
        self.phase_reasons = {name: "waiting_uwb" for name in self.vehicle_names}
        self.recovery_count = {name: 0 for name in self.vehicle_names}
        self.initial_pose_publishers = {}
        self.status_publishers = {}
        self.input_subscriptions = []

        for name in self.vehicle_names:
            topics = localization_topics(name, self.main_vehicle)
            self.initial_pose_publishers[name] = self.create_publisher(
                PoseWithCovarianceStamped, topics["initialpose"], 10
            )
            self.status_publishers[name] = self.create_publisher(
                String, topics["initialization_status"], 10
            )
            self.input_subscriptions.extend(
                [
                    self.create_subscription(
                        PoseWithCovarianceStamped,
                        topics["uwb_pose"],
                        lambda message, vehicle=name: self.on_uwb_pose(vehicle, message),
                        10,
                    ),
                    self.create_subscription(
                        String,
                        topics["uwb_status"],
                        lambda message, vehicle=name: self.on_uwb_status(vehicle, message),
                        10,
                    ),
                    self.create_subscription(
                        PoseWithCovarianceStamped,
                        topics["amcl_pose"],
                        lambda message, vehicle=name: self.on_amcl_pose(vehicle, message),
                        10,
                    ),
                    self.create_subscription(
                        String,
                        topics["validation"],
                        lambda message, vehicle=name: self.on_validation(vehicle, message),
                        10,
                    ),
                    self.create_subscription(
                        Odometry,
                        topics["odom"],
                        lambda message, vehicle=name: self.on_odometry(vehicle, message),
                        10,
                    ),
                ]
            )

        self.create_timer(0.5, self.update)
        self.get_logger().info(
            f"UWB-assisted AMCL startup/recovery enabled for {len(self.vehicle_names)} "
            "vehicles; AMCL stays authoritative and recovery requires a stop"
        )

    def on_uwb_pose(self, name, message):
        self.uwb_poses[name] = (message, time.monotonic())

    def on_uwb_status(self, name, message):
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            return
        self.uwb_status[name] = (payload, time.monotonic())

    def on_amcl_pose(self, name, message):
        now = time.monotonic()
        self.amcl_received_at[name] = now
        if self.phases[name] not in ("initializing", "recovering"):
            return
        if self.attempts[name] == 0:
            return
        uwb_entry = self.uwb_poses.get(name)
        if uwb_entry is None or now - uwb_entry[1] > self.stale_after:
            self.accepted_samples[name] = 0
            return
        uwb = uwb_entry[0].pose.pose.position
        amcl = message.pose.pose.position
        error = math.hypot(amcl.x - uwb.x, amcl.y - uwb.y)
        if error <= self.acceptance_distance:
            self.accepted_samples[name] += 1
        else:
            self.accepted_samples[name] = 0
        if self.accepted_samples[name] >= self.required_samples:
            recovered = self.phases[name] == "recovering"
            self._transition(name, "ready", "amcl_accepted", now)
            self.get_logger().info(
                f"{name} accepted AMCL localization after "
                f"{'recovery' if recovered else 'UWB startup'} "
                f"({error:.2f} m agreement)"
            )

    def on_validation(self, name, message):
        """Watch the validator's filtered state without fusing UWB into AMCL."""
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            return
        self.validation_states[name] = payload.get("state")

    def on_odometry(self, name, message):
        """Cache measured speed so recovery cannot reset a moving vehicle."""
        linear = message.twist.twist.linear
        angular = message.twist.twist.angular
        self.odometry[name] = (
            math.sqrt(linear.x * linear.x + linear.y * linear.y + linear.z * linear.z),
            math.sqrt(angular.x * angular.x + angular.y * angular.y + angular.z * angular.z),
            time.monotonic(),
        )

    def _transition(self, name, phase, reason, now):
        if self.phases[name] != phase:
            self.phases[name] = phase
            self.phase_started[name] = now
        self.phase_reasons[name] = reason

    def _lose_localization(self, name, reason, now):
        self.accepted_samples[name] = 0
        self.last_attempt[name] = 0.0
        self.recovery_count[name] += 1
        self._transition(name, "stopping", reason, now)
        self.get_logger().warning(
            f"{name} localization lost ({reason}); motion interlock engaged"
        )

    def valid_fix(self, name, now):
        pose_entry = self.uwb_poses.get(name)
        status_entry = self.uwb_status.get(name)
        if pose_entry is None or status_entry is None:
            return None, "waiting_uwb"
        if now - pose_entry[1] > self.stale_after or now - status_entry[1] > self.stale_after:
            return None, "stale_uwb"
        status = status_entry[0]
        if not status.get("fix_valid", False):
            return None, status.get("reason", "invalid_uwb")
        if int(status.get("visible_tag_count", 0)) < self.minimum_tags:
            return None, "insufficient_tags"
        residual = status.get("residual_m")
        if residual is not None and float(residual) > self.maximum_residual:
            return None, "poor_uwb_fit"
        return pose_entry[0], "ready"

    def publish_initial_pose(self, name, uwb_message):
        message = PoseWithCovarianceStamped()
        message.header.stamp = self.get_clock().now().to_msg()
        message.header.frame_id = "map"
        message.pose.pose.position.x = uwb_message.pose.pose.position.x
        message.pose.pose.position.y = uwb_message.pose.pose.position.y
        message.pose.pose.orientation.w = 1.0
        message.pose.covariance[0] = max(0.04, uwb_message.pose.covariance[0])
        message.pose.covariance[7] = max(0.04, uwb_message.pose.covariance[7])
        message.pose.covariance[14] = 1.0e6
        message.pose.covariance[21] = 1.0e6
        message.pose.covariance[28] = 1.0e6
        message.pose.covariance[35] = self.yaw_variance
        self.initial_pose_publishers[name].publish(message)

    def publish_status(self, name, state, reason):
        payload = {
            "vehicle_id": name,
            "state": state,
            "reason": reason,
            "attempts": self.attempts[name],
            "accepted_amcl_samples": self.accepted_samples[name],
            "drive_allowed": state == "ready",
            "recovery_count": self.recovery_count[name],
            "authoritative_source": "amcl",
            "one_shot": False,
        }
        self.status_publishers[name].publish(
            String(data=json.dumps(payload, separators=(",", ":")))
        )

    def update(self):
        now = time.monotonic()
        for name in self.vehicle_names:
            phase = self.phases[name]
            if phase == "ready":
                received_at = self.amcl_received_at.get(name)
                amcl_age = None if received_at is None else now - received_at
                validation_state = (
                    self.validation_states.get(name)
                    if now - self.phase_started[name] >= self.validation_grace_period
                    else None
                )
                reason = localization_loss_reason(
                    validation_state,
                    amcl_age,
                    self.amcl_loss_timeout,
                )
                if reason is not None:
                    self._lose_localization(name, reason, now)
                    self.publish_status(name, "stopping", reason)
                else:
                    ready_reason = (
                        "amcl_confirmed_by_uwb"
                        if validation_state == "confirmed"
                        else "amcl_ready_uwb_not_confirming"
                    )
                    self.publish_status(name, "ready", ready_reason)
                continue

            if phase == "stopping":
                if now - self.phase_started[name] < self.stop_settle_time:
                    self.publish_status(name, "stopping", self.phase_reasons[name])
                    continue
                if not odometry_is_stopped(
                    self.odometry.get(name),
                    now,
                    self.odometry_stale_after,
                    self.stopped_linear_speed,
                    self.stopped_angular_speed,
                ):
                    self.publish_status(name, "stopping", "waiting_for_measured_stop")
                    continue
                self._transition(name, "recovering", "vehicle_stopped", now)
                phase = "recovering"

            uwb_message, reason = self.valid_fix(name, now)
            if uwb_message is None:
                state = "recovering" if phase == "recovering" else "waiting"
                self._transition(name, state, reason, now)
                self.publish_status(name, state, reason)
                continue
            if now - self.last_attempt[name] >= self.retry_period:
                state = "recovering" if phase == "recovering" else "initializing"
                self._transition(name, state, "uwb_pose_sent", now)
                self.publish_initial_pose(name, uwb_message)
                self.attempts[name] += 1
                self.last_attempt[name] = now
            self.publish_status(name, self.phases[name], self.phase_reasons[name])


def main(args=None):
    rclpy.init(args=args)
    node = UwbAmclInitializer()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
