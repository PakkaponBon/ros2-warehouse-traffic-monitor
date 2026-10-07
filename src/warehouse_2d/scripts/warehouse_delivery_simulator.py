#!/usr/bin/env python3
"""Drive a warehouse fleet on coordinated roaming routes or delivery jobs."""

import json
import math
import time

from geometry_msgs.msg import Point
import rclpy
from rclpy.duration import Duration
from rclpy.qos import DurabilityPolicy, QoSProfile
from rclpy.time import Time
from std_msgs.msg import String
from tf2_ros import Buffer, TransformException, TransformListener
from visualization_msgs.msg import Marker, MarkerArray

from delivery_tasks import DeliveryFleet, load_delivery_config, transform_xy
from grid_planner import FleetRoamingPlanner
from traffic_simulator import TrafficSimulator


class WarehouseDeliverySimulator(TrafficSimulator):
    # The base class supplies A*, LiDAR avoidance, vehicle yielding and commands.
    # Goals come from either the coordinated roaming planner or delivery queue.
    PROFILES = {
        "warehouse_delivery": {
            "starts": ((-24.0, -2.4), (24.0, -2.4), (-24.0, 25.2), (24.0, 25.2)),
            "map_navigation": True,
            "random_vehicle": "none",
            "fixed_routes": ((), (), (), ()),
        },
        "warehouse_roads": {
            "starts": ((-25.0, 0.0), (25.0, 0.0), (-25.0, 24.0), (25.0, -24.8),
                       (-35.0, 0.0), (35.0, 0.0), (-35.0, 24.0), (35.0, -24.8)),
            "map_navigation": True,
            "random_vehicle": "none",
            "fixed_routes": ((), (), (), (), (), (), (), ()),
        },
    }

    def __init__(self):
        super().__init__()
        self.declare_parameter("traffic_mode", "auto")
        mode = str(self.get_parameter("traffic_mode").value)
        if mode == "auto":
            mode = "roam" if self.get_parameter("profile").value == "warehouse_roads" else "jobs"
        if mode not in {"roam", "jobs"}:
            raise ValueError("traffic_mode must be auto, roam, or jobs")
        self.roaming = FleetRoamingPlanner(self.planner, self.random) if mode == "roam" else None
        self.declare_parameter("delivery_config", "")
        self.declare_parameter("world_to_map_x", 0.0)
        self.declare_parameter("world_to_map_y", 0.0)
        self.declare_parameter("world_to_map_yaw", 0.0)
        self.alignment = tuple(float(self.get_parameter(key).value) for key in
                               ("world_to_map_x", "world_to_map_y", "world_to_map_yaw"))
        config = load_delivery_config(self.get_parameter("delivery_config").value)
        self.fleet = DeliveryFleet(config, self.states, self.alignment)
        self.motion = dict.fromkeys(self.states, "localizing")
        component = None
        for station, entry in self.fleet.stations.items():
            configured_point = entry["point"]
            cell = self.planner.nearest_free(*configured_point, maximum_radius=3)
            if self.roaming is not None:
                entry["goal_offset_m"] = 0.0
                continue
            if cell is None or math.dist(configured_point, self.planner.cell_to_world(cell)) > 0.35:
                raise ValueError(f"Dock {station} is blocked in this map; check map alignment")
            if component is None:
                component = self.planner.component_for[cell]
            if self.planner.component_for[cell] != component:
                raise ValueError(f"Dock {station} is disconnected from the delivery aisles")
            entry["configured_point"] = configured_point
            entry["point"] = self.planner.cell_to_world(cell)
            entry["goal_offset_m"] = math.dist(configured_point, entry["point"])
        self.tf_buffer = Buffer(cache_time=Duration(seconds=10.0))
        self.tf_listener = TransformListener(self.tf_buffer, self)
        qos = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.delivery_publisher = self.create_publisher(String, "/traffic/delivery/status", qos)
        self.marker_publisher = self.create_publisher(MarkerArray, "/traffic/delivery/markers", qos)
        self.create_timer(0.5, self.publish_delivery_status)
        self.get_logger().info(
            f"Warehouse fleet ready: mode={mode}, {len(self.states)} vehicles, "
            f"{len(self.roaming.sectors) if self.roaming else len(self.fleet.stations)} "
            f"{'map sectors' if self.roaming else 'docks'}")

    def on_models(self, message):
        super().on_models(message)
        for name in message.name:
            if name in self.observed:
                x, y, yaw = self.observed[name]
                x, y = transform_xy(x, y, *self.alignment)
                self.observed[name] = (x, y, yaw + self.alignment[2])

    def on_side_task_request(self, message):
        self.get_logger().warning("Warehouse delivery fleet uses the configured pickup/dropoff job queue")

    def step(self):
        # TF combines the latest odometry with AMCL's map correction, including
        # while stopped. A stale amcl_pose alone would deadlock after loading.
        now = time.monotonic()
        if self.pose_source == "amcl":
            for name in self.states:
                try:
                    transform = self.tf_buffer.lookup_transform("map", f"{name}/base_link", Time())
                    stamp = Time.from_msg(transform.header.stamp).nanoseconds
                    age = (self.get_clock().now().nanoseconds - stamp) / 1e9
                    if not -0.5 <= age <= 1.0:
                        continue
                    t, q = transform.transform.translation, transform.transform.rotation
                    yaw = math.atan2(2 * (q.w * q.z + q.x * q.y),
                                     1 - 2 * (q.y * q.y + q.z * q.z))
                    self.observed[name] = (t.x, t.y, yaw)
                    self.observed_at[name] = now
                except TransformException:
                    pass
        for name in self.states:
            if now - self.observed_at.get(name, 0.0) > 1.0:
                self.scans.pop(name, None)
        super().step()

    def _plan_map_route(self, name, state, now):
        if self.roaming is not None:
            dynamic = [p[:2] for other, p in self.observed.items() if other != name]
            path, goal = self.roaming.plan(name, (state["x"], state["y"]), dynamic)
            state.update(path=path, path_index=0, goal=goal, last_replan=now)
            if path:
                state["target"] = path[0]
            return bool(path)
        goal = self.fleet.target(name)
        if goal is None:
            return False
        dynamic = [p[:2] for other, p in self.observed.items() if other != name]
        path, snapped = self.planner.path_to_goal((state["x"], state["y"]), goal, dynamic)
        state.update(path=path, path_index=0, goal=snapped, last_replan=now)
        if not path:
            return False
        state["target"] = path[0]
        return True

    def _map_target(self, name, state, now):
        if self.roaming is not None:
            position = (state["x"], state["y"])
            self.roaming.observe(name, position)
            # Only count time with fresh sensors and localization permission.
            # If an obstruction offers no usable detour, try another goal.
            if (now - state.get("roam_active_at", 0.0) > 2.0
                    or math.dist(position, state.get("roam_progress_xy", position)) >= 0.75):
                state.update(roam_progress_xy=position, roam_progress_at=now)
            state["roam_active_at"] = now
            goal = self.roaming.goals.get(name)
            arrived = goal is not None and math.dist(position, self.planner.cell_to_world(goal)) <= 0.30
            stuck = goal is not None and now - state.get("roam_progress_at", now) >= 45.0
            if arrived or stuck:
                self.roaming.finish(name, reached=arrived)
                state.update(path=[], path_index=0, goal=None, last_replan=0.0,
                             roam_progress_xy=position, roam_progress_at=now)
                if stuck and not arrived:
                    self.get_logger().warning(f"{name}: no progress for 45s; choosing another roaming goal")
            if not state["path"]:
                if now - state["last_replan"] < 1.0 or not self._plan_map_route(name, state, now):
                    return None
            while state["path_index"] < len(state["path"]):
                target = state["path"][state["path_index"]]
                if math.dist(position, target) > 0.20:
                    state["target"] = target
                    return target
                state["path_index"] += 1
            state["path"] = []
            return None
        sim_now = self.get_clock().now().nanoseconds / 1e9
        task = self.fleet.tasks[name]
        if task is None:
            task = self.fleet.assign(name, self.observed)
            if task is None:
                return None
            state.update(path=[], path_index=0, goal=None, last_replan=0.0)
            self.get_logger().info(f"{name}: {task.task_id} {task.pickup} -> {task.dropoff}")
        transition = self.fleet.advance(name, (state["x"], state["y"]), sim_now)
        if transition:
            state.update(path=[], path_index=0, goal=None, last_replan=0.0)
            self.get_logger().info(f"{name}: {task.task_id} {transition}")
        if self.fleet.target(name) is None:
            return None
        if not state["path"]:
            if now - state["last_replan"] < 1.0 or not self._plan_map_route(name, state, now):
                return None
        while state["path_index"] < len(state["path"]):
            target = state["path"][state["path_index"]]
            if math.dist((state["x"], state["y"]), target) > 0.20:
                state["target"] = target
                return target
            state["path_index"] += 1
        # Check physical arrival next tick; consuming a path is not delivery.
        state["path"] = []
        return None

    def _publish_control(self, name, speed=0.0, turn=0.0, motion_state="idle"):
        if hasattr(self, "fleet") and self.roaming is None and motion_state == "planning":
            task = self.fleet.tasks[name]
            motion_state = task.phase if task and task.phase in {"loading", "unloading"} else (
                "planning" if task else "idle")
        if hasattr(self, "motion"):
            self.motion[name] = motion_state
        super()._publish_control(name, speed, turn, motion_state)

    def publish_delivery_status(self):
        statuses = []
        for name in self.states:
            status = self.fleet.vehicle_status(name)
            status["motion_state"] = self.motion[name]
            position = self.observed.get(name)
            status["position"] = None if position is None else {"x": position[0], "y": position[1]}
            task = self.fleet.tasks[name]
            goal = self.fleet.target(name)
            if self.roaming is not None:
                cell = self.roaming.goals.get(name)
                goal = None if cell is None else self.planner.cell_to_world(cell)
                status.update(phase="roaming", completed_goals=self.roaming.completed[name])
            status["status"] = status["phase"]
            if goal is None and task:
                goal = self.fleet.stations[task.dropoff if task.carrying else task.pickup]["point"]
            status["destination"] = None if goal is None else {"x": goal[0], "y": goal[1]}
            if self.roaming is not None:
                state = self.states[name]
                status["route"] = [{"x": x, "y": y} for x, y in state["path"][state["path_index"]:]]
            self.task_status_publishers[name].publish(String(data=json.dumps(status)))
            statuses.append(status)
        snapshot = {
            "simulation_only": True, "sim_time": self.get_clock().now().nanoseconds / 1e9,
            "observed_at": time.time(), "mode": "roam" if self.roaming else "jobs",
            "pending_jobs": 0 if self.roaming else len(self.fleet.pending),
            "coverage": None if self.roaming is None else {
                "visited_sectors": len(self.roaming.visited),
                "reachable_sectors": len({key for key in self.roaming.sectors
                    if key[0] in {self.planner.component_for[cell] for cell in self.roaming.last_position.values()}})},
            "vehicles": statuses,
            "stations": [{"id": key, "label": entry["label"], "x": entry["point"][0],
                          "y": entry["point"][1], "goal_offset_m": entry["goal_offset_m"]}
                         for key, entry in self.fleet.stations.items()] if self.roaming is None else [],
        }
        self.delivery_publisher.publish(String(data=json.dumps(snapshot)))
        self.publish_markers(statuses)

    def publish_markers(self, statuses):
        markers = [Marker(action=Marker.DELETEALL)]

        def add(namespace, index, kind, x, y, z, scale, color, text=""):
            marker = Marker()
            marker.header.frame_id = "map"
            marker.header.stamp = self.get_clock().now().to_msg()
            marker.ns, marker.id, marker.type = namespace, index, kind
            marker.pose.position.x, marker.pose.position.y, marker.pose.position.z = float(x), float(y), float(z)
            marker.pose.orientation.w = 1.0
            marker.scale.x, marker.scale.y, marker.scale.z = scale
            marker.color.r, marker.color.g, marker.color.b, marker.color.a = color
            marker.text = text
            markers.append(marker)
            return marker

        for index, entry in enumerate(self.fleet.stations.values() if self.roaming is None else []):
            x, y = entry["point"]
            add("docks", index, Marker.CYLINDER, x, y, 0.03, (0.7, 0.7, 0.06), (0.0, 0.8, 0.7, 0.6))
            add("dock_labels", index, Marker.TEXT_VIEW_FACING, x, y, 0.8,
                (0.0, 0.0, 0.3), (0.8, 1.0, 1.0, 1.0), entry["label"])
        for index, status in enumerate(statuses):
            name = status["vehicle_id"]
            if name not in self.observed:
                continue
            x, y, yaw = self.observed[name]
            arrow = add("vehicles", index, Marker.ARROW, x, y, 0.25,
                        (1.1, 0.45, 0.45), (1.0, 0.65, 0.1, 1.0))
            arrow.pose.orientation.z, arrow.pose.orientation.w = math.sin(yaw / 2), math.cos(yaw / 2)
            label = f"{name}: {status['phase']}\n{status['pickup'] or '-'} -> {status['dropoff'] or '-'}"
            if self.roaming is not None:
                goal = status["destination"]
                label = f"{name}: roaming" + (f"\nGoal ({goal['x']:.1f}, {goal['y']:.1f})" if goal else "")
            add("jobs", index, Marker.TEXT_VIEW_FACING, x, y, 1.8,
                (0.0, 0.0, 0.30), (1.0, 1.0, 1.0, 1.0), label)
            if status["carrying"]:
                add("cargo", index, Marker.CUBE, x + 0.45 * math.cos(yaw),
                    y + 0.45 * math.sin(yaw), 0.55, (0.4, 0.4, 0.4), (0.7, 0.4, 0.15, 1.0))
            path = self.states[name]["path"][self.states[name]["path_index"]:]
            if path:
                line = add("paths", index, Marker.LINE_STRIP, 0.0, 0.0, 0.0,
                           (0.06, 0.0, 0.0), ((0.25 + index * 0.37) % 0.8 + 0.2,
                            (0.35 + index * 0.53) % 0.8 + 0.2, (0.45 + index * 0.29) % 0.8 + 0.2, 0.9))
                line.points = [Point(x=float(px), y=float(py), z=0.08) for px, py in [(x, y), *path]]
        self.marker_publisher.publish(MarkerArray(markers=markers))


def main(args=None):
    rclpy.init(args=args)
    node = None
    try:
        node = WarehouseDeliverySimulator()
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        if node is not None:
            if rclpy.ok():
                for name in node.states:
                    node._publish_control(name)
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
