import threading
import json
import time
import pytest
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
    monitor.initialization_status = {}
    monitor.scan_received = {}
    monitor.simulation_faults_enabled = False
    monitor.simulation_vehicle_names = tuple(
        f"vehicle_{index}" for index in range(1, 5)
    )
    monitor.active_simulation_faults = {}
    monitor.last_simulation_fault_action = None
    monitor.side_tasks_enabled = False
    monitor.side_task_status = {}
    monitor.task_request_publisher = None
    monitor.fault_state_publisher = None
    monitor.fault_action_publisher = None
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


def test_selected_track_keeps_dense_route_samples_without_other_vehicles(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (?, ?, ?, ?, 0, 0.5, 'amcl', 'map', 'moving', 0.5, 1)""",
            [(float(index), float(index), "vehicle_1", index * 0.5)
             for index in range(300)]
            + [(100.0, 100.0, "vehicle_2", 999.0)],
        )
    track = monitor.selected_track({
        "vehicle_id": ["vehicle_1"], "start": ["0"], "end": ["300"],
    })
    assert len(track["points"]) == 300
    assert track["points"][149][:3] == [74.5, 0.0, 149.0]
    assert all(point[0] != 999.0 for point in track["points"])
    for query in (
        {"vehicle_id": ["vehicle_99"], "start": ["0"], "end": ["300"]},
        {"vehicle_id": ["vehicle_1"], "start": ["0"], "end": ["7200"]},
    ):
        with pytest.raises(ValueError):
            monitor.selected_track(query)



def test_selected_track_reports_recording_gaps_and_simulator_reference(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    try:
        with monitor.connection:
            monitor.connection.executemany(
                """INSERT INTO samples
                   (observed_at, vehicle_id, x, y, speed, source, frame_id)
                   VALUES (?, 'vehicle_1', ?, 0, 0.5, 'amcl', 'map')""",
                [(100.0, 0.0), (101.0, 1.0), (120.0, 2.0), (121.0, 20.0)],
            )
            monitor.connection.executemany(
                """INSERT INTO localization_metrics
                   (observed_at, vehicle_id, estimated_x, estimated_y,
                    ground_truth_x, ground_truth_y, position_error, yaw_error,
                    covariance_trace)
                   VALUES (?, 'vehicle_1', 0, 0, 0, 0, ?, 0, 0.1)""",
                [(100.0, 0.1), (101.0, 0.2), (120.0, 0.4), (121.0, 4.0)],
            )
        result = monitor.selected_track({
            "vehicle_id": ["vehicle_1"], "start": ["100"], "end": ["122"],
        })
        quality = result["quality"]
        assert len(result["points"]) == 4
        assert quality["time_basis"] == "recorder_wall_clock"
        assert quality["max_gap_s"] == 19.0
        assert quality["path_breaks"] == 2
        assert quality["frames"] == ["map"]
        assert quality["simulation_reference"]["source"] == "gazebo_ground_truth"
        assert quality["simulation_reference"]["p95_error_m"] == 4.0
    finally:
        monitor.connection.close()


def test_delivery_snapshot_waits_for_controller_and_detects_stale_heartbeat(tmp_path):
    monitor = make_monitor(tmp_path / "delivery.db")
    assert not monitor.delivery_snapshot()["online"]
    monitor._on_delivery_status(SimpleNamespace(data=json.dumps({
        "vehicles": [{"vehicle_id": "vehicle_1", "phase": "loading"}], "pending_jobs": 3,
    })))
    assert monitor.delivery_snapshot()["online"]
    assert monitor.delivery_snapshot()["vehicles"][0]["phase"] == "loading"
    monitor.delivery_status["received_at"] = time.monotonic() - 10
    assert not monitor.delivery_snapshot()["online"]
    monitor._on_delivery_status(SimpleNamespace(data='{"vehicles":42}'))
    assert not monitor.delivery_snapshot()["online"]


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
        monitor.connection.execute(
            """INSERT INTO congestion_events
               (group_key, vehicle_count, started_at, ended_at, x, y)
               VALUES ('vehicle_1,vehicle_2', 2, 130, 150, 4.2, 5.2)"""
        )

    result = monitor.query({"start": ["60"], "end": ["180"]})

    timeline = result["stuck_timeline"]
    assert timeline["bucket_seconds"] == 60
    assert len(timeline["buckets"]) == 2
    second = timeline["buckets"][1]
    assert second["start"] == 120.0
    assert second["total_vehicles"] == 3
    assert second["stuck_events"] == 3
    assert second["congestion_events"] == 1
    assert second["hotspot"]["vehicles"] == 2
    assert second["hotspot"]["vehicle_ids"] == ["vehicle_1", "vehicle_2"]
    assert second["hotspot"]["congestion_events"] == 1
    assert 4.1 < second["hotspot"]["x"] < 4.3
    monitor.connection.close()


def test_issue_timeline_focuses_the_last_actual_event_time():
    timeline = WebMonitor._stuck_timeline(
        [], 120.0, 180.0, 1.5,
        congestion_rows=[("vehicle_2,vehicle_3", 4.2, 5.2, 2, 130.0, 150.0)],
    )
    bucket = timeline["buckets"][0]
    assert bucket["end"] == 180.0
    assert bucket["hotspot"]["last_event_at"] == 150.0
    assert bucket["hotspot"]["vehicle_ids"] == ["vehicle_2", "vehicle_3"]


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
        monitor.connection.execute(
            """INSERT INTO congestion_events
               (group_key, vehicle_count, started_at, ended_at, x, y)
               VALUES ('vehicle_2,vehicle_3', 2, 325, 350, 4.2, 5.2)"""
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
    assert details["stuck"]["latest"]["vehicle_ids"] == ["vehicle_2"]
    assert details["congestion"]["vehicle_ids"] == ["vehicle_2", "vehicle_3"]
    assert details["congestion"]["latest"]["start"] == 325.0
    assert result["congestion"][0]["vehicle_ids"] == ["vehicle_2", "vehicle_3"]
    assert monitor._heat_bucket_seconds(0.0, 3600.0) == 300
    monitor.connection.close()


def test_heat_area_links_nearby_congestion_centroid_to_recorded_vehicle_cell(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    with monitor.connection:
        monitor.connection.execute(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (100, 10, 'vehicle_1', 4.1, 5.1, 0.0, 'amcl', 'map',
                       'waiting_vehicle', 0.0, 1)"""
        )
        monitor.connection.execute(
            """INSERT INTO congestion_events
               (group_key, vehicle_count, started_at, ended_at, x, y)
               VALUES ('vehicle_1,vehicle_2', 2, 100, 110, 5.0, 5.2)"""
        )
    result = monitor.query({"start": ["90"], "end": ["120"]})
    assert len(result["density"]) == 1
    nearby = result["density"][0]["time_details"]["congestion"]
    assert nearby["events"] == 1
    assert nearby["vehicle_ids"] == ["vehicle_1", "vehicle_2"]
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
    assert result["simulation_faults"]["enabled"] is False
    monitor.connection.close()


