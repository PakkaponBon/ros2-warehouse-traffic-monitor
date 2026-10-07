# Warehouse Delivery

A dedicated ROS 2 Humble and Gazebo Classic workspace for a larger simulated
mining haul-truck assembly site. A 96 × 55.2 m floor has four ordered halls:
southwest rack storage; northwest shops for chassis, powertrain, dump-bed,
and cab components; northeast six-wheel truck assembly; and southeast dump-bed
installation, safety testing, and dispatch. Component carts occupy the gaps
between stations while keeping the forklift aisles open. Four build lines each
progress through 12 stations from start to end; no floor arrows are used.
The original road widths are retained. There are 48 pickup/drop-off points,
four forklifts, traffic history, and one operations web interface.

## Run the complete demo

After saving the robot's SLAM map, run:

```bash
cd ~/warehouse_delivery_ws
./run_demo.sh
```

The script reports the local Git branch, commit and number of changed/untracked
entries, builds the frontend and ROS package, and starts Gazebo, eight roaming
vehicles, AMCL, Gazebo validation/recovery, the traffic recorder, heatmap,
web monitor and RViz. Open <http://localhost:8080/>. Stop with `Ctrl+C`.
It uses the current workspace files and does not fetch, pull or commit Git changes.
Build steps do not run tests.

Launch arguments can override the defaults:

```bash
./run_demo.sh vehicle_count:=2 database:=/tmp/warehouse_demo.db
./run_demo.sh gui:=false use_rviz:=false
./run_demo.sh --skip-build
./run_demo.sh --delivery
./run_demo.sh traffic_mode:=jobs
```

`--skip-build` requires an existing build with the renamed entry points.
`--delivery` selects the four-vehicle production fleet and requires the saved
map to cover its docking areas. Mapping is a separate step using
`./run_mapping.sh auto_drive:=false`; do not run mapping and the fleet together.

Launch files, scripts, profiles, gate models and configuration files use the
generic `warehouse_` prefix. The fleet profiles are `warehouse_roads` and
`warehouse_delivery`.

The jointless traffic model keeps physics enabled while stopped and applies
velocity commands at 1000 Hz, matching the world's 1 ms physics step; odometry
and TF remain at 20 Hz. After changing its SDF template, restart the demo so
Gazebo spawns the updated models. RViz clears `GTK_PATH` in its own environment
to avoid loading incompatible GTK libraries from a Snap terminal.
The run scripts default to `rmw_cyclonedds_cpp` (unless `RMW_IMPLEMENTATION` is
already set). On this installation, tests with Fast DDS showed some Gazebo
command subscriptions staying unresponsive even though commands were published;
the Cyclone DDS fleet test confirmed physical movement from all eight vehicles.

## Preview the enlarged warehouse

```bash
cd ~/warehouse_delivery_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select warehouse_2d --symlink-install
ros2 launch "$PWD/src/warehouse_2d/launch/warehouse_layout_demo.launch.py"
```

This opens `worlds/delivery_site.world` as a Gazebo scene. Stop it with
`Ctrl+C` before starting the mapping robot.

## Build and map with the robot

Open a fresh terminal and build this workspace:

```bash
cd ~/warehouse_delivery_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select warehouse_2d --symlink-install
./run_mapping.sh auto_drive:=false
```

The mapping launch spawns one forklift on the 2.4 m north road. Drive it
manually along the roads with a second terminal while `slam_toolbox` builds
`/map` from LiDAR and odometry:

```bash
cd ~/warehouse_delivery_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
ros2 run teleop_twist_keyboard teleop_twist_keyboard \
  --ros-args -r cmd_vel:=/traffic/vehicle_1/cmd_vel \
  -p speed:=0.25 -p turn:=0.5
```

Use `i` to move forward, `j`/`l` to turn and `k` to stop. RViz displays the
vehicle's traveled path as **Mapping Vehicle Path** while the map is drawn.
`run_mapping.sh` installs the path publisher automatically if the executable is
missing from this workspace's build. The vehicle does not need to enter every
hall, but areas hidden from its LiDAR remain unknown. Stop the vehicle and save
the map while mapping is still running:

```bash
cd ~/warehouse_delivery_ws
source /opt/ros/humble/setup.bash
source install/setup.bash
ros2 run nav2_map_server map_saver_cli -f ~/warehouse_delivery_ws/src/warehouse_2d/maps/delivery_site
python3 src/warehouse_2d/scripts/prepare_slam_map.py src/warehouse_2d/maps/delivery_site.yaml
colcon build --packages-select warehouse_2d --symlink-install
```

After saving, stop the mapping launch. For the current goal of live vehicle
positions, traffic heatmaps and route history, start the road-only fleet:

```bash
cd ~/warehouse_delivery_ws
colcon build --packages-select warehouse_2d --symlink-install
./run_traffic.sh
```

