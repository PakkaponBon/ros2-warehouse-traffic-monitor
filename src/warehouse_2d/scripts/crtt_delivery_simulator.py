#!/usr/bin/env python3
"""Drive a CRTT fleet through pickup/loading/delivery/unloading jobs."""

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
from traffic_simulator import TrafficSimulator


class CrttDeliverySimulator(TrafficSimulator):
    # The base class supplies A*, LiDAR avoidance, vehicle yielding and commands.
    # Its loop routes are unused: all goals come from the delivery queue below.
    PROFILES = {
        "crtt_delivery": {
            "starts": ((-16.0, 11.4), (-6.0, 11.4), (7.0, 11.4), (18.0, 11.4)),
            "map_navigation": True,
            "random_vehicle": "none",
            "fixed_routes": ((), (), (), ()),
        },
    }

    def __init__(self):
        super().__init__()
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
            cell = self.planner.nearest_free(*entry["point"], maximum_radius=3)
            if cell is None or math.dist(entry["point"], self.planner.cell_to_world(cell)) > 0.35:
                raise ValueError(f"Dock {station} is blocked in this map; check map alignment")
            if component is None:
                component = self.planner.component_for[cell]
            if self.planner.component_for[cell] != component:
                raise ValueError(f"Dock {station} is disconnected from the delivery aisles")
            entry["point"] = self.planner.cell_to_world(cell)
        self.tf_buffer = Buffer(cache_time=Duration(seconds=10.0))
        self.tf_listener = TransformListener(self.tf_buffer, self)
        qos = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.delivery_publisher = self.create_publisher(String, "/traffic/delivery/status", qos)
        self.marker_publisher = self.create_publisher(MarkerArray, "/traffic/delivery/markers", qos)
        self.create_timer(0.5, self.publish_delivery_status)
        self.get_logger().info(
            f"CRTT delivery queue ready: {len(self.fleet.stations)} docks, "
            f"{len(self.fleet.pending)} job types, {len(self.states)} forklifts")

    def on_models(self, message):
        super().on_models(message)
        for name in message.name:
            if name in self.observed:
                x, y, yaw = self.observed[name]
                x, y = transform_xy(x, y, *self.alignment)
                self.observed[name] = (x, y, yaw + self.alignment[2])

    def on_side_task_request(self, message):
        self.get_logger().warning("CRTT delivery fleet uses the configured pickup/dropoff job queue")

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
        if hasattr(self, "fleet") and motion_state == "planning":
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
            status["status"] = status["phase"]
            task = self.fleet.tasks[name]
            goal = self.fleet.target(name)
            if goal is None and task:
                goal = self.fleet.stations[task.dropoff if task.carrying else task.pickup]["point"]
            status["destination"] = None if goal is None else {"x": goal[0], "y": goal[1]}
            self.task_status_publishers[name].publish(String(data=json.dumps(status)))
            statuses.append(status)
        snapshot = {
            "simulation_only": True, "sim_time": self.get_clock().now().nanoseconds / 1e9,
            "observed_at": time.time(), "pending_jobs": len(self.fleet.pending),
            "vehicles": statuses,
            "stations": [{"id": key, "label": entry["label"], "x": entry["point"][0],
                          "y": entry["point"][1]} for key, entry in self.fleet.stations.items()],
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

        for index, entry in enumerate(self.fleet.stations.values()):
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
            add("jobs", index, Marker.TEXT_VIEW_FACING, x, y, 1.8,
                (0.0, 0.0, 0.30), (1.0, 1.0, 1.0, 1.0), label)
            if status["carrying"]:
                add("cargo", index, Marker.CUBE, x + 0.45 * math.cos(yaw),
                    y + 0.45 * math.sin(yaw), 0.55, (0.4, 0.4, 0.4), (0.7, 0.4, 0.15, 1.0))
            path = self.states[name]["path"][self.states[name]["path_index"]:]
            if path:
                line = add("paths", index, Marker.LINE_STRIP, 0.0, 0.0, 0.0,
                           (0.04, 0.0, 0.0), (0.2, 0.6, 1.0, 0.8))
                line.points = [Point(x=float(px), y=float(py), z=0.08) for px, py in [(x, y), *path]]
        self.marker_publisher.publish(MarkerArray(markers=markers))


def main(args=None):
    rclpy.init(args=args)
    node = None
    try:
        node = CrttDeliverySimulator()
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
