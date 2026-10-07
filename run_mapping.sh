#!/usr/bin/env bash
set -eo pipefail

workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source /opt/ros/humble/setup.bash
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_cyclonedds_cpp}"
mapping_path_executable="$workspace_dir/install/warehouse_2d/lib/warehouse_2d/mapping_path.py"
mapping_launch="$workspace_dir/install/warehouse_2d/share/warehouse_2d/launch/warehouse_layout_slam.launch.py"
if [[ ! -x "$mapping_path_executable" || ! -f "$mapping_launch" ]]; then
  printf 'Installing mapping launch and executables...\n'
  (cd "$workspace_dir" && colcon build --packages-select warehouse_2d --symlink-install)
fi
source "$workspace_dir/install/setup.bash"
set -u

expected_prefix="$workspace_dir/install/warehouse_2d"
actual_prefix="$(ros2 pkg prefix warehouse_2d)"
if [[ "$actual_prefix" != "$expected_prefix" ]]; then
  printf 'warehouse_2d resolves to %s; expected %s. Rebuild this workspace.\n' \
    "$actual_prefix" "$expected_prefix" >&2
  exit 1
fi

exec ros2 launch warehouse_2d warehouse_layout_slam.launch.py "$@"
