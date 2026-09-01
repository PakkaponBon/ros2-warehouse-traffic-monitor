#!/usr/bin/env python3
"""Spawn a traffic vehicle with namespaced LiDAR, odometry, and TF frames."""

import math
from pathlib import Path
import random

from gazebo_msgs.srv import SpawnEntity
from geometry_msgs.msg import Pose
import rclpy
from rclpy.node import Node

from grid_planner import OccupancyGridPlanner


def render_model(template, namespace, vehicle_name):
    """Substitute the per-vehicle ROS namespace and frame names."""
    frame_prefix = vehicle_name
    replacements = {
        "__ROBOT_NAMESPACE__": namespace.rstrip("/"),
        "__ODOM_FRAME__": f"{frame_prefix}/odom",
        "__BASE_FRAME__": f"{frame_prefix}/base_link",
        "__LASER_FRAME__": f"{frame_prefix}/laser",
    }
    rendered = template
    for marker, value in replacements.items():
        rendered = rendered.replace(marker, value)
    return rendered


def select_random_poses(planner, requested, seed, minimum_separation=3.0):
    """Select deterministic, mutually separated poses in the largest region."""
    if not planner.components:
        raise RuntimeError("warehouse map has no free component for spawning")
    cells = list(max(planner.components.values(), key=len))
    generator = random.Random(int(seed))
    generator.shuffle(cells)
    selected = []
    for cell in cells:
        x, y = planner.cell_to_world(cell)
        if any(
            math.hypot(x - other_x, y - other_y) < float(minimum_separation)
            for other_x, other_y, _yaw in selected
        ):
            continue
        selected.append((x, y, generator.uniform(-math.pi, math.pi)))
        if len(selected) >= int(requested):
            break
    return selected


class LocalizedVehicleSpawner(Node):
    def __init__(self):
        super().__init__("spawn_localized_vehicle")
        self.declare_parameter("entity", "vehicle_1")
        self.declare_parameter("robot_namespace", "/traffic/vehicle_1")
        self.declare_parameter("template", "")
        self.declare_parameter("x", 0.0)
        self.declare_parameter("y", 0.0)
        self.declare_parameter("z", 0.3)
        self.declare_parameter("yaw", 0.0)
        self.declare_parameter("random_start", False)
        self.declare_parameter("map_yaml", "")
        self.declare_parameter("spawn_index", 0)
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("random_seed", 42)
        self.declare_parameter("minimum_separation", 3.0)

    def random_pose(self):
        """Choose this vehicle's deterministic, collision-clear random pose."""
        map_yaml = str(self.get_parameter("map_yaml").value)
        if not map_yaml:
            raise ValueError("map_yaml is required when random_start is enabled")
        planner = OccupancyGridPlanner.from_yaml(
            map_yaml, planning_resolution=0.30, robot_radius=0.80
        )
        minimum_separation = float(self.get_parameter("minimum_separation").value)
        requested = int(self.get_parameter("vehicle_count").value)
        selected = select_random_poses(
            planner,
            requested,
            int(self.get_parameter("random_seed").value),
            minimum_separation,
        )
        index = int(self.get_parameter("spawn_index").value)
        if index < 0 or index >= len(selected):
            raise RuntimeError(
                f"could only find {len(selected)} safe random starts for "
                f"vehicle index {index}"
            )
        return selected[index]

    def spawn(self):
        entity = str(self.get_parameter("entity").value)
        namespace = str(self.get_parameter("robot_namespace").value)
        template_path = Path(str(self.get_parameter("template").value))
        template = template_path.read_text(encoding="utf-8")

        request = SpawnEntity.Request()
        request.name = entity
        request.robot_namespace = namespace
        request.xml = render_model(template, namespace, entity)
        request.initial_pose = Pose()
        if bool(self.get_parameter("random_start").value):
            x, y, yaw = self.random_pose()
        else:
            x = float(self.get_parameter("x").value)
            y = float(self.get_parameter("y").value)
            yaw = float(self.get_parameter("yaw").value)
        request.initial_pose.position.x = x
        request.initial_pose.position.y = y
        request.initial_pose.position.z = float(self.get_parameter("z").value)
        request.initial_pose.orientation.z = math.sin(yaw / 2.0)
        request.initial_pose.orientation.w = math.cos(yaw / 2.0)

        client = self.create_client(SpawnEntity, "/spawn_entity")
        if not client.wait_for_service(timeout_sec=30.0):
            raise RuntimeError("Gazebo /spawn_entity service was not available")
        future = client.call_async(request)
        rclpy.spin_until_future_complete(self, future, timeout_sec=30.0)
        response = future.result()
        if response is None:
            raise RuntimeError(f"Timed out while spawning {entity}")
        if not response.success:
            raise RuntimeError(f"Gazebo refused {entity}: {response.status_message}")
        self.get_logger().info(
            f"Spawned {entity} with 2-D LiDAR at ({request.initial_pose.position.x:.1f}, "
            f"{request.initial_pose.position.y:.1f})"
        )


def main(args=None):
    rclpy.init(args=args)
    node = LocalizedVehicleSpawner()
    try:
        node.spawn()
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
