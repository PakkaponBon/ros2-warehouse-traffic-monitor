#!/usr/bin/env python3
"""Generate a compact Gazebo site layout inspired by the CRTT plan screenshot.

This is a visual demonstration, not a survey or a metrically accurate CAD
conversion. No occupancy map or vehicle routes are generated here.
"""

from pathlib import Path

from sdf_primitives import box_model, floor_marking, material, rack_model


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORLD_PATH = PACKAGE_ROOT / "worlds" / "crtt_layout_demo.world"
# Shrink the horizontal site geometry while keeping the forklift at its real
# model size. The 8 m two-way road becomes 2.4 m wide: 1.2 m per lane versus
# the forklift's 0.66 m body width. Heights remain unchanged for LiDAR hits.
LAYOUT_SCALE = 0.30
SITE_WIDTH = 160.0 * LAYOUT_SCALE
SITE_DEPTH = 92.0 * LAYOUT_SCALE


def scaled_xy(x, y, width, depth):
    """Scale positions and footprints, but not object height."""
    return (x * LAYOUT_SCALE, y * LAYOUT_SCALE,
            width * LAYOUT_SCALE, depth * LAYOUT_SCALE)

# Approximate visual zones, not a metrically accurate CAD conversion.
# name, centre x/y, width/depth, RGBA
ZONES = (
    ("west_loading", -56.0, -2.0, 30.0, 55.0, "0.60 0.62 0.61 1"),
    ("central_production", -15.0, 1.0, 54.0, 45.0, "0.66 0.69 0.70 1"),
    ("east_fabrication", 42.0, 1.0, 55.0, 45.0, "0.72 0.74 0.75 1"),
    ("south_service_pad", -18.0, -29.0, 73.0, 15.0, "0.48 0.50 0.51 1"),
    ("southeast_parking", 43.0, -29.0, 52.0, 15.0, "0.42 0.45 0.46 1"),
)

# Four non-overlapping strips form a continuous loop around the main site.
# These are visual-only surfaces; surrounding solid objects stay off the path.
PERIMETER_PATH = (
    ("north_access_road", 0.0, 36.0, 143.0, 8.0),
    ("west_perimeter_path", -69.5, 0.0, 4.0, 64.0),
    ("east_perimeter_path", 69.5, 0.0, 4.0, 64.0),
    ("south_perimeter_path", 0.0, -34.5, 143.0, 5.0),
)

# Green visual-only strips hug the inside of the boundary fence.
# Their gaps line up with the entrance roads so vehicles take priority.
# name, centre x/y, width/depth
GREEN_PATHS = (
    ("green_north_west", -40.25, 41.5, 68.5, 2.5),
    ("green_north_east", 40.25, 41.5, 68.5, 2.5),
    ("green_west_edge", -74.5, 0.0, 2.5, 83.0),
    ("green_east_north", 74.5, 24.25, 2.5, 34.5),
    ("green_east_south", 74.5, -24.25, 2.5, 34.5),
    ("green_south_west", -60.25, -41.5, 28.5, 2.5),
    ("green_south_east", 21.25, -41.5, 106.5, 2.5),
)

# Road aprons pass through the three fence openings, with the roadway painted
# above the green layer if a future layout change brings their edges together.
GATE_ROADS = (
    ("north_entry_road", 0.0, 42.25, 10.0, 7.5),
    ("east_entry_road", 75.5, 0.0, 9.0, 12.0),
    ("south_loading_entry_road", -39.0, -41.25, 12.0, 9.5),
)

# Posts make the open gate locations obvious without closing the entrances.
GATE_POSTS = (
    ("north_gate_west_post", -6.0, 44.0),
    ("north_gate_east_post", 6.0, 44.0),
    ("east_gate_south_post", 77.0, -7.0),
    ("east_gate_north_post", 77.0, 7.0),
    ("south_gate_west_post", -46.0, -44.0),
    ("south_gate_east_post", -32.0, -44.0),
)

# Collision-enabled sliding panels begin closed across each entrance.
SLIDING_GATES = (
    ("crtt_north_gate", 0.0, 44.0, 10.0, 0.35),
    ("crtt_east_gate", 77.0, 0.0, 0.35, 12.0),
    ("crtt_south_gate", -39.0, -44.0, 12.0, 0.35),
)

