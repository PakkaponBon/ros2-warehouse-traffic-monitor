#!/usr/bin/env python3
"""Generate a four-hall mining haul-truck assembly simulation.

The layout is a simulation, not a surveyed CAD drawing. Warehouse size and
road widths retain their existing physical scale.
"""

from pathlib import Path

from sdf_primitives import box_model, floor_marking, material, rack_model


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORLD_PATH = PACKAGE_ROOT / "worlds" / "delivery_site.world"
# Four halls share the original site footprint and road widths.
# Materials progress through storage, parts, vehicle build and final test.
SITE_WIDTH = 96.0
SITE_DEPTH = 55.2
MODULES = (
    ("sw", -24.0, -13.8), ("se", 24.0, -13.8),
    ("nw", -24.0, 13.8), ("ne", 24.0, 13.8),
)


# Keep the perimeter fence on the slab edge. Gate gaps retain their existing
# widths and each paved approach terminates at (never beyond) its gate.
FENCE_X = SITE_WIDTH / 2.0 - 0.1
FENCE_Y = SITE_DEPTH / 2.0 - 0.1
SITE_WALLS = (
    ("north_fence_west", -24.7, FENCE_Y, 46.4, 0.09, 2.5),
    ("north_fence_east", 24.7, FENCE_Y, 46.4, 0.09, 2.5),
    ("south_fence_west", -36.85, -FENCE_Y, 22.1, 0.09, 2.5),
    ("south_fence_east", 12.85, -FENCE_Y, 70.1, 0.09, 2.5),
    ("west_fence", -FENCE_X, 0.0, 0.09, 55.0, 2.5),
    ("east_fence_south", FENCE_X, -14.65, 0.09, 25.7, 2.5),
    ("east_fence_north", FENCE_X, 14.65, 0.09, 25.7, 2.5),
)
GATE_POSTS = (
    ("north_gate_west_post", -2.0, FENCE_Y),
    ("north_gate_east_post", 2.0, FENCE_Y),
    ("east_gate_south_post", FENCE_X, -2.3),
    ("east_gate_north_post", FENCE_X, 2.3),
    ("south_gate_west_post", -26.2, -FENCE_Y),
    ("south_gate_east_post", -21.8, -FENCE_Y),
)
SLIDING_GATES = (
    ("warehouse_north_gate", 0.0, FENCE_Y, 3.0, 0.105),
    ("warehouse_east_gate", FENCE_X, 0.0, 0.105, 3.6),
    ("warehouse_south_gate", -24.0, -FENCE_Y, 3.6, 0.105),
)
SITE_ROADS = (
    ("north_access_road", 0.0, 24.0, 90.0, 2.4),
    ("south_perimeter_path", 0.0, -24.8, 90.0, 1.5),
    ("west_perimeter_path", -44.7, 0.0, 1.2, 49.0),
    ("east_perimeter_path", 44.7, 0.0, 1.2, 49.0),
    ("central_cross_aisle", 0.0, 0.0, 2.4, 48.0),
    ("central_long_aisle", 0.0, 0.0, 90.0, 2.4),
    ("north_gate_approach", 0.0, 26.35, 3.0, 2.3),
    ("south_gate_approach", -24.0, -26.525, 3.6, 1.95),
    ("east_gate_approach", 46.6, 0.0, 2.6, 3.6),
)

# Green pedestrian paths run between the roads and the inside face of the
# fence. The breaks at north, east and south keep all three gates clear.
PEDESTRIAN_PATHS = (
    ("pedestrian_north_west", -24.3, 26.4, 45.2, 0.8),
    ("pedestrian_north_east", 24.3, 26.4, 45.2, 0.8),
    ("pedestrian_west", -46.6, 0.0, 0.8, 53.0),
    ("pedestrian_east_south", 46.7, -14.25, 0.8, 24.5),
    ("pedestrian_east_north", 46.7, 14.25, 0.8, 24.5),
    ("pedestrian_south_west", -36.45, -26.65, 20.9, 0.8),
    ("pedestrian_south_east", 12.45, -26.65, 68.9, 0.8),
)


