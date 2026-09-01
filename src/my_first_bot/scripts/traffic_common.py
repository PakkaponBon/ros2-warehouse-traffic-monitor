"""Shared, ROS-independent helpers for warehouse traffic analytics."""

from datetime import datetime, timezone
import math
from pathlib import Path
import sqlite3


SCHEMA = """
CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY,
    observed_at REAL NOT NULL,
    sim_time REAL,
    vehicle_id TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    speed REAL NOT NULL,
    source TEXT NOT NULL,
    frame_id TEXT NOT NULL DEFAULT 'map',
    motion_state TEXT NOT NULL DEFAULT 'unknown',
    commanded_speed REAL NOT NULL DEFAULT 0.0,
    intent_active INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS samples_time_idx ON samples(observed_at);
CREATE INDEX IF NOT EXISTS samples_vehicle_time_idx
    ON samples(vehicle_id, observed_at);
CREATE TABLE IF NOT EXISTS stuck_events (
    id INTEGER PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    started_at REAL NOT NULL,
    ended_at REAL NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    max_speed REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS stuck_time_idx ON stuck_events(started_at, ended_at);

CREATE TABLE IF NOT EXISTS congestion_events (
    id INTEGER PRIMARY KEY,
    group_key TEXT NOT NULL,
    vehicle_count INTEGER NOT NULL,
    started_at REAL NOT NULL,
    ended_at REAL NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS congestion_time_idx
    ON congestion_events(started_at, ended_at);

CREATE TABLE IF NOT EXISTS localization_metrics (
    id INTEGER PRIMARY KEY,
    observed_at REAL NOT NULL,
    sim_time REAL,
    vehicle_id TEXT NOT NULL,
    estimated_x REAL NOT NULL,
    estimated_y REAL NOT NULL,
    ground_truth_x REAL NOT NULL,
    ground_truth_y REAL NOT NULL,
    position_error REAL NOT NULL,
    yaw_error REAL NOT NULL,
    covariance_trace REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS localization_metrics_time_idx
    ON localization_metrics(observed_at);
CREATE INDEX IF NOT EXISTS localization_metrics_vehicle_time_idx
    ON localization_metrics(vehicle_id, observed_at);

CREATE TABLE IF NOT EXISTS localization_validation_samples (
    id INTEGER PRIMARY KEY,
    observed_at REAL NOT NULL,
    sim_time REAL,
    vehicle_id TEXT NOT NULL,
    state TEXT NOT NULL,
    raw_state TEXT NOT NULL,
    authoritative_source TEXT NOT NULL DEFAULT 'amcl',
    amcl_x REAL,
    amcl_y REAL,
    uwb_x REAL,
    uwb_y REAL,
    error_m REAL,
    visible_tag_count INTEGER NOT NULL DEFAULT 0,
    uwb_residual_m REAL,
    measurement_skew_s REAL,
    amcl_age_s REAL,
    uwb_age_s REAL,
    amcl_stamp REAL,
    uwb_stamp REAL,
    uwb_reason TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS localization_validation_time_idx
    ON localization_validation_samples(observed_at);
CREATE INDEX IF NOT EXISTS localization_validation_vehicle_time_idx
    ON localization_validation_samples(vehicle_id, observed_at);
"""


KNOWN_MOTION_STATES = {
    "moving",
    "turning",
    "waiting_vehicle",
    "blocked_obstacle",
    "stalled",
    "stuck",
    "idle",
    "planning",
    "localizing",
    "sensor_wait",
    "unknown",
}

PROBLEM_MOTION_STATES = {
    "waiting_vehicle",
    "blocked_obstacle",
    "stalled",
    "stuck",
}


def classify_motion_state(
    speed,
    commanded_linear=0.0,
    commanded_angular=0.0,
    reported_state="",
    slow_speed=0.05,
    command_speed=0.05,
    turning_speed=0.20,
):
    """
    Classify a vehicle using motion, command intent, and controller context.

    The returned boolean means the vehicle currently has an active movement
    intent.  A recorder can use that flag to avoid treating an idle vehicle as
    stuck while still detecting a vehicle that was commanded to move but made
    no progress.
    """
    speed = abs(float(speed))
    commanded_linear = abs(float(commanded_linear))
    commanded_angular = abs(float(commanded_angular))
    state = str(reported_state or "").strip().lower()
    if state not in KNOWN_MOTION_STATES:
        state = "unknown"

    if speed >= float(slow_speed):
        if state in {"waiting_vehicle", "blocked_obstacle"}:
            return state, True
        return "moving", True
    if state == "turning" or commanded_angular >= float(turning_speed):
        return "turning", True
    if state in {"waiting_vehicle", "blocked_obstacle"}:
        return state, True
    if state in {"planning", "localizing", "sensor_wait"}:
        return state, True
    if state == "idle":
        return "idle", False
    if state in {"moving", "stalled", "stuck"} or commanded_linear >= float(command_speed):
        return "stalled", True
    return "idle", False


