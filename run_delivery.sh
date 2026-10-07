#!/usr/bin/env bash
set -eo pipefail

workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$workspace_dir/ros_environment.sh"
if ! ros2 pkg prefix gazebo_ros >/dev/null 2>&1 || ! ros2 pkg prefix gazebo_plugins >/dev/null 2>&1; then
  printf 'Gazebo ROS packages are missing. On Ubuntu 22.04 / Humble run ./setup_recomputer.sh first.\n' >&2
  exit 1
fi
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_cyclonedds_cpp}"
printf 'ROS middleware: %s\n' "$RMW_IMPLEMENTATION"
delivery_launch="$workspace_dir/install/warehouse_2d/share/warehouse_2d/launch/warehouse_delivery.launch.py"
delivery_executable="$workspace_dir/install/warehouse_2d/lib/warehouse_2d/warehouse_delivery_simulator.py"
if [[ ! -f "$delivery_launch" || ! -x "$delivery_executable" ]]; then
  printf 'Installing delivery launch and executables...\n'
  (cd "$workspace_dir" && colcon build --packages-select warehouse_2d --symlink-install)
fi
source "$workspace_dir/install/local_setup.bash"
set -u

expected_prefix="$workspace_dir/install/warehouse_2d"
actual_prefix="$(ros2 pkg prefix warehouse_2d)"
if [[ "$actual_prefix" != "$expected_prefix" ]]; then
  printf 'warehouse_2d resolves to %s; expected %s. Rebuild this workspace.\n' \
    "$actual_prefix" "$expected_prefix" >&2
  exit 1
fi

map_yaml="$workspace_dir/src/warehouse_2d/maps/delivery_site.yaml"
for argument in "$@"; do
  if [[ "$argument" == map:=* ]]; then
    map_yaml="${argument#map:=}"
  fi
done
map_yaml="${map_yaml/#\~\//$HOME/}"
if [[ ! -f "$map_yaml" ]]; then
  printf 'Saved SLAM map missing: %s\nRun ./run_mapping.sh, save /map as delivery_site, then rebuild.\n' "$map_yaml" >&2
  exit 1
fi

exec ros2 launch warehouse_2d warehouse_delivery.launch.py "map:=$map_yaml" "$@"