With `pose_source:=amcl gazebo_validation:=true`, Gazebo also supervises
localization recovery. Moving a forklift abruptly in Gazebo stops that vehicle,
waits for its new LiDAR and odometry, and sends its transformed map pose to
`/traffic/vehicle_N/initialpose`. The supervisor requests AMCL updates while
stationary and releases driving only after a new AMCL pose and three distinct
TF updates agree with the reference within 0.40 m and 0.25 rad. The controller
then replans from the corrected position. Persistent position/yaw disagreement
also starts recovery, including smaller moves below the jump threshold.
Progress and the reason for any wait are published on
`/traffic/vehicle_N/initialization_status`, exposed in the state API's
`localization_recovery` and the health API's per-vehicle `gazebo_validation`.
This mode uses Gazebo reference poses to reinitialize AMCL, so it measures
localization with simulation assistance. `ModelStates` has no source timestamp;
reference time is approximated by ROS clock at receipt, and comparisons more
than 0.25 s apart are skipped. Map alignment must still be measured correctly.

To run the same AMCL-driven fleet without comparing its poses with Gazebo
ground truth, use a separate database so previous comparison metrics do not
appear in the dashboard:

```bash
./run_traffic.sh gazebo_validation:=false database:=$HOME/.ros/delivery_site_no_truth.db
```

Gazebo still supplies the simulated LiDAR and odometry. The recorder does not
subscribe to Gazebo model poses or write localization error metrics in this
mode. The dashboard can show tracks and sensor health, but it cannot report
absolute position accuracy without an independent reference.

The default `warehouse_roads` profile starts eight vehicles across four mapped
roads, then continuously selects random goals throughout the connected, known
free map. Goals favor 8 m sectors that have received fewer destinations, avoid
other vehicles' goals and recent destinations, and use A* costs to reduce overlap
with active routes and recently travelled areas. Narrow shared aisles remain
usable; LiDAR avoidance and yielding still apply. Each physical arrival triggers
a new goal. Localization recovery replans from the corrected pose while retaining
the destination. After 45 seconds without movement while localization and sensors
are ready, a vehicle chooses another goal; this does not count as an arrival.
RViz shows each vehicle's planned path in a different color.
Unknown or disconnected map areas are excluded; extend the SLAM map to cover them.
Use `traffic_mode:=jobs` to restore the 20-checkpoint repeating traffic flows.
The original 48-dock production
delivery configuration remains intact. Open <http://localhost:8080/> for
live positions and traffic history. Selecting a vehicle shows its last five
minutes of recorded path by default; the map control can switch to one, 15,
or 60 minutes independently of the traffic heat window. Replay history lets
you move that path window to an earlier recorded time. The full production
delivery mode remains available with `./run_delivery.sh` after the robot maps
all 48 docking areas.

In Live mode, the Issues view also shows vehicle signal alerts from the health
API: delayed/missing position updates, unavailable localization, and delayed or
missing `LaserScan` messages. Unknown readings are not treated as sensor
faults. In historical replay, Issues shows only recorded stuck/congestion
events; live signal alerts are not backfilled as historical events.

Selected vehicle paths report the last recording time, largest gap, and path
breaks. When Gazebo reference positions exist, they also report the 95th
percentile position error for that selected interval; this is simulation-only
evidence, not a sensor-derived guarantee for a real truck. Route timestamps are
currently the traffic recorder's wall clock, not the original sensor header
stamps. Station markers show the planner's reachable map-cell goal, with its
offset from the configured station point in the tooltip. A real deployment
needs surveyed station coordinates, a measured map transform, and synchronized
source timestamps before absolute position or travel-time accuracy is claimed.

The launchers check that ROS resolves `warehouse_2d` from this workspace. The
operations web page is at <http://localhost:8080/> and delivery jobs at
<http://localhost:8080/#deliveries>. The saved SLAM map may need a measured
`world_to_map_x`, `world_to_map_y`, or `world_to_map_yaw` correction before
AMCL positions and station routes line up. Those launch arguments default to
zero until the mapping run provides an alignment measurement. Delivery traffic
uses `~/.ros/delivery_site_traffic.db`, separate from older runs.

## Layout and frontend

The world is generated from
`src/warehouse_2d/worlds/generate_warehouse_layout_demo.py`. Docking points, spawn
poses, ordered production flows, and dwell times are in
`src/warehouse_2d/config/warehouse_delivery.yaml`. Each line's next transfer is
queued only after the previous stage finishes.
The saved map files are created only by the robot mapping workflow above.

For frontend development:

```bash
cd ~/warehouse_delivery_ws/src/warehouse_2d/web
npm ci
npm run dev
```

Open <http://localhost:5174/>. The development server proxies port 8080. After
editing the frontend, run `npm run build` and rebuild the ROS package to refresh
the installed web files.

## Verification

```bash
source /opt/ros/humble/setup.bash
python3 -m pytest src/warehouse_2d/test -q
cd src/warehouse_2d/web
npm test
npm run build
```
