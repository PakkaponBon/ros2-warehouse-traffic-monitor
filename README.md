# Warehouse Delivery

A dedicated ROS 2 Humble and Gazebo Classic workspace for automated warehouse
pickup and delivery. This branch contains one layout, its saved LiDAR map,
four forklifts, eight docking points, traffic recording, and one operations web
interface. The older warehouse scenarios, their maps and assets, the M300
profile, and UWB nodes are excluded.

## Build and run

Open a fresh terminal so another workspace does not take precedence:

```bash
cd ~/warehouse_delivery_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select warehouse_2d --symlink-install
source install/setup.bash
ros2 launch warehouse_2d crtt_delivery.launch.py
```

The launch serves the new operations dashboard at <http://localhost:8080/>.
Delivery jobs are at <http://localhost:8080/#deliveries>. The prebuilt frontend is
included, so a ROS build does not require Node.js.

Stop an existing simulation using the same ROS domain and port before starting
this one. To run alongside another simulation, use a separate domain, Gazebo
master, database, and web port:

```bash
ROS_DOMAIN_ID=74 GAZEBO_MASTER_URI=http://localhost:11374 \
  ros2 launch warehouse_2d crtt_delivery.launch.py web_port:=8081 \
  database:=/tmp/warehouse_delivery_74.db
```

The delivery loop is pickup → load → deliver → unload → next job. Cargo loading
is simulated; it does not physically lift a pallet in Gazebo. AMCL provides
positions, A* plans paths, and LiDAR and vehicle yielding handle obstacles.

## Frontend development

```bash
cd ~/warehouse_delivery_ws/src/warehouse_2d/web
npm ci
npm run dev
```

Open <http://localhost:5174/>. The development server proxies the local backend
on port 8080. Use `WAREHOUSE_API_TARGET=http://localhost:8081 npm run dev` when
running an isolated backend on port 8081. The UI uses generic warehouse branding.
After editing the frontend, run `npm run build` and rebuild the ROS package to
refresh the installed web files.

## Mapping and layout

```bash
ros2 launch warehouse_2d crtt_layout_slam.launch.py
ros2 run nav2_map_server map_saver_cli -f /tmp/warehouse_delivery_map
```

`crtt_layout_demo.launch.py` opens the layout without vehicles. The world can be
regenerated using `python3 src/warehouse_2d/worlds/generate_crtt_layout_demo.py`.
Docking points, spawn poses, jobs, and load/unload durations are configured in
`src/warehouse_2d/config/crtt_delivery.yaml`.

The bundled `crtt_layout_slam2` map uses 0.05 m/pixel. Its world-to-map alignment
is x = -1.775 m, y = 0.004 m, yaw = 0.0011 rad. Recheck alignment when replacing
the map or world. Loading and unloading count as intentional stops rather than
stuck events. Traffic history is stored in SQLite; the default database is
`~/.ros/crtt_delivery_traffic.db`.

## Verification

```bash
source /opt/ros/humble/setup.bash
python3 -m pytest src/warehouse_2d/test -q
cd src/warehouse_2d/web
npm test
npm run build
```

Shared Python modules needed by the delivery controller and traffic API are
retained. The package name remains `warehouse_2d`, so do not source this and the
original workspace in the same terminal.
