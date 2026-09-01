#!/usr/bin/env python3
"""Compare AMCL with UWB without allowing UWB to control localization."""

from collections import deque
import json
import math
import time

from geometry_msgs.msg import PoseWithCovarianceStamped
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from traffic_common import (
    advance_stable_state,
    classify_localization_error,
    select_time_aligned_pair,
)


class LocalizationValidator(Node):
    """Publish per-vehicle AMCL/UWB agreement as diagnostic JSON."""

    def __init__(self):
        # Create one validator node for the whole fleet.  This node observes
        # localization; it never changes AMCL or commands a vehicle.
        super().__init__("localization_validator")

        # Keep fleet size, topic naming, quality thresholds, and timing
        # configurable so the same validator can be used with another fleet.
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("vehicle_prefix", "vehicle_")
        self.declare_parameter("include_main_vehicle", True)
        self.declare_parameter("confirm_threshold", 0.5)
        self.declare_parameter("warning_threshold", 1.0)
        self.declare_parameter("stale_after", 2.0)
        self.declare_parameter("publish_rate", 5.0)
        self.declare_parameter("max_pair_skew", 0.35)
        self.declare_parameter("history_size", 30)
        self.declare_parameter("hysteresis", 0.10)
        self.declare_parameter("problem_samples", 3)
        self.declare_parameter("recovery_samples", 3)

        # Read and sanitize the parameters used by the comparison logic.
        vehicle_count = int(self.get_parameter("vehicle_count").value)
        vehicle_prefix = str(self.get_parameter("vehicle_prefix").value)
        self.confirm_threshold = max(
            0.0, float(self.get_parameter("confirm_threshold").value)
        )
        self.warning_threshold = max(
            self.confirm_threshold,
            float(self.get_parameter("warning_threshold").value),
        )
        self.stale_after = max(0.1, float(self.get_parameter("stale_after").value))
        self.max_pair_skew = max(
            0.0, float(self.get_parameter("max_pair_skew").value)
        )
        history_size = max(2, int(self.get_parameter("history_size").value))
        self.hysteresis = max(
            0.0, float(self.get_parameter("hysteresis").value)
        )
        self.problem_samples = max(
            1, int(self.get_parameter("problem_samples").value)
        )
        self.recovery_samples = max(
            1, int(self.get_parameter("recovery_samples").value)
        )

        # Build the list of namespaced vehicles.  The main AMR uses a special
        # AMCL topic, while traffic vehicles use their own namespace.
        self.vehicle_names = [
            f"{vehicle_prefix}{index}" for index in range(1, vehicle_count + 1)
        ]
        if bool(self.get_parameter("include_main_vehicle").value):
            self.vehicle_names.insert(0, "my_robot")

        # Small bounded histories allow the validator to compare measurements
        # taken at nearly the same time instead of blindly comparing the two
        # most recently received messages.
        self.amcl_poses = {
            name: deque(maxlen=history_size) for name in self.vehicle_names
        }
        self.uwb_poses = {
            name: deque(maxlen=history_size) for name in self.vehicle_names
        }
        self.uwb_status = {}
        self.stable_states = {name: None for name in self.vehicle_names}
        self.candidate_states = {name: None for name in self.vehicle_names}
        self.candidate_samples = {name: 0 for name in self.vehicle_names}
        self.last_pair_keys = {name: None for name in self.vehicle_names}
        self.validation_publishers = {}
        self.input_subscriptions = []
        for vehicle_name in self.vehicle_names:
            # Construct the AMCL topic.  ``my_robot`` is the main vehicle and
            # publishes /amcl_pose; traffic vehicles publish namespaced AMCL.
            topic_root = f"/traffic/{vehicle_name}"
            amcl_topic = (
                "/amcl_pose"
                if vehicle_name == "my_robot"
                else f"{topic_root}/amcl_pose"
            )
            # Store the latest AMCL pose, which is the authoritative pose used
            # by the rest of the system.
            self.input_subscriptions.append(
                self.create_subscription(
                    PoseWithCovarianceStamped,
                    amcl_topic,
                    lambda message, name=vehicle_name: self.on_pose(
                        self.amcl_poses, name, message
                    ),
                    10,
                )
            )
            # Store the latest UWB multilateration pose for comparison only.
            self.input_subscriptions.append(
                self.create_subscription(
                    PoseWithCovarianceStamped,
                    f"{topic_root}/uwb_pose",
                    lambda message, name=vehicle_name: self.on_pose(
                        self.uwb_poses, name, message
                    ),
                    10,
                )
            )
            # Store UWB quality metadata such as visible tags and fix_valid.
            self.input_subscriptions.append(
                self.create_subscription(
                    String,
                    f"{topic_root}/uwb_status",
                    lambda message, name=vehicle_name: self.on_uwb_status(
                        name, message
                    ),
                    10,
                )
            )
            # Publish one JSON diagnostic topic per vehicle for the web monitor
            # and any future safety/fleet-management node.
            self.validation_publishers[vehicle_name] = self.create_publisher(
                String, f"{topic_root}/localization_validation", 10
            )

        # Re-evaluate every vehicle periodically, even when no new input has
        # arrived, so stale AMCL/UWB data is reported promptly.
        publish_rate = max(0.1, float(self.get_parameter("publish_rate").value))
        self.create_timer(1.0 / publish_rate, self.publish_validation)
        self.get_logger().info(
            "UWB validator started: AMCL remains authoritative; "
            f"confirmed <= {self.confirm_threshold:.2f} m, "
            f"disagreement > {self.warning_threshold:.2f} m, "
            f"maximum timestamp skew={self.max_pair_skew:.2f}s"
        )

    @staticmethod
    def on_pose(store, vehicle_name, message):
        # Keep only x/y because UWB validation is a 2-D map-frame comparison.
        # Preserve both measurement time and receipt time: measurement time is
        # used for pairing, while monotonic receipt time detects dead sensors.
        stamp = message.header.stamp
        measurement_at = float(stamp.sec) + float(stamp.nanosec) / 1.0e9
        store[vehicle_name].append({
            "x": float(message.pose.pose.position.x),
            "y": float(message.pose.pose.position.y),
            "measurement_at": measurement_at if measurement_at > 0.0 else None,
            "received_at": time.monotonic(),
        })

    def on_uwb_status(self, vehicle_name, message):
        # UWB status is JSON on a String topic.  Ignore malformed data rather
        # than allowing one bad packet to stop validation for the whole fleet.
        try:
            status = json.loads(message.data)
        except (TypeError, ValueError):
            self.get_logger().warning(
                f"Ignored malformed UWB status for {vehicle_name}",
                throttle_duration_sec=5.0,
            )
            return
        # Add local receipt time for the same freshness test used by poses.
        status["received_at"] = time.monotonic()
        self.uwb_status[vehicle_name] = status

    def is_fresh(self, record, now):
        # A value is usable only if it exists and arrived within the configured
        # stale-data window.
        return record is not None and now - record["received_at"] <= self.stale_after

    def fresh_records(self, records, now):
        """Return buffered measurements inside the stale-data window."""
        return [record for record in records if self.is_fresh(record, now)]

    def stabilize(self, vehicle_name, raw_state, pair_key):
        """Apply consecutive distinct-sample filtering to a raw state."""
        # A timer may evaluate the same sensor pair several times. Count it
        # only once; otherwise a single noisy range would satisfy a three-
        # sample requirement merely because the publish timer ran three times.
        if pair_key == self.last_pair_keys[vehicle_name]:
            return self.stable_states[vehicle_name]
        self.last_pair_keys[vehicle_name] = pair_key
        stable, candidate, count = advance_stable_state(
            self.stable_states[vehicle_name],
            self.candidate_states[vehicle_name],
            self.candidate_samples[vehicle_name],
            raw_state,
            self.problem_samples,
            self.recovery_samples,
        )
        self.stable_states[vehicle_name] = stable
        self.candidate_states[vehicle_name] = candidate
        self.candidate_samples[vehicle_name] = count
        return stable

    def validation_for(self, vehicle_name, now):
        # Collect the newest records for this vehicle and determine which
        # inputs are currently available.
        amcl_records = self.fresh_records(self.amcl_poses[vehicle_name], now)
        uwb_records = self.fresh_records(self.uwb_poses[vehicle_name], now)
        status = self.uwb_status.get(vehicle_name)
        amcl_available = bool(amcl_records)
        uwb_pose_available = bool(uwb_records)
        status_available = self.is_fresh(status, now)
        # ``fix_valid`` is produced by the UWB source after its own geometry,
        # tag-count, range, and residual checks.  The validator does not
        # recompute multilateration here.
        visible_tags = int(status.get("visible_tag_count", 0)) if status_available else 0
        fix_valid = bool(status.get("fix_valid", False)) if status_available else False
        uwb_available = uwb_pose_available and status_available and fix_valid

        # Select a diagnostic state before calculating an error.  Missing AMCL
        # or invalid UWB data must not be reported as a numeric disagreement.
        error = None
        skew = None
        amcl = amcl_records[-1] if amcl_records else None
        uwb = uwb_records[-1] if uwb_records else None
        if not amcl_available:
            raw_state = "waiting_amcl"
        elif not uwb_available:
            raw_state = "uwb_unavailable"
        else:
            amcl, uwb, skew = select_time_aligned_pair(
                amcl_records, uwb_records, self.max_pair_skew
            )
            if skew is None or skew > self.max_pair_skew:
                raw_state = "unsynchronized"
            else:
                # Compare horizontal map positions. UWB orientation and z are
                # not used because this validator checks 2-D localization.
                error = math.hypot(amcl["x"] - uwb["x"], amcl["y"] - uwb["y"])
                raw_state = classify_localization_error(
                    error,
                    self.stable_states[vehicle_name],
                    self.confirm_threshold,
                    self.warning_threshold,
                    self.hysteresis,
                )

        if amcl is not None and uwb is not None:
            pair_key = (
                raw_state,
                amcl.get("measurement_at") or amcl["received_at"],
                uwb.get("measurement_at") or uwb["received_at"],
            )
        else:
            # Availability transitions are time-based, so let each evaluation
            # count after the configured stale window has expired.
            pair_key = (raw_state, round(now, 3))
        state = self.stabilize(vehicle_name, raw_state, pair_key)
        amcl_age = None if amcl is None else max(0.0, now - amcl["received_at"])
        uwb_age = None if uwb is None else max(0.0, now - uwb["received_at"])

        # Return a self-contained JSON-compatible diagnostic record.  AMCL is
        # explicitly marked authoritative so consumers do not mistake this
        # check for sensor fusion or an instruction to reset AMCL.
        return {
            "vehicle_id": vehicle_name,
            "device_id": status.get("device_id") if status_available else None,
            "state": state,
            "raw_state": raw_state,
            "pending_state": self.candidate_states[vehicle_name],
            "pending_samples": self.candidate_samples[vehicle_name],
            "authoritative_source": "amcl",
            "amcl_available": amcl_available,
            "uwb_available": uwb_available,
            "visible_tag_count": visible_tags,
            "visible_tags": status.get("visible_tags", []) if status_available else [],
            "ranges": status.get("ranges", []) if status_available else [],
            "error_m": None if error is None else round(error, 3),
            "amcl_x": None if amcl is None else round(amcl["x"], 3),
            "amcl_y": None if amcl is None else round(amcl["y"], 3),
            "uwb_x": None if uwb is None else round(uwb["x"], 3),
            "uwb_y": None if uwb is None else round(uwb["y"], 3),
            "amcl_stamp": None if amcl is None else amcl.get("measurement_at"),
            "uwb_stamp": None if uwb is None else uwb.get("measurement_at"),
            "amcl_age_s": None if amcl_age is None else round(amcl_age, 3),
            "uwb_age_s": None if uwb_age is None else round(uwb_age, 3),
            "measurement_skew_s": None if skew is None else round(skew, 3),
            "uwb_residual_m": (
                status.get("residual_m") if status_available else None
            ),
            "uwb_reason": status.get("reason", "no_status") if status_available else "stale",
            "confirm_threshold_m": self.confirm_threshold,
            "warning_threshold_m": self.warning_threshold,
        }

    def publish_validation(self):
        # Publish an independent status message for every configured vehicle at
        # the requested rate.  Each message reflects the latest available
        # AMCL/UWB pair and can therefore transition to a stale/unavailable
        # state even if a sensor stops publishing.
        now = time.monotonic()
        for vehicle_name in self.vehicle_names:
            payload = self.validation_for(vehicle_name, now)
            self.validation_publishers[vehicle_name].publish(
                String(data=json.dumps(payload, separators=(",", ":")))
            )


def main(args=None):
    rclpy.init(args=args)
    node = LocalizationValidator()
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