# Four parallel build lines advance from west to east within each hall.
# The material route between halls is southwest -> northwest -> northeast ->
# southeast, ending at the outbound side of the building.
STORAGE_RACK_ROWS = tuple(
    (f"storage_rack_{bank}_{row}", x, y, 17.0, 0.7, 3.3)
    for bank, x in (("west", -35.0), ("east", -13.0))
    for row, y in enumerate((-7.5, -12.0, -16.5, -21.0), 1)
)
BUILD_LANES = {
    "sw": (-18.7, -14.2, -9.7, -5.0),
    "nw": (5.5, 10.5, 15.5, 20.5),
    "ne": (5.5, 10.5, 15.5, 20.5),
    "se": (-21.0, -16.0, -11.0, -6.0),
}
STAGE_COLUMNS = {
    "sw": (-40.0, -24.0, -8.0),
    "nw": (-36.0, -23.0, -10.0),
    "ne": (8.0, 24.0, 40.0),
    "se": (8.0, 24.0, 40.0),
}
PART_NAMES = (
    ("frame cutting", "axle machining", "suspension fitting"),
    ("engine block", "gearbox assembly", "cooling pack"),
    ("dump-bed panels", "hydraulic rams", "bed pivot"),
    ("cab structure", "electrical harness", "operator controls"),
)
PART_COLORS = (
    "0.83 0.50 0.14 1", "0.26 0.49 0.67 1",
    "0.27 0.64 0.57 1", "0.84 0.70 0.20 1",
)
TRUCK_COLORS = (
    "0.82 0.68 0.14 1", "0.89 0.60 0.15 1",
    "0.79 0.55 0.18 1", "0.87 0.66 0.18 1",
)
SUPPORT_COLUMNS = {
    "nw": (-29.5, -16.5),
    "ne": (16.0, 32.0),
    "se": (16.0, 32.0),
}


def module_fixtures(suffix, offset_x, offset_y):
    """Solid rack, production and truck footprints in world metres."""
    if suffix == "sw":
        for name, x, y, width, depth, height in STORAGE_RACK_ROWS:
            yield f"{name}_{suffix}", x, y, width, depth, height, "rack", ""
    elif suffix == "nw":
        for line, y in enumerate(BUILD_LANES["nw"], 1):
            for stage, x in enumerate(STAGE_COLUMNS["nw"], 1):
                yield (f"part_stage_{stage}_line_{line}_nw", x, y,
                       7.2, 2.0, 2.8, "part", PART_COLORS[line - 1])
            for slot, x in enumerate(SUPPORT_COLUMNS["nw"], 1):
                yield (f"parts_kit_{slot}_line_{line}_nw", x, y,
                       2.4, 2.0, 1.8, "support", PART_COLORS[line - 1])
    elif suffix in {"ne", "se"}:
        first_stage = 0 if suffix == "ne" else 3
        for line, y in enumerate(BUILD_LANES[suffix], 1):
            for column, x in enumerate(STAGE_COLUMNS[suffix]):
                stage = first_stage + column
                yield (f"vehicle_stage_{stage + 1}_line_{line}_{suffix}",
                       x, y, 7.0, 3.0, 3.8, "vehicle", TRUCK_COLORS[line - 1])
            for slot, x in enumerate(SUPPORT_COLUMNS[suffix], 1):
                yield (f"assembly_kit_{slot}_line_{line}_{suffix}", x, y,
                       2.6, 2.2, 1.9, "support", TRUCK_COLORS[line - 1])
    else:
        raise ValueError(f"Unknown hall: {suffix}")


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


