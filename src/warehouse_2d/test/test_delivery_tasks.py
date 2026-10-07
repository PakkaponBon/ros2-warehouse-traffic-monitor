import ast
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

from types import SimpleNamespace

import pytest
import yaml
from rclpy.time import Time

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from delivery_tasks import DeliveryFleet, load_delivery_config  # noqa: E402
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


def test_expanded_halls_keep_original_road_width_and_clear_docks():
    sys.path.insert(0, str(PACKAGE / "worlds"))
    import generate_warehouse_layout_demo as layout

    world = ET.parse(PACKAGE / "worlds" / "delivery_site.world")
    models = {model.attrib["name"]: model for model in world.findall(".//model")}
    floor = models["site_floor"].findtext(".//collision/geometry/box/size")
    road = models["north_access_road"].findtext(".//visual/geometry/box/size")
    assert tuple(float(v) for v in floor.split())[:2] == (96.0, 55.2)
    assert float(road.split()[1]) == 2.4
    assert math.isclose(layout.FENCE_X, layout.SITE_WIDTH / 2 - 0.1)
    assert math.isclose(layout.FENCE_Y, layout.SITE_DEPTH / 2 - 0.1)
    assert not any(name.startswith("green_") for name in models)
    assert len(layout.PEDESTRIAN_PATHS) == 7
    gate_approaches = [road for road in layout.SITE_ROADS
                       if road[0].endswith("gate_approach")]
    for name, x, y, width, depth in (*layout.SITE_ROADS,
                                     *layout.PEDESTRIAN_PATHS):
        assert abs(x) + width / 2 <= layout.FENCE_X + 1e-6, name
        assert abs(y) + depth / 2 <= layout.FENCE_Y + 1e-6, name
        assert name in models
    for name, x, y, width, depth in layout.PEDESTRIAN_PATHS:
        assert "0.18 0.57 0.25 1" in ET.tostring(models[name], encoding="unicode")
        for gate_name, gx, gy, gw, gd in gate_approaches:
            assert (abs(x - gx) >= (width + gw) / 2 or
                    abs(y - gy) >= (depth + gd) / 2), (name, gate_name)
    gate_tree = ast.parse((PACKAGE / "scripts" / "warehouse_gate_control.py").read_text())
    gate_poses = ast.literal_eval(next(node.value for node in gate_tree.body
                                      if isinstance(node, ast.Assign)
                                      and any(isinstance(target, ast.Name) and target.id == "GATES"
                                              for target in node.targets)))
    for name, x, y, _width, _depth in layout.SLIDING_GATES:
        matching = [entry[1] for entry in gate_poses.values() if entry[0] == name]
        assert matching == [(x, y, 1.25)]

    config = load_delivery_config(PACKAGE / "config" / "warehouse_delivery.yaml")
    assert len(config["stations"]) == 48
    assert len(config["spawns"]) == 4
    assert len(config["jobs"]) == 44
    assert len(config["production_flows"]) == 4
    assert all(len(flow) == 12 for flow in config["production_flows"])
    assert all([station.rsplit("_", 1)[1] for station in flow] ==
               ["sw"] * 3 + ["nw"] * 3 + ["ne"] * 3 + ["se"] * 3
               for flow in config["production_flows"])
    hall_kinds = {
        "nw": {"part", "support"},
        "sw": {"rack"},
        "ne": {"vehicle", "support"},
        "se": {"vehicle", "support"},
    }
    for suffix, offset_x, offset_y in layout.MODULES:
        fixtures = list(layout.module_fixtures(suffix, offset_x, offset_y))
        assert {fixture[6] for fixture in fixtures} == hall_kinds[suffix]
        assert {fixture[0] for fixture in fixtures} <= models.keys()
    assert len(list(layout.module_fixtures("sw", -24.0, -13.8))) == 8
    assert len(list(layout.module_fixtures("nw", -24.0, 13.8))) == 20
    assert len(list(layout.module_fixtures("ne", 24.0, 13.8))) == 20
    assert len(list(layout.module_fixtures("se", 24.0, -13.8))) == 20
    assert models["storage_rack_west_1_sw"].find(".//link[@name='rack']") is not None
    assert "floor_load_1_sw" not in models
    assert "part_stage_1_line_1_nw" in models
    assert "vehicle_stage_1_line_1_ne" in models
    assert "vehicle_stage_6_line_4_se" in models
    assert models["vehicle_stage_6_line_4_se"].find(
        ".//visual[@name='front_bumper']") is not None
    assert models["vehicle_stage_4_line_1_se"].find(
        ".//visual[@name='dump_bed_floor']") is not None
    tires = [visual for visual in models["vehicle_stage_6_line_4_se"].findall(
        ".//visual") if visual.attrib["name"].startswith("haul_tire_")]
    assert len(tires) == 6
    signatures = ("frame_rail_0", "axle_0", "coil_0_0", "engine_block",
                  "gear_case_0", "radiator_frame", "bed_plate",
                  "ram_body_0", "pivot_beam", "cab_post_0_0",
                  "cable_reel_0", "dashboard")
    for line in range(1, 5):
        for stage in range(1, 4):
            model = models[f"part_stage_{stage}_line_{line}_nw"]
            assert model.find(f".//visual[@name='{signatures[(line - 1) * 3 + stage - 1]}']") is not None
    assert not any(name.startswith("flow_") or name in {
        "storage_to_parts", "parts_to_assembly", "assembly_to_final"}
        for name in models)

    boxes = list(layout.collision_boxes())
    for name, x, y, width, depth in boxes:
        model = models[name]
        pose = [float(value) for value in model.findtext("pose").split()]
        size = [float(value) for value in model.findtext(
            ".//collision/geometry/box/size").split()]
        assert math.isclose(pose[0], x, abs_tol=1e-6)
        assert math.isclose(pose[1], y, abs_tol=1e-6)
        assert math.isclose(size[0], width, abs_tol=1e-6)
        assert math.isclose(size[1], depth, abs_tol=1e-6)

    def clear(x, y, clearance=0.4):
        for _name, cx, cy, width, depth in boxes:
            dx = max(0.0, abs(x - cx) - width / 2)
            dy = max(0.0, abs(y - cy) - depth / 2)
            if math.hypot(dx, dy) < clearance:
                return False
        return True

    for point in config["stations"] + config["spawns"]:
        assert clear(point["x"], point["y"], clearance=0.8), point

    # The future mapping robot follows physical open aisles; no map is saved
    # or referenced by this test.
    tree = ast.parse((PACKAGE / "scripts" / "warehouse_mapping_driver.py").read_text())
    route = ast.literal_eval(next(node.value for node in tree.body
                                  if isinstance(node, ast.Assign)
                                  and any(isinstance(target, ast.Name) and target.id == "ROUTE"
                                          for target in node.targets)))
    previous = (0.0, 24.0)
    for destination in route:
        distance = math.dist(previous, destination)
        for step in range(math.ceil(distance / 0.25) + 1):
            ratio = step / max(1, math.ceil(distance / 0.25))
            point = (previous[0] + (destination[0] - previous[0]) * ratio,
                     previous[1] + (destination[1] - previous[1]) * ratio)
            assert clear(*point), (previous, destination, point)
        previous = destination


