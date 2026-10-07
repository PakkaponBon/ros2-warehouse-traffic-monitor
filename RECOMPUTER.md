# Move the warehouse demo to T208P / reComputer

Target reported for this demo: **T208P, 8 GB**. TWOWIN lists T208P in its
[Jetson Orin Nano series](https://twowintech.com/download-center-datasheets/).
Confirm the installed OS on the actual unit; its model name alone does not tell
us the JetPack version or establish simulation performance.

## Target stack and resources

The native preparation scripts target Ubuntu **22.04**, ROS 2 **Humble**, and
Gazebo **Classic 11**, on `aarch64` (Jetson) or `x86_64` (development machine).
[JetPack 6.2 uses an Ubuntu 22.04 root filesystem](https://docs.nvidia.com/jetson/jetpack/6.2/introduction/index.html).
On a Jetson with Ubuntu 20.04 / JetPack 5, the scripts stop before installing
anything. Use the device manufacturer's supported OS image or keep simulation
on the existing PC; do not add Ubuntu 22.04 repositories to Ubuntu 20.04.
An OS reflash is a separate decision and is not performed by these scripts.

Gazebo Classic and its ROS integration have
[reached end of life](https://index.ros.org/p/gazebo_ros/).
This preparation preserves the working demo's simulator and plugins. Confirm
that the target's configured apt repositories resolve them before the show.

Start with **4 vehicles**, Gazebo server only, and the web dashboard.
Keep AMCL, validation/recovery, LiDAR, roaming, recording, and heatmaps active.
This is a starting preset for an 8 GB device, not a measured performance claim.
Increase to 8 after measuring on the actual device. Open Gazebo GUI / RViz only
when the local display and measured resource usage allow it. Use SSD storage
for the workspace and database, and provide working cooling and the correct
power supply. The scripts report memory, disk space and `nvpmodel -q`; they do
not change power modes or clocks.

## 1. Prepare a transfer archive on the current PC

The archive includes the source, saved SLAM map, SDF world/models, launch
configuration and built frontend. It excludes `build/`, `install/`, ROS logs,
Git metadata, databases, Node modules and Python caches. Native ROS/Gazebo
packages still need to be installed on the target, with Internet access during
setup. The archive is not an offline dependency installer.

```bash
cd ~/warehouse_delivery_ws
# Only needed after frontend changes:
(cd src/warehouse_2d/web && npm run build)
./package_recomputer.sh
```

Outputs:

- `artifacts/warehouse_demo_recomputer.tar.gz`
- `artifacts/warehouse_demo_recomputer.tar.gz.sha256`

Copy both files by USB, or use SSH with the target's real user/IP:

```bash
scp artifacts/warehouse_demo_recomputer.tar.gz* TARGET_USER@TARGET_IP:~/
```

On the target, extract into a new workspace directory:

```bash
cd ~
sha256sum -c warehouse_demo_recomputer.tar.gz.sha256
mkdir warehouse_delivery_ws
tar -xzf warehouse_demo_recomputer.tar.gz -C warehouse_delivery_ws
cd warehouse_delivery_ws
```

Do not copy the current PC's `build/` or `install/` to the target. Build natively
so package paths and Gazebo plugins match the target's CPU and OS. Keep the
extracted source directory in place: the build uses symlink installation.

## 2. Install and build on the target

Check the OS before starting:

```bash
cat /etc/os-release
cat /etc/nv_tegra_release  # Jetson only
uname -m
```

Install ROS 2 Humble using the
[official Ubuntu installation instructions](https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html).
Then, as your normal login user:

```bash
cd ~/warehouse_delivery_ws
./setup_recomputer.sh
```

This installs colcon and rosdep using apt, initializes rosdep when needed,
resolves build/runtime dependencies from `package.xml`, then builds only
`warehouse_2d` with one worker and testing disabled. It uses the bundled web
frontend, so Node.js/npm are not needed on the target. No tests or simulation
are started by setup. `./setup_recomputer.sh --build-only` skips dependency
installation for a machine already prepared.

Afterwards:

```bash
./check_recomputer.sh
```

This is a read-only check of OS, memory/storage, ROS packages, Gazebo plugins,
map/world/frontend files and the native build marker. Passing it confirms the
files and dependencies, not performance or a working display driver.

## 3. Start the demo

```bash
./run_recomputer.sh
```

Open `http://localhost:8080/` on the target. Default database:
`~/.ros/recomputer_demo.db`. Stop normally with `Ctrl+C`; restarting continues
recording into the same database. To use a fresh session, specify a new database
filename rather than deleting the existing history.

Options:

```bash
./run_recomputer.sh vehicle_count:=2
./run_recomputer.sh vehicle_count:=8
./run_recomputer.sh --desktop vehicle_count:=4
./run_recomputer.sh --dry-run
./run_recomputer.sh database:=$HOME/.ros/recomputer_show_01.db
```

All simulator/ROS processes run on the target. `ROS_LOCALHOST_ONLY` defaults to
`1` to avoid discovering another demo on the same network. Cyclone DDS remains
the default middleware. The preset keeps the 1 ms physics step and planar
control at 1000 Hz that fixed the stopped-vehicle bug; do not reduce these rates
as a shortcut to improve performance.

### Show the dashboard on a laptop

Use an SSH tunnel from the laptop (choose local port 8081 if 8080 is busy):

```bash
ssh -N -L 8081:127.0.0.1:8080 TARGET_USER@TARGET_IP
```

Open `http://localhost:8081/` on the laptop. For a trusted local demo network,
you can explicitly bind HTTP to the target's network interfaces:

```bash
./run_recomputer.sh web_host:=0.0.0.0
```

Then open `http://TARGET_IP:8080/`. HTTP has no authentication; keep this on the
trusted demo LAN or use the SSH tunnel. No router port forwarding is required.

## 4. Rehearse on the actual device

Wait until all vehicles have localized, then in another terminal:

```bash
python3 verify_recomputer_demo.py --vehicles 4 --seconds 60
```

For the 8-vehicle preset, use `--vehicles 8`. This reads the HTTP APIs and reports
physical travel from Gazebo reference poses, observed initialization permission,
sector coverage, completed roaming goals and the approximate simulation/wall
time ratio. Its output is saved only when `--output report.json` is supplied.
It fails if the fleet is offline, a vehicle never becomes ready, or any vehicle
moves less than 0.5 m over the interval. This does not prove a collision-free
or indefinitely stable run.

For rehearsal, aim for a simulation/wall ratio near 1 (use 0.8 as an initial
review threshold), all vehicles moving, fresh LiDAR, and continued goal renewal.
Run long enough to observe at least one arrival and new destination; 60 seconds
may be too short for long factory routes. Watch memory, CPU and temperature with
`tegrastats` on Jetson and the health page at `/health.html`. If performance is
insufficient, reduce vehicle count, keep GUI/RViz closed, and show the web UI on
the laptop. Keep a working PC simulation available until the target rehearsal
has passed. Record the actual OS/JetPack, vehicle count and measured ratio with
the rehearsal result.

**Preparation status:** the source/packaging and launch checks can be verified
on the current PC. The T208P has not been accessed or benchmarked in this
session; its OS and complete-system performance remain to be confirmed.
