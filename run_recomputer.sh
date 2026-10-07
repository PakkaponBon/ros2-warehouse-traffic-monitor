#!/usr/bin/env bash
set -eo pipefail
workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
gui=false
rviz=false
dry_run=false
build_flag=--skip-build
arguments=()
for argument in "$@"; do
  case "$argument" in
    --desktop) gui=true; rviz=true ;;
    --build) build_flag=--skip-web-build ;;
    --dry-run) dry_run=true ;;
    -h|--help)
      cat <<'USAGE'
Usage: ./run_recomputer.sh [--desktop] [--build] [--dry-run] [name:=value ...]
Default: four roaming vehicles, AMCL + Gazebo validation, web 8080,
         Gazebo server only, no RViz, existing native build.
  --desktop   Open Gazebo GUI and RViz on a local display.
  --build     Rebuild ROS using the bundled frontend (no npm).
  --dry-run   Print the launch command without starting anything.
Examples:
  ./run_recomputer.sh
  ./run_recomputer.sh vehicle_count:=8
  ./run_recomputer.sh --desktop vehicle_count:=4
  ./run_recomputer.sh web_host:=0.0.0.0
USAGE
      exit 0 ;;
    *:=*) arguments+=("$argument") ;;
    *) printf 'Unknown option: %s\n' "$argument" >&2; exit 2 ;;
  esac
done
command=("$workspace_dir/run_demo.sh" "$build_flag" vehicle_count:=4
         "gui:=$gui" "use_rviz:=$rviz" traffic_mode:=roam gazebo_verbose:=true
         "database:=$HOME/.ros/recomputer_demo.db" "${arguments[@]}")
if [[ "$dry_run" == true ]]; then printf '%q ' "${command[@]}"; printf '\n'; exit 0; fi
if [[ "$build_flag" == --skip-build ]]; then "$workspace_dir/check_recomputer.sh"; fi
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_cyclonedds_cpp}"
# Every process is on this host; avoid accidental discovery of another demo.
export ROS_LOCALHOST_ONLY="${ROS_LOCALHOST_ONLY:-1}"
export GAZEBO_MASTER_URI="${GAZEBO_MASTER_URI:-http://127.0.0.1:11345}"
export GAZEBO_IP="${GAZEBO_IP:-127.0.0.1}"
printf 'Gazebo transport: master=%s; advertised address=%s\n' "$GAZEBO_MASTER_URI" "$GAZEBO_IP"
exec "${command[@]}"
