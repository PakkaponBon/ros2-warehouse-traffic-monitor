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
        "traffic_vehicle_count": 4,
        "health_online_after": 5.0,
        "health_offline_after": 15.0,
        "software_version": "test",
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


def test_stuck_timeline_reports_busiest_location_per_minute(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO stuck_events
               (vehicle_id, started_at, ended_at, x, y, max_speed)
               VALUES (?, ?, ?, ?, ?, 0.0)""",
            [
                ("vehicle_1", 60.0, 179.0, 4.1, 5.1),
                ("vehicle_2", 121.0, 179.0, 4.3, 5.2),
                ("vehicle_3", 125.0, 130.0, 12.0, 8.0),
            ],
        )

    result = monitor.query({"start": ["60"], "end": ["180"]})

    timeline = result["stuck_timeline"]
    assert timeline["bucket_seconds"] == 60
    assert len(timeline["buckets"]) == 2
    second = timeline["buckets"][1]
    assert second["start"] == 120.0
    assert second["total_vehicles"] == 3
    assert second["hotspot"]["vehicles"] == 2
    assert second["hotspot"]["vehicle_ids"] == ["vehicle_1", "vehicle_2"]
    assert 4.1 < second["hotspot"]["x"] < 4.3
    monitor.connection.close()


def test_heat_cells_report_metric_peak_times_and_local_stuck_history(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    rows = [
        (100.0, "vehicle_1", 4.1, 5.1, 0.8, "moving"),
        (110.0, "vehicle_2", 4.2, 5.2, 0.0, "waiting_vehicle"),
        (310.0, "vehicle_1", 4.1, 5.1, 0.0, "blocked_obstacle"),
        (320.0, "vehicle_2", 4.2, 5.2, 0.0, "stuck"),
        (330.0, "vehicle_3", 4.2, 5.2, 0.0, "waiting_vehicle"),
    ]
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (?, 10, ?, ?, ?, ?, 'amcl', 'map', ?, 0.8, 1)""",
            rows,
        )
        monitor.connection.execute(
            """INSERT INTO stuck_events
               (vehicle_id, started_at, ended_at, x, y, max_speed)
               VALUES ('vehicle_2', 315, 355, 4.2, 5.2, 0.0)"""
        )

    result = monitor.query({"start": ["60"], "end": ["600"]})

    cell = result["density"][0]
    details = cell["time_details"]
    assert details["bucket_seconds"] == 60
    assert details["peaks"]["count"]["start"] == 300.0
    assert details["peaks"]["count"]["count"] == 3
    assert details["peaks"]["vehicles"]["vehicle_ids"] == [
        "vehicle_1", "vehicle_2", "vehicle_3"
    ]
    assert details["peaks"]["slow_samples"]["slow_samples"] == 3
    assert details["peaks"]["count"]["slow_vehicle_ids"] == [
        "vehicle_1", "vehicle_2", "vehicle_3"
    ]
    assert details["peaks"]["count"]["slow_vehicle_states"] == [
        {"vehicle_id": "vehicle_1", "states": ["blocked_obstacle"]},
        {"vehicle_id": "vehicle_2", "states": ["stuck"]},
        {"vehicle_id": "vehicle_3", "states": ["waiting_vehicle"]},
    ]
    assert details["stuck"]["events"] == 1
    assert details["stuck"]["vehicle_ids"] == ["vehicle_2"]
    assert details["stuck"]["peak"]["start"] == 300.0
    assert monitor._heat_bucket_seconds(0.0, 3600.0) == 300
    monitor.connection.close()


def test_health_snapshot_distinguishes_online_stale_offline_and_unknown(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    rows = [
        (98.0, "vehicle_1", "moving"),
        (90.0, "vehicle_2", "idle"),
        (70.0, "vehicle_3", "sensor_wait"),
    ]
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (?, 10, ?, 1, 2, 0.5, 'amcl', 'map', ?, 0.5, 1)""",
            rows,
        )
        monitor.connection.execute(
            """INSERT INTO localization_validation_samples
               (observed_at, sim_time, vehicle_id, state, raw_state,
                authoritative_source, visible_tag_count, uwb_reason)
               VALUES (98, 10, 'vehicle_1', 'confirmed', 'confirmed',
                       'amcl', 4, 'ok')"""
        )

    result = monitor.health_snapshot(now=100.0)
    vehicles = {item["vehicle_id"]: item for item in result["vehicles"]}

    assert result["summary"] == {
        "total": 4,
        "online": 1,
        "stale": 1,
        "offline": 1,
        "unknown": 1,
    }
    assert vehicles["vehicle_1"]["status"] == "online"
    assert vehicles["vehicle_1"]["uwb"]["state"] == "confirmed"
    assert vehicles["vehicle_2"]["status"] == "stale"
    assert vehicles["vehicle_3"]["status"] == "offline"
    assert vehicles["vehicle_3"]["lidar"]["state"] == "unavailable"
    assert vehicles["vehicle_4"]["status"] == "unknown"
    assert vehicles["vehicle_4"]["lidar"]["state"] == "unknown"
    assert result["services"]["traffic_recorder"]["status"] == "online"
    monitor.connection.close()
