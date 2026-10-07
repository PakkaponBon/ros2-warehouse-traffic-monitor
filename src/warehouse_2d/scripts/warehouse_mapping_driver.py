#!/usr/bin/env python3
"""Drive one Warehouse mapping vehicle through open demo-world corridors.

Gazebo model states guide only the scripted demo route. slam_toolbox still
builds its map from the vehicle's odometry and 2-D LaserScan, not ground truth.
"""

import math
import time

from gazebo_msgs.msg import ModelStates
from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import LaserScan


# Collision-clear sweeps through the original-width roads and four compact halls.
# The robot records LaserScan/odometry with SLAM; these are navigation waypoints,
# not a precomputed occupancy map.
ROUTE = (
    (-42.0, 24.0), (0.0, 24.0), (42.0, 24.0), (0.0, 24.0),
    (0.0, 3.4), (-42.0, 3.4), (0.0, 3.4), (42.0, 3.4), (0.0, 3.4),
    (0.0, -3.4), (-42.0, -3.4), (0.0, -3.4), (42.0, -3.4), (0.0, -3.4),
    (0.0, -24.0), (-42.0, -24.0), (0.0, -24.0), (42.0, -24.0),
    (0.0, -24.0), (0.0, 24.0),
)


def normalized_angle(angle):
    return (angle + math.pi) % (2.0 * math.pi) - math.pi


class WarehouseMappingDriver(Node):
    def __init__(self):
        super().__init__("warehouse_mapping_driver")
        self.declare_parameter("max_speed", 0.9)
        self.declare_parameter("loop", False)
        self.max_speed = float(self.get_parameter("max_speed").value)
        if not 0.0 < self.max_speed <= 2.0:
            raise ValueError("max_speed must be between 0 and 2 m/s")
        self.loop = bool(self.get_parameter("loop").value)
        self.pose = None
        self.pose_at = 0.0
        self.front_range = None
        self.scan_at = 0.0
        self.target_index = 0
        self.finished = False
        self.last_warning_at = 0.0
        self.command_publisher = self.create_publisher(
            Twist, "/traffic/vehicle_1/cmd_vel", 10
        )
        self.create_subscription(
            ModelStates, "/gazebo/model_states", self.on_models, 10
        )
        self.create_subscription(
            LaserScan,
            "/traffic/vehicle_1/scan",
            self.on_scan,
            qos_profile_sensor_data,
        )
        self.create_timer(0.1, self.step)
        self.get_logger().info(
            f"Warehouse automatic mapping: {len(ROUTE)} waypoints, "
            f"speed <= {self.max_speed:.2f} m/s"
        )

    def on_models(self, message):
        try:
            index = message.name.index("vehicle_1")
        except ValueError:
            return
        pose = message.pose[index]
        orientation = pose.orientation
        yaw = math.atan2(
            2.0 * (orientation.w * orientation.z + orientation.x * orientation.y),
            1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z),
        )
        self.pose = (pose.position.x, pose.position.y, yaw)
        self.pose_at = time.monotonic()

    def on_scan(self, message):
        front = [
            distance
            for index, distance in enumerate(message.ranges)
            if abs(message.angle_min + index * message.angle_increment) < 0.35
            and math.isfinite(distance)
            and message.range_min <= distance <= message.range_max
        ]
        self.front_range = min(front, default=float(message.range_max))
        self.scan_at = time.monotonic()

    def stop(self):
        self.command_publisher.publish(Twist())

    def warn_throttled(self, message):
        now = time.monotonic()
        if now - self.last_warning_at >= 5.0:
            self.get_logger().warning(message)
            self.last_warning_at = now

    def step(self):
        now = time.monotonic()
        if self.finished:
            self.stop()
            return
        if self.pose is None or now - self.pose_at > 2.0:
            self.stop()
            self.warn_throttled("Waiting for fresh Gazebo vehicle pose")
            return
        if self.front_range is None or now - self.scan_at > 2.0:
            self.stop()
            self.warn_throttled("Waiting for fresh vehicle LaserScan")
            return

        x, y, yaw = self.pose
        target_x, target_y = ROUTE[self.target_index]
        distance = math.hypot(target_x - x, target_y - y)
        if distance < 0.20:
            self.target_index += 1
            if self.target_index == len(ROUTE):
                if not self.loop:
                    self.finished = True
                    self.stop()
                    self.get_logger().info(
                        "Warehouse mapping route complete; save /map with map_saver_cli"
                    )
                    return
                self.target_index = 0
            target_x, target_y = ROUTE[self.target_index]
            distance = math.hypot(target_x - x, target_y - y)
            self.get_logger().info(
                f"Mapping waypoint {self.target_index + 1}/{len(ROUTE)}: "
                f"({target_x:.1f}, {target_y:.1f})"
            )

        error = normalized_angle(math.atan2(target_y - y, target_x - x) - yaw)
        command = Twist()
        command.angular.z = max(-1.2, min(1.2, 2.0 * error))
        if abs(error) < 0.15:
            command.linear.x = min(self.max_speed, 0.8 * distance)
            if self.front_range < 1.2:
                command.linear.x = 0.0
                self.warn_throttled(
                    f"Obstacle {self.front_range:.2f} m ahead; mapping vehicle stopped"
                )
        self.command_publisher.publish(command)


def main(args=None):
    rclpy.init(args=args)
    node = WarehouseMappingDriver()
    try:
        rclpy.spin(node)
    finally:
        if rclpy.ok():
            node.stop()
            rclpy.spin_once(node, timeout_sec=0.1)
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