# Fixed collision geometry. The north road and central aisles remain open.
OBSTACLES = (
    ("north_fence_west", -41.5, 44.0, 71.0, 0.30, 2.5, "wall"),
    ("north_fence_east", 41.5, 44.0, 71.0, 0.30, 2.5, "wall"),
    ("south_fence_west", -61.5, -44.0, 31.0, 0.30, 2.5, "wall"),
    ("south_fence_east", 22.5, -44.0, 109.0, 0.30, 2.5, "wall"),
    ("west_fence", -77.0, 0.0, 0.30, 88.0, 2.5, "wall"),
    ("east_fence_south", 77.0, -25.5, 0.30, 37.0, 2.5, "wall"),
    ("east_fence_north", 77.0, 25.5, 0.30, 37.0, 2.5, "wall"),
    ("loading_office", -60.0, 19.0, 14.0, 9.0, 3.3, "room"),
    ("northeast_service_building", 62.5, 22.0, 8.0, 4.0, 3.1, "room"),
    ("west_rack_1", -57.0, -19.0, 20.0, 1.2, 3.3, "rack"),
    ("west_rack_2", -57.0, -12.0, 20.0, 1.2, 3.3, "rack"),
    ("west_rack_3", -57.0, -5.0, 20.0, 1.2, 3.3, "rack"),
    ("west_rack_4", -57.0, 2.0, 20.0, 1.2, 3.3, "rack"),
)

# Unlike the original uniform rows, stations have long, medium and short
# footprints. Each gets a coloured floor pad to show its working boundary.
# name, x, y, width, depth, height, color
STATIONS = (
    ("process_long_a", -23.0, 17.0, 27.0, 1.7, 1.6, "0.89 0.47 0.10 1"),
    ("process_short_a", -1.0, 17.0, 9.0, 2.2, 1.5, "0.86 0.53 0.14 1"),
    ("process_long_b", -22.0, 9.0, 29.0, 1.8, 1.5, "0.89 0.47 0.10 1"),
    ("process_medium_a", -2.0, 9.0, 11.0, 2.4, 1.5, "0.86 0.53 0.14 1"),
    ("process_medium_b", -29.0, 1.0, 15.0, 2.5, 1.5, "0.91 0.49 0.09 1"),
    ("process_long_c", -5.0, 1.0, 22.0, 1.8, 1.5, "0.89 0.47 0.10 1"),
    ("process_short_b", -33.0, -7.0, 8.0, 2.4, 1.6, "0.86 0.53 0.14 1"),
    ("process_long_d", -11.0, -7.0, 28.0, 1.7, 1.5, "0.89 0.47 0.10 1"),
    ("process_medium_c", -29.0, -15.0, 16.0, 2.2, 1.5, "0.91 0.49 0.09 1"),
    ("process_medium_d", -7.0, -15.0, 17.0, 2.2, 1.5, "0.91 0.49 0.09 1"),
    ("fabrication_long_a", 31.0, 17.0, 19.0, 2.4, 1.7, "0.23 0.46 0.66 1"),
    ("fabrication_short_a", 54.0, 17.0, 7.0, 3.0, 1.6, "0.29 0.55 0.69 1"),
    ("fabrication_medium_a", 30.0, 9.0, 10.0, 3.0, 1.6, "0.23 0.46 0.66 1"),
    ("fabrication_long_b", 52.0, 9.0, 21.0, 2.5, 1.7, "0.29 0.55 0.69 1"),
    ("fabrication_short_b", 24.0, 1.0, 6.0, 3.2, 1.6, "0.29 0.55 0.69 1"),
    ("fabrication_medium_b", 40.0, 1.0, 14.0, 3.0, 1.7, "0.23 0.46 0.66 1"),
    ("fabrication_short_c", 59.0, 1.0, 8.0, 3.0, 1.5, "0.29 0.55 0.69 1"),
    ("fabrication_long_c", 31.0, -8.0, 20.0, 2.6, 1.7, "0.23 0.46 0.66 1"),
    ("fabrication_medium_c", 54.0, -8.0, 12.0, 3.0, 1.6, "0.29 0.55 0.69 1"),
    ("fabrication_short_d", 25.0, -17.0, 7.0, 3.0, 1.6, "0.29 0.55 0.69 1"),
    ("fabrication_long_d", 48.0, -17.0, 25.0, 2.4, 1.7, "0.23 0.46 0.66 1"),
)

