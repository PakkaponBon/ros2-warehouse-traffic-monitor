"""Shared validation for simulation-only fault-injection messages."""

import json
import math


PERSISTENT_FAULTS = frozenset(
    {"freeze", "lidar_dropout", "uwb_dropout", "localization_loss"}
)
ONE_SHOT_ACTIONS = frozenset({"teleport", "restore"})
TERMINAL_ACTION_STATUSES = frozenset({"succeeded", "failed"})


def vehicle_names(count, prefix="vehicle_"):
    """Return the configured traffic vehicle identifiers."""
    return tuple(f"{prefix}{index}" for index in range(1, int(count) + 1))


def _decode_fault_state(message_data, allowed_vehicles):
    """Decode a complete registry, raising when its envelope is malformed."""
    try:
        payload = json.loads(message_data)
    except (TypeError, ValueError) as error:
        raise ValueError("fault state must be valid JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("active"), dict):
        raise ValueError("fault state must contain an active object")
    allowed = set(allowed_vehicles)
    result = {}
    for name, values in payload["active"].items():
        if name not in allowed or not isinstance(values, list):
            continue
        faults = {str(value) for value in values if str(value) in PERSISTENT_FAULTS}
        if faults:
            result[name] = faults
    return result


def parse_fault_state(message_data, allowed_vehicles):
    """Parse a full active-fault registry published by the web monitor."""
    try:
        return _decode_fault_state(message_data, allowed_vehicles)
    except ValueError:
        return {}


def fault_state_transitions(previous, current):
    """Return deterministic started and ended persistent-fault pairs."""
    previous_pairs = {
        (vehicle_id, fault)
        for vehicle_id, faults in previous.items()
        for fault in faults
    }
    current_pairs = {
        (vehicle_id, fault)
        for vehicle_id, faults in current.items()
        for fault in faults
    }
    return sorted(current_pairs - previous_pairs), sorted(
        previous_pairs - current_pairs
    )


class FaultEventStore:
    """Persist simulation fault intervals and completed one-shot actions."""

    def __init__(self, connection, run_id, allowed_vehicles):
        self.connection = connection
        self.run_id = str(run_id)
        self.allowed_vehicles = tuple(allowed_vehicles)
        self.active_state = {}
        self.active_rows = {}

    def update_persistent_state(self, message_data, observed_at, sim_time):
        """Apply one complete registry and return its started/ended transitions."""
        current = _decode_fault_state(message_data, self.allowed_vehicles)
        started, ended = fault_state_transitions(self.active_state, current)
        with self.connection:
            for vehicle_id, fault_type in started:
                cursor = self.connection.execute(
                    """INSERT INTO fault_events
                       (run_id, vehicle_id, fault_type, action, status,
                        started_at, started_sim_time, simulation_only)
                       VALUES (?, ?, ?, 'set', 'active', ?, ?, 1)""",
                    (
                        self.run_id,
                        vehicle_id,
                        fault_type,
                        float(observed_at),
                        float(sim_time),
                    ),
                )
                self.active_rows[(vehicle_id, fault_type)] = cursor.lastrowid
            for vehicle_id, fault_type in ended:
                event_id = self.active_rows.pop((vehicle_id, fault_type), None)
                if event_id is None:
                    continue
                self.connection.execute(
                    """UPDATE fault_events
                       SET status = 'cleared', ended_at = ?, ended_sim_time = ?
                       WHERE id = ?""",
                    (float(observed_at), float(sim_time), event_id),
                )
        self.active_state = current
        return started, ended

    def record_action_status(self, message_data, observed_at, sim_time):
        """Store a terminal teleport/restore result once; ignore interim status."""
        try:
            payload = json.loads(message_data)
        except (TypeError, ValueError) as error:
            raise ValueError("fault action status must be valid JSON") from error
        if not isinstance(payload, dict):
            raise ValueError("fault action status must be a JSON object")
        action = str(payload.get("action") or "").strip().lower()
        vehicle_id = str(payload.get("vehicle_id") or "").strip()
        status = str(payload.get("status") or "").strip().lower()
        if action not in ONE_SHOT_ACTIONS:
            return False
        if vehicle_id not in set(self.allowed_vehicles):
            return False
        if status not in TERMINAL_ACTION_STATUSES:
            return False
        event_at = payload.get("observed_at", observed_at)
        try:
            event_at = float(event_at)
        except (TypeError, ValueError):
            event_at = float(observed_at)
        if not math.isfinite(event_at):
            event_at = float(observed_at)
        detail = str(payload.get("detail") or "")
        with self.connection:
            cursor = self.connection.execute(
                """INSERT OR IGNORE INTO fault_events
                   (run_id, vehicle_id, fault_type, action, status,
                    started_at, ended_at, started_sim_time, ended_sim_time,
                    simulation_only, detail)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                (
                    self.run_id,
                    vehicle_id,
                    action,
                    action,
                    status,
                    event_at,
                    event_at,
                    float(sim_time),
                    float(sim_time),
                    detail,
                ),
            )
        return cursor.rowcount > 0

    def close_open_events(self, observed_at, sim_time):
        """Close active intervals when the recorder shuts down."""
        if not self.active_rows:
            return 0
        row_ids = list(self.active_rows.values())
        with self.connection:
            self.connection.executemany(
                """UPDATE fault_events
                   SET status = 'interrupted', ended_at = ?, ended_sim_time = ?
                   WHERE id = ?""",
                [
                    (float(observed_at), float(sim_time), event_id)
                    for event_id in row_ids
                ],
            )
        self.active_rows.clear()
        self.active_state.clear()
        return len(row_ids)


def validate_fault_request(payload, allowed_vehicles):
    """Validate and normalize one browser fault-control request."""
    if not isinstance(payload, dict):
        raise ValueError("fault request must be a JSON object")
    action = str(payload.get("action") or "set").strip().lower()
    name = str(payload.get("vehicle_id") or "").strip()
    if name not in set(allowed_vehicles):
        raise ValueError("vehicle_id is not a configured simulation vehicle")

    if action == "set":
        fault = str(payload.get("fault") or "").strip().lower()
        if fault not in PERSISTENT_FAULTS:
            raise ValueError("unknown simulation fault")
        enabled = payload.get("enabled")
        if not isinstance(enabled, bool):
            raise ValueError("enabled must be true or false")
        return {
            "action": action,
            "vehicle_id": name,
            "fault": fault,
            "enabled": enabled,
        }

    if action == "clear_all":
        return {"action": action, "vehicle_id": name}

    if action in ONE_SHOT_ACTIONS:
        result = {"action": action, "vehicle_id": name}
        if action == "teleport":
            for key, default in (("offset_x", 6.0), ("offset_y", 0.0)):
                try:
                    value = float(payload.get(key, default))
                except (TypeError, ValueError) as error:
                    raise ValueError(f"{key} must be numeric") from error
                if not math.isfinite(value) or abs(value) > 10.0:
                    raise ValueError(f"{key} must be between -10 and 10 metres")
                result[key] = value
        return result

    raise ValueError("unknown simulation fault action")