def test_localizing_interlock_overrides_recent_amcl_sample_in_health(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    with monitor.connection:
        monitor.connection.execute(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (98, 10, 'vehicle_1', 1, 2, 0.1, 'amcl', 'map',
                       'localizing', 0, 1)"""
        )
    vehicle = monitor.health_snapshot(now=100)["vehicles"][0]
    assert vehicle["status"] == "online"
    assert vehicle["localization"]["state"] == "unavailable"
    monitor.connection.close()


def test_health_snapshot_uses_observed_laserscan_freshness(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    monitor.scan_received = {
        "vehicle_1": 98.0,
        "vehicle_2": 90.0,
        "vehicle_3": 70.0,
    }
    try:
        vehicles = {
            item["vehicle_id"]: item
            for item in monitor.health_snapshot(now=100.0)["vehicles"]
        }
        assert vehicles["vehicle_1"]["lidar"]["state"] == "online"
        assert vehicles["vehicle_2"]["lidar"]["state"] == "stale"
        assert vehicles["vehicle_3"]["lidar"]["state"] == "offline"
        assert vehicles["vehicle_4"]["lidar"]["state"] == "unknown"
        assert vehicles["vehicle_2"]["lidar"]["age_seconds"] == 10.0
    finally:
        monitor.connection.close()


def test_simulation_fault_control_is_guarded_and_publishes_full_state(tmp_path):
    class Publisher:
        def __init__(self):
            self.messages = []

        def publish(self, message):
            self.messages.append(message.data)

    monitor = make_monitor(tmp_path / "traffic.db")
    try:
        monitor.set_simulation_fault(
            {"vehicle_id": "vehicle_1", "fault": "freeze", "enabled": True}
        )
    except PermissionError as error:
        assert "disabled" in str(error)
    else:
        raise AssertionError("disabled simulation fault endpoint accepted a command")

    monitor.simulation_faults_enabled = True
    monitor.fault_state_publisher = Publisher()
    monitor.fault_action_publisher = Publisher()
    result = monitor.set_simulation_fault(
        {"vehicle_id": "vehicle_1", "fault": "freeze", "enabled": True}
    )
    assert result["active"] == [
        {"vehicle_id": "vehicle_1", "faults": ["freeze"]}
    ]
    assert '"vehicle_1":["freeze"]' in monitor.fault_state_publisher.messages[-1]

    result = monitor.set_simulation_fault(
        {"action": "teleport", "vehicle_id": "vehicle_1"}
    )
    assert result["last_action"]["status"] == "requested"
    assert '"action":"teleport"' in monitor.fault_action_publisher.messages[-1]
    monitor.connection.close()


def test_side_task_control_is_guarded_and_publishes_valid_request(tmp_path):
    class Publisher:
        def __init__(self):
            self.messages = []

        def publish(self, message):
            self.messages.append(message.data)

    monitor = make_monitor(tmp_path / "traffic.db")
    try:
        monitor.set_side_task(
            {"vehicle_id": "vehicle_2", "x": 4.0, "y": 5.0}
        )
    except PermissionError as error:
        assert "disabled" in str(error)
    else:
        raise AssertionError("disabled side-task endpoint accepted a command")

    monitor.side_tasks_enabled = True
    monitor.task_request_publisher = Publisher()
    result = monitor.set_side_task(
        {
            "vehicle_id": "vehicle_2",
            "x": 4.0,
            "y": 5.0,
            "dwell_seconds": 15,
        }
    )
    assert result["simulation_only"] is True
    assert result["requested"]["vehicle_id"] == "vehicle_2"
    assert '"dwell_seconds":15.0' in monitor.task_request_publisher.messages[-1]
    monitor.connection.close()


def test_normal_turning_stays_out_of_heat_and_is_publicly_grouped_as_moving(tmp_path):
    monitor = make_monitor(tmp_path / "traffic.db")
    rows = [
        (100.0, "vehicle_1", 1.1, 2.1, 0.0, "turning"),
        (101.0, "vehicle_1", 1.1, 2.1, 0.0, "turning"),
        (102.0, "vehicle_2", 4.1, 5.1, 0.0, "turning"),
        (103.0, "vehicle_3", 4.1, 5.1, 0.0, "waiting_vehicle"),
        (104.0, "vehicle_4", 4.1, 5.1, 0.6, "moving"),
    ]
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, sim_time, vehicle_id, x, y, speed, source,
                frame_id, motion_state, commanded_speed, intent_active)
               VALUES (?, 10, ?, ?, ?, ?, 'amcl', 'map', ?, 0.8, 1)""",
            rows,
        )
    result = monitor.query({"start": ["90"], "end": ["105"]})
    assert result["samples"] == 5
    assert len(result["density"]) == 1
    cell = result["density"][0]
    assert cell["count"] == 2
    assert cell["vehicles"] == 2
    assert cell["slow_samples"] == 1
    assert cell["average_speed"] == 0.3
    peak = cell["time_details"]["peaks"]["count"]
    assert peak["count"] == 2
    assert peak["vehicle_ids"] == ["vehicle_3", "vehicle_4"]
    assert any(vehicle["vehicle_id"] == "vehicle_1"
               and vehicle["motion_state"] == "moving" for vehicle in result["latest"])
    assert any(track["vehicle_id"] == "vehicle_1" for track in result["tracks"])
    monitor.connection.close()


def test_traffic_timeline_counts_distinct_delayed_vehicles_and_active_issues(tmp_path):
    monitor = make_monitor(tmp_path / "timeline.db")
    with monitor.connection:
        monitor.connection.executemany(
            """INSERT INTO samples
               (observed_at, vehicle_id, x, y, speed, source, frame_id,
                motion_state, commanded_speed, intent_active)
               VALUES (?, ?, ?, 0, ?, 'amcl', 'map', ?, 0.5, 1)""",
            [
                (100.0, "vehicle_1", 1.0, 0.0, "waiting_vehicle"),
                (101.0, "vehicle_1", 2.0, 0.0, "waiting_vehicle"),
                (102.0, "vehicle_2", 3.0, 0.0, "blocked_obstacle"),
                (103.0, "vehicle_3", 4.0, 0.0, "turning"),
                (310.0, "vehicle_2", 3.0, 0.5, "moving"),
            ],
        )
        monitor.connection.execute(
            """INSERT INTO stuck_events
               (vehicle_id, started_at, ended_at, x, y, max_speed)
               VALUES ('vehicle_2', 100, 130, 3, 0, 0)"""
        )
        monitor.connection.execute(
            """INSERT INTO congestion_events
               (group_key, vehicle_count, started_at, ended_at, x, y)
               VALUES ('vehicle_1,vehicle_2', 2, 105, 120, 2, 0)"""
        )

    result = monitor.query({"start": ["60"], "end": ["360"]})
    timeline = result["traffic_timeline"]
    assert timeline["bucket_seconds"] == 60
    assert len(timeline["buckets"]) == 5
    first = timeline["buckets"][0]
    assert first["slow_vehicles"] == 2
    assert first["slow_vehicle_ids"] == ["vehicle_1", "vehicle_2"]
    assert first["stuck_events"] == 1
    assert first["congestion_events"] == 1
    assert first["issue_vehicle_ids"] == ["vehicle_1", "vehicle_2"]
    assert first["hotspot"]["last_event_at"] == 120.0
    second = timeline["buckets"][1]
    assert second["slow_vehicles"] == 0
    assert second["stuck_events"] == 1
    assert second["congestion_events"] == 0
    assert timeline["buckets"][-1]["slow_vehicles"] == 0
    monitor.connection.close()


def test_traffic_timeline_keeps_long_selected_ranges_compact():
    start = 0.0
    end = 90 * 86400.0
    seconds = WebMonitor._heat_bucket_seconds(start, end)
    issues = WebMonitor._stuck_timeline(
        [], start, end, 1.5, maximum_buckets=24
    )
    timeline = WebMonitor._traffic_timeline([], issues, start, end)
    assert seconds == issues["bucket_seconds"]
    assert len(timeline["buckets"]) <= 24
    assert timeline["buckets"][0]["start"] == start
    assert timeline["buckets"][-1]["end"] == end