# Cargo on pallets in staging pockets, away from the main station aisles.
# x, y, cargo width, depth, height, color
FLOOR_LOADS = (
    (-64.5, 10.0, 1.5, 1.1, 1.1, "0.62 0.39 0.18 1"),
    (-61.0, 10.0, 1.8, 1.2, 1.5, "0.70 0.52 0.28 1"),
    (-57.5, 10.0, 1.4, 1.1, 0.8, "0.62 0.39 0.18 1"),
    (-64.5, -25.0, 1.7, 1.2, 1.6, "0.70 0.52 0.28 1"),
    (-61.0, -25.0, 1.5, 1.1, 0.8, "0.62 0.39 0.18 1"),
    (-57.5, -25.0, 1.8, 1.2, 1.3, "0.70 0.52 0.28 1"),
    (-42.0, -28.0, 1.8, 1.2, 1.3, "0.67 0.47 0.22 1"),
    (-38.5, -28.0, 1.5, 1.1, 0.9, "0.67 0.47 0.22 1"),
    (-34.5, -28.0, 1.7, 1.2, 1.7, "0.67 0.47 0.22 1"),
    (-19.0, -28.0, 1.7, 1.2, 1.2, "0.62 0.39 0.18 1"),
    (-15.5, -28.0, 1.8, 1.2, 1.5, "0.70 0.52 0.28 1"),
    (-12.0, -28.0, 1.4, 1.1, 0.7, "0.62 0.39 0.18 1"),
    (2.0, -28.0, 1.7, 1.2, 1.6, "0.67 0.47 0.22 1"),
    (5.5, -28.0, 1.6, 1.2, 1.0, "0.67 0.47 0.22 1"),
    (9.0, -28.0, 1.8, 1.2, 1.4, "0.67 0.47 0.22 1"),
    (66.0, 18.0, 1.5, 1.1, 1.2, "0.62 0.39 0.18 1"),
    (66.0, 13.5, 1.8, 1.2, 1.6, "0.70 0.52 0.28 1"),
    (66.0, 9.0, 1.4, 1.1, 0.9, "0.62 0.39 0.18 1"),
)


def concrete_floor():
    """Return a flat, collision-enabled site floor with its top at z=0."""
    return f"""
    <model name="site_floor">
      <static>true</static>
      <pose>0 0 -0.05 0 0 0</pose>
      <link name="floor">
        <collision name="collision"><geometry><box><size>{SITE_WIDTH} {SITE_DEPTH} 0.10</size></box></geometry></collision>
        <visual name="visual">
          <geometry><box><size>{SITE_WIDTH} {SITE_DEPTH} 0.10</size></box></geometry>
          <material><ambient>0.49 0.51 0.52 1</ambient><diffuse>0.49 0.51 0.52 1</diffuse></material>
        </visual>
      </link>
    </model>"""


def pallet_load_model(name, x, y, width, depth, height, color):
    """One static pallet and cargo stack with matching collision geometry."""
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} 0 0 0 0</pose>
      <link name="load">
        <collision name="collision">
          <pose>0 0 {(height + 0.16) / 2.0} 0 0 0</pose>
          <geometry><box><size>{width + 0.2} {depth + 0.2} {height + 0.16}</size></box></geometry>
        </collision>
        <visual name="wood_pallet">
          <pose>0 0 0.08 0 0 0</pose>
          <geometry><box><size>{width + 0.2} {depth + 0.2} 0.16</size></box></geometry>
{material("0.43 0.26 0.10 1")}
        </visual>
        <visual name="cargo">
          <pose>0 0 {0.16 + height / 2.0} 0 0 0</pose>
          <geometry><box><size>{width} {depth} {height}</size></box></geometry>
{material(color)}
        </visual>
      </link>
    </model>"""


def raised_floor_marking(name, x, y, width, depth, color, z=0.025):
    """Visual-only marking above the base zones to avoid z-fighting."""
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} {z} 0 0 0</pose>
      <link name="marking">
        <visual name="visual">
          <geometry><box><size>{width} {depth} 0.012</size></box></geometry>
{material(color)}
        </visual>
      </link>
    </model>"""


def sliding_gate_model(name, x, y, width, depth):
    """A movable, gravity-free panel that blocks LiDAR and collisions."""
    height = 2.5
    return f"""
    <model name="{name}">
      <static>false</static>
      <pose>{x} {y} {height / 2.0} 0 0 0</pose>
      <link name="panel">
        <kinematic>true</kinematic>
        <gravity>false</gravity>
        <inertial>
          <mass>100.0</mass>
          <inertia><ixx>100.0</ixx><iyy>100.0</iyy><izz>100.0</izz>
            <ixy>0</ixy><ixz>0</ixz><iyz>0</iyz></inertia>
        </inertial>
        <collision name="collision">
          <geometry><box><size>{width} {depth} {height}</size></box></geometry>
        </collision>
        <visual name="visual">
          <geometry><box><size>{width} {depth} {height}</size></box></geometry>
{material("0.55 0.65 0.72 1")}
        </visual>
      </link>
    </model>"""


