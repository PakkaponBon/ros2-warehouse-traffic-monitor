#!/usr/bin/env bash
set -eo pipefail

workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
web_dir="$workspace_dir/src/warehouse_2d/web"
profile="warehouse_roads"
skip_build=false
skip_web_build=false
launch_arguments=()

usage() {
  cat <<'USAGE'
Usage: ./run_demo.sh [--delivery] [--skip-build] [--skip-web-build] [name:=value ...]

Build the frontend and ROS package, then start Gazebo, the fleet, AMCL,
localization validation/recovery, recorder, heatmap, web monitor and RViz.
The default fleet uses eight vehicles roaming all reachable mapped areas.

  --delivery     Use the four-vehicle production delivery profile.
                 Requires a saved map covering the delivery stations.
  --skip-build   Use an existing build after checking required entry points.
  --skip-web-build Use the bundled frontend; build only the ROS package.
  -h, --help     Show this help.

Examples:
  ./run_demo.sh
  ./run_demo.sh vehicle_count:=2
  ./run_demo.sh traffic_mode:=jobs  # Repeat the configured road delivery loops
  ./run_demo.sh gui:=false use_rviz:=false
  ./run_demo.sh database:=/tmp/warehouse_demo.db
  ./run_demo.sh --delivery
USAGE
}

for argument in "$@"; do
  case "$argument" in
    --delivery) profile="warehouse_delivery" ;;
    --skip-build) skip_build=true ;;
    --skip-web-build) skip_web_build=true ;;
    -h|--help) usage; exit 0 ;;
    profile:=*) profile="${argument#profile:=}" ;;
    *:=*) launch_arguments+=("$argument") ;;
    *) printf 'Unknown argument: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
  esac
done

case "$profile" in
  warehouse_roads) delivery_config="$workspace_dir/src/warehouse_2d/config/warehouse_traffic_roads.yaml" ;;
  warehouse_delivery) delivery_config="$workspace_dir/src/warehouse_2d/config/warehouse_delivery.yaml" ;;
  *) printf 'Unknown profile: %s\n' "$profile" >&2; exit 2 ;;
esac

map_yaml="$workspace_dir/src/warehouse_2d/maps/delivery_site.yaml"
web_port=8080
for argument in "${launch_arguments[@]}"; do
  case "$argument" in
    map:=*) map_yaml="${argument#map:=}" ;;
    delivery_config:=*) delivery_config="${argument#delivery_config:=}" ;;
    web_port:=*) web_port="${argument#web_port:=}" ;;
  esac
done
map_yaml="${map_yaml/#\~\//$HOME/}"
delivery_config="${delivery_config/#\~\//$HOME/}"
for required_file in "$map_yaml" "$delivery_config"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Required file missing: %s\nSave the SLAM map with ./run_mapping.sh before running the fleet.\n' "$required_file" >&2
    exit 1
  fi
done

if command -v git >/dev/null 2>&1 && [[ -e "$workspace_dir/.git" ]]; then
  git_branch="$(git -C "$workspace_dir" branch --show-current)"
  git_commit="$(git -C "$workspace_dir" rev-parse --short HEAD)"
  mapfile -t git_changes < <(git -C "$workspace_dir" status --porcelain=v1)
  printf 'Git: %s @ %s; %s changed/untracked entries\n' \
    "${git_branch:-detached HEAD}" "$git_commit" "${#git_changes[@]}"
else
  printf 'Git metadata unavailable; using the current workspace files.\n'
fi

if [[ ! -f /opt/ros/humble/setup.bash ]]; then
  printf 'ROS 2 Humble setup missing: /opt/ros/humble/setup.bash\n' >&2
  exit 1
fi
source /opt/ros/humble/setup.bash

if [[ "$skip_build" == false ]]; then
  required_commands=(colcon)
  if [[ "$skip_web_build" == false ]]; then
    required_commands+=(npm)
  elif [[ ! -f "$web_dir/dist/index.html" ]]; then
    printf 'Bundled frontend missing: run npm run build in %s first.\n' "$web_dir" >&2
    exit 1
  fi
  for required_command in "${required_commands[@]}"; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
      printf 'Required command missing: %s\n' "$required_command" >&2
      exit 1
    fi
  done
  if [[ "$skip_web_build" == false ]]; then
    (
      cd "$web_dir"
      if [[ ! -x node_modules/.bin/vite ]]; then
        npm ci
      fi
      npm run build
    )
  fi
  (
    cd "$workspace_dir"
    colcon build --packages-select warehouse_2d --symlink-install
  )
else
  for required_file in \
    "$workspace_dir/install/setup.bash" \
    "$workspace_dir/install/warehouse_2d/share/warehouse_2d/launch/warehouse_delivery.launch.py" \
    "$workspace_dir/install/warehouse_2d/share/warehouse_2d/launch/warehouse_layout_demo.launch.py" \
    "$workspace_dir/install/warehouse_2d/share/warehouse_2d/web/dist/index.html"; do
    if [[ ! -f "$required_file" ]]; then
      printf 'Build entry point missing: %s\nRun ./run_demo.sh without --skip-build.\n' "$required_file" >&2
      exit 1
    fi
  done
  for required_executable in warehouse_delivery_simulator.py gazebo_amcl_validator.py; do
    if [[ ! -x "$workspace_dir/install/warehouse_2d/lib/warehouse_2d/$required_executable" ]]; then
      printf 'Installed executable missing: %s\nRun ./run_demo.sh without --skip-build.\n' "$required_executable" >&2
      exit 1
    fi
  done
fi

printf 'Starting %s; web monitor: http://localhost:%s/\nPress Ctrl+C to stop the launch.\n' "$profile" "$web_port"
exec "$workspace_dir/run_delivery.sh" \
  "profile:=$profile" "delivery_config:=$delivery_config" "map:=$map_yaml" \
  gui:=true use_rviz:=true use_web:=true \
  pose_source:=amcl gazebo_validation:=true \
  "${launch_arguments[@]}"
