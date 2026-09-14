"""Shared validation for simulation-only fault-injection messages."""

import json
import math


PERSISTENT_FAULTS = frozenset(
    {"freeze", "lidar_dropout", "uwb_dropout", "localization_loss"}
)
ONE_SHOT_ACTIONS = frozenset({"teleport", "restore"})


def vehicle_names(count, prefix="vehicle_"):
    """Return the configured traffic vehicle identifiers."""
    return tuple(f"{prefix}{index}" for index in range(1, int(count) + 1))


def parse_fault_state(message_data, allowed_vehicles):
    """Parse a full active-fault registry published by the web monitor."""
    try:
        payload = json.loads(message_data)
    except (TypeError, ValueError):
        return {}
    if not isinstance(payload, dict) or not isinstance(payload.get("active"), dict):
        return {}
    allowed = set(allowed_vehicles)
    result = {}
    for name, values in payload["active"].items():
        if name not in allowed or not isinstance(values, list):
            continue
        faults = {str(value) for value in values if str(value) in PERSISTENT_FAULTS}
        if faults:
            result[name] = faults
    return result


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