def generate_world():
    """Build the compact visual site, varied stations, and floor loads."""
    models = [concrete_floor()]
    for name, x, y, width, depth, color in ZONES:
        models.append(floor_marking(
            name, *scaled_xy(x, y, width, depth), color))
    for name, x, y, width, depth in PERIMETER_PATH:
        models.append(raised_floor_marking(
            name, *scaled_xy(x, y, width, depth), "0.28 0.30 0.32 1",
        ))
    for name, x, y, width, depth in GREEN_PATHS:
        models.append(raised_floor_marking(
            name, *scaled_xy(x, y, width, depth),
            "0.21 0.48 0.22 1", z=0.036,
        ))
    for name, x, y, width, depth in GATE_ROADS:
        models.append(raised_floor_marking(
            name, *scaled_xy(x, y, width, depth),
            "0.28 0.30 0.32 1", z=0.050,
        ))

    for name, x, y, width, depth, height, kind in OBSTACLES:
        x, y, width, depth = scaled_xy(x, y, width, depth)
        if kind == "rack":
            models.append(rack_model(name, x, y, width, depth, height))
        else:
            color = {
                "wall": "0.33 0.37 0.40 1",
                "room": "0.76 0.79 0.81 1",
            }[kind]
            models.append(box_model(name, x, y, width, depth, height, color))

    for name, x, y in GATE_POSTS:
        models.append(box_model(
            name, x * LAYOUT_SCALE, y * LAYOUT_SCALE,
            0.35, 0.35, 3.0, "0.95 0.72 0.10 1",
        ))
    for name, x, y, width, depth in SLIDING_GATES:
        models.append(sliding_gate_model(
            name, *scaled_xy(x, y, width, depth)))

    for name, x, y, width, depth, height, color in STATIONS:
        models.append(floor_marking(
            f"{name}_pad", *scaled_xy(x, y, width + 1.6, depth + 1.6),
            "0.91 0.80 0.23 1",
        ))
        models.append(box_model(
            name, *scaled_xy(x, y, width, depth), height, color))

    for index, (x, y, width, depth, height, color) in enumerate(FLOOR_LOADS, start=1):
        models.append(pallet_load_model(
            f"floor_load_{index}",
            *scaled_xy(x, y, width, depth), height, color,
        ))

    for index, x in enumerate((-64.0, -58.0, -52.0, -46.0), start=1):
        models.append(raised_floor_marking(
            f"loading_bay_line_{index}",
            *scaled_xy(x, -29.5, 5.4, 0.12),
            "0.98 0.83 0.12 1"))
    for index, x in enumerate((22.0, 33.0, 44.0, 55.0, 66.0), start=1):
        models.append(raised_floor_marking(
            f"parking_line_{index}",
            *scaled_xy(x, -27.0, 0.12, 7.0),
            "0.94 0.94 0.90 1"))
    for index in range(16):
        models.append(raised_floor_marking(
            f"road_dashed_line_{index}",
            *scaled_xy(-66.0 + index * 8.7, 36.0, 4.0, 0.14),
            "0.96 0.82 0.12 1", z=0.045))

    WORLD_PATH.write_text(
        """<?xml version="1.0" ?>
<sdf version="1.7">
  <world name="crtt_layout_demo">
    <gravity>0 0 -9.8</gravity>
    <plugin name="gazebo_ros_state" filename="libgazebo_ros_state.so">
      <ros><namespace>/gazebo</namespace></ros>
      <update_rate>10.0</update_rate>
    </plugin>
    <physics name="warehouse_physics" type="ode">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
      <real_time_update_rate>1000</real_time_update_rate>
    </physics>
    <scene>
      <ambient>0.65 0.65 0.65 1</ambient>
      <background>0.72 0.76 0.80 1</background>
      <shadows>true</shadows>
    </scene>
    <gui fullscreen="0"><camera name="site_overview">
      <pose>0 -40 38 0 0.76 1.57</pose>
      <view_controller>orbit</view_controller>
    </camera></gui>
    <include><uri>model://sun</uri></include>
""" + "".join(models) + """
  </world>
</sdf>
""",
        encoding="utf-8",
    )
    print(f"Generated {WORLD_PATH}")


if __name__ == "__main__":
    generate_world()
