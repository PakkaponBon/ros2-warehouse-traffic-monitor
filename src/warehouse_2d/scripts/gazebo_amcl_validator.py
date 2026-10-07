#!/usr/bin/env python3
"""Validate and recover AMCL after simulated vehicles are moved in Gazebo."""

from dataclasses import dataclass
import json
import math
import time

from gazebo_msgs.msg import ModelStates
from geometry_msgs.msg import PoseWithCovarianceStamped, Twist
import rclpy
from rclpy.duration import Duration
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, qos_profile_sensor_data
from rclpy.time import Time
from sensor_msgs.msg import LaserScan
from std_msgs.msg import String
from std_srvs.srv import Empty
from tf2_ros import Buffer, TransformException, TransformListener

from traffic_common import transform_xy


def yaw_of(orientation):
    return math.atan2(
        2.0 * (orientation.w * orientation.z + orientation.x * orientation.y),
        1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z),
    )


def angle_distance(first, second):
    return abs((first - second + math.pi) % (2.0 * math.pi) - math.pi)


def pose_within_drive_tolerance(vehicle, settings):
    """Require a margin before restarting after a validation stop.

    The stop thresholds remain unchanged. Restarting at the very same
    boundary repeatedly toggles cmd_vel when the estimate has small noise.
    """
    margin = 1.0 if vehicle.state == "ready" else 0.75
    return (vehicle.position_error <= margin * settings["position_tolerance"]
            and vehicle.yaw_error <= margin * settings["yaw_tolerance"])


@dataclass
class VehicleValidation:
    truth: tuple = None
    truth_received: float = 0.0
    truth_stamp: int = 0
    linear_speed: float = 0.0
    angular_speed: float = 0.0
    scan_received: float = 0.0
    scan_stamp: int = 0
    amcl_received: float = 0.0
    amcl_stamp: int = 0
    state: str = "waiting"
    reason: str = "waiting_for_gazebo"
    generation: int = 0
    recovery_started: float = 0.0
    event_stamp: int = 0
    reset_required: bool = False
    reset_received: float = 0.0
    reset_stamp: int = 0
    reset_attempts: int = 0
    good_samples: int = 0
    bad_samples: int = 0
    mismatch_samples: int = 0
    checked_stamp: int = -1
    position_error: float = None
    yaw_error: float = None
    measurement_skew: float = None
    trigger: str = "startup"
    transform_wait_started: float = 0.0


