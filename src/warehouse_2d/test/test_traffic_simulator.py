import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_simulator import (  # noqa: E402
    TrafficSimulator,
    parse_side_task_request,
    readiness_allows_drive,
    resolve_random_vehicle,
)
from spawn_localized_vehicle import render_model  # noqa: E402
from simulation_faults import (  # noqa: E402
    FaultEventStore,
    fault_state_transitions,
    parse_fault_state,
    validate_fault_request,
    vehicle_names,
)
from uwb_amcl_initializer import (  # noqa: E402
    localization_loss_reason,
    localization_topics,
    odometry_is_stopped,
)


def test_every_profile_has_valid_starts_and_targets():
    for profile in TrafficSimulator.PROFILES.values():
        if profile.get("map_navigation") or profile.get("random_map_navigation"):
            assert profile["starts"]
            assert len(profile.get("fixed_routes", ())) >= len(profile["starts"])
            assert all(len(route) >= 2 for route in profile["fixed_routes"])
            continue
        waypoints = profile["waypoints"]
        if profile.get("loop"):
            assert len(profile["starts"]) == len(profile["target_indices"])
            assert all(
                0 <= index < len(waypoints)
                for index in profile["target_indices"]
            )
            continue
        assert set(profile["starts"]).issubset(waypoints)
        for point in waypoints:
            choices = [
                candidate
                for candidate in waypoints
                if candidate != point
                and (candidate[0] == point[0] or candidate[1] == point[1])
            ]
            assert choices, f"waypoint {point} is isolated"


def test_vehicle_priority_is_stable():
    assert TrafficSimulator._vehicle_number("vehicle_2") == 2
    assert TrafficSimulator._vehicle_number("unknown") == 9999


def test_random_vehicle_defaults_to_last_and_accepts_named_override():
    names = ("vehicle_1", "vehicle_2", "vehicle_3")
    assert resolve_random_vehicle("last", names) == "vehicle_3"
    assert resolve_random_vehicle("vehicle_1", names) == "vehicle_1"
    assert resolve_random_vehicle("none", names) is None


def test_random_vehicle_rejects_unconfigured_vehicle():
    try:
        resolve_random_vehicle("vehicle_9", ("vehicle_1", "vehicle_2"))
    except ValueError as error:
        assert "random_vehicle" in str(error)
    else:
        raise AssertionError("unconfigured random vehicle was accepted")


def test_side_task_assignment_and_cancellation_are_validated():
    vehicles = ("vehicle_1", "vehicle_2")
    assert parse_side_task_request(
        '{"vehicle_id":"vehicle_2","x":4.5,"y":-3,"dwell_seconds":12}',
        vehicles,
    ) == {
        "action": "assign",
        "vehicle_id": "vehicle_2",
        "x": 4.5,
        "y": -3.0,
        "dwell_seconds": 12.0,
        "task_id": "",
        "replace": False,
    }
    assert parse_side_task_request(
        '{"action":"cancel","vehicle_id":"vehicle_2"}', vehicles
    ) == {"action": "cancel", "vehicle_id": "vehicle_2"}


def test_side_task_rejects_unknown_vehicle_and_invalid_coordinates():
    vehicles = ("vehicle_1",)
    for request in (
        '{"vehicle_id":"vehicle_9","x":1,"y":2}',
        '{"vehicle_id":"vehicle_1","x":"bad","y":2}',
        '{"vehicle_id":"vehicle_1","x":1,"y":2,"dwell_seconds":-1}',
    ):
        try:
            parse_side_task_request(request, vehicles)
        except ValueError:
            pass
        else:
            raise AssertionError(f"invalid side task was accepted: {request}")


def test_localized_vehicle_template_gets_unique_topics_and_frames():
    template = (
        "__ROBOT_NAMESPACE__ __ODOM_FRAME__ __BASE_FRAME__ __LASER_FRAME__"
    )
    model = render_model(template, "/traffic/vehicle_3", "vehicle_3")
    assert model == (
        "/traffic/vehicle_3 vehicle_3/odom vehicle_3/base_link vehicle_3/laser"
    )


def test_uwb_initializer_uses_main_and_namespaced_amcl_topics():
    main = localization_topics("my_robot")
    traffic = localization_topics("vehicle_3")
    assert main["initialpose"] == "/initialpose"
    assert main["amcl_pose"] == "/amcl_pose"
    assert main["uwb_pose"] == "/traffic/my_robot/uwb_pose"
    assert traffic["initialpose"] == "/traffic/vehicle_3/initialpose"
    assert traffic["amcl_pose"] == "/traffic/vehicle_3/amcl_pose"
    assert traffic["odom"] == "/traffic/vehicle_3/odom"
    assert traffic["validation"] == "/traffic/vehicle_3/localization_validation"


