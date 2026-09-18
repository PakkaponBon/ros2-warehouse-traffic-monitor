#!/usr/bin/env python3
"""Move demo warehouse vehicles along safe traffic routes."""

import json
import math
import random
import time

from geometry_msgs.msg import Twist
from geometry_msgs.msg import PoseWithCovarianceStamped
from gazebo_msgs.msg import ModelStates
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from std_msgs.msg import String

from grid_planner import OccupancyGridPlanner
from simulation_faults import parse_fault_state


def readiness_allows_drive(entry, now, timeout):
    """Return true only for a fresh explicit localization-ready message."""
    if entry is None:
        return False
    payload, received_at = entry
    return (
        now - received_at <= timeout
        and payload.get("state") == "ready"
        and payload.get("drive_allowed") is True
    )


def resolve_random_vehicle(configured, names):
    """Resolve one random-roaming vehicle from a launch-friendly value."""
    allowed = tuple(names)
    if not allowed:
        return None
    value = str(configured or "last").strip()
    if value.lower() == "last":
        return allowed[-1]
    if value.lower() in {"none", "off"}:
        return None
    if value not in allowed:
        raise ValueError(
            f"random_vehicle must be 'last', 'none', or one of {list(allowed)}"
        )
    return value


def parse_side_task_request(message_data, allowed_vehicles):
    """Validate a JSON side-work assignment or cancellation request."""
    try:
        payload = json.loads(message_data)
    except (TypeError, ValueError) as error:
        raise ValueError("side-task request must contain valid JSON") from error
    if not isinstance(payload, dict):
        raise ValueError("side-task request must be a JSON object")

    action = str(payload.get("action", "assign")).strip().lower()
    if action not in {"assign", "cancel"}:
        raise ValueError("side-task action must be 'assign' or 'cancel'")
    vehicle_id = str(payload.get("vehicle_id", "")).strip()
    if vehicle_id not in set(allowed_vehicles):
        raise ValueError(f"vehicle_id '{vehicle_id}' is not configured")
    request = {"action": action, "vehicle_id": vehicle_id}
    if action == "cancel":
        return request

    try:
        x = float(payload["x"])
        y = float(payload["y"])
        dwell_seconds = float(payload.get("dwell_seconds", 5.0))
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("side-task assignment requires numeric x and y") from error
    if not math.isfinite(x) or not math.isfinite(y):
        raise ValueError("side-task x and y must be finite")
    if not math.isfinite(dwell_seconds) or not 0.0 <= dwell_seconds <= 3600.0:
        raise ValueError("dwell_seconds must be between 0 and 3600")
    task_id = str(payload.get("task_id", "")).strip()
    if len(task_id) > 80:
        raise ValueError("task_id must not exceed 80 characters")
    request.update(
        {
            "x": x,
            "y": y,
            "dwell_seconds": dwell_seconds,
            "task_id": task_id,
            "replace": bool(payload.get("replace", False)),
        }
    )
    return request