def visual_box(name, x, y, z, width, depth, height, color):
    """One non-colliding visual component inside a solid model."""
    return f"""
        <visual name="{name}">
          <pose>{x} {y} {z} 0 0 0</pose>
          <geometry><box><size>{width} {depth} {height}</size></box></geometry>
{material(color)}
        </visual>"""


def visual_cylinder(name, x, y, z, radius, length, color, roll=0.0):
    return f"""
        <visual name="{name}">
          <pose>{x} {y} {z} {roll} 0 0</pose>
          <geometry><cylinder><radius>{radius}</radius><length>{length}</length></cylinder></geometry>
{material(color)}
        </visual>"""


def detailed_fixture_model(name, x, y, width, depth, height, visuals):
    """Keep collision a simple, honest envelope around detailed visuals."""
    return f"""
    <model name="{name}">
      <static>true</static>
      <pose>{x} {y} 0 0 0 0</pose>
      <link name="fixture">
        <collision name="collision">
          <pose>0 0 {height / 2.0} 0 0 0</pose>
          <geometry><box><size>{width} {depth} {height}</size></box></geometry>
        </collision>
{''.join(visuals)}
      </link>
    </model>"""


def part_station_model(name, x, y, width, depth, height, color, line, stage):
    """Twelve visually different mining-truck component workstations."""
    visuals = [
        visual_box("machine_base", 0, 0, 0.12, width, depth, 0.24,
                   "0.20 0.27 0.31 1"),
        visual_box("work_table", 0, 0, 0.92, 5.6, 1.60, 0.16,
                   "0.53 0.59 0.62 1"),
        visual_box("controller", 3.05, -0.63, 1.06, 0.35, 0.42, 1.46,
                   "0.29 0.38 0.43 1"),
        visual_box("control_screen", 3.05, -0.85, 1.45, 0.25, 0.02, 0.20,
                   "0.09 0.64 0.75 1"),
    ]
    for side, gx in enumerate((-3.35, 3.35)):
        visuals.append(visual_box(f"hoist_post_{side}", gx, 0, 1.40,
                                  0.14, 0.16, 2.72, "0.31 0.40 0.45 1"))
    visuals.append(visual_box("hoist_beam", 0, 0, 2.71,
                              6.85, 0.18, 0.18, color))
    steel = "0.64 0.69 0.71 1"
    dark = "0.23 0.30 0.34 1"
    if line == 1:  # Frame, axles, suspension.
        if stage == 1:
            for side, ry in enumerate((-0.50, 0.50)):
                visuals.append(visual_box(f"frame_rail_{side}", 0, ry, 1.14,
                                          4.8, 0.19, 0.30, steel))
            for index, cx in enumerate((-1.75, -0.55, 0.65, 1.85)):
                visuals.append(visual_box(f"frame_cross_{index}", cx, 0, 1.14,
                                          0.22, 1.16, 0.25, dark))
        elif stage == 2:
            for index, cx in enumerate((-1.55, 0, 1.55)):
                visuals.append(visual_cylinder(f"axle_{index}", cx, 0, 1.22,
                                               0.18, 1.36, steel,
                                               roll=1.57079632679))
                for side, yy in enumerate((-0.60, 0.60)):
                    visuals.append(visual_cylinder(f"hub_{index}_{side}",
                                                   cx, yy, 1.22, 0.36, 0.18,
                                                   dark, roll=1.57079632679))
        else:
            for index, cx in enumerate((-1.5, 0, 1.5)):
                for side, yy in enumerate((-0.42, 0.42)):
                    visuals.append(visual_cylinder(f"coil_{index}_{side}",
                                                   cx, yy, 1.24, 0.25, 0.66,
                                                   color))
                    visuals.append(visual_box(f"spring_foot_{index}_{side}",
                                              cx, yy, 1.02, 0.62, 0.56, 0.10,
                                              dark))
    elif line == 2:  # Engine, gearbox, cooling module.
        if stage == 1:
            visuals.append(visual_box("engine_block", 0, 0, 1.37,
                                      2.9, 1.18, 0.76, dark))
            for index, cx in enumerate((-1.10, -0.45, 0.20, 0.85)):
                visuals.append(visual_cylinder(f"engine_cylinder_{index}",
                                               cx, 0, 1.90, 0.23, 0.50, color))
            visuals.append(visual_cylinder("turbo", 1.65, 0, 1.43,
                                           0.35, 0.58, steel,
                                           roll=1.57079632679))
        elif stage == 2:
            for index, cx in enumerate((-1.28, 0, 1.28)):
                radius = 0.48 if index == 1 else 0.35
                visuals.append(visual_cylinder(f"gear_case_{index}",
                                               cx, 0, 1.45, radius, 0.75,
                                               color, roll=1.57079632679))
                visuals.append(visual_cylinder(f"drive_shaft_{index}",
                                               cx, 0, 1.45, 0.12, 1.32,
                                               steel, roll=1.57079632679))
        else:
            visuals.append(visual_box("radiator_frame", 0, 0, 1.64,
                                      3.25, 0.44, 1.20, dark))
            for index, cx in enumerate((-1.35, -0.90, -0.45, 0,
                                        0.45, 0.90, 1.35)):
                visuals.append(visual_box(f"cooling_fin_{index}", cx, -0.25,
                                          1.64, 0.14, 0.05, 1.02, steel))
            for side, cx in enumerate((-0.73, 0.73)):
                visuals.append(visual_cylinder(f"cooling_fan_{side}", cx,
                                               0.35, 1.65, 0.38, 0.15,
                                               color, roll=1.57079632679))
    elif line == 3:  # Dump bed and hydraulic lifting gear.
        if stage == 1:
            visuals.append(visual_box("bed_plate", 0, 0, 1.23,
                                      4.65, 1.50, 0.14, color))
            for side, yy in enumerate((-0.66, 0.66)):
                visuals.append(visual_box(f"bed_side_{side}", 0, yy, 1.62,
                                          4.55, 0.16, 0.78, color))
            for index, cx in enumerate((-1.55, -0.55, 0.45, 1.45)):
                visuals.append(visual_box(f"bed_rib_{index}", cx, 0, 1.32,
                                          0.12, 1.52, 0.19, dark))
        elif stage == 2:
            for index, cx in enumerate((-1.55, 0, 1.55)):
                visuals.append(visual_cylinder(f"ram_body_{index}", cx,
                                               -0.22, 1.39, 0.25, 1.15,
                                               color, roll=1.57079632679))
                visuals.append(visual_cylinder(f"ram_rod_{index}", cx,
                                               0.36, 1.39, 0.12, 0.64,
                                               steel, roll=1.57079632679))
        else:
            visuals.append(visual_box("pivot_beam", 0, 0, 1.26,
                                      4.30, 0.22, 0.32, color))
            for index, cx in enumerate((-1.65, 0, 1.65)):
                visuals.append(visual_cylinder(f"pivot_{index}", cx, 0,
                                               1.36, 0.35, 1.28, dark,
                                               roll=1.57079632679))
                visuals.append(visual_box(f"mount_{index}", cx, 0, 1.03,
                                          0.64, 1.32, 0.24, steel))
    else:  # Operator cab, wiring harness, controls.
        if stage == 1:
            for side, cx in enumerate((-1.48, 1.48)):
                for end, yy in enumerate((-0.54, 0.54)):
                    visuals.append(visual_box(f"cab_post_{side}_{end}",
                                              cx, yy, 1.70, 0.14, 0.14,
                                              1.40, color))
            visuals.append(visual_box("cab_roof", 0, 0, 2.37,
                                      3.25, 1.28, 0.16, color))
            visuals.append(visual_box("windshield", 1.52, -0.03, 1.88,
                                      0.05, 0.95, 0.70,
                                      "0.16 0.36 0.44 1"))
        elif stage == 2:
            for index, cx in enumerate((-1.45, -0.48, 0.49, 1.46)):
                visuals.append(visual_cylinder(f"cable_reel_{index}",
                                               cx, 0, 1.38, 0.42, 0.38,
                                               dark, roll=1.57079632679))
                visuals.append(visual_cylinder(f"cable_hub_{index}",
                                               cx, -0.21, 1.38, 0.20, 0.05,
                                               color, roll=1.57079632679))
        else:
            visuals.append(visual_box("dashboard", 0, 0, 1.48,
                                      3.60, 0.75, 0.70, dark))
            for index, cx in enumerate((-1.30, -0.43, 0.44, 1.31)):
                visuals.append(visual_box(f"instrument_{index}", cx, -0.39,
                                          1.64, 0.52, 0.04, 0.30,
                                          "0.10 0.67 0.74 1"))
                visuals.append(visual_cylinder(f"work_lamp_{index}", cx,
                                               0.40, 1.60, 0.22, 0.22,
                                               "0.95 0.84 0.38 1"))
    return detailed_fixture_model(name, x, y, width, depth, height, visuals)


