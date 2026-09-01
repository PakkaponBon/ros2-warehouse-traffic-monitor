import math
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_common import (  # noqa: E402
    advance_stable_state,
    classify_localization_error,
    classify_motion_state,
    grid_counts,
    motion_state_is_problem,
    open_database,
    parse_time,
    slow_clusters,
    select_time_aligned_pair,
    track_paths,
    transform_xy,
)


def test_parse_time_accepts_iso_utc_and_epoch():
    expected = 1_787_724_000.0
    assert parse_time("2026-08-26T06:00:00Z", 0) == expected
    assert parse_time(str(expected), 0) == expected


def test_grid_counts_handles_negative_coordinates():
    assert grid_counts([(-0.1, -0.1), (-0.4, -0.2), (0.1, 0.1)], 0.5) == {
        (-1, -1): 2,
        (0, 0): 1,
    }


def test_slow_clusters_rejects_wide_transitive_chains():
    tracks = {"a": (0.0, 0.0), "b": (1.0, 0.0), "c": (2.0, 0.0), "d": (9.0, 9.0)}
    assert slow_clusters(tracks, radius=1.1, minimum_size=3) == []


def test_slow_clusters_keeps_compact_groups():
    tracks = {"a": (0.0, 0.0), "b": (0.5, 0.0), "c": (0.25, 0.4)}
    assert slow_clusters(tracks, radius=0.7, minimum_size=3) == [["a", "b", "c"]]


def test_transform_xy_applies_translation_and_rotation():
    x, y = transform_xy(1.0, 0.0, translation_x=2.0, translation_y=3.0, yaw=math.pi / 2)
    assert x == pytest.approx(2.0)
    assert y == pytest.approx(4.0)


@pytest.mark.parametrize(
    ("speed", "linear", "angular", "reported", "expected", "intent"),
    [
        (0.6, 0.6, 0.0, "moving", "moving", True),
        (0.0, 0.0, 0.8, "turning", "turning", True),
        (0.0, 0.0, 0.0, "waiting_vehicle", "waiting_vehicle", True),
        (0.0, 0.0, 0.0, "blocked_obstacle", "blocked_obstacle", True),
        (0.0, 0.5, 0.0, "moving", "stalled", True),
        (0.0, 0.0, 0.0, "idle", "idle", False),
    ],
)
def test_motion_state_uses_controller_context(
    speed, linear, angular, reported, expected, intent
):
    assert classify_motion_state(speed, linear, angular, reported) == (
        expected,
        intent,
    )


def test_only_operational_delay_counts_as_problem_state():
    assert motion_state_is_problem("waiting_vehicle", 0.0)
    assert motion_state_is_problem("blocked_obstacle", 0.0)
    assert not motion_state_is_problem("turning", 0.0)
    assert not motion_state_is_problem("idle", 0.0)


def test_track_paths_preserves_last_point_when_decimating():
    rows = [("vehicle_1", index, 0.0, 0.5, index) for index in range(7)]
    tracks = track_paths(rows, max_points=3)
    assert tracks[0]["vehicle_id"] == "vehicle_1"
    assert [point[2] for point in tracks[0]["points"]] == [0.0, 3.0, 6.0]


def test_track_paths_retains_aisle_turn_when_decimating():
    rows = [("vehicle_1", float(index), 0.0, 0.5, float(index)) for index in range(11)]
    rows.extend(
        ("vehicle_1", 10.0, float(index), 0.5, float(10 + index))
        for index in range(1, 11)
    )
    tracks = track_paths(rows, max_points=5)
    assert any(point[0] == pytest.approx(10.0) and point[1] == pytest.approx(0.0)
               for point in tracks[0]["points"])


def test_database_includes_localization_performance_table(tmp_path):
    connection = open_database(tmp_path / "traffic.db")
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    assert "localization_metrics" in tables
    assert "localization_validation_samples" in tables
    assert connection.execute(
        "SELECT SQRT(AVG(position_error)) FROM localization_metrics"
    ).fetchone()[0] is None
    connection.close()


def test_database_migrates_existing_samples_with_motion_context(tmp_path):
    database = tmp_path / "traffic.db"
    legacy = sqlite3.connect(database)
    legacy.execute(
        """CREATE TABLE samples (
               id INTEGER PRIMARY KEY, observed_at REAL NOT NULL,
               sim_time REAL, vehicle_id TEXT NOT NULL, x REAL NOT NULL,
               y REAL NOT NULL, speed REAL NOT NULL, source TEXT NOT NULL,
               frame_id TEXT NOT NULL DEFAULT 'map'
           )"""
    )
    legacy.close()
    connection = open_database(database)
    columns = {
        row[1] for row in connection.execute("PRAGMA table_info(samples)")
    }
    connection.close()
    assert {"motion_state", "commanded_speed", "intent_active"} <= columns


def test_localization_error_hysteresis_resists_threshold_flicker():
    assert classify_localization_error(0.55, "confirmed") == "confirmed"
    assert classify_localization_error(0.70, "confirmed") == "caution"
    assert classify_localization_error(0.95, "disagreement") == "disagreement"
    assert classify_localization_error(0.80, "disagreement") == "caution"


def test_localization_state_requires_consecutive_distinct_samples():
    stable, candidate, count = advance_stable_state(
        None, None, 0, "confirmed"
    )
    assert (stable, candidate, count) == ("confirmed", None, 0)

    for expected_count in (1, 2):
        stable, candidate, count = advance_stable_state(
            stable, candidate, count, "disagreement", problem_samples=3
        )
        assert stable == "confirmed"
        assert candidate == "disagreement"
        assert count == expected_count

    stable, candidate, count = advance_stable_state(
        stable, candidate, count, "disagreement", problem_samples=3
    )
    assert (stable, candidate, count) == ("disagreement", None, 0)


def test_time_aligned_pair_prefers_newest_synchronized_measurements():
    amcl = [
        {"measurement_at": 10.0, "received_at": 20.0, "x": 1.0},
        {"measurement_at": 12.0, "received_at": 22.0, "x": 2.0},
    ]
    uwb = [
        {"measurement_at": 10.05, "received_at": 20.1, "x": 1.1},
        {"measurement_at": 12.08, "received_at": 22.1, "x": 2.1},
    ]
    selected_amcl, selected_uwb, skew = select_time_aligned_pair(
        amcl, uwb, maximum_skew=0.1
    )
    assert selected_amcl["x"] == 2.0
    assert selected_uwb["x"] == 2.1
    assert skew == pytest.approx(0.08)


def test_time_aligned_pair_reports_closest_pair_when_none_are_synchronized():
    amcl = [{"measurement_at": 10.0, "received_at": 20.0}]
    uwb = [{"measurement_at": 10.5, "received_at": 20.1}]
    _selected_amcl, _selected_uwb, skew = select_time_aligned_pair(
        amcl, uwb, maximum_skew=0.1
    )
    assert skew == pytest.approx(0.5)
