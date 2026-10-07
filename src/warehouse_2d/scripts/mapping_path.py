#!/usr/bin/env python3
"""Publish the SLAM vehicle's traveled path in the map frame."""

import math
import time

from geometry_msgs.msg import PoseStamped
from nav_msgs.msg import Path
import rclpy
from rclpy.duration import Duration
from rclpy.node import Node
from rclpy.qos import (
    DurabilityPolicy,
    QoSProfile,
    ReliabilityPolicy,
    qos_profile_sensor_data,
)
from rclpy.time import Time
from sensor_msgs.msg import LaserScan
from tf2_ros import Buffer, TransformException, TransformListener


class MappingPath(Node):
    def __init__(self):
        super().__init__("mapping_path")
        self.declare_parameter("vehicle_name", "vehicle_1")
        self.declare_parameter("min_distance", 0.20)
        self.declare_parameter("max_jump", 2.0)
        self.declare_parameter("max_points", 4000)

        vehicle = str(self.get_parameter("vehicle_name").value)
        self.base_frame = f"{vehicle}/base_link"
        self.min_distance = float(self.get_parameter("min_distance").value)
        self.max_jump = float(self.get_parameter("max_jump").value)
        self.max_points = int(self.get_parameter("max_points").value)
        if not 0.0 < self.min_distance < self.max_jump or self.max_points < 2:
            raise ValueError("invalid mapping path spacing, jump, or point limit")

        self.path = Path()
        self.path.header.frame_id = "map"
        self.last_scan_at = None
        self.tf_buffer = Buffer(cache_time=Duration(seconds=10.0))
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.publisher = self.create_publisher(
            Path,
            f"/traffic/{vehicle}/mapping_path",
            QoSProfile(
                depth=1,
                reliability=ReliabilityPolicy.RELIABLE,
                durability=DurabilityPolicy.TRANSIENT_LOCAL,
            ),
        )
        self.create_subscription(
            LaserScan,
            f"/traffic/{vehicle}/scan",
            self.on_scan,
            qos_profile_sensor_data,
        )
        self.create_timer(0.2, self.record_pose)
        self.get_logger().info(
            f"Publishing scanned route on /traffic/{vehicle}/mapping_path"
        )

    def on_scan(self, _message):
        self.last_scan_at = time.monotonic()

    def record_pose(self):
        if self.last_scan_at is None or time.monotonic() - self.last_scan_at > 2.0:
            return
        try:
            transform = self.tf_buffer.lookup_transform(
                "map", self.base_frame, Time()
            )
        except TransformException:
            return

        position = transform.transform.translation
        if not math.isfinite(position.x) or not math.isfinite(position.y):
            return
        if self.path.poses:
            previous = self.path.poses[-1].pose.position
            distance = math.hypot(position.x - previous.x, position.y - previous.y)
            if distance < self.min_distance:
                return
            if distance > self.max_jump:
                # A relocalization or teleported vehicle must not draw a
                # misleading line across the warehouse.
                self.path.poses.clear()

        pose = PoseStamped()
        pose.header.frame_id = "map"
        pose.header.stamp = transform.header.stamp
        pose.pose.position.x = position.x
        pose.pose.position.y = position.y
        pose.pose.position.z = 0.0
        pose.pose.orientation = transform.transform.rotation
        self.path.poses.append(pose)
        if len(self.path.poses) > self.max_points:
            del self.path.poses[:len(self.path.poses) - self.max_points]
        self.path.header.stamp = self.get_clock().now().to_msg()
        self.publisher.publish(self.path)


def main(args=None):
    rclpy.init(args=args)
    node = MappingPath()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
