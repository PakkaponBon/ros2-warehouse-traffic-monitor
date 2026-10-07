"""Primitive SDF geometry for the warehouse layout generator."""

import math

RACK_COLOR = "0.12 0.24 0.42 1"


RACK_BEAM_COLOR = "0.95 0.55 0.08 1"


BOX_COLOR = "0.67 0.48 0.25 1"


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
    """Build a repeated-bay pallet rack inside one collision footprint."""
    visuals = []
    bay_count = max(2, math.ceil(length / 2.4))
    bay_width = length / bay_count
    for index in range(bay_count + 1):
        upright_x = -length / 2.0 + index * bay_width
        for side, upright_y in enumerate((-depth / 2.0, depth / 2.0)):
            visuals.append(f"""
        <visual name="upright_{index}_{side}">
          <pose>{upright_x} {upright_y} {height / 2.0} 0 0 0</pose>
          <geometry><box><size>0.10 0.10 {height}</size></box></geometry>
{material(RACK_COLOR)}
        </visual>""")
    for level, z in enumerate((0.65, 1.65, 2.65)):
        visuals.append(f"""
        <visual name="deck_{level}">
          <pose>0 0 {z} 0 0 0</pose>
          <geometry><box><size>{length} {depth} 0.06</size></box></geometry>
{material("0.48 0.51 0.55 1")}
        </visual>""")
        for side, beam_y in enumerate((-depth / 2.0, depth / 2.0)):
            visuals.append(f"""
        <visual name="beam_{level}_{side}">
          <pose>0 {beam_y} {z + 0.06} 0 0 0</pose>
          <geometry><box><size>{length} 0.10 0.12</size></box></geometry>
{material(RACK_BEAM_COLOR)}
        </visual>""")
    load_width = min(1.25, bay_width * 0.82)
    for bay in range(bay_count):
        load_x = -length / 2.0 + (bay + 0.5) * bay_width
        for level in range(2):
            visuals.append(f"""
        <visual name="load_{bay}_{level}">
          <pose>{load_x} 0 {0.95 + level} 0 0 0</pose>
          <geometry><box><size>{load_width} {depth * 0.72} 0.48</size></box></geometry>
{material(BOX_COLOR if (bay + level) % 2 else "0.72 0.54 0.31 1")}
        </visual>""")
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