def test_localization_interlock_requires_fresh_explicit_ready_state():
    now = 100.0
    assert readiness_allows_drive(
        ({"state": "ready", "drive_allowed": True}, 99.5), now, 2.0
    )
    assert not readiness_allows_drive(None, now, 2.0)
    assert not readiness_allows_drive(
        ({"state": "stopping", "drive_allowed": False}, 99.5), now, 2.0
    )
    assert not readiness_allows_drive(
        ({"state": "ready", "drive_allowed": True}, 90.0), now, 2.0
    )


def test_recovery_triggers_for_missing_amcl_or_filtered_disagreement():
    assert localization_loss_reason("confirmed", 0.2, 2.0) is None
    assert localization_loss_reason("uwb_unavailable", 0.2, 2.0) is None
    assert localization_loss_reason("disagreement", 0.2, 2.0) == (
        "persistent_uwb_disagreement"
    )
    assert localization_loss_reason("confirmed", 2.1, 2.0) == "amcl_missing"


def test_recovery_requires_fresh_stopped_odometry():
    now = 100.0
    assert odometry_is_stopped((0.01, 0.02, 99.8), now, 1.0, 0.03, 0.08)
    assert not odometry_is_stopped((0.2, 0.02, 99.8), now, 1.0, 0.03, 0.08)
    assert not odometry_is_stopped((0.01, 0.2, 99.8), now, 1.0, 0.03, 0.08)
    assert not odometry_is_stopped((0.0, 0.0, 95.0), now, 1.0, 0.03, 0.08)


def test_simulation_fault_requests_are_bounded_and_vehicle_scoped():
    allowed = vehicle_names(2)
    assert validate_fault_request(
        {
            "vehicle_id": "vehicle_2",
            "fault": "uwb_dropout",
            "enabled": True,
        },
        allowed,
    ) == {
        "action": "set",
        "vehicle_id": "vehicle_2",
        "fault": "uwb_dropout",
        "enabled": True,
    }
    assert validate_fault_request(
        {"action": "teleport", "vehicle_id": "vehicle_1"}, allowed
    )["offset_x"] == 6.0
    try:
        validate_fault_request(
            {"vehicle_id": "vehicle_9", "fault": "freeze", "enabled": True},
            allowed,
        )
    except ValueError as error:
        assert "configured" in str(error)
    else:
        raise AssertionError("unconfigured vehicle fault was accepted")


def test_fault_state_parser_ignores_unknown_faults_and_vehicles():
    state = parse_fault_state(
        '{"active":{"vehicle_1":["freeze","unknown"],"vehicle_9":["freeze"]}}',
        vehicle_names(2),
    )
    assert state == {"vehicle_1": {"freeze"}}


def test_fault_state_transitions_do_not_repeat_unchanged_faults():
    active = {"vehicle_1": {"freeze", "lidar_dropout"}}
    started, ended = fault_state_transitions({}, active)
    assert started == [
        ("vehicle_1", "freeze"),
        ("vehicle_1", "lidar_dropout"),
    ]
    assert ended == []
    assert fault_state_transitions(active, active) == ([], [])
    assert fault_state_transitions(active, {}) == ([], started)


def test_fault_event_store_records_one_interval_for_republished_state(tmp_path):
    from traffic_common import open_database

    connection = open_database(tmp_path / "traffic.db")
    store = FaultEventStore(connection, "run-1", vehicle_names(2))
    registry = '{"active":{"vehicle_1":["freeze"]}}'

    assert store.update_persistent_state(registry, 100.0, 10.0) == (
        [("vehicle_1", "freeze")],
        [],
    )
    assert store.update_persistent_state(registry, 101.0, 11.0) == ([], [])
    assert store.update_persistent_state('{"active":{}}', 105.0, 15.0) == (
        [],
        [("vehicle_1", "freeze")],
    )

    rows = connection.execute(
        """SELECT run_id, vehicle_id, fault_type, status, started_at, ended_at,
                  started_sim_time, ended_sim_time, simulation_only
           FROM fault_events"""
    ).fetchall()
    connection.close()
    assert rows == [
        ("run-1", "vehicle_1", "freeze", "cleared", 100.0, 105.0, 10.0, 15.0, 1)
    ]


def test_fault_event_store_records_terminal_action_once(tmp_path):
    from traffic_common import open_database

    connection = open_database(tmp_path / "traffic.db")
    store = FaultEventStore(connection, "run-2", vehicle_names(1))
    requested = (
        '{"action":"teleport","vehicle_id":"vehicle_1",'
        '"status":"requested","observed_at":200.0}'
    )
    succeeded = (
        '{"action":"teleport","vehicle_id":"vehicle_1",'
        '"status":"succeeded","observed_at":201.0,"detail":"updated"}'
    )

    assert not store.record_action_status(requested, 200.0, 20.0)
    assert store.record_action_status(succeeded, 201.0, 21.0)
    assert not store.record_action_status(succeeded, 201.0, 21.0)
    assert connection.execute(
        """SELECT fault_type, action, status, started_at, ended_at, detail
           FROM fault_events"""
    ).fetchall() == [
        ("teleport", "teleport", "succeeded", 201.0, 201.0, "updated")
    ]
    connection.close()
