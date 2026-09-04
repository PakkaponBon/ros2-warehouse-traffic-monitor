import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_simulator import TrafficSimulator, readiness_allows_drive  # noqa: E402
from spawn_localized_vehicle import render_model  # noqa: E402
from uwb_amcl_initializer import (  # noqa: E402
    localization_loss_reason,
    localization_topics,
    odometry_is_stopped,
)


def test_every_profile_has_valid_starts_and_targets():
    for profile in TrafficSimulator.PROFILES.values():
        if profile.get("random_map_navigation"):
            assert profile["starts"]
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