def support_kit_model(name, x, y, width, depth, height, color, line, slot):
    """Process-specific component carts that fill gaps without blocking aisles."""
    visuals = [visual_box("kit_frame", 0, 0, 0.12, width, depth, 0.24,
                          "0.32 0.37 0.38 1")]
    steel = "0.69 0.73 0.72 1"
    if line == 1:
        for index, cx in enumerate((-0.60, 0.60)):
            visuals.append(visual_cylinder(f"spare_tire_{index}", cx, 0,
                                           0.80, 0.55, 0.35,
                                           "0.08 0.09 0.10 1",
                                           roll=1.57079632679))
            visuals.append(visual_cylinder(f"tire_hub_{index}", cx, -0.20,
                                           0.80, 0.22, 0.05, steel,
                                           roll=1.57079632679))
    elif line == 2:
        visuals.append(visual_box("engine_crate", 0, 0, 0.70,
                                  1.65, 1.14, 1.02, color))
        for index, cx in enumerate((-0.55, 0, 0.55)):
            visuals.append(visual_cylinder(f"pipe_{index}", cx, 0,
                                           1.38, 0.12, 1.10, steel,
                                           roll=1.57079632679))
    elif line == 3:
        for index, yy in enumerate((-0.52, 0, 0.52)):
            visuals.append(visual_box(f"bed_panel_{index}", 0, yy,
                                      0.58 + index * 0.20,
                                      1.96, 0.24, 0.13, color))
        visuals.append(visual_cylinder("lift_ram", 0, 0.54, 1.28,
                                       0.19, 1.50, steel,
                                       roll=1.57079632679))
    else:
        visuals.append(visual_box("cab_module", 0, 0, 0.80,
                                  1.62, 1.25, 1.35, color))
        for side, cx in enumerate((-0.43, 0.43)):
            visuals.append(visual_box(f"cab_window_{side}", cx, -0.64,
                                      1.02, 0.47, 0.03, 0.45,
                                      "0.19 0.41 0.47 1"))
        visuals.append(visual_box("cab_roof", 0, 0, 1.52,
                                  1.75, 1.34, 0.12,
                                  "0.28 0.33 0.36 1"))
    return detailed_fixture_model(name, x, y, width, depth, height, visuals)