class GazeboAmclValidator(Node):
    """Interlock driving until a fresh AMCL estimate agrees with Gazebo."""

    def __init__(self):
        super().__init__("gazebo_amcl_validator")
        defaults = {
            "vehicle_count": 8,
            "world_to_map_x": 0.0,
            "world_to_map_y": 0.0,
            "world_to_map_yaw": 0.0,
            "jump_distance": 1.0,
            "jump_yaw": 0.75,
            "position_tolerance": 0.40,
            "yaw_tolerance": 0.25,
            "recovery_position_error": 0.75,
            "recovery_yaw_error": 0.45,
            "freshness_timeout": 1.0,
            "maximum_time_skew": 0.25,
            "confirmation_samples": 3,
            "settle_seconds": 0.4,
            "reset_retry_seconds": 3.0,
        }
        for key, default in defaults.items():
            self.declare_parameter(key, default)
        self.settings = {key: self.get_parameter(key).value for key in defaults}
        if not all(math.isfinite(float(value)) for value in self.settings.values()):
            raise ValueError("Gazebo AMCL validation settings must be finite")
        count = int(self.settings["vehicle_count"])
        if count < 1 or int(self.settings["confirmation_samples"]) < 1:
            raise ValueError("vehicle and confirmation counts must be positive")
        for key in defaults.keys() - {
            "vehicle_count", "world_to_map_x", "world_to_map_y", "world_to_map_yaw"
        }:
            if float(self.settings[key]) <= 0.0:
                raise ValueError(f"{key} must be positive")
        if (self.settings["recovery_position_error"] < self.settings["position_tolerance"]
                or self.settings["recovery_yaw_error"] < self.settings["yaw_tolerance"]):
            raise ValueError("recovery thresholds must cover the validation tolerances")

        self.alignment = tuple(float(self.settings[key]) for key in
                               ("world_to_map_x", "world_to_map_y", "world_to_map_yaw"))
        self.vehicles = {f"vehicle_{index}": VehicleValidation()
                         for index in range(1, count + 1)}
        self.tf_buffer = Buffer(cache_time=Duration(seconds=10.0))
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.initial_pose_publishers = {}
        self.stop_publishers = {}
        self.status_publishers = {}
        self.nomotion_clients = {}
        self.nomotion_pending = {}
        self.nomotion_requested = {}
        self.validation_subscriptions = []
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        for name in self.vehicles:
            prefix = f"/traffic/{name}"
            self.initial_pose_publishers[name] = self.create_publisher(
                PoseWithCovarianceStamped, f"{prefix}/initialpose", 10)
            self.stop_publishers[name] = self.create_publisher(Twist, f"{prefix}/cmd_vel", 10)
            self.status_publishers[name] = self.create_publisher(
                String, f"{prefix}/initialization_status", latched)
            self.nomotion_clients[name] = self.create_client(
                Empty, f"{prefix}/request_nomotion_update")
            self.validation_subscriptions.extend([
                self.create_subscription(
                    PoseWithCovarianceStamped, f"{prefix}/amcl_pose",
                    lambda message, vehicle=name: self.on_amcl(vehicle, message), latched),
                self.create_subscription(
                    LaserScan, f"{prefix}/scan",
                    lambda message, vehicle=name: self.on_scan(vehicle, message),
                    qos_profile_sensor_data),
            ])
        self.validation_subscriptions.append(self.create_subscription(
            ModelStates, "/gazebo/model_states", self.on_models, qos_profile_sensor_data))
        self.create_timer(0.1, self.validate)
        self.get_logger().info(
            "Gazebo AMCL validation and jump recovery enabled; driving requires "
            "a confirmed map pose. Gazebo reference timestamps use ROS clock at receipt.")

    def on_scan(self, name, message):
        vehicle = self.vehicles[name]
        vehicle.scan_received = time.monotonic()
        vehicle.scan_stamp = Time.from_msg(message.header.stamp).nanoseconds

    def on_amcl(self, name, message):
        if message.header.frame_id.lstrip("/") != "map":
            return
        pose = message.pose.pose
        if not all(math.isfinite(value) for value in
                   (pose.position.x, pose.position.y, yaw_of(pose.orientation))):
            return
        vehicle = self.vehicles[name]
        vehicle.amcl_received = time.monotonic()
        vehicle.amcl_stamp = Time.from_msg(message.header.stamp).nanoseconds

    def on_models(self, message):
        now = time.monotonic()
        stamp = self.get_clock().now().nanoseconds
        for name, pose, twist in zip(message.name, message.pose, message.twist):
            if name not in self.vehicles:
                continue
            vehicle = self.vehicles[name]
            x, y = transform_xy(pose.position.x, pose.position.y, *self.alignment)
            truth = (x, y, yaw_of(pose.orientation) + self.alignment[2])
            speed = math.hypot(twist.linear.x, twist.linear.y)
            angular = abs(twist.angular.z)
            if not all(math.isfinite(value) for value in (*truth, speed, angular)):
                continue
            recovery_reason = None
            if vehicle.truth is not None:
                elapsed = (stamp - vehicle.truth_stamp) / 1e9
                if elapsed < 0.0:
                    recovery_reason = "simulation_clock_reset"
                else:
                    # Allow motion reported by physics; a discontinuous change
                    # cannot be explained by the vehicle's measured velocity.
                    travel = math.dist(truth[:2], vehicle.truth[:2])
                    turn = angle_distance(truth[2], vehicle.truth[2])
                    if (travel > self.settings["jump_distance"]
                            + max(speed, vehicle.linear_speed) * elapsed
                            or turn > self.settings["jump_yaw"]
                            + max(angular, vehicle.angular_speed) * elapsed):
                        recovery_reason = "gazebo_jump"
            vehicle.truth = truth
            vehicle.truth_received = now
            vehicle.truth_stamp = stamp
            vehicle.linear_speed = speed
            vehicle.angular_speed = angular
            if recovery_reason is not None:
                self.begin_recovery(name, recovery_reason, now, stamp)

    def begin_recovery(self, name, reason, now, stamp):
        vehicle = self.vehicles[name]
        vehicle.generation += 1
        vehicle.state = "relocalizing"
        vehicle.reason = reason
        vehicle.trigger = reason
        vehicle.recovery_started = now
        vehicle.event_stamp = stamp
        vehicle.reset_required = True
        vehicle.reset_received = 0.0
        vehicle.reset_stamp = 0
        vehicle.reset_attempts = 0
        vehicle.good_samples = vehicle.bad_samples = vehicle.mismatch_samples = 0
        vehicle.checked_stamp = -1
        vehicle.transform_wait_started = 0.0
        vehicle.position_error = vehicle.yaw_error = vehicle.measurement_skew = None
        self.publish_status(name)
        self.get_logger().warning(f"{name}: {reason}; stopping and reinitializing AMCL")

    def request_scan_update(self, name, now):
        client = self.nomotion_clients[name]
        pending = self.nomotion_pending.get(name)
        if pending is not None:
            future, started = pending
            if future.done():
                self.nomotion_pending.pop(name)
                try:
                    future.result()
                except Exception as error:
                    self.get_logger().warning(f"{name}: stationary AMCL update failed: {error}")
            elif now - started > 2.0:
                client.remove_pending_request(future)
                self.nomotion_pending.pop(name)
            else:
                return
        if now - self.nomotion_requested.get(name, 0.0) >= 0.5 and client.service_is_ready():
            self.nomotion_requested[name] = now
            self.nomotion_pending[name] = (client.call_async(Empty.Request()), now)

    def reset_amcl(self, name, now):
        vehicle = self.vehicles[name]
        if (now - vehicle.recovery_started < self.settings["settle_seconds"]
                or vehicle.linear_speed > 0.05 or vehicle.angular_speed > 0.10):
            vehicle.reason = "waiting_for_vehicle_to_stop"
            return
        if vehicle.scan_stamp <= vehicle.event_stamp:
            vehicle.reason = "waiting_for_scan_after_jump"
            return
        publisher = self.initial_pose_publishers[name]
        if publisher.get_subscription_count() == 0:
            vehicle.reason = "waiting_for_amcl_initialpose_subscriber"
            return
        if (vehicle.reset_received
                and now - vehicle.reset_received < self.settings["reset_retry_seconds"]):
            return
        # Odometry itself jumps with gazebo_ros_planar_move. Wait for its TF
        # after the jump so AMCL does not integrate the old odometry delta
        # into the new initial pose.
        try:
            odom = self.tf_buffer.lookup_transform(
                f"{name}/odom", f"{name}/base_link", Time())
        except TransformException:
            vehicle.reason = "waiting_for_odometry"
            return
        odom_stamp = Time.from_msg(odom.header.stamp).nanoseconds
        if (odom_stamp <= vehicle.event_stamp
                or abs(odom_stamp - vehicle.truth_stamp) / 1e9 > self.settings["maximum_time_skew"]):
            vehicle.reason = "waiting_for_odometry_after_jump"
            return

        message = PoseWithCovarianceStamped()
        message.header.frame_id = "map"
        message.header.stamp = self.get_clock().now().to_msg()
        x, y, yaw = vehicle.truth
        message.pose.pose.position.x = float(x)
        message.pose.pose.position.y = float(y)
        message.pose.pose.orientation.z = math.sin(yaw / 2.0)
        message.pose.pose.orientation.w = math.cos(yaw / 2.0)
        # This seed is measured Gazebo truth after motion has stopped. A broad
        # 20 cm / 0.1 rad distribution lets repetitive shelves pull AMCL into
        # a neighbouring hypothesis immediately after every recovery.
        message.pose.covariance[0] = message.pose.covariance[7] = 0.0025
        message.pose.covariance[35] = 0.0004
        publisher.publish(message)
        vehicle.reset_received = now
        vehicle.reset_stamp = Time.from_msg(message.header.stamp).nanoseconds
        vehicle.reset_attempts += 1
        vehicle.good_samples = vehicle.bad_samples = vehicle.mismatch_samples = 0
        vehicle.checked_stamp = -1
        vehicle.reason = "waiting_for_amcl_after_reset"
        self.get_logger().info(
            f"{name}: initialpose #{vehicle.reset_attempts} at "
            f"({x:.2f}, {y:.2f}, yaw={yaw:.2f}) in map; awaiting AMCL confirmation")

    def validate(self):
        now = time.monotonic()
        sim_stamp = self.get_clock().now().nanoseconds
        timeout = self.settings["freshness_timeout"]
        for name, vehicle in self.vehicles.items():
            vehicle.position_error = vehicle.yaw_error = vehicle.measurement_skew = None
            reason = None
            if vehicle.truth is None or now - vehicle.truth_received > timeout:
                reason = "gazebo_reference_unavailable"
            elif sim_stamp <= 0 or abs(sim_stamp - vehicle.truth_stamp) / 1e9 > timeout:
                reason = "gazebo_reference_clock_stale"
            elif (not vehicle.scan_received or now - vehicle.scan_received > timeout
                  or not 0.0 <= (sim_stamp - vehicle.scan_stamp) / 1e9 <= timeout):
                reason = "lidar_unavailable"
            if reason is not None:
                vehicle.state = "waiting"
                vehicle.reason = reason
                vehicle.good_samples = vehicle.bad_samples = vehicle.mismatch_samples = 0
                vehicle.transform_wait_started = 0.0
                self.publish_status(name)
                continue

            # Force a scan update while stopped. AMCL normally waits for
            # translation/rotation before publishing another amcl_pose.
            if vehicle.state != "ready":
                self.request_scan_update(name, now)
            if not vehicle.amcl_received and not vehicle.reset_required:
                self.begin_recovery(name, "amcl_pose_unavailable", now, vehicle.truth_stamp)

            transform = None
            if vehicle.amcl_received:
                try:
                    transform = self.tf_buffer.lookup_transform("map", f"{name}/base_link", Time())
                except TransformException:
                    pass
            if transform is not None:
                stamp = Time.from_msg(transform.header.stamp).nanoseconds
                skew = abs(stamp - vehicle.truth_stamp) / 1e9
                if skew <= self.settings["maximum_time_skew"]:
                    translation = transform.transform.translation
                    estimated = (translation.x, translation.y, yaw_of(transform.transform.rotation))
                    if all(math.isfinite(value) for value in estimated):
                        vehicle.position_error = math.dist(estimated[:2], vehicle.truth[:2])
                        vehicle.yaw_error = angle_distance(estimated[2], vehicle.truth[2])
                        vehicle.measurement_skew = skew
                if vehicle.position_error is not None and stamp != vehicle.checked_stamp:
                    vehicle.checked_stamp = stamp
                    good = pose_within_drive_tolerance(vehicle, self.settings)
                    bad = (vehicle.position_error > self.settings["recovery_position_error"]
                           or vehicle.yaw_error > self.settings["recovery_yaw_error"])
                    # A pre-reset AMCL message/TF must never release the interlock.
                    confirmed_reset = (not vehicle.reset_required or (
                        vehicle.reset_received > 0.0
                        and vehicle.amcl_received > vehicle.reset_received
                        and vehicle.amcl_stamp > vehicle.reset_stamp
                        and stamp >= vehicle.amcl_stamp))
                    required = int(self.settings["confirmation_samples"])
                    vehicle.good_samples = (
                        min(vehicle.good_samples + 1, required) if good and confirmed_reset else 0)
                    vehicle.bad_samples = min(vehicle.bad_samples + 1, required) if bad else 0
                    vehicle.mismatch_samples = (
                        min(vehicle.mismatch_samples + 1, 2 * required) if not good else 0)
                    if vehicle.good_samples >= self.settings["confirmation_samples"]:
                        if vehicle.state != "ready":
                            self.get_logger().info(f"{name}: AMCL agrees with Gazebo; driving released")
                        vehicle.state = "ready"
                        vehicle.reason = "gazebo_confirmed"
                        vehicle.reset_required = False
                    elif not good and vehicle.state == "ready":
                        vehicle.state = "validating"
                        vehicle.reason = "pose_mismatch"
                    if ((vehicle.bad_samples >= required
                         or vehicle.mismatch_samples >= 2 * required)
                            and not vehicle.reset_required):
                        self.begin_recovery(name, "amcl_pose_mismatch", now, vehicle.truth_stamp)

            if vehicle.position_error is None:
                if not vehicle.transform_wait_started:
                    vehicle.transform_wait_started = now
                elif (now - vehicle.transform_wait_started >= 2.0
                      and not vehicle.reset_required):
                    self.begin_recovery(
                        name, "amcl_transform_unavailable", now, vehicle.truth_stamp)
            else:
                vehicle.transform_wait_started = 0.0

            if vehicle.reset_required and vehicle.state != "ready":
                vehicle.state = "relocalizing"
                if vehicle.reset_received:
                    if (vehicle.amcl_received <= vehicle.reset_received
                            or vehicle.amcl_stamp <= vehicle.reset_stamp):
                        vehicle.reason = "waiting_for_amcl_after_reset"
                    elif vehicle.position_error is None:
                        vehicle.reason = "waiting_for_amcl_transform_after_reset"
                    elif not pose_within_drive_tolerance(vehicle, self.settings):
                        vehicle.reason = "amcl_pose_mismatch_after_reset"
                    else:
                        vehicle.reason = "confirming_amcl_pose_after_reset"
                self.reset_amcl(name, now)
            elif vehicle.position_error is None:
                vehicle.state = "waiting"
                vehicle.reason = "amcl_transform_unavailable_or_time_skew"
                vehicle.good_samples = vehicle.bad_samples = vehicle.mismatch_samples = 0
            elif vehicle.state != "ready":
                vehicle.state = "validating"
                vehicle.reason = "confirming_amcl_pose"
            self.publish_status(name)

    def publish_status(self, name):
        vehicle = self.vehicles[name]
        ready = vehicle.state == "ready"
        if not ready:
            self.stop_publishers[name].publish(Twist())
        payload = {
            "vehicle_id": name,
            "state": vehicle.state,
            "reason": vehicle.reason,
            "trigger": vehicle.trigger,
            "drive_allowed": ready,
            "simulation_only": True,
            "reference_source": "gazebo_ground_truth",
            "authoritative_source": "amcl",
            "recovery_generation": vehicle.generation,
            "reset_attempts": vehicle.reset_attempts,
            "position_error_m": vehicle.position_error,
            "yaw_error_rad": vehicle.yaw_error,
            "measurement_skew_s": vehicle.measurement_skew,
            "reference_timestamp_source": "ros_clock_at_receipt",
            "reference_position": None if vehicle.truth is None else {
                "x": vehicle.truth[0], "y": vehicle.truth[1], "yaw": vehicle.truth[2],
                "frame_id": "map",
            },
            "observed_at": time.time(),
        }
        self.status_publishers[name].publish(String(data=json.dumps(payload, allow_nan=False)))


def main(args=None):
    rclpy.init(args=args)
    node = None
    try:
        node = GazeboAmclValidator()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        if node is not None:
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
