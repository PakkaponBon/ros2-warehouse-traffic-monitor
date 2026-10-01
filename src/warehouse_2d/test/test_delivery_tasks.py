import math
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from delivery_tasks import DeliveryFleet, load_delivery_config, transform_xy  # noqa: E402
from grid_planner import OccupancyGridPlanner  # noqa: E402
from traffic_common import classify_motion_state  # noqa: E402
from traffic_recorder import Track, TrafficRecorder  # noqa: E402


PACKAGE = Path(__file__).parents[1]


def make_fleet(repeat=False):
    return DeliveryFleet({
        "stations": [{"id": name, "x": index * 5.0, "y": 0.0}
                     for index, name in enumerate(("a", "b", "c", "d"))],
        "jobs": [{"pickup": "a", "dropoff": "b"}, {"pickup": "b", "dropoff": "c"},
                 {"pickup": "c", "dropoff": "d"}],
        "loading_seconds": 4.0, "unloading_seconds": 3.0, "repeat_jobs": repeat,
    }, ("vehicle_1", "vehicle_2"))


def test_job_requires_physical_arrival_and_both_dwell_periods():
    fleet = make_fleet()
    fleet.assign("vehicle_1", {"vehicle_1": (-2.0, 0.0)})
    assert fleet.advance("vehicle_1", (-2.0, 0.0), 0.0) is None
    assert fleet.advance("vehicle_1", (0.0, 0.0), 10.0) == "loading"
    assert fleet.target("vehicle_1") is None
    assert not fleet.vehicle_status("vehicle_1")["carrying"]
    assert fleet.advance("vehicle_1", (0.0, 0.0), 13.9) is None
    assert fleet.advance("vehicle_1", (0.0, 0.0), 14.0) == "to_dropoff"
    assert fleet.vehicle_status("vehicle_1")["carrying"]
    assert fleet.advance("vehicle_1", (3.0, 0.0), 20.0) is None
    assert fleet.completed["vehicle_1"] == 0
    assert fleet.advance("vehicle_1", (5.0, 0.0), 25.0) == "unloading"
    assert fleet.advance("vehicle_1", (5.0, 0.0), 27.9) is None
    assert fleet.advance("vehicle_1", (5.0, 0.0), 28.0) == "completed"
    assert fleet.completed["vehicle_1"] == 1
    assert not fleet.vehicle_status("vehicle_1")["carrying"]


def test_reserved_dropoff_prevents_a_second_job_claiming_it():
    fleet = make_fleet()
    positions = {"vehicle_1": (-3.0, 1.0), "vehicle_2": (-3.0, 4.0)}
    first = fleet.assign("vehicle_1", positions)
    second = fleet.assign("vehicle_2", positions)
    assert (first.pickup, first.dropoff) == ("a", "b")
    assert (second.pickup, second.dropoff) == ("c", "d")


def test_idle_truck_at_dock_keeps_another_truck_out():
    fleet = make_fleet()
    task = fleet.assign("vehicle_1", {"vehicle_1": (-3, 0), "vehicle_2": (5, 0)})
    assert "b" not in (task.pickup, task.dropoff)
    assert fleet.assign("vehicle_2", {"vehicle_1": (-3, 0), "vehicle_2": (5, 0)}).pickup == "a"


def test_loading_restarts_if_truck_leaves_dock_and_pause_does_not_finish_dwell():
    fleet = make_fleet()
    fleet.assign("vehicle_1", {"vehicle_1": (0, 0)})
    fleet.advance("vehicle_1", (0, 0), 10)
    assert fleet.advance("vehicle_1", (0, 0), 10) is None
    assert fleet.advance("vehicle_1", (1, 0), 15) == "to_pickup"
    assert fleet.advance("vehicle_1", (0, 0), 16) == "loading"
    assert fleet.advance("vehicle_1", (0, 0), 19) is None
    assert fleet.advance("vehicle_1", (0, 0), 20) == "to_dropoff"


def test_repeating_job_returns_to_queue_after_completion():
    fleet = make_fleet(repeat=True)
    fleet.assign("vehicle_1", {"vehicle_1": (0, 0)})
    fleet.advance("vehicle_1", (0, 0), 0)
    fleet.advance("vehicle_1", (0, 0), 4)
    fleet.advance("vehicle_1", (5, 0), 10)
    fleet.advance("vehicle_1", (5, 0), 13)
    assert list(fleet.pending)[-1] == ("a", "b")
    assert fleet.completed["vehicle_1"] == 1


def test_crtt_job_endpoints_and_starts_have_routes_on_saved_map():
    config = load_delivery_config(PACKAGE / "config" / "crtt_delivery.yaml")
    alignment = (-1.775, 0.004, 0.0011)
    fleet = DeliveryFleet(config, ("vehicle_1",), alignment)
    planner = OccupancyGridPlanner.from_yaml(PACKAGE / "maps" / "crtt_layout_slam2.yaml", 0.15, 0.80)
    for station in fleet.stations.values():
        cell = planner.nearest_free(*station["point"], maximum_radius=3)
        assert cell is not None
        assert math.dist(station["point"], planner.cell_to_world(cell)) < 0.35
    for spawn in config["spawns"]:
        start = transform_xy(spawn["x"], spawn["y"], *alignment)
        for station in fleet.stations.values():
            path, _ = planner.path_to_goal(start, station["point"])
            assert path, f"No route from {start} to {station}"
    for job in config["jobs"]:
        path, _ = planner.path_to_goal(fleet.stations[job["pickup"]]["point"],
                                       fleet.stations[job["dropoff"]]["point"])
        assert path, f"No route for {job}"


def test_loading_and_unloading_are_intentional_stops():
    for state in ("loading", "unloading"):
        assert classify_motion_state(0.0, reported_state=state) == (state, False)


def test_stationary_odom_refreshes_speed_without_masking_stale_amcl():
    recorder = TrafficRecorder.__new__(TrafficRecorder)
    recorder.traffic_speeds = {}
    recorder.traffic_speed_received = {}
    track = Track(1.0, 2.0, 0.4, 123.0, "amcl_with_odom_speed", "map")
    recorder.tracks = {"vehicle_1": track}
    message = SimpleNamespace(twist=SimpleNamespace(twist=SimpleNamespace(
        linear=SimpleNamespace(x=0.0, y=0.0))))
    recorder.on_traffic_odom("vehicle_1", message)
    assert track.speed == 0.0
    assert track.received_at == 123.0
    assert classify_motion_state(track.speed, reported_state="loading") == ("loading", False)
    message.twist.twist.linear.x = 0.3
    message.twist.twist.linear.y = 0.4
    recorder.on_traffic_odom("vehicle_1", message)
    assert track.speed == 0.5
    assert track.received_at == 123.0


def test_delivery_config_rejects_unknown_and_duplicate_stations(tmp_path):
    source = (PACKAGE / "config" / "crtt_delivery.yaml").read_text()
    invalid = tmp_path / "jobs.yaml"
    invalid.write_text(source.replace("pickup: receiving", "pickup: missing"))
    with pytest.raises(ValueError, match="unknown station"):
        load_delivery_config(invalid)
    invalid.write_text(source.replace("id: warehouse_bay", "id: receiving"))
    with pytest.raises(ValueError, match="unique"):
        load_delivery_config(invalid)