def mining_truck_model(name, x, y, width, depth, height, color, stage):
    """A six-wheel haul truck gains powertrain, cab, dump bed and test gear."""
    steel = "0.63 0.68 0.70 1"
    dark = "0.20 0.27 0.31 1"
    visuals = [visual_box("service_platform", 0, 0, 0.11,
                          width, depth, 0.22, dark)]
    for side, yy in enumerate((-0.66, 0.66)):
        visuals.append(visual_box(f"chassis_rail_{side}", 0, yy, 0.85,
                                  5.90, 0.19, 0.28, steel))
        for axle, xx in enumerate((-2.20, -0.65, 2.15)):
            wheel_y = -1.18 if side == 0 else 1.18
            visuals.append(visual_cylinder(f"haul_tire_{side}_{axle}",
                                           xx, wheel_y, 0.63, 0.58, 0.32,
                                           "0.08 0.09 0.10 1",
                                           roll=1.57079632679))
            visuals.append(visual_cylinder(f"tire_hub_{side}_{axle}",
                                           xx, wheel_y, 0.63, 0.23, 0.34,
                                           "0.70 0.74 0.74 1",
                                           roll=1.57079632679))
    for index, xx in enumerate((-2.20, -0.65, 2.15)):
        visuals.append(visual_cylinder(f"drive_axle_{index}", xx, 0, 0.68,
                                       0.15, 2.38, steel,
                                       roll=1.57079632679))
    if stage >= 1:
        visuals.extend((
            visual_box("diesel_engine", 1.15, 0, 1.26,
                       1.38, 1.22, 0.83, dark),
            visual_box("gearbox", 0.08, 0, 1.12,
                       0.82, 0.76, 0.60, steel),
            visual_cylinder("radiator_fan", 1.98, 0, 1.29,
                            0.41, 0.15, "0.76 0.80 0.79 1",
                            roll=1.57079632679),
        ))
    if stage >= 2:
        visuals.extend((
            visual_box("operator_cab", 2.08, 0, 1.82,
                       1.60, 1.83, 1.62, color),
            visual_box("cab_roof", 2.08, 0, 2.66,
                       1.72, 1.91, 0.14, dark),
            visual_box("windshield", 2.91, 0, 2.03,
                       0.045, 1.48, 0.91,
                       "0.17 0.38 0.48 1"),
            visual_cylinder("exhaust_stack", 1.14, 0.76, 2.15,
                            0.12, 1.57, dark),
        ))
        for side, yy in enumerate((-0.95, 0.95)):
            visuals.append(visual_box(f"cab_side_glass_{side}", 2.11,
                                      yy, 2.08, 0.87, 0.035, 0.76,
                                      "0.17 0.38 0.48 1"))
    if stage >= 3:
        visuals.append(visual_box("dump_bed_floor", -1.01, 0, 1.78,
                                  3.75, 2.15, 0.22, color))
        for side, yy in enumerate((-1.05, 1.05)):
            visuals.append(visual_box(f"dump_bed_side_{side}", -1.01,
                                      yy, 2.37, 3.75, 0.15, 1.15, color))
            for rib, xx in enumerate((-2.46, -1.39, -0.32, 0.75)):
                visuals.append(visual_box(f"bed_rib_{side}_{rib}", xx,
                                          yy * 1.07, 2.37,
                                          0.13, 0.08, 1.10, steel))
        visuals.extend((
            visual_box("rear_gate", -2.93, 0, 2.29,
                       0.15, 2.20, 1.00, color),
            visual_cylinder("hydraulic_lift_left", -0.78, -0.48, 1.37,
                            0.18, 1.00, steel),
            visual_cylinder("hydraulic_lift_right", -0.78, 0.48, 1.37,
                            0.18, 1.00, steel),
        ))
    if stage >= 4:
        for side, yy in enumerate((-1.42, 1.42)):
            visuals.append(visual_box(f"test_gantry_post_{side}", 0,
                                      yy, 1.86, 0.13, 0.13, 3.52,
                                      "0.91 0.72 0.12 1"))
        visuals.append(visual_box("test_gantry_beam", 0, 0, 3.59,
                                  0.18, 2.86, 0.13,
                                  "0.91 0.72 0.12 1"))
    if stage >= 5:
        for side, yy in enumerate((-0.62, 0.62)):
            visuals.append(visual_box(f"headlamp_{side}", 3.01, yy, 1.30,
                                      0.07, 0.30, 0.21,
                                      "0.98 0.89 0.59 1"))
        visuals.append(visual_box("front_bumper", 3.04, 0, 0.85,
                                  0.19, 2.27, 0.21, steel))
        visuals.append(visual_box("safety_step", 2.45, -1.02, 0.72,
                                  0.67, 0.23, 0.13, steel))
    return detailed_fixture_model(name, x, y, width, depth, height, visuals)


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