def motion_state_is_problem(state, speed=None, slow_speed=0.05):
    """Return whether a sample represents operational delay or blockage."""
    normalized = str(state or "unknown").strip().lower()
    if normalized in PROBLEM_MOTION_STATES:
        return True
    # Existing databases are migrated with ``unknown`` state. Preserve their
    # historical slow-time behavior until new context-aware samples arrive.
    return normalized == "unknown" and speed is not None and float(speed) < slow_speed


def classify_localization_error(
    error,
    previous_state=None,
    confirm_threshold=0.5,
    warning_threshold=1.0,
    hysteresis=0.1,
):
    """
    Classify AMCL/UWB distance while resisting threshold flicker.

    Hysteresis keeps the previous distance state until the measurement clears a
    small margin around the threshold. Availability states are handled by the
    validator because they do not have a numeric position error.
    """
    value = max(0.0, float(error))
    confirm = max(0.0, float(confirm_threshold))
    warning = max(confirm, float(warning_threshold))
    margin = max(0.0, float(hysteresis))
    margin = min(margin, confirm, max(0.0, (warning - confirm) / 2.0))

    if previous_state == "confirmed" and value <= confirm + margin:
        return "confirmed"
    if previous_state == "caution":
        if value < confirm - margin:
            return "confirmed"
        if value <= warning + margin:
            return "caution"
        return "disagreement"
    if previous_state == "disagreement":
        if value > warning - margin:
            return "disagreement"
        if value > confirm - margin:
            return "caution"
        return "confirmed"

    if value <= confirm:
        return "confirmed"
    if value <= warning:
        return "caution"
    return "disagreement"


def advance_stable_state(
    stable_state,
    candidate_state,
    candidate_samples,
    raw_state,
    problem_samples=3,
    recovery_samples=3,
):
    """
    Advance a consecutive-sample state filter.

    The first observation establishes a state immediately. Later transitions
    require repeated observations so a single noisy UWB range cannot change a
    fleet-level diagnostic.
    """
    raw_state = str(raw_state)
    if stable_state is None:
        return raw_state, None, 0
    if raw_state == stable_state:
        return stable_state, None, 0
    if candidate_state == raw_state:
        candidate_samples += 1
    else:
        candidate_state = raw_state
        candidate_samples = 1
    required = (
        max(1, int(recovery_samples))
        if raw_state == "confirmed"
        else max(1, int(problem_samples))
    )
    if candidate_samples >= required:
        return raw_state, None, 0
    return stable_state, candidate_state, candidate_samples


def select_time_aligned_pair(first_records, second_records, maximum_skew):
    """
    Return the newest measurement pair inside a timestamp-skew limit.

    Header timestamps are preferred when both messages contain them. Local
    monotonic receive times are the fallback for hardware drivers that publish
    zero timestamps. If no pair satisfies the limit, the closest pair is
    returned so the caller can report the actual skew.
    """
    candidates = []
    for first in first_records:
        for second in second_records:
            first_stamp = first.get("measurement_at")
            second_stamp = second.get("measurement_at")
            if first_stamp is not None and second_stamp is not None:
                skew = abs(float(first_stamp) - float(second_stamp))
            else:
                skew = abs(
                    float(first["received_at"]) - float(second["received_at"])
                )
            freshness = min(
                float(first["received_at"]), float(second["received_at"])
            )
            candidates.append((skew, freshness, first, second))
    if not candidates:
        return None, None, None
    limit = max(0.0, float(maximum_skew))
    synchronized = [candidate for candidate in candidates if candidate[0] <= limit]
    if synchronized:
        skew, _freshness, first, second = max(
            synchronized, key=lambda value: (value[1], -value[0])
        )
    else:
        skew, _freshness, first, second = min(
            candidates, key=lambda value: (value[0], -value[1])
        )
    return first, second, skew


def _ensure_column(connection, table, name, definition):
    columns = {
        row[1] for row in connection.execute(f"PRAGMA table_info({table})")
    }
    if name not in columns:
        try:
            connection.execute(
                f"ALTER TABLE {table} ADD COLUMN {name} {definition}"
            )
        except sqlite3.OperationalError:
            # Recorder and web monitor can open the same legacy database at
            # launch. Another process may have completed this migration after
            # our PRAGMA check.
            columns = {
                row[1]
                for row in connection.execute(f"PRAGMA table_info({table})")
            }
            if name not in columns:
                raise


def open_database(path, check_same_thread=True):
    database_path = Path(path).expanduser()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        str(database_path), timeout=10.0, check_same_thread=check_same_thread
    )
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.create_function(
        "FLOOR", 1, lambda value: None if value is None else math.floor(value)
    )
    connection.create_function(
        "SQRT", 1, lambda value: None if value is None else math.sqrt(value)
    )
    connection.executescript(SCHEMA)
    _ensure_column(
        connection, "samples", "motion_state", "TEXT NOT NULL DEFAULT 'unknown'"
    )
    _ensure_column(
        connection, "samples", "commanded_speed", "REAL NOT NULL DEFAULT 0.0"
    )
    _ensure_column(
        connection, "samples", "intent_active", "INTEGER NOT NULL DEFAULT 0"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS samples_state_time_idx "
        "ON samples(motion_state, observed_at)"
    )
    return connection


