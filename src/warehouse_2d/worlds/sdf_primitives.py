"""Primitive SDF geometry for the warehouse layout generator."""

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
