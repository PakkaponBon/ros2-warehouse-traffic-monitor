#!/usr/bin/env python3
"""Generate a realistic Gazebo warehouse and its matching ROS occupancy map."""

from pathlib import Path

from PIL import Image, ImageDraw


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORLD_PATH = PACKAGE_ROOT / "worlds" / "real_warehouse.world"
MAP_PGM_PATH = PACKAGE_ROOT / "maps" / "real_warehouse.pgm"
MAP_PNG_PATH = PACKAGE_ROOT / "maps" / "real_warehouse.png"
MAP_YAML_PATH = PACKAGE_ROOT / "maps" / "real_warehouse.yaml"
UWB_CONFIG_PATH = PACKAGE_ROOT / "config" / "real_warehouse_uwb_tags.yaml"

MAP_ORIGIN = (-32.0, -22.0)
MAP_SIZE = (64.0, 44.0)
MAP_RESOLUTION = 0.05

WALL_COLOR = "0.36 0.39 0.42 1"
RACK_COLOR = "0.12 0.24 0.42 1"
RACK_BEAM_COLOR = "0.95 0.55 0.08 1"
CONCRETE_COLOR = "0.42 0.44 0.45 1"
OFFICE_COLOR = "0.72 0.75 0.77 1"
PALLET_COLOR = "0.50 0.29 0.10 1"
BOX_COLOR = "0.67 0.48 0.25 1"


# Every footprint in this list is written to both Gazebo and the occupancy map.
# Values are: name, centre x, centre y, size x, size y, height, category.
OBSTACLES = [
    ("north_wall", 0.0, 20.0, 60.6, 0.35, 5.5, "wall"),
    ("south_wall", 0.0, -20.0, 60.6, 0.35, 5.5, "wall"),
    ("west_wall", -30.0, 0.0, 0.35, 40.0, 5.5, "wall"),
    ("east_wall", 30.0, 0.0, 0.35, 40.0, 5.5, "wall"),
    ("office_block", -24.0, 14.8, 9.5, 7.0, 3.2, "room"),
    ("battery_room", 24.7, 15.0, 7.0, 6.5, 3.2, "room"),
]

for rack_row, rack_y in enumerate((-10.0, -5.0, 0.0, 5.0, 10.0), start=1):
    OBSTACLES.extend(
        [
            (
                f"rack_{rack_row}_west",
                -14.0,
                rack_y,
                18.0,
                1.2,
                3.6,
                "rack",
            ),
            (
                f"rack_{rack_row}_east",
                14.0,
                rack_y,
                18.0,
                1.2,
                3.6,
                "rack",
            ),
        ]
    )

OBSTACLES.extend(
    [
        ("pallet_west_1", -26.2, -11.8, 2.2, 1.5, 1.4, "pallet"),
        ("pallet_west_2", -26.2, -6.8, 2.2, 1.5, 1.0, "pallet"),
        ("pallet_west_3", -26.2, 1.8, 2.2, 1.5, 1.7, "pallet"),
        ("pallet_east_1", 26.2, -9.0, 2.2, 1.5, 1.3, "pallet"),
        ("pallet_east_2", 26.2, -3.8, 2.2, 1.5, 1.6, "pallet"),
        ("pallet_east_3", 26.2, 6.5, 2.2, 1.5, 1.1, "pallet"),
        ("staging_pallet_1", -8.0, -16.2, 2.0, 1.4, 1.2, "pallet"),
        ("staging_pallet_2", 8.0, -16.2, 2.0, 1.4, 1.5, "pallet"),
    ]
)

UWB_TAGS = [
    ("anchor_sw", -28.5, -18.5, 3.6),
    ("anchor_s", 0.0, -18.5, 3.6),
    ("anchor_se", 28.5, -18.5, 3.6),
    ("anchor_w", -28.5, 0.0, 3.6),
    ("anchor_e", 28.5, 0.0, 3.6),
    ("anchor_nw", -28.5, 18.5, 3.6),
    ("anchor_n", 0.0, 18.5, 3.6),
    ("anchor_ne", 28.5, 18.5, 3.6),
]


def material(color):
    """Return an SDF material using one RGBA color."""
    return f"""
          <material>
            <ambient>{color}</ambient>
            <diffuse>{color}</diffuse>
          </material>"""