def test_road_traffic_profile_keeps_checkpoints_on_paved_routes():
    sys.path.insert(0, str(PACKAGE / "worlds"))
    import generate_warehouse_layout_demo as layout

    config = load_delivery_config(PACKAGE / "config" / "warehouse_traffic_roads.yaml")
    assert len(config["stations"]) == 20
    assert len(config["spawns"]) == 8
    assert len(config["production_flows"]) == 8
    assert [len(flow) for flow in config["production_flows"]] == [3] * 4 + [2] * 4
    names = tuple(f"vehicle_{index}" for index in range(1, 9))
    fleet = DeliveryFleet(config, names)
    positions = {name: (spawn["x"], spawn["y"]) for name, spawn in zip(names, config["spawns"])}
    assert all(fleet.assign(name, positions) is not None for name in names)
    assert not fleet.pending
    for point in config["stations"] + config["spawns"]:
        assert any(abs(point["x"] - x) <= width / 2 and
                   abs(point["y"] - y) <= depth / 2
                   for _name, x, y, width, depth in layout.SITE_ROADS), point

    profile_tree = ast.parse((PACKAGE / "scripts" / "warehouse_delivery_simulator.py").read_text())
    simulator = next(node for node in profile_tree.body
                     if isinstance(node, ast.ClassDef) and node.name == "WarehouseDeliverySimulator")
    profiles = ast.literal_eval(next(node.value for node in simulator.body
                                     if isinstance(node, ast.Assign)
                                     and any(isinstance(target, ast.Name)
                                             and target.id == "PROFILES"
                                             for target in node.targets)))
    assert profiles["warehouse_roads"]["starts"] == tuple(
        (spawn["x"], spawn["y"]) for spawn in config["spawns"])


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


