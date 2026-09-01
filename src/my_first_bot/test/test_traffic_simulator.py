import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_simulator import TrafficSimulator  # noqa: E402
from spawn_localized_vehicle import render_model  # noqa: E402
from uwb_amcl_initializer import localization_topics  # noqa: E402


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