def parse_time(value, default):
    """Return a UTC epoch from an ISO-8601 string or numeric epoch."""
    if value is None or str(value).strip() == "":
        return float(default)
    text = str(value).strip()
    try:
        return float(text)
    except ValueError:
        pass
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def iso_time(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace("+00:00", "Z")


def grid_counts(rows, resolution):
    counts = {}
    for row in rows:
        x, y = float(row[0]), float(row[1])
        cell = (math.floor(x / resolution), math.floor(y / resolution))
        counts[cell] = counts.get(cell, 0) + 1
    return counts


def transform_xy(x, y, translation_x=0.0, translation_y=0.0, yaw=0.0):
    """Apply a planar rigid transform and return coordinates in the target frame."""
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    return (
        float(translation_x) + cosine * float(x) - sine * float(y),
        float(translation_y) + sine * float(x) + cosine * float(y),
    )


def track_paths(rows, max_points):
    """
    Group samples into bounded trails while retaining real turns.

    A simple ``points[::stride]`` decimation can skip the samples around an
    aisle corner.  The browser then connects the two samples on either side
    of that corner with a long diagonal, which makes a path appear to cut
    through a rack.  Keep the normal evenly-spaced samples, but replace a few
    of them with samples that have a clear change in heading.
    """
    grouped = {}
    for vehicle_id, x, y, speed, observed_at in rows:
        grouped.setdefault(vehicle_id, []).append(
            [float(x), float(y), float(observed_at), float(speed)]
        )
    tracks = []
    max_points = max(1, int(max_points))
    for vehicle_id, points in sorted(grouped.items()):
        if len(points) <= max_points:
            tracks.append({"vehicle_id": vehicle_id, "points": points})
            continue

        target = max(1, int(max_points))
        if target == 1:
            tracks.append({"vehicle_id": vehicle_id, "points": [points[-1]]})
            continue
        last_index = len(points) - 1

        # Start with evenly spaced samples.  Using the full index range makes
        # the first/last samples deterministic and keeps the old behaviour
        # for straight paths (important for long histories).
        selected_indices = {
            round(index * last_index / (target - 1)) for index in range(target)
        }

        # Score heading changes.  Ignore tiny movements so localization noise
        # does not turn a straight aisle into a zig-zag line.
        turns = []
        for index in range(1, last_index):
            previous = points[index - 1]
            current = points[index]
            following = points[index + 1]
            first_x = current[0] - previous[0]
            first_y = current[1] - previous[1]
            second_x = following[0] - current[0]
            second_y = following[1] - current[1]
            first_length = math.hypot(first_x, first_y)
            second_length = math.hypot(second_x, second_y)
            if first_length < 0.12 or second_length < 0.12:
                continue
            cosine = (first_x * second_x + first_y * second_y) / (
                first_length * second_length
            )
            angle = math.acos(max(-1.0, min(1.0, cosine)))
            if angle >= math.radians(25.0):
                turns.append((angle * min(first_length, second_length), index))

        # Keep the strongest turns, with a small separation to prevent noisy
        # neighbouring samples from consuming the entire point budget.
        turns.sort(reverse=True)
        turn_indices = []
        minimum_separation = max(2, last_index // max(1, target * 3))
        for _score, index in turns:
            if all(abs(index - other) >= minimum_separation for other in turn_indices):
                turn_indices.append(index)
            if len(turn_indices) >= target - 2:
                break

        selected_indices.update(turn_indices)
        if len(selected_indices) > target:
            # Preserve endpoints and the strongest turn samples, then fill
            # remaining slots with the regular samples in time order.
            keep = {0, last_index, *turn_indices[: target - 2]}
            for index in sorted(selected_indices):
                if len(keep) >= target:
                    break
                keep.add(index)
            selected_indices = keep
        elif len(selected_indices) < target:
            # This normally only occurs when rounded regular indices collide.
            for index in range(last_index + 1):
                selected_indices.add(index)
                if len(selected_indices) >= target:
                    break

        selected = [points[index] for index in sorted(selected_indices)]
        tracks.append({"vehicle_id": vehicle_id, "points": selected})
    return tracks


def slow_clusters(tracks, radius, minimum_size):
    """Group slow vehicles while keeping every pair within the radius."""
    remaining = sorted(tracks)
    clusters = []
    radius_squared = radius * radius
    while remaining:
        cluster = [remaining.pop(0)]
        for candidate in remaining[:]:
            if all(
                (tracks[candidate][0] - tracks[member][0]) ** 2
                + (tracks[candidate][1] - tracks[member][1]) ** 2
                <= radius_squared
                for member in cluster
            ):
                cluster.append(candidate)
                remaining.remove(candidate)
        if len(cluster) >= minimum_size:
            clusters.append(cluster)
    return sorted(clusters)