def collision_boxes():
    """All solid 2-D footprints for dock and route validation."""
    for name, x, y, width, depth, _height in SITE_WALLS:
        yield name, x, y, width, depth
    for name, x, y in GATE_POSTS:
        yield name, x, y, 0.35, 0.35
    for name, x, y, width, depth in SLIDING_GATES:
        yield name, x, y, width, depth
    for suffix, offset_x, offset_y in MODULES:
        for name, x, y, width, depth, _height, kind, _color in module_fixtures(
                suffix, offset_x, offset_y):
            yield name, x, y, width, depth


def generate_world():
    """Build storage, parts, assembly and final-test halls in process order."""
    models = [concrete_floor()]
    floor_colors = {"sw": "0.66 0.68 0.67 1",
                    "nw": "0.67 0.70 0.71 1",
                    "ne": "0.66 0.75 0.77 1",
                    "se": "0.70 0.73 0.68 1"}
    for suffix, offset_x, offset_y in MODULES:
        models.append(floor_marking(
            f"{suffix}_working_floor", offset_x, offset_y,
            43.0, 22.0, floor_colors[suffix]))

    for name, x, y, width, depth in SITE_ROADS:
        models.append(raised_floor_marking(
            name, x, y, width, depth, "0.28 0.30 0.32 1"))
    for name, x, y, width, depth in PEDESTRIAN_PATHS:
        models.append(raised_floor_marking(
            name, x, y, width, depth, "0.18 0.57 0.25 1", z=0.055))
    for name, x, y, width, depth, height in SITE_WALLS:
        models.append(box_model(name, x, y, width, depth, height, "0.33 0.37 0.40 1"))
    for name, x, y in GATE_POSTS:
        models.append(box_model(name, x, y, 0.35, 0.35, 3.0, "0.95 0.72 0.10 1"))
    for name, x, y, width, depth in SLIDING_GATES:
        models.append(sliding_gate_model(name, x, y, width, depth))

    for suffix, offset_x, offset_y in MODULES:
        for name, x, y, width, depth, height, kind, color in module_fixtures(
                suffix, offset_x, offset_y):
            if kind == "rack":
                models.append(rack_model(name, x, y, width, depth, height))
                continue
            models.append(floor_marking(
                f"{name}_pad", x, y, width + 0.20, depth + 0.20,
                "0.87 0.78 0.39 1" if kind == "part" else "0.72 0.79 0.78 1"))
            if kind == "part":
                line = int(name.split("_")[4])
                stage = int(name.split("_")[2])
                models.append(part_station_model(
                    name, x, y, width, depth, height, color, line, stage))
            elif kind == "support":
                line = int(name.split("_")[4])
                slot = int(name.split("_")[2])
                models.append(support_kit_model(
                    name, x, y, width, depth, height, color, line, slot))
            else:
                stage = int(name.split("_")[2]) - 1
                models.append(mining_truck_model(
                    name, x, y, width, depth, height, color, stage))
    for index, x in enumerate(range(-42, 43, 6), start=1):
        models.append(raised_floor_marking(
            f"road_dashed_line_{index}", x, 24.0, 3.0, 0.042,
            "0.96 0.82 0.12 1", z=0.045))

    WORLD_PATH.write_text(
        """<?xml version="1.0" ?>
<sdf version="1.7">
  <world name="warehouse_layout_demo">
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
      <pose>0 -80 72 0 0.76 1.57</pose>
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
