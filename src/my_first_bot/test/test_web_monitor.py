import threading
from types import SimpleNamespace
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_common import open_database  # noqa: E402
from grid_planner import OccupancyGridPlanner  # noqa: E402
from web_monitor import WebMonitor  # noqa: E402


def make_monitor(database):
    monitor = WebMonitor.__new__(WebMonitor)
    monitor.connection = open_database(database, check_same_thread=False)
    monitor.lock = threading.Lock()
    monitor.validation_status = {}
    parameters = {
        "grid_resolution": 0.5,
        "event_resolution": 1.5,
        "slow_speed": 0.05,
        "latest_max_age": 10.0,
        "max_track_points": 240,
        "max_analysis_samples": 100000,
    }
    monitor.get_parameter = lambda name: SimpleNamespace(value=parameters[name])
    return monitor


def test_historical_query_returns_recorded_validation_not_live_cache(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    with monitor.connection:
        monitor.connection.execute(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (100, 10, 'vehicle_1', 1, 2, 0.5, 'amcl', 'map',
                       'moving', 0.5, 1)"""
        )
        monitor.connection.execute(
            """INSERT INTO localization_validation_samples
               (observed_at, sim_time, vehicle_id, state, raw_state,
                authoritative_source, amcl_x, amcl_y, uwb_x, uwb_y, error_m,
                visible_tag_count, uwb_residual_m, measurement_skew_s,
                amcl_age_s, uwb_age_s, amcl_stamp, uwb_stamp, uwb_reason)
               VALUES (100, 10, 'vehicle_1', 'caution', 'caution', 'amcl',
                       1, 2, 1.6, 2, 0.6, 4, 0.1, 0.04,
                       0.1, 0.1, 10, 10.04, 'ok')"""
        )
    monitor.validation_status["vehicle_1"] = {
        "vehicle_id": "vehicle_1",
        "state": "disagreement",
        "received_at": 10**12,
    }

    result = monitor.query({"start": ["90"], "end": ["105"]})

    assert result["uwb_validation"]["historical"] is True
    assert result["uwb_validation"]["live"] is False
    assert result["uwb_validation"]["summary"]["caution"] == 1
    assert result["uwb_validation"]["vehicles"][0]["state"] == "caution"
    assert result["uwb_validation"]["vehicles"][0]["measurement_skew_s"] == 0.04
    monitor.connection.close()


def test_route_suggestion_is_advisory_and_returns_two_routes(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    monitor.route_planner = OccupancyGridPlanner(
        1.0,
        (0.0, 0.0),
        7,
        3,
        {(x, y) for x in range(7) for y in range(3)},
    )
    monitor.map_info = {
        "image": "test.png",
        "width": 7,
        "height": 3,
        "resolution": 1.0,
    }
    rows = [
        (100.0, "vehicle_1", 0.5, 1.5, 0.8, "moving"),
        (100.0, "vehicle_2", 2.5, 1.5, 0.0, "waiting_vehicle"),
        (101.0, "vehicle_2", 3.5, 1.5, 0.0, "waiting_vehicle"),
        (102.0, "vehicle_2", 4.5, 1.5, 0.0, "waiting_vehicle"),
    ]
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (?, 10, ?, ?, ?, ?, 'amcl', 'map', ?, 0.8, 1)""",
            rows,
        )

    result = monitor.suggest_route({
        "vehicle_id": "vehicle_1",
        "destination": {"x": 6.5, "y": 1.5},
        "start": 90,
        "end": 110,
        "nominal_speed_mps": 0.8,
    })

    assert result["advisory_only"] is True
    assert result["vehicle_id"] == "vehicle_1"
    assert result["baseline"]["points"][0] == [0.5, 1.5]
    assert result["suggested"]["points"][-1] == [6.5, 1.5]
    assert result["suggested"]["risk_score"] <= result["baseline"]["risk_score"]
    assert "command" not in result
    monitor.connection.close()
