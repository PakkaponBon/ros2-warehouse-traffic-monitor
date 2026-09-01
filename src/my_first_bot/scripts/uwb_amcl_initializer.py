#!/usr/bin/env python3
"""
Initialize traffic-vehicle AMCL once from a valid UWB position fix.

UWB supplies map x/y only. The initial yaw covariance covers the full heading
range so AMCL can select heading from the 2-D LiDAR scan. After AMCL publishes a
stable nearby pose, this node never resets that vehicle again.
"""

import json
import math
import time

from geometry_msgs.msg import PoseWithCovarianceStamped
import rclpy
from rclpy.node import Node
from std_msgs.msg import String


def localization_topics(vehicle_name, main_vehicle="my_robot"):
    """Return the AMCL/UWB startup topics for one vehicle."""
    root = f"/traffic/{vehicle_name}"
    return {
        "uwb_pose": f"{root}/uwb_pose",
        "uwb_status": f"{root}/uwb_status",
        "initialization_status": f"{root}/initialization_status",
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
    }


class UwbAmclInitializer(Node):
    """Provide one-shot, per-vehicle UWB-assisted AMCL initialization."""

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

        self.uwb_poses = {}
        self.uwb_status = {}
        self.attempts = {name: 0 for name in self.vehicle_names}
        self.last_attempt = {name: 0.0 for name in self.vehicle_names}
        self.accepted_samples = {name: 0 for name in self.vehicle_names}
        self.initialized = set()
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
            self.input_subscriptions.append(
                self.create_subscription(
                    PoseWithCovarianceStamped,
                    topics["uwb_pose"],
                    lambda message, vehicle=name: self.on_uwb_pose(vehicle, message),
                    10,
                )
            )
            self.input_subscriptions.append(
                self.create_subscription(
                    String,
                    topics["uwb_status"],
                    lambda message, vehicle=name: self.on_uwb_status(vehicle, message),
                    10,
                )
            )
            self.input_subscriptions.append(
                self.create_subscription(
                    PoseWithCovarianceStamped,
                    topics["amcl_pose"],
                    lambda message, vehicle=name: self.on_amcl_pose(vehicle, message),
                    10,
                )
            )

        self.create_timer(0.5, self.update)
        self.get_logger().info(
            f"UWB-assisted AMCL startup enabled for {len(self.vehicle_names)} "
            "vehicles; UWB initializes x/y once and LiDAR resolves heading"
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
        if name in self.initialized or self.attempts[name] == 0:
            return
        uwb_entry = self.uwb_poses.get(name)
        if uwb_entry is None or time.monotonic() - uwb_entry[1] > self.stale_after:
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
            self.initialized.add(name)
            self.get_logger().info(
                f"{name} accepted AMCL localization after UWB startup "
                f"({error:.2f} m agreement)"
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
            "one_shot": True,
        }
        self.status_publishers[name].publish(
            String(data=json.dumps(payload, separators=(",", ":")))
        )

    def update(self):
        now = time.monotonic()
        for name in self.vehicle_names:
            if name in self.initialized:
                self.publish_status(name, "initialized", "amcl_accepted")
                continue
            uwb_message, reason = self.valid_fix(name, now)
            if uwb_message is None:
                self.publish_status(name, "waiting", reason)
                continue
            if now - self.last_attempt[name] >= self.retry_period:
                self.publish_initial_pose(name, uwb_message)
                self.attempts[name] += 1
                self.last_attempt[name] = now
                self.publish_status(name, "initializing", "uwb_pose_sent")


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
