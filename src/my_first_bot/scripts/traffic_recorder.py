#!/usr/bin/env python3
"""Record warehouse vehicle tracks and derive stuck/congestion events."""

from dataclasses import dataclass
import json
import math
import re
import time

from gazebo_msgs.msg import ModelStates
from geometry_msgs.msg import PoseWithCovarianceStamped, Twist
from nav_msgs.msg import Odometry
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from traffic_common import (
    classify_motion_state,
    open_database,
    slow_clusters,
    transform_xy,
)


@dataclass
class Track:
    x: float
    y: float
    speed: float
    received_at: float
    source: str
    frame_id: str
    yaw: float = 0.0
    covariance_trace: float = 0.0


class TrafficRecorder(Node):
    def __init__(self):
        super().__init__("traffic_recorder")
        self.declare_parameter("database_path", "~/.ros/warehouse_traffic.db")
        self.declare_parameter("vehicle_name_regex", r"^(my_robot|vehicle_[0-9]+)$")
        self.declare_parameter("main_vehicle_id", "my_robot")
        self.declare_parameter("sample_period", 1.0)
        self.declare_parameter("stale_after", 5.0)
        self.declare_parameter("slow_speed", 0.05)
        self.declare_parameter("resume_speed", 0.10)
        self.declare_parameter("command_speed", 0.05)
        self.declare_parameter("turning_speed", 0.20)
        self.declare_parameter("stuck_duration", 60.0)
        self.declare_parameter("congestion_radius", 2.0)
        self.declare_parameter("congestion_min_vehicles", 3)
        self.declare_parameter("congestion_duration", 15.0)
        self.declare_parameter("traffic_vehicle_count", 8)
        self.declare_parameter("traffic_pose_source", "gazebo")
        self.declare_parameter("model_states_frame", "map")
        self.declare_parameter("world_to_map_x", 0.0)
        self.declare_parameter("world_to_map_y", 0.0)
        self.declare_parameter("world_to_map_yaw", 0.0)

        database_path = self.get_parameter("database_path").value
        self.connection = open_database(database_path)
        self.vehicle_pattern = re.compile(
            self.get_parameter("vehicle_name_regex").value
        )
        self.main_vehicle = self.get_parameter("main_vehicle_id").value
        self.stale_after = float(self.get_parameter("stale_after").value)
        self.slow_speed = float(self.get_parameter("slow_speed").value)
        self.resume_speed = float(self.get_parameter("resume_speed").value)
        self.command_speed = float(self.get_parameter("command_speed").value)
        self.turning_speed = float(self.get_parameter("turning_speed").value)
        self.stuck_duration = float(self.get_parameter("stuck_duration").value)
        self.congestion_radius = float(
            self.get_parameter("congestion_radius").value
        )
        self.congestion_min_vehicles = int(
            self.get_parameter("congestion_min_vehicles").value
        )
        self.congestion_duration = float(
            self.get_parameter("congestion_duration").value
        )
        self.traffic_vehicle_count = int(
            self.get_parameter("traffic_vehicle_count").value
        )
        self.traffic_pose_source = str(
            self.get_parameter("traffic_pose_source").value
        )
        if self.traffic_pose_source not in ("gazebo", "amcl"):
            raise ValueError("traffic_pose_source must be 'gazebo' or 'amcl'")
        self.model_states_frame = str(
            self.get_parameter("model_states_frame").value
        )
        self.world_to_map_x = float(self.get_parameter("world_to_map_x").value)
        self.world_to_map_y = float(self.get_parameter("world_to_map_y").value)
        self.world_to_map_yaw = float(
            self.get_parameter("world_to_map_yaw").value
        )
        if self.resume_speed < self.slow_speed:
            raise ValueError("resume_speed must be greater than or equal to slow_speed")
        if self.traffic_vehicle_count < 0:
            raise ValueError("traffic_vehicle_count cannot be negative")

        self.tracks = {}
        self.ground_truth = {}
        self.traffic_speeds = {}
        self.traffic_speed_received = {}
        self.commands = {}
        self.reported_states = {}
        self.localization_validation = {}
        self.traffic_subscriptions = []
        self.slow_since = {}
        self.active_stuck = {}
        self.congestion_since = {}
        self.active_congestion = {}
        self.congestion_centers = {}
        self.next_congestion_region = 1
        self.last_sim_time = None
        self.main_speed = None
        self.main_speed_received = None
        self.create_subscription(ModelStates, "/gazebo/model_states", self.on_models, 10)
        self.create_subscription(
            PoseWithCovarianceStamped, "/amcl_pose", self.on_amcl_pose, 10
        )
        self.create_subscription(Odometry, "/odom", self.on_odom, 10)
        self.create_subscription(
            Twist,
            "/cmd_vel",
            lambda message: self.on_command(self.main_vehicle, message),
            10,
        )
        self.create_subscription(
            String,
            "/motion_state",
            lambda message: self.on_motion_state(self.main_vehicle, message),
            10,
        )
        self.traffic_subscriptions.append(
            self.create_subscription(
                String,
                f"/traffic/{self.main_vehicle}/localization_validation",
                lambda message: self.on_localization_validation(
                    self.main_vehicle, message
                ),
                10,
            )
        )
        for index in range(1, self.traffic_vehicle_count + 1):
            name = f"vehicle_{index}"
            self.traffic_subscriptions.extend(
                [
                    self.create_subscription(
                        Twist,
                        f"/traffic/{name}/cmd_vel",
                        lambda message, vehicle=name: self.on_command(
                            vehicle, message
                        ),
                        10,
                    ),
                    self.create_subscription(
                        String,
                        f"/traffic/{name}/motion_state",
                        lambda message, vehicle=name: self.on_motion_state(
                            vehicle, message
                        ),
                        10,
                    ),
                    self.create_subscription(
                        String,
                        f"/traffic/{name}/localization_validation",
                        lambda message, vehicle=name: self.on_localization_validation(
                            vehicle, message
                        ),
                        10,
                    ),
                ]
            )
            if self.traffic_pose_source == "amcl":
                self.traffic_subscriptions.extend(
                    [
                        self.create_subscription(
                            PoseWithCovarianceStamped,
                            f"/traffic/{name}/amcl_pose",
                            lambda message, vehicle=name: self.on_traffic_amcl(
                                vehicle, message
                            ),
                            10,
                        ),
                        self.create_subscription(
                            Odometry,
                            f"/traffic/{name}/odom",
                            lambda message, vehicle=name: self.on_traffic_odom(
                                vehicle, message
                            ),
                            10,
                        ),
                    ]
                )
        period = float(self.get_parameter("sample_period").value)
        self.create_timer(period, self.record_snapshot)
        self.get_logger().info(
            f"Recording warehouse traffic in {database_path}; "
            f"traffic poses use {self.traffic_pose_source}; Gazebo truth is retained "
            "only for localization error measurement"
        )

    def on_models(self, message):
        now = time.monotonic()
        for name, pose, twist in zip(message.name, message.pose, message.twist):
            if not self.vehicle_pattern.match(name):
                continue
            if name != self.main_vehicle:
                try:
                    vehicle_index = int(name.rsplit("_", 1)[1])
                except (IndexError, ValueError):
                    continue
                if vehicle_index > self.traffic_vehicle_count:
                    continue
            x, y = self._world_to_map(pose.position.x, pose.position.y)
            speed = math.hypot(twist.linear.x, twist.linear.y)
            yaw = self._yaw(pose.orientation) + self.world_to_map_yaw
            truth = Track(
                x, y, speed, now, "gazebo_ground_truth", "map", yaw
            )
            self.ground_truth[name] = truth
            if name != self.main_vehicle and self.traffic_pose_source == "gazebo":
                self.tracks[name] = truth

    @staticmethod
    def _yaw(orientation):
        return math.atan2(
            2.0 * (orientation.w * orientation.z + orientation.x * orientation.y),
            1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z),
        )

    def on_traffic_amcl(self, name, message):
        """Record a traffic vehicle from its LiDAR/odometry AMCL estimate."""
        now = time.monotonic()
        pose = message.pose.pose
        previous = self.tracks.get(name)
        speed_fresh = (
            name in self.traffic_speeds
            and now - self.traffic_speed_received[name] <= self.stale_after
        )
        speed = self.traffic_speeds.get(name, 0.0) if speed_fresh else 0.0
        if not speed_fresh and previous is not None:
            elapsed = now - previous.received_at
            if elapsed > 0.0:
                speed = math.hypot(
                    pose.position.x - previous.x, pose.position.y - previous.y
                ) / elapsed
        covariance = message.pose.covariance
        self.tracks[name] = Track(
            pose.position.x,
            pose.position.y,
            speed,
            now,
            "amcl_with_odom_speed" if speed_fresh else "amcl",
            message.header.frame_id or "map",
            self._yaw(pose.orientation),
            float(covariance[0] + covariance[7] + covariance[35]),
        )

    def on_traffic_odom(self, name, message):
        linear = message.twist.twist.linear
        self.traffic_speeds[name] = math.hypot(linear.x, linear.y)
        self.traffic_speed_received[name] = time.monotonic()

    def on_amcl_pose(self, message):
        now = time.monotonic()
        position = message.pose.pose.position
        previous = self.tracks.get(self.main_vehicle)
        odom_fresh = (
            self.main_speed is not None
            and self.main_speed_received is not None
            and now - self.main_speed_received <= self.stale_after
        )
        speed = self.main_speed if odom_fresh else 0.0
        if not odom_fresh and previous is not None:
            elapsed = now - previous.received_at
            if elapsed > 0.0:
                speed = math.hypot(position.x - previous.x, position.y - previous.y) / elapsed
        self.tracks[self.main_vehicle] = Track(
            position.x,
            position.y,
            speed,
            now,
            "amcl_with_odom_speed" if odom_fresh else "amcl",
            message.header.frame_id or "map",
            self._yaw(message.pose.pose.orientation),
            float(
                message.pose.covariance[0]
                + message.pose.covariance[7]
                + message.pose.covariance[35]
            ),
        )

    def on_odom(self, message):
        linear = message.twist.twist.linear
        self.main_speed = math.hypot(linear.x, linear.y)
        self.main_speed_received = time.monotonic()

    def on_command(self, name, message):
        """Cache controller intent independently from measured movement."""
        self.commands[name] = (
            float(message.linear.x),
            float(message.angular.z),
            time.monotonic(),
        )

    def on_motion_state(self, name, message):
        """Cache context reported by a vehicle controller."""
        self.reported_states[name] = (str(message.data), time.monotonic())

    def on_localization_validation(self, name, message):
        """Cache the newest AMCL/UWB diagnostic for historical recording."""
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            self.get_logger().warning(
                f"Ignored malformed localization validation for {name}",
                throttle_duration_sec=5.0,
            )
            return
        if not isinstance(payload, dict):
            return
        payload["vehicle_id"] = name
        self.localization_validation[name] = (payload, time.monotonic())

    def _vehicle_context(self, name, track, now):
        command = self.commands.get(name)
        if command is not None and now - command[2] <= self.stale_after:
            linear, angular = command[:2]
        else:
            linear, angular = 0.0, 0.0
        reported = self.reported_states.get(name)
        reported_state = (
            reported[0]
            if reported is not None and now - reported[1] <= self.stale_after
            else ""
        )
        state, intent_active = classify_motion_state(
            track.speed,
            linear,
            angular,
            reported_state,
            self.slow_speed,
            self.command_speed,
            self.turning_speed,
        )
        return {
            "motion_state": state,
            "commanded_speed": abs(float(linear)),
            "intent_active": intent_active,
        }

    def _world_to_map(self, x, y):
        """Apply the configured static Gazebo-world to ROS-map transform."""
        return transform_xy(
            x,
            y,
            self.world_to_map_x,
            self.world_to_map_y,
            self.world_to_map_yaw,
        )

    def record_snapshot(self):
        observed_at = time.time()
        sim_time = self.get_clock().now().nanoseconds / 1.0e9
        received_at = time.monotonic()
        if self.last_sim_time is not None and sim_time < self.last_sim_time:
            self.slow_since.clear()
            self.active_stuck.clear()
            self.congestion_since.clear()
            self.active_congestion.clear()
            self.congestion_centers.clear()
            self.get_logger().warning("Simulation clock moved backwards; event timers reset")
        self.last_sim_time = sim_time
        fresh = {
            name: track
            for name, track in self.tracks.items()
            if received_at - track.received_at <= self.stale_after
        }
        if not fresh:
            return

        with self.connection:
            contexts = {}
            for name, track in fresh.items():
                context = self._vehicle_context(name, track, received_at)
                is_stuck = self._update_stuck(
                    name, track, context, observed_at, sim_time
                )
                if is_stuck:
                    context["motion_state"] = "stuck"
                contexts[name] = context
                self.connection.execute(
                    """INSERT INTO samples
                       (observed_at, sim_time, vehicle_id, x, y, speed, source,
                        frame_id, motion_state, commanded_speed, intent_active)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        observed_at,
                        sim_time,
                        name,
                        track.x,
                        track.y,
                        track.speed,
                        track.source,
                        track.frame_id,
                        context["motion_state"],
                        context["commanded_speed"],
                        int(context["intent_active"]),
                    ),
                )
                self._record_localization_metric(name, track, observed_at, sim_time)
                self._record_localization_validation(
                    name, observed_at, sim_time, received_at
                )
            self._update_congestion(fresh, contexts, observed_at, sim_time)

    @staticmethod
    def _optional_float(payload, key):
        value = payload.get(key)
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _optional_int(payload, key, default=0):
        try:
            return int(payload.get(key, default))
        except (TypeError, ValueError):
            return int(default)

    def _record_localization_validation(
        self, name, observed_at, sim_time, received_at
    ):
        """Store one fresh validation sample per traffic snapshot."""
        entry = self.localization_validation.get(name)
        if entry is None or received_at - entry[1] > self.stale_after:
            return
        payload = entry[0]
        self.connection.execute(
            """INSERT INTO localization_validation_samples
               (observed_at, sim_time, vehicle_id, state, raw_state,
                authoritative_source, amcl_x, amcl_y, uwb_x, uwb_y, error_m,
                visible_tag_count, uwb_residual_m, measurement_skew_s,
                amcl_age_s, uwb_age_s, amcl_stamp, uwb_stamp, uwb_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                observed_at,
                sim_time,
                name,
                str(payload.get("state") or "unknown"),
                str(payload.get("raw_state") or payload.get("state") or "unknown"),
                str(payload.get("authoritative_source") or "amcl"),
                self._optional_float(payload, "amcl_x"),
                self._optional_float(payload, "amcl_y"),
                self._optional_float(payload, "uwb_x"),
                self._optional_float(payload, "uwb_y"),
                self._optional_float(payload, "error_m"),
                max(0, self._optional_int(payload, "visible_tag_count")),
                self._optional_float(payload, "uwb_residual_m"),
                self._optional_float(payload, "measurement_skew_s"),
                self._optional_float(payload, "amcl_age_s"),
                self._optional_float(payload, "uwb_age_s"),
                self._optional_float(payload, "amcl_stamp"),
                self._optional_float(payload, "uwb_stamp"),
                str(payload.get("uwb_reason") or "unknown"),
            ),
        )

    def _record_localization_metric(self, name, track, observed_at, sim_time):
        # This table measures the direct 2-D ray sensors added to traffic
        # vehicles. The pre-existing main robot uses a converted 3-D cloud and
        # is intentionally excluded from this no-IMU experiment.
        if name == self.main_vehicle or not track.source.startswith("amcl"):
            return
        truth = self.ground_truth.get(name)
        if truth is None or time.monotonic() - truth.received_at > self.stale_after:
            return
        position_error = math.hypot(track.x - truth.x, track.y - truth.y)
        yaw_error = abs(
            (track.yaw - truth.yaw + math.pi) % (2.0 * math.pi) - math.pi
        )
        self.connection.execute(
            """INSERT INTO localization_metrics
               (observed_at, sim_time, vehicle_id, estimated_x, estimated_y,
                ground_truth_x, ground_truth_y, position_error, yaw_error,
                covariance_trace)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                observed_at,
                sim_time,
                name,
                track.x,
                track.y,
                truth.x,
                truth.y,
                position_error,
                yaw_error,
                track.covariance_trace,
            ),
        )

    def _update_stuck(self, name, track, context, wall_now, sim_now):
        """Promote only unexplained/blocked no-progress periods to stuck."""
        threshold = self.resume_speed if name in self.slow_since else self.slow_speed
        candidate = context["intent_active"] and context["motion_state"] in {
            "blocked_obstacle",
            "stalled",
        }
        if track.speed >= threshold or not candidate:
            self.slow_since.pop(name, None)
            self.active_stuck.pop(name, None)
            return False

        started_sim, started_at = self.slow_since.setdefault(
            name, (sim_now, wall_now)
        )
        if sim_now - started_sim < self.stuck_duration:
            return False

        event_id = self.active_stuck.get(name)
        if event_id is None:
            cursor = self.connection.execute(
                """INSERT INTO stuck_events
                   (vehicle_id, started_at, ended_at, x, y, max_speed)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (name, started_at, wall_now, track.x, track.y, track.speed),
            )
            self.active_stuck[name] = cursor.lastrowid
            self.get_logger().warning(
                f"Vehicle {name} has had movement intent without progress for "
                f"{sim_now - started_sim:.0f}s ({context['motion_state']})"
            )
        else:
            self.connection.execute(
                """UPDATE stuck_events
                   SET ended_at = ?, x = ?, y = ?, max_speed = MAX(max_speed, ?)
                   WHERE id = ?""",
                (wall_now, track.x, track.y, track.speed, event_id),
            )
        return True

    def _update_congestion(self, tracks, contexts, wall_now, sim_now):
        slow_positions = {
            name: (track.x, track.y)
            for name, track in tracks.items()
            if track.speed < self.resume_speed
            and contexts[name]["motion_state"] in {
                "waiting_vehicle",
                "blocked_obstacle",
                "stalled",
                "stuck",
            }
        }
        clusters = slow_clusters(
            slow_positions, self.congestion_radius, self.congestion_min_vehicles
        )
        current_keys = set()
        matched_keys = set()
        for names in clusters:
            x = sum(slow_positions[name][0] for name in names) / len(names)
            y = sum(slow_positions[name][1] for name in names) / len(names)
            key = self._congestion_region(x, y, matched_keys)
            matched_keys.add(key)
            current_keys.add(key)
            started_sim, started_at = self.congestion_since.setdefault(
                key, (sim_now, wall_now)
            )
            if sim_now - started_sim < self.congestion_duration:
                continue
            event_id = self.active_congestion.get(key)
            group_key = ",".join(names)
            if event_id is None:
                cursor = self.connection.execute(
                    """INSERT INTO congestion_events
                       (group_key, vehicle_count, started_at, ended_at, x, y)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (group_key, len(names), started_at, wall_now, x, y),
                )
                self.active_congestion[key] = cursor.lastrowid
                self.get_logger().warning(
                    f"Congestion detected near ({x:.1f}, {y:.1f}): {group_key}"
                )
            else:
                self.connection.execute(
                    """UPDATE congestion_events
                       SET group_key = ?, ended_at = ?, vehicle_count = ?, x = ?, y = ?
                       WHERE id = ?""",
                    (group_key, wall_now, len(names), x, y, event_id),
                )
        for key in set(self.active_congestion) - current_keys:
            self.active_congestion.pop(key, None)
        for key in set(self.congestion_since) - current_keys:
            self.congestion_since.pop(key, None)
            self.congestion_centers.pop(key, None)

    def _congestion_region(self, x, y, matched_keys):
        """Match a changing vehicle group to the nearest active spatial region."""
        candidates = [
            (math.hypot(x - center[0], y - center[1]), key)
            for key, center in self.congestion_centers.items()
            if key not in matched_keys
        ]
        candidates = [item for item in candidates if item[0] <= self.congestion_radius]
        if candidates:
            key = min(candidates)[1]
        else:
            key = f"region_{self.next_congestion_region}"
            self.next_congestion_region += 1
        self.congestion_centers[key] = (x, y)
        return key

    def destroy_node(self):
        self.connection.close()
        return super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = TrafficRecorder()
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
