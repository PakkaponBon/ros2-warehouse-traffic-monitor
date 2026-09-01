import random
import sys
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image


PACKAGE_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(PACKAGE_ROOT / "scripts"))
sys.path.insert(0, str(PACKAGE_ROOT / "worlds"))

from generate_real_warehouse import (  # noqa: E402
    MAP_ORIGIN,
    MAP_PGM_PATH,
    MAP_RESOLUTION,
    MAP_YAML_PATH,
    OBSTACLES,
    UWB_TAGS,
    WORLD_PATH,
)
from grid_planner import OccupancyGridPlanner  # noqa: E402
from spawn_localized_vehicle import select_random_poses  # noqa: E402
from prepare_slam_map import prepare_map  # noqa: E402


def map_pixel(image, x, y):
    """Read a map pixel at one ROS world coordinate."""
    pixel_x = round((x - MAP_ORIGIN[0]) / MAP_RESOLUTION)
    pixel_y = image.height - round((y - MAP_ORIGIN[1]) / MAP_RESOLUTION)
    return image.getpixel((pixel_x, pixel_y))


def test_world_contains_every_mapped_obstacle_and_uwb_anchor():
    tree = ElementTree.parse(WORLD_PATH)
    names = {model.attrib["name"] for model in tree.findall(".//model")}
    assert {obstacle[0] for obstacle in OBSTACLES} <= names
    assert {f"uwb_{tag[0]}" for tag in UWB_TAGS} <= names


def test_occupancy_map_matches_obstacle_centres_and_open_cross_aisle():
    image = Image.open(MAP_PGM_PATH).convert("L")
    for _name, x, y, _size_x, _size_y, _height, _category in OBSTACLES:
        assert map_pixel(image, x, y) < 50
    assert map_pixel(image, 0.0, 0.0) > 250
    assert map_pixel(image, 0.0, -15.0) > 250


def test_real_warehouse_has_long_connected_routes():
    planner = OccupancyGridPlanner.from_yaml(
        MAP_YAML_PATH, planning_resolution=0.30, robot_radius=0.55
    )
    route, goal = planner.random_path(
        (0.0, -15.0), random.Random(42), minimum_distance=25.0
    )
    assert goal is not None
    assert route


def test_real_warehouse_has_eight_safe_vehicle_starts():
    planner = OccupancyGridPlanner.from_yaml(
        MAP_YAML_PATH, planning_resolution=0.30, robot_radius=0.80
    )
    poses = select_random_poses(planner, requested=8, seed=42)
    assert len(poses) == 8
    for index, (x, y, _yaw) in enumerate(poses):
        assert planner.world_to_cell(x, y) in planner.free
        assert all(
            ((x - other_x) ** 2 + (y - other_y) ** 2) ** 0.5 >= 3.0
            for other_x, other_y, _other_yaw in poses[index + 1:]
        )


def test_slam_configuration_uses_mapping_vehicle_frames():
    import yaml

    configuration = yaml.safe_load(
        (PACKAGE_ROOT / "config" / "real_warehouse_slam.yaml").read_text(
            encoding="utf-8"
        )
    )["slam_toolbox"]["ros__parameters"]
    assert configuration["mode"] == "mapping"
    assert configuration["map_frame"] == "map"
    assert configuration["odom_frame"] == "vehicle_1/odom"
    assert configuration["base_frame"] == "vehicle_1/base_link"
    assert configuration["scan_topic"] == "/traffic/vehicle_1/scan"


def test_saved_slam_map_can_be_prepared_for_the_web(tmp_path):
    source = tmp_path / "mapping.pgm"
    Image.new("L", (20, 10), 254).save(source)
    yaml_path = tmp_path / "mapping.yaml"
    yaml_path.write_text(
        "image: mapping.pgm\nresolution: 0.05\norigin: [0, 0, 0]\n",
        encoding="utf-8",
    )
    destination = prepare_map(yaml_path)
    assert destination == tmp_path / "mapping.png"
    assert Image.open(destination).size == (20, 10)