def box_model(name, x, y, size_x, size_y, height, color):
    """Create one static box with matching collision and visual geometry."""
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} {height / 2.0} 0 0 0</pose>
      <link name="link">
        <collision name="collision">
          <geometry><box><size>{size_x} {size_y} {height}</size></box></geometry>
          <surface><friction><ode><mu>0.9</mu><mu2>0.9</mu2></ode></friction></surface>
        </collision>
        <visual name="visual">
          <geometry><box><size>{size_x} {size_y} {height}</size></box></geometry>
{material(color)}
        </visual>
      </link>
    </model>"""


def rack_model(name, x, y, length, depth, height):
    """Create an industrial rack with beams, decks, loads, and one footprint."""
    visuals = []
    for index, upright_x in enumerate((-length / 2.0, -length / 6.0, length / 6.0, length / 2.0)):
        for side, upright_y in enumerate((-depth / 2.0, depth / 2.0)):
            visuals.append(
                f"""
        <visual name="upright_{index}_{side}">
          <pose>{upright_x} {upright_y} {height / 2.0} 0 0 0</pose>
          <geometry><box><size>0.12 0.12 {height}</size></box></geometry>
{material(RACK_COLOR)}
        </visual>"""
            )
    for level, z in enumerate((0.65, 1.65, 2.65, 3.5)):
        visuals.append(
            f"""
        <visual name="beam_{level}">
          <pose>0 0 {z} 0 0 0</pose>
          <geometry><box><size>{length} {depth} 0.12</size></box></geometry>
{material(RACK_BEAM_COLOR)}
        </visual>"""
        )
    for load_index, load_x in enumerate(
        (-length * 0.38, -length * 0.18, length * 0.03, length * 0.25, length * 0.41)
    ):
        level = load_index % 3
        visuals.append(
            f"""
        <visual name="load_{load_index}">
          <pose>{load_x} 0 {0.92 + level} 0 0 0</pose>
          <geometry><box><size>1.25 {depth * 0.78} 0.48</size></box></geometry>
{material(BOX_COLOR)}
        </visual>"""
        )
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} 0 0 0 0</pose>
      <link name="rack">
        <collision name="rack_footprint">
          <pose>0 0 {height / 2.0} 0 0 0</pose>
          <geometry><box><size>{length} {depth} {height}</size></box></geometry>
        </collision>
{''.join(visuals)}
      </link>
    </model>"""


def floor_marking(name, x, y, size_x, size_y, color):
    """Create a visual-only floor marking that does not block vehicles."""
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} 0.012 0 0 0</pose>
      <link name="marking">
        <visual name="visual">
          <geometry><box><size>{size_x} {size_y} 0.012</size></box></geometry>
{material(color)}
        </visual>
      </link>
    </model>"""


def tag_model(tag_id, x, y, z):
    """Create a visible wall-mounted UWB anchor without collision geometry."""
    return f"""
    <model name="uwb_{tag_id}">
      <static>true</static>
      <pose>{x} {y} {z} 0 0 0</pose>
      <link name="tag">
        <visual name="body">
          <geometry><box><size>0.28 0.12 0.20</size></box></geometry>
{material('0.92 0.12 0.82 1')}
        </visual>
      </link>
    </model>"""


def generate_world():
    """Write the Gazebo Classic SDF world."""
    models = []
    for name, x, y, size_x, size_y, height, category in OBSTACLES:
        if category == "rack":
            models.append(rack_model(name, x, y, size_x, size_y, height))
        else:
            color = {
                "wall": WALL_COLOR,
                "room": OFFICE_COLOR,
                "pallet": PALLET_COLOR,
            }[category]
            models.append(box_model(name, x, y, size_x, size_y, height, color))

    # Main travel lanes and three loading/staging bays.
    for lane_y in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
        models.append(
            floor_marking(
                f"aisle_line_{str(lane_y).replace('-', 'm').replace('.', '_')}",
                0.0,
                lane_y,
                54.0,
                0.08,
                "0.95 0.82 0.10 0.9",
            )
        )
    models.append(floor_marking("central_cross_aisle", 0.0, 0.0, 0.10, 37.0, "0.95 0.82 0.10 0.9"))
    models.append(floor_marking("pedestrian_lane", -28.0, 0.0, 1.2, 36.0, "0.12 0.72 0.35 0.55"))
    for bay, bay_x in enumerate((-15.0, 0.0, 15.0), start=1):
        models.append(
            floor_marking(
                f"loading_bay_{bay}", bay_x, -17.0, 9.0, 4.2, "0.10 0.48 0.88 0.32"
            )
        )
    for tag_id, x, y, z in UWB_TAGS:
        models.append(tag_model(tag_id, x, y, z))

    WORLD_PATH.write_text(
        f"""<?xml version="1.0" ?>
<sdf version="1.7">
  <world name="real_warehouse">
    <gravity>0 0 -9.8</gravity>
    <physics name="warehouse_physics" type="ode">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
      <real_time_update_rate>1000</real_time_update_rate>
    </physics>
    <plugin name="gazebo_ros_state" filename="libgazebo_ros_state.so">
      <ros><namespace>/gazebo</namespace></ros>
      <update_rate>10.0</update_rate>
    </plugin>
    <scene>
      <ambient>0.65 0.65 0.65 1</ambient>
      <background>0.72 0.76 0.80 1</background>
      <shadows>true</shadows>
    </scene>
    <gui fullscreen="0">
      <camera name="warehouse_overview">
        <pose>0 -38 48 0 0.80 1.57</pose>
        <view_controller>orbit</view_controller>
      </camera>
    </gui>
    <include><uri>model://sun</uri></include>
    <model name="concrete_floor">
      <static>true</static>
      <pose>0 0 -0.06 0 0 0</pose>
      <link name="floor">
        <collision name="collision">
          <geometry><box><size>64 44 0.10</size></box></geometry>
          <surface><friction><ode><mu>1.0</mu><mu2>1.0</mu2></ode></friction></surface>
        </collision>
        <visual name="visual">
          <geometry><box><size>64 44 0.10</size></box></geometry>
{material(CONCRETE_COLOR)}
        </visual>
      </link>
    </model>
{''.join(models)}
  </world>