def test_production_flow_unlocks_only_the_next_stage():
    config = {
        "stations": [{"id": name, "x": index * 5.0, "y": 0.0}
                     for index, name in enumerate(("start", "build", "finish"))],
        "production_flows": [["start", "build", "finish"]],
        "jobs": [{"pickup": "start", "dropoff": "build"},
                 {"pickup": "build", "dropoff": "finish"}],
        "loading_seconds": 0.0, "unloading_seconds": 0.0,
        "repeat_jobs": True,
    }
    fleet = DeliveryFleet(config, ("vehicle_1", "vehicle_2"))
    positions = {"vehicle_1": (-2, 0), "vehicle_2": (-2, 4)}
    assert fleet.assign("vehicle_2", positions) is not None
    assert fleet.assign("vehicle_1", positions) is None
    for pickup, dropoff in ((0.0, 5.0), (5.0, 10.0)):
        task = fleet.tasks["vehicle_2"]
        assert task.pickup == ("start" if pickup == 0.0 else "build")
        fleet.advance("vehicle_2", (pickup, 0), 0)
        fleet.advance("vehicle_2", (pickup, 0), 0)
        fleet.advance("vehicle_2", (dropoff, 0), 0)
        assert fleet.advance("vehicle_2", (dropoff, 0), 0) == "completed"
        if dropoff == 5.0:
            assert list(fleet.pending) == [("build", "finish")]
            fleet.assign("vehicle_2", {"vehicle_2": (5, 0)})
    assert list(fleet.pending) == [("start", "build")]


def test_delivery_config_rejects_unknown_and_duplicate_stations(tmp_path):
    source = yaml.safe_load((PACKAGE / "config" / "warehouse_delivery.yaml").read_text())
    invalid = tmp_path / "jobs.yaml"
    source["production_flows"][0][0] = "missing"
    invalid.write_text(yaml.safe_dump(source))
    with pytest.raises(ValueError, match="unknown station"):
        load_delivery_config(invalid)
    source["production_flows"][0][0] = source["stations"][0]["id"]
    source["stations"][1]["id"] = source["stations"][0]["id"]
    invalid.write_text(yaml.safe_dump(source))
    with pytest.raises(ValueError, match="unique"):
        load_delivery_config(invalid)



def test_recorder_keeps_stopped_amcl_vehicle_online_only_with_fresh_map_tf(monkeypatch):
    recorder = TrafficRecorder.__new__(TrafficRecorder)
    recorder.traffic_vehicle_count = 1
    recorder.stale_after = 5.0
    recorder.tracks = {
        "vehicle_1": Track(1.0, 2.0, 0.0, 0.0, "amcl", "map", covariance_trace=0.2)
    }
    recorder.traffic_speeds = {"vehicle_1": 0.0}
    recorder.traffic_speed_received = {"vehicle_1": 100.0}
    monkeypatch.setattr("traffic_recorder.time.monotonic", lambda: 100.0)
    monkeypatch.setattr(
        recorder, "get_clock",
        lambda: SimpleNamespace(now=lambda: SimpleNamespace(nanoseconds=100_000_000_000)),
    )

    def transform(stamp):
        return SimpleNamespace(
            header=SimpleNamespace(stamp=Time(seconds=stamp).to_msg()),
            transform=SimpleNamespace(
                translation=SimpleNamespace(x=3.0, y=4.0),
                rotation=SimpleNamespace(x=0.0, y=0.0, z=0.0, w=1.0),
            ),
        )

    recorder.tf_buffer = SimpleNamespace(lookup_transform=lambda *_: transform(96))
    recorder.refresh_traffic_tf()
    assert recorder.tracks["vehicle_1"].received_at == 0.0

    recorder.tf_buffer = SimpleNamespace(lookup_transform=lambda *_: transform(100))
    recorder.refresh_traffic_tf()
    track = recorder.tracks["vehicle_1"]
    assert (track.x, track.y, track.speed) == (3.0, 4.0, 0.0)
    assert track.received_at == 100.0
    assert track.source == "amcl_tf_with_odom_speed"
    assert track.covariance_trace == 0.2


def test_recorder_does_not_accept_tf_before_first_amcl_pose(monkeypatch):
    recorder = TrafficRecorder.__new__(TrafficRecorder)
    recorder.traffic_vehicle_count = 1
    recorder.tracks = {}
    recorder.tf_buffer = SimpleNamespace(
        lookup_transform=lambda *_: pytest.fail("TF must not replace initial AMCL localization")
    )
    monkeypatch.setattr(
        recorder, "get_clock",
        lambda: SimpleNamespace(now=lambda: SimpleNamespace(nanoseconds=100_000_000_000)),
    )
    recorder.refresh_traffic_tf()
    assert recorder.tracks == {}