class TrafficSimulator(Node):
    """Drive existing `vehicle_N` Gazebo models for repeatable traffic."""

    PROFILES = {
        "warehouse_2d": {
            "waypoints": tuple(
                (x, y)
                for y in (-9.0, 0.0, 9.0)
                for x in (-17.0, -4.0, 4.0, 17.0)
            ),
            "starts": (
                (-17.0, -9.0), (-4.0, -9.0), (4.0, -9.0), (17.0, -9.0),
                (17.0, 0.0), (17.0, 9.0), (4.0, 9.0), (-4.0, 9.0),
            ),
        },
        # Seven repeatable loops exercise known warehouse traffic patterns.
        # One configurable vehicle uses random A* goals to add variation.
        # Every leg is still planned over the saved occupancy map.
        "newwarehouse": {
            "starts": (
                (-16.0, -18.0),
                (-4.0, -18.0),
                (8.0, -18.0),
                (9.6, -5.0),
                (10.0, 3.0),
                (9.1, 14.0),
                (4.0, 19.4),
                (-10.0, 19.4),
            ),
            "map_navigation": True,
            "random_vehicle": "last",
            "fixed_routes": (
                ((-18.0, -18.0), (-5.0, -18.0), (-5.0, -12.0), (-18.0, -12.0)),
                ((-24.0, -13.0), (-5.0, -13.0), (-5.0, -8.0), (-24.0, -8.0)),
                ((7.0, -18.0), (21.0, -18.0), (21.0, -13.0), (7.0, -13.0)),
                ((6.0, -8.0), (24.0, -8.0), (24.0, -3.0), (6.0, -3.0)),
                ((6.0, 2.0), (24.0, 2.0), (24.0, 7.0), (6.0, 7.0)),
                ((6.0, 12.0), (20.0, 12.0), (20.0, 17.0), (6.0, 17.0)),
                ((-18.0, 12.0), (-5.0, 12.0), (-5.0, 17.0), (-18.0, 17.0)),
                ((-5.0, -18.0), (5.0, -18.0), (5.0, 18.0), (-5.0, 18.0)),
            ),
        },
    }

    def __init__(self):
        super().__init__("traffic_simulator")
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("max_speed", 0.8)
        self.declare_parameter("update_period", 0.2)
        self.declare_parameter("seed", 42)
        self.declare_parameter("model_prefix", "vehicle_")
        self.declare_parameter("profile", "warehouse_2d")
        self.declare_parameter("pose_source", "gazebo")
        self.declare_parameter("map_yaml", "")
        self.declare_parameter("planning_resolution", 0.30)
        self.declare_parameter("robot_clearance", 0.55)
        self.declare_parameter("avoidance_distance", 1.5)
        self.declare_parameter("emergency_distance", 0.65)
        self.declare_parameter("blocked_replan_time", 3.5)
        self.declare_parameter("pose_timeout", 3.0)
        self.declare_parameter("require_localization_ready", False)
        self.declare_parameter("readiness_timeout", 2.0)
        self.declare_parameter("random_vehicle", "")
        self.vehicle_count = int(self.get_parameter("vehicle_count").value)
        self.max_speed = float(self.get_parameter("max_speed").value)
        self.period = float(self.get_parameter("update_period").value)
        self.prefix = str(self.get_parameter("model_prefix").value)
        self.pose_source = str(self.get_parameter("pose_source").value)
        if self.pose_source not in ("gazebo", "amcl"):
            raise ValueError("pose_source must be 'gazebo' or 'amcl'")
        profile_name = str(self.get_parameter("profile").value)
        if profile_name not in self.PROFILES:
            raise ValueError(
                f"unknown traffic profile '{profile_name}'; "
                f"choose one of {sorted(self.PROFILES)}"
            )
        profile = self.PROFILES[profile_name]
        self.waypoints = profile.get("waypoints", ())
        self.starts = profile["starts"]
        self.loop_route = bool(profile.get("loop", False))
        self.target_indices = profile.get("target_indices")
        self.map_navigation = bool(
            profile.get("map_navigation", profile.get("random_map_navigation", False))
        )
        self.fixed_routes = tuple(profile.get("fixed_routes", ()))
        self.avoidance_distance = float(
            self.get_parameter("avoidance_distance").value
        )
        self.emergency_distance = float(
            self.get_parameter("emergency_distance").value
        )
        self.blocked_replan_time = float(
            self.get_parameter("blocked_replan_time").value
        )
        self.pose_timeout = max(
            0.2, float(self.get_parameter("pose_timeout").value)
        )
        self.require_localization_ready = bool(
            self.get_parameter("require_localization_ready").value
        )
        self.readiness_timeout = max(
            0.5, float(self.get_parameter("readiness_timeout").value)
        )
        self.planner = None
        if self.map_navigation:
            map_yaml = str(self.get_parameter("map_yaml").value)
            if not map_yaml:
                raise ValueError("map_yaml is required for random map navigation")
            self.planner = OccupancyGridPlanner.from_yaml(
                map_yaml,
                self.get_parameter("planning_resolution").value,
                self.get_parameter("robot_clearance").value,
            )
        if not 1 <= self.vehicle_count <= len(self.starts):
            raise ValueError(
                f"vehicle_count must be between 1 and {len(self.starts)} "
                f"for profile '{profile_name}'"
            )
        seed = int(self.get_parameter("seed").value)
        self.random = random.Random(seed)
        names = tuple(
            f"{self.prefix}{index}" for index in range(1, self.vehicle_count + 1)
        )
        configured_random_vehicle = str(
            self.get_parameter("random_vehicle").value
        ).strip() or str(profile.get("random_vehicle", "last"))
        self.random_vehicle = (
            resolve_random_vehicle(configured_random_vehicle, names)
            if self.map_navigation
            else None
        )
        if self.map_navigation and len(self.fixed_routes) < self.vehicle_count:
            raise ValueError(
                f"profile '{profile_name}' needs one fixed route per configured vehicle"
            )
        self.command_publishers = {}
        self.state_publishers = {}
        self.pose_subscriptions = []
        self.scan_subscriptions = []
        self.readiness_subscriptions = []
        self.scans = {}
        self.observed = {}
        self.observed_at = {}
        self.localization_readiness = {}
        self.injected_faults = {}
        self.states = {}
        self.task_sequence = 0
        self.task_event_publisher = self.create_publisher(
            String, "/traffic/task_status", 10
        )
        self.task_status_publishers = {}
        now = time.monotonic()
        for index in range(1, self.vehicle_count + 1):
            point = self.starts[index - 1]
            name = f"{self.prefix}{index}"
            target_index = None
            navigation_mode = "waypoints"
            fixed_route = ()
            if self.map_navigation:
                navigation_mode = "random" if name == self.random_vehicle else "fixed"
                fixed_route = tuple(self.fixed_routes[index - 1])
                target = point
            elif self.loop_route:
                target_index = self.target_indices[index - 1]
                target = self.waypoints[target_index]
            else:
                target = self._new_target(point)
            self.command_publishers[name] = self.create_publisher(
                Twist, f"/traffic/{name}/cmd_vel", 10
            )
            self.state_publishers[name] = self.create_publisher(
                String, f"/traffic/{name}/motion_state", 10
            )
            self.task_status_publishers[name] = self.create_publisher(
                String, f"/traffic/{name}/task_status", 10
            )
            if self.pose_source == "amcl":
                self.pose_subscriptions.append(
                    self.create_subscription(
                        PoseWithCovarianceStamped,
                        f"/traffic/{name}/amcl_pose",
                        lambda message, vehicle=name: self.on_localized_pose(
                            vehicle, message
                        ),
                        10,
                    )
                )
            if self.require_localization_ready:
                self.readiness_subscriptions.append(
                    self.create_subscription(
                        String,
                        f"/traffic/{name}/initialization_status",
                        lambda message, vehicle=name: self.on_localization_readiness(
                            vehicle, message
                        ),
                        10,
                    )
                )
            if self.map_navigation:
                self.scan_subscriptions.append(
                    self.create_subscription(
                        LaserScan,
                        f"/traffic/{name}/scan",
                        lambda message, vehicle=name: self.on_scan(vehicle, message),
                        10,
                    )
                )
            self.states[name] = {
                "x": point[0],
                "y": point[1],
                "target": target,
                "target_index": target_index,
                "last": now,
                "yaw": 0.0,
                "yield_since": None,
                "path": [],
                "path_index": 0,
                "goal": None,
                "blocked_since": None,
                "last_replan": 0.0,
                "navigation_mode": navigation_mode,
                "fixed_route": fixed_route,
                "fixed_route_index": 0,
                "side_task": None,
            }
        self.create_subscription(
            String,
            "/traffic/simulation_faults",
            self.on_simulation_faults,
            10,
        )
        self.create_subscription(
            String,
            "/traffic/task_request",
            self.on_side_task_request,
            10,
        )
        self.create_timer(self.period, self.step)
        if self.pose_source == "gazebo":
            self.create_subscription(
                ModelStates, "/gazebo/model_states", self.on_models, 10
            )
        self.get_logger().info(
            f"Warehouse traffic enabled for {self.vehicle_count} vehicles "
            f"(profile={profile_name}, pose={self.pose_source}, "
            "navigation="
            f"{'fixed loops + one random A* rover' if self.map_navigation else 'waypoints'}, "
            f"random_vehicle={self.random_vehicle or 'none'}, "
            f"speed <= {self.max_speed:.2f} m/s, seed={seed})"
        )

    def on_scan(self, name, message):
        """Cache close obstacle distances in front and on both sides."""
        self.scans[name] = (
            time.monotonic(),
            self._sector_min(message, -0.38, 0.38),
            self._sector_min(message, 0.20, 1.20),
            self._sector_min(message, -1.20, -0.20),
        )

    def on_simulation_faults(self, message):
        """Apply the latest complete simulation fault registry."""
        self.injected_faults = parse_fault_state(message.data, self.states)

    def _publish_task_status(self, name, task, status, reason=""):
        """Publish one fleet-wide and per-vehicle task transition."""
        payload = {
            "vehicle_id": name,
            "task_id": None if task is None else task.get("task_id"),
            "status": status,
            "reason": reason,
            "destination": (
                None
                if task is None
                else {"x": task["destination"][0], "y": task["destination"][1]}
            ),
            "observed_at": time.time(),
        }
        message = String(data=json.dumps(payload, separators=(",", ":")))
        self.task_event_publisher.publish(message)
        if name in self.task_status_publishers:
            self.task_status_publishers[name].publish(message)

    def on_side_task_request(self, message):
        """Temporarily divert one vehicle, then return it to its own route."""
        try:
            request = parse_side_task_request(message.data, self.states)
        except ValueError as error:
            self.get_logger().warning(f"Rejected side-task request: {error}")
            return

        name = request["vehicle_id"]
        state = self.states[name]
        active = state["side_task"]
        if request["action"] == "cancel":
            if active is None:
                self._publish_task_status(name, None, "rejected", "no_active_task")
                return
            state["side_task"] = None
            state["path"] = []
            state["path_index"] = 0
            state["goal"] = None
            state["last_replan"] = 0.0
            self._publish_task_status(name, active, "cancelled", "operator_request")
            self.get_logger().info(f"Cancelled side task {active['task_id']} for {name}")
            return

        if not self.map_navigation:
            self._publish_task_status(name, None, "rejected", "map_navigation_disabled")
            return
        if active is not None and not request["replace"]:
            self._publish_task_status(name, active, "rejected", "task_already_active")
            return
        if active is not None:
            self._publish_task_status(name, active, "cancelled", "replaced")

        self.task_sequence += 1
        task_id = request["task_id"] or f"side-{self.task_sequence}"
        route = state["fixed_route"]
        if state["navigation_mode"] == "fixed" and route:
            resume_goal = route[state["fixed_route_index"]]
        else:
            resume_goal = state["goal"] or (state["x"], state["y"])
        task = {
            "task_id": task_id,
            "destination": (request["x"], request["y"]),
            "dwell_seconds": request["dwell_seconds"],
            "phase": "outbound",
            "work_until": None,
            "resume_goal": resume_goal,
        }
        state["side_task"] = task
        state["path"] = []
        state["path_index"] = 0
        state["goal"] = None
        state["blocked_since"] = None
        state["last_replan"] = 0.0
        self._publish_task_status(name, task, "assigned")
        self.get_logger().info(
            f"Assigned side task {task_id} to {name}: "
            f"({request['x']:.1f}, {request['y']:.1f}) for "
            f"{request['dwell_seconds']:.1f}s"
        )

    @staticmethod
    def _sector_min(message, minimum_angle, maximum_angle):
        values = []
        for index, distance in enumerate(message.ranges):
            angle = message.angle_min + index * message.angle_increment
            if minimum_angle <= angle <= maximum_angle and math.isfinite(distance):
                if message.range_min <= distance <= message.range_max:
                    values.append(distance)
        return min(values, default=float(message.range_max or 20.0))

    def on_localized_pose(self, name, message):
        """Use AMCL map pose as the controller's observed vehicle position."""
        pose = message.pose.pose
        orientation = pose.orientation
        yaw = math.atan2(
            2.0 * (orientation.w * orientation.z + orientation.x * orientation.y),
            1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z),
        )
        self.observed[name] = (pose.position.x, pose.position.y, yaw)
        self.observed_at[name] = time.monotonic()

    def on_localization_readiness(self, name, message):
        """Cache the recovery coordinator's explicit drive permission."""
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            return
        self.localization_readiness[name] = (payload, time.monotonic())

    def on_models(self, message):
        """Cache actual positions so a vehicle can yield to a nearby vehicle."""
        for name, pose in zip(message.name, message.pose):
            if name in self.states:
                orientation = pose.orientation
                yaw = math.atan2(
                    2.0
                    * (orientation.w * orientation.z + orientation.x * orientation.y),
                    1.0
                    - 2.0
                    * (orientation.y * orientation.y + orientation.z * orientation.z),
                )
                self.observed[name] = (pose.position.x, pose.position.y, yaw)
                self.observed_at[name] = time.monotonic()

    @staticmethod
    def _vehicle_number(name):
        """Return a stable right-of-way priority for a vehicle model name."""
        try:
            return int(name.rsplit("_", 1)[1])
        except (IndexError, ValueError):
            return 9999

    def _new_target(self, current):
        # Every move is along one open aisle. This prevents straight-line
        # shortcuts through the shelf collision boxes.
        choices = [
            point
            for point in self.waypoints
            if point != current
            and (abs(point[0] - current[0]) < 0.1 or abs(point[1] - current[1]) < 0.1)
        ]
        return self.random.choice(choices)

    def _plan_random_route(self, name, state, now):
        dynamic = [
            (position[0], position[1])
            for other_name, position in self.observed.items()
            if other_name != name
        ]
        path, goal = self.planner.random_path(
            (state["x"], state["y"]), self.random, dynamic
        )
        state["path"] = path
        state["path_index"] = 0
        state["goal"] = goal
        state["last_replan"] = now
        if not path:
            self.get_logger().warning(
                f"No random route available for {name}; it will retry"
            )
            return False
        state["target"] = path[0]
        self.get_logger().info(
            f"{name} random goal: ({goal[0]:.1f}, {goal[1]:.1f}), "
            f"{len(path)} path segment(s)"
        )
        return True

    def _plan_fixed_route(self, name, state, now):
        route = state["fixed_route"]
        if not route:
            self.get_logger().error(f"No fixed route configured for {name}")
            state["last_replan"] = now
            return False
        # Move to the next loop stop when this vehicle is already at the
        # current one. This also handles a randomized spawn near a route stop.
        for _unused in route:
            requested_goal = route[state["fixed_route_index"]]
            if math.hypot(
                requested_goal[0] - state["x"],
                requested_goal[1] - state["y"],
            ) >= 0.75:
                break
            state["fixed_route_index"] = (
                state["fixed_route_index"] + 1
            ) % len(route)
        requested_goal = route[state["fixed_route_index"]]
        dynamic = [
            (position[0], position[1])
            for other_name, position in self.observed.items()
            if other_name != name
        ]
        path, goal = self.planner.path_to_goal(
            (state["x"], state["y"]), requested_goal, dynamic
        )
        state["path"] = path
        state["path_index"] = 0
        state["goal"] = goal
        state["last_replan"] = now
        if not path:
            self.get_logger().warning(
                f"No fixed route available for {name} to "
                f"({requested_goal[0]:.1f}, {requested_goal[1]:.1f}); it will retry"
            )
            return False
        state["target"] = path[0]
        self.get_logger().info(
            f"{name} fixed stop {state['fixed_route_index'] + 1}/{len(route)}: "
            f"({goal[0]:.1f}, {goal[1]:.1f}), {len(path)} path segment(s)"
        )
        return True

    def _plan_side_task_route(self, name, state, now):
        """Plan the outbound or return leg of an active side-work task."""
        task = state["side_task"]
        if task is None or task["phase"] == "working":
            return False
        requested_goal = (
            task["destination"]
            if task["phase"] == "outbound"
            else task["resume_goal"]
        )
        dynamic = [
            (position[0], position[1])
            for other_name, position in self.observed.items()
            if other_name != name
        ]
        path, goal = self.planner.path_to_goal(
            (state["x"], state["y"]), requested_goal, dynamic
        )
        state["path"] = path
        state["path_index"] = 0
        state["goal"] = goal
        state["last_replan"] = now
        if not path:
            self._publish_task_status(name, task, "planning", "route_unavailable")
            self.get_logger().warning(
                f"No {task['phase']} route for side task {task['task_id']} "
                f"assigned to {name}; it will retry"
            )
            return False
        state["target"] = path[0]
        self.get_logger().info(
            f"{name} side task {task['task_id']} {task['phase']}: "
            f"({goal[0]:.1f}, {goal[1]:.1f}), {len(path)} path segment(s)"
        )
        return True

    def _plan_map_route(self, name, state, now):
        if state["side_task"] is not None:
            return self._plan_side_task_route(name, state, now)
        if state["navigation_mode"] == "random":
            return self._plan_random_route(name, state, now)
        return self._plan_fixed_route(name, state, now)

    def _map_target(self, name, state, now):
        task = state["side_task"]
        if task is not None and task["phase"] == "working":
            if now < task["work_until"]:
                return None
            task["phase"] = "returning"
            state["last_replan"] = 0.0
            self._publish_task_status(name, task, "returning")
        if not state["path"]:
            if now - state["last_replan"] < 1.0:
                return None
            if not self._plan_map_route(name, state, now):
                return None
        while state["path_index"] < len(state["path"]):
            target = state["path"][state["path_index"]]
            if math.hypot(target[0] - state["x"], target[1] - state["y"]) >= 0.5:
                state["target"] = target
                return target
            state["path_index"] += 1
        state["path"] = []
        task = state["side_task"]
        if task is not None and task["phase"] == "outbound":
            task["phase"] = "working"
            task["work_until"] = now + task["dwell_seconds"]
            self._publish_task_status(name, task, "working")
            return None
        if task is not None and task["phase"] == "returning":
            self._publish_task_status(name, task, "completed")
            self.get_logger().info(
                f"{name} completed side task {task['task_id']} and resumed its route"
            )
            state["side_task"] = None
            state["goal"] = None
            state["last_replan"] = 0.0
        if not self._plan_map_route(name, state, now):
            return None
        return state["target"]

    def _publish_control(self, name, speed=0.0, turn=0.0, motion_state="idle"):
        """Publish both actuator intent and its operational context."""
        command = Twist()
        command.linear.x = float(speed)
        command.angular.z = float(turn)
        self.command_publishers[name].publish(command)
        state_message = String()
        state_message.data = motion_state
        self.state_publishers[name].publish(state_message)

    def step(self):
        now = time.monotonic()
        for name, state in self.states.items():
            faults = self.injected_faults.get(name, set())
            if "freeze" in faults:
                # Report movement intent while withholding the actuator command.
                # The recorder can therefore exercise its normal stuck timer.
                self._publish_control(name, motion_state="stalled")
                continue
            if "lidar_dropout" in faults:
                self._publish_control(name, motion_state="sensor_wait")
                continue
            if self.pose_source == "amcl" and (
                name not in self.observed
                or now - self.observed_at.get(name, 0.0) > self.pose_timeout
            ):
                self._publish_control(name, motion_state="localizing")
                continue
            if self.require_localization_ready and not readiness_allows_drive(
                self.localization_readiness.get(name),
                now,
                self.readiness_timeout,
            ):
                self._publish_control(name, motion_state="localizing")
                continue
            if name in self.observed:
                state["x"], state["y"], state["yaw"] = self.observed[name]
            elapsed = min(max(now - state["last"], 0.0), 1.0)
            state["last"] = now
            if self.map_navigation:
                if name not in self.scans or now - self.scans[name][0] > 1.0:
                    self._publish_control(name, motion_state="sensor_wait")
                    continue
                target = self._map_target(name, state, now)
                if target is None:
                    task = state["side_task"]
                    if task is not None and task["phase"] == "working":
                        motion_state = "side_work"
                    elif task is not None:
                        motion_state = "task_planning"
                    else:
                        motion_state = "planning"
                    self._publish_control(name, motion_state=motion_state)
                    continue
                target_x, target_y = target
            else:
                target_x, target_y = state["target"]
            dx, dy = target_x - state["x"], target_y - state["y"]
            distance = math.hypot(dx, dy)
            if not self.map_navigation and distance < 0.3:
                if self.loop_route:
                    state["target_index"] = (
                        state["target_index"] + 1
                    ) % len(self.waypoints)
                    state["target"] = self.waypoints[state["target_index"]]
                else:
                    state["target"] = self._new_target((target_x, target_y))
                target_x, target_y = state["target"]
                dx, dy = target_x - state["x"], target_y - state["y"]
                distance = math.hypot(dx, dy)
            # Ease into a waypoint instead of hitting it at full speed and
            # oscillating around it.
            speed = min(self.max_speed, 0.8 * distance)
            target_yaw = math.atan2(dy, dx)
            heading_error = (target_yaw - state["yaw"] + math.pi) % (2 * math.pi) - math.pi
            turn = max(-1.5, min(1.5, 2.0 * heading_error))
            aligned_for_drive = abs(heading_error) <= 0.35
            if not aligned_for_drive:
                speed = 0.0

            # Find vehicles inside a narrow corridor in front of this bot.
            # Following traffic slows smoothly. For head-on/crossing traffic,
            # the lower-numbered vehicle gets deterministic right-of-way and
            # both vehicles steer to opposite sides of the aisle.
            obstacle = None
            emergency = None
            for other_name, (other_x, other_y, other_yaw) in self.observed.items():
                if other_name == name:
                    continue
                offset_x = other_x - state["x"]
                offset_y = other_y - state["y"]
                gap = math.hypot(offset_x, offset_y)
                forward = (
                    offset_x * math.cos(state["yaw"])
                    + offset_y * math.sin(state["yaw"])
                )
                lateral = (
                    -offset_x * math.sin(state["yaw"])
                    + offset_y * math.cos(state["yaw"])
                )
                # The traffic forklift envelope is 1.25 x 0.66 m. Begin the
                # deterministic emergency right-of-way response before their
                # swept boxes can touch during a crossing turn.
                if gap < 1.05:
                    if emergency is None or gap < emergency[0]:
                        emergency = (gap, other_name)
                if forward > 0.0 and abs(lateral) < 1.0 and gap < 2.2:
                    if obstacle is None or gap < obstacle[0]:
                        obstacle = (gap, lateral, other_name, other_yaw)

            yielding = False
            # Do not let a nearby vehicle perturb an in-place route turn.
            # Once aligned, the normal following/head-on rules take over.
            if obstacle is not None and aligned_for_drive:
                gap, lateral, other_name, other_yaw = obstacle
                opposite = math.cos(state["yaw"] - other_yaw) < 0.35
                if opposite:
                    yielding = self._vehicle_number(name) > self._vehicle_number(
                        other_name
                    )
                    side = -1.0 if lateral >= 0.0 else 1.0
                    if abs(lateral) < 0.08:
                        side = -1.0 if self._vehicle_number(name) % 2 else 1.0
                    turn = max(-1.5, min(1.5, turn + side * 1.2))
                    speed = min(speed, 0.28)
                else:
                    # Maintain about one vehicle length of following distance.
                    speed = min(speed, max(0.0, (gap - 1.15) * 0.65))

            if yielding:
                if state["yield_since"] is None:
                    state["yield_since"] = now
                # Pause briefly for the priority vehicle, then crawl while
                # steering aside. This timeout prevents symmetric deadlocks.
                if now - state["yield_since"] < 2.0:
                    speed = 0.0
            else:
                state["yield_since"] = None
            if emergency is not None:
                _gap, other_name = emergency
                # Deterministic priority avoids both vehicles applying an
                # emergency stop forever when they are nose-to-nose.
                if self._vehicle_number(name) > self._vehicle_number(other_name):
                    speed = 0.0
                else:
                    speed = min(speed, 0.08)

            lidar_blocked = False
            if self.map_navigation:
                _scan_time, front, left, right = self.scans[name]
                turn_side = 1.0 if left >= right else -1.0
                # A forward return does not obstruct an in-place turn. Wait
                # until the robot faces its path before treating that return
                # as something it could drive into.
                if aligned_for_drive and front < self.emergency_distance:
                    speed = 0.0
                    turn = turn_side * 1.25
                    lidar_blocked = True
                elif aligned_for_drive and front < self.avoidance_distance:
                    clearance = max(0.0, front - self.emergency_distance)
                    ratio = clearance / max(
                        0.01, self.avoidance_distance - self.emergency_distance
                    )
                    speed = min(speed, max(0.08, self.max_speed * ratio * 0.45))
                    turn = max(
                        -1.5,
                        min(1.5, turn + turn_side * (1.0 - ratio) * 1.2),
                    )
                    lidar_blocked = True
                # Side returns shape forward motion, but they are not by
                # themselves a blocked route. A shelf alongside the vehicle
                # is normal in a warehouse aisle. Also leave in-place turns
                # alone so a robot beside a wall can still face its escape
                # waypoint instead of endlessly fighting the wall repulsion.
                if aligned_for_drive:
                    if left < 0.48:
                        turn = max(-1.5, turn - (0.48 - left) * 2.0)
                    if right < 0.48:
                        turn = min(1.5, turn + (0.48 - right) * 2.0)

                route_blocked = (
                    lidar_blocked
                    or (aligned_for_drive and obstacle is not None)
                    or emergency is not None
                )
                if route_blocked:
                    if state["blocked_since"] is None:
                        state["blocked_since"] = now
                    elif (
                        now - state["blocked_since"] >= self.blocked_replan_time
                        and now - state["last_replan"] >= self.blocked_replan_time
                    ):
                        self._plan_map_route(name, state, now)
                        state["blocked_since"] = now
                        speed = 0.0
                else:
                    state["blocked_since"] = None
            state["yaw"] += turn * elapsed
            state["x"] += math.cos(state["yaw"]) * speed * elapsed
            state["y"] += math.sin(state["yaw"]) * speed * elapsed
            if (obstacle is not None and aligned_for_drive) or emergency is not None or yielding:
                motion_state = "waiting_vehicle"
            elif lidar_blocked:
                motion_state = "blocked_obstacle"
            elif not aligned_for_drive:
                motion_state = "turning"
            elif speed > 0.05:
                motion_state = "moving"
            else:
                motion_state = "stalled"
            task = state["side_task"]
            if task is not None and motion_state == "moving":
                motion_state = (
                    "side_task" if task["phase"] == "outbound" else "returning_route"
                )
            self._publish_control(name, speed, turn, motion_state)


def main(args=None):
    rclpy.init(args=args)
    node = TrafficSimulator()
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
