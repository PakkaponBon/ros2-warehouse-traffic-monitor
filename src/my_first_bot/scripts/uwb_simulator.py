#!/usr/bin/env python3
"""
Simulate fixed-tag UWB ranging and 2-D multilateration per vehicle.

Gazebo is used only to generate synthetic ranges. The published UWB position is
solved from those noisy ranges and the surveyed tag registry; it is not a noisy
copy of the Gazebo position. UWB heading is deliberately left unknown.
"""

import json
import math
from pathlib import Path
import random

from gazebo_msgs.msg import ModelStates
from geometry_msgs.msg import PoseWithCovarianceStamped
import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile
from std_msgs.msg import String
from visualization_msgs.msg import Marker, MarkerArray
import yaml


class UwbSimulator(Node):
    """Emulate a UWB station mounted on every configured vehicle."""

    def __init__(self):
        super().__init__("uwb_simulator")
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("vehicle_prefix", "vehicle_")
        self.declare_parameter("include_main_vehicle", True)
        self.declare_parameter("map_frame", "map")
        self.declare_parameter("update_rate", 10.0)
        self.declare_parameter("range_noise", 0.10)
        self.declare_parameter("tag_dropout_rate", 0.05)
        self.declare_parameter("maximum_range", 45.0)
        self.declare_parameter("minimum_tags", 3)
        self.declare_parameter("maximum_residual", 1.0)
        self.declare_parameter("station_height", 0.8)
        self.declare_parameter("tag_config", "")
        self.declare_parameter("world_to_map_x", 0.0)
        self.declare_parameter("world_to_map_y", 0.0)
        self.declare_parameter("world_to_map_yaw", 0.0)
        self.declare_parameter("seed", 42)

        self.vehicle_count = int(self.get_parameter("vehicle_count").value)
        self.vehicle_prefix = str(self.get_parameter("vehicle_prefix").value)
        self.map_frame = str(self.get_parameter("map_frame").value)
        self.range_noise = max(0.0, float(self.get_parameter("range_noise").value))
        self.tag_dropout_rate = min(
            1.0, max(0.0, float(self.get_parameter("tag_dropout_rate").value))
        )
        self.maximum_range = max(0.1, float(self.get_parameter("maximum_range").value))
        self.minimum_tags = max(3, int(self.get_parameter("minimum_tags").value))
        self.maximum_residual = max(
            0.0, float(self.get_parameter("maximum_residual").value)
        )
        self.station_height = float(self.get_parameter("station_height").value)
        self.world_to_map_x = float(self.get_parameter("world_to_map_x").value)
        self.world_to_map_y = float(self.get_parameter("world_to_map_y").value)
        self.world_to_map_yaw = float(self.get_parameter("world_to_map_yaw").value)
        self.random = random.Random(int(self.get_parameter("seed").value))
        self.tags = self.load_tags(str(self.get_parameter("tag_config").value))

        self.vehicle_names = [
            f"{self.vehicle_prefix}{index}"
            for index in range(1, self.vehicle_count + 1)
        ]
        if bool(self.get_parameter("include_main_vehicle").value):
            self.vehicle_names.insert(0, "my_robot")

        transient = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.tag_publisher = self.create_publisher(
            MarkerArray, "/traffic/uwb_tags", transient
        )
        self.pose_publishers = {}
        self.status_publishers = {}
        self.id_publishers = {}
        self.device_ids = {}
        for vehicle_name in self.vehicle_names:
            topic_root = f"/traffic/{vehicle_name}"
            self.pose_publishers[vehicle_name] = self.create_publisher(
                PoseWithCovarianceStamped, f"{topic_root}/uwb_pose", 10
            )
            self.status_publishers[vehicle_name] = self.create_publisher(
                String, f"{topic_root}/uwb_status", 10
            )
            self.id_publishers[vehicle_name] = self.create_publisher(
                String, f"{topic_root}/uwb_id", transient
            )
            if vehicle_name == "my_robot":
                device_id = "UWB-AMR-001"
            else:
                vehicle_number = int(vehicle_name.rsplit("_", 1)[1])
                device_id = f"UWB-{vehicle_number:03d}"
            self.device_ids[vehicle_name] = device_id
            self.id_publishers[vehicle_name].publish(String(data=device_id))

        self.publish_tag_markers()

        self.positions = {}
        self.create_subscription(ModelStates, "/gazebo/model_states", self.on_models, 10)
        rate = max(0.1, float(self.get_parameter("update_rate").value))
        self.create_timer(1.0 / rate, self.publish_fixes)
        self.get_logger().info(
            f"UWB ranging enabled for {len(self.vehicle_names)} vehicles; "
            f"{len(self.tags)} fixed tags loaded; range noise={self.range_noise:.3f} m; "
            f"dropout={self.tag_dropout_rate:.1%}"
        )

    @staticmethod
    def load_tags(config_value):
        """Load surveyed tag positions and health metadata."""
        path = Path(config_value).expanduser() if config_value else None
        if path is None or not path.is_file():
            return []
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        tags = []
        for value in payload.get("tags", []):
            tags.append(
                {
                    "id": str(value["id"]),
                    "x": float(value["x"]),
                    "y": float(value["y"]),
                    "z": float(value.get("z", 0.0)),
                    "enabled": bool(value.get("enabled", True)),
                    "battery_pct": max(
                        0.0, min(100.0, float(value.get("battery_pct", 100.0)))
                    ),
                }
            )
        return tags

    def publish_tag_markers(self):
        """Publish the fixed tag registry for RViz using the map frame."""
        markers = MarkerArray()
        stamp = self.get_clock().now().to_msg()
        for index, tag in enumerate(self.tags):
            body = Marker()
            body.header.frame_id = self.map_frame
            body.header.stamp = stamp
            body.ns = "uwb_tags"
            body.id = index * 2
            body.type = Marker.CUBE
            body.action = Marker.ADD
            body.pose.position.x = tag["x"]
            body.pose.position.y = tag["y"]
            body.pose.position.z = tag["z"]
            body.pose.orientation.w = 1.0
            body.scale.x = 0.28
            body.scale.y = 0.10
            body.scale.z = 0.20
            body.color.r = 0.95
            body.color.g = 0.20
            body.color.b = 0.95
            body.color.a = 1.0 if tag["enabled"] else 0.25
            markers.markers.append(body)

            label = Marker()
            label.header.frame_id = self.map_frame
            label.header.stamp = stamp
            label.ns = "uwb_tag_labels"
            label.id = index * 2 + 1
            label.type = Marker.TEXT_VIEW_FACING
            label.action = Marker.ADD
            label.pose.position.x = tag["x"]
            label.pose.position.y = tag["y"]
            label.pose.position.z = tag["z"] + 0.35
            label.pose.orientation.w = 1.0
            label.scale.z = 0.25
            label.color.r = 1.0
            label.color.g = 0.65
            label.color.b = 1.0
            label.color.a = 1.0
            label.text = tag["id"]
            markers.markers.append(label)
        self.tag_publisher.publish(markers)

    def on_models(self, message):
        """Cache true world positions used only to synthesize tag ranges."""
        for name, pose in zip(message.name, message.pose):
            if name in self.pose_publishers:
                self.positions[name] = (
                    float(pose.position.x),
                    float(pose.position.y),
                )

    def to_map(self, x, y):
        """Apply the same world-to-map transform used by traffic recording."""
        cosine = math.cos(self.world_to_map_yaw)
        sine = math.sin(self.world_to_map_yaw)
        return (
            self.world_to_map_x + cosine * x - sine * y,
            self.world_to_map_y + sine * x + cosine * y,
        )

    def simulate_ranges(self, map_x, map_y):
        """Generate noisy 3-D ranges and derive planar ranges for the solver."""
        observations = []
        for tag in self.tags:
            if not tag["enabled"] or tag["battery_pct"] <= 0.0:
                continue
            if self.random.random() < self.tag_dropout_rate:
                continue

            dx = map_x - tag["x"]
            dy = map_y - tag["y"]
            dz = self.station_height - tag["z"]
            true_range = math.sqrt(dx * dx + dy * dy + dz * dz)
            if true_range > self.maximum_range:
                continue

            measured_range = max(
                0.05, true_range + self.random.gauss(0.0, self.range_noise)
            )
            planar_squared = measured_range * measured_range - dz * dz
            if planar_squared <= 0.0:
                continue
            observations.append(
                {
                    "tag": tag,
                    "distance_m": measured_range,
                    "planar_m": math.sqrt(planar_squared),
                }
            )
        return observations

    @staticmethod
    def multilaterate(observations):
        """Solve a linearized least-squares 2-D multilateration problem."""
        reference = observations[0]
        x0 = reference["tag"]["x"]
        y0 = reference["tag"]["y"]
        r0 = reference["planar_m"]

        normal_xx = 0.0
        normal_xy = 0.0
        normal_yy = 0.0
        right_x = 0.0
        right_y = 0.0
        for observation in observations[1:]:
            tag = observation["tag"]
            radius = observation["planar_m"]
            row_x = 2.0 * (tag["x"] - x0)
            row_y = 2.0 * (tag["y"] - y0)
            result = (
                r0 * r0
                - radius * radius
                + tag["x"] * tag["x"]
                - x0 * x0
                + tag["y"] * tag["y"]
                - y0 * y0
            )
            normal_xx += row_x * row_x
            normal_xy += row_x * row_y
            normal_yy += row_y * row_y
            right_x += row_x * result
            right_y += row_y * result

        determinant = normal_xx * normal_yy - normal_xy * normal_xy
        if abs(determinant) < 1.0e-9:
            return None
        x = (right_x * normal_yy - right_y * normal_xy) / determinant
        y = (normal_xx * right_y - normal_xy * right_x) / determinant
        squared_errors = []
        for observation in observations:
            tag = observation["tag"]
            predicted = math.hypot(x - tag["x"], y - tag["y"])
            squared_errors.append((predicted - observation["planar_m"]) ** 2)
        residual = math.sqrt(sum(squared_errors) / len(squared_errors))
        return x, y, residual

    def publish_fixes(self):
        """Publish a solved position and ranging status for every vehicle."""
        stamp = self.get_clock().now().to_msg()
        for vehicle_name, (world_x, world_y) in self.positions.items():
            true_map_x, true_map_y = self.to_map(world_x, world_y)
            observations = self.simulate_ranges(true_map_x, true_map_y)
            solution = None
            reason = "insufficient_tags"
            if len(observations) >= self.minimum_tags:
                solution = self.multilaterate(observations)
                reason = "poor_geometry" if solution is None else "ok"

            fix_valid = solution is not None
            residual = None
            if solution is not None:
                solved_x, solved_y, residual = solution
                if residual > self.maximum_residual:
                    fix_valid = False
                    reason = "poor_fit"

            status = {
                "vehicle_id": vehicle_name,
                "device_id": self.device_ids[vehicle_name],
                "visible_tag_count": len(observations),
                "visible_tags": [item["tag"]["id"] for item in observations],
                "ranges": [
                    {
                        "tag_id": item["tag"]["id"],
                        "distance_m": round(item["distance_m"], 3),
                        "battery_pct": item["tag"]["battery_pct"],
                    }
                    for item in observations
                ],
                "fix_valid": fix_valid,
                "residual_m": None if residual is None else round(residual, 3),
                "reason": reason,
            }
            self.status_publishers[vehicle_name].publish(
                String(data=json.dumps(status, separators=(",", ":")))
            )

            if not fix_valid:
                continue
            message = PoseWithCovarianceStamped()
            message.header.stamp = stamp
            message.header.frame_id = self.map_frame
            message.pose.pose.position.x = solved_x
            message.pose.pose.position.y = solved_y
            message.pose.pose.position.z = self.station_height
            message.pose.pose.orientation.w = 1.0
            variance = max(self.range_noise * self.range_noise, residual * residual)
            message.pose.covariance[0] = variance
            message.pose.covariance[7] = variance
            message.pose.covariance[14] = 1.0
            # A single UWB station provides position, not a trustworthy yaw.
            message.pose.covariance[35] = 1.0e6
            self.pose_publishers[vehicle_name].publish(message)


def main(args=None):
    rclpy.init(args=args)
    node = UwbSimulator()
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