</sdf>
""",
        encoding="utf-8",
    )


def map_rectangle(draw, footprint, fill):
    """Draw a world-space rectangle into a north-up map image."""
    x, y, size_x, size_y = footprint
    height = round(MAP_SIZE[1] / MAP_RESOLUTION)
    left = round((x - size_x / 2.0 - MAP_ORIGIN[0]) / MAP_RESOLUTION)
    right = round((x + size_x / 2.0 - MAP_ORIGIN[0]) / MAP_RESOLUTION)
    top = height - round((y + size_y / 2.0 - MAP_ORIGIN[1]) / MAP_RESOLUTION)
    bottom = height - round((y - size_y / 2.0 - MAP_ORIGIN[1]) / MAP_RESOLUTION)
    draw.rectangle((left, top, right, bottom), fill=fill)


def generate_maps():
    """Write the ROS occupancy PGM and a styled web-map PNG."""
    pixel_size = (
        round(MAP_SIZE[0] / MAP_RESOLUTION),
        round(MAP_SIZE[1] / MAP_RESOLUTION),
    )
    occupancy = Image.new("L", pixel_size, 205)
    occupancy_draw = ImageDraw.Draw(occupancy)
    occupancy_draw.rectangle((40, 40, pixel_size[0] - 40, pixel_size[1] - 40), fill=254)

    web_map = Image.new("RGB", pixel_size, (220, 226, 229))
    web_draw = ImageDraw.Draw(web_map)
    web_draw.rectangle((40, 40, pixel_size[0] - 40, pixel_size[1] - 40), fill=(238, 241, 241))

    for _name, x, y, size_x, size_y, _height, category in OBSTACLES:
        footprint = (x, y, size_x, size_y)
        map_rectangle(occupancy_draw, footprint, 0)
        map_rectangle(
            web_draw,
            footprint,
            {
                "wall": (55, 62, 68),
                "rack": (35, 72, 112),
                "room": (122, 132, 140),
                "pallet": (142, 91, 45),
            }[category],
        )

    # Web-only markings help operators recognize aisles and work zones. They
    # are absent from the PGM, so they never become navigation obstacles.
    for lane_y in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
        map_rectangle(web_draw, (0.0, lane_y, 54.0, 0.07), (227, 181, 46))
    map_rectangle(web_draw, (0.0, 0.0, 0.07, 37.0), (227, 181, 46))
    map_rectangle(web_draw, (-28.0, 0.0, 1.2, 36.0), (170, 225, 187))
    for bay_x in (-15.0, 0.0, 15.0):
        x1 = round((bay_x - 4.5 - MAP_ORIGIN[0]) / MAP_RESOLUTION)
        x2 = round((bay_x + 4.5 - MAP_ORIGIN[0]) / MAP_RESOLUTION)
        y1 = pixel_size[1] - round((-14.9 - MAP_ORIGIN[1]) / MAP_RESOLUTION)
        y2 = pixel_size[1] - round((-19.1 - MAP_ORIGIN[1]) / MAP_RESOLUTION)
        web_draw.rectangle((x1, y1, x2, y2), outline=(50, 133, 205), width=8)

    occupancy.save(MAP_PGM_PATH)
    web_map.save(MAP_PNG_PATH, optimize=True)
    MAP_YAML_PATH.write_text(
        """image: real_warehouse.pgm
mode: trinary
resolution: 0.05
origin: [-32.0, -22.0, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
""",
        encoding="utf-8",
    )


def generate_uwb_config():
    """Write surveyed UWB anchors in the shared ROS map frame."""
    rows = [
        "frame_id: map",
        "minimum_tags: 3",
        "tags:",
    ]
    for tag_id, x, y, z in UWB_TAGS:
        rows.extend(
            [
                f"  - id: {tag_id}",
                f"    x: {x}",
                f"    y: {y}",
                f"    z: {z}",
                "    enabled: true",
                "    battery_pct: 100.0",
            ]
        )
    UWB_CONFIG_PATH.write_text("\n".join(rows) + "\n", encoding="utf-8")


def main():
    """Generate every environment artifact from the shared geometry."""
    generate_world()
    generate_maps()
    generate_uwb_config()
    print(f"Generated {WORLD_PATH}")
    print(f"Generated {MAP_YAML_PATH}")
    print(f"Generated {MAP_PNG_PATH}")
    print(f"Generated {UWB_CONFIG_PATH}")


if __name__ == "__main__":
    main()
