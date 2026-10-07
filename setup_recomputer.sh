#!/usr/bin/env bash
set -eo pipefail
workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install_dependencies=true
case "${1:-}" in
  --build-only) install_dependencies=false ;;
  -h|--help)
    printf 'Usage: ./setup_recomputer.sh [--build-only]\nInstall package dependencies and build natively on Ubuntu 22.04 with ROS 2 Humble.\nROS must already be installed. No Node.js is needed for the bundled frontend.\n'
    exit 0 ;;
  '') ;;
  *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
esac
if [[ "$#" -gt 1 ]]; then printf 'Too many arguments.\n' >&2; exit 2; fi
source /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 22.04 ]]; then
  printf 'This native demo requires Ubuntu 22.04 / ROS 2 Humble; detected %s. See RECOMPUTER.md.\n' "$PRETTY_NAME" >&2
  exit 1
fi
case "$(uname -m)" in
  aarch64|x86_64) ;;
  *) printf 'Unsupported CPU architecture: %s\n' "$(uname -m)" >&2; exit 1 ;;
esac
if [[ ! -f /opt/ros/humble/setup.bash ]]; then
  printf 'Install ROS 2 Humble first: https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html\n' >&2
  exit 1
fi
if [[ ! -f "$workspace_dir/src/warehouse_2d/web/dist/index.html" ]]; then
  printf 'Bundled frontend missing. Build it on the source machine before transfer.\n' >&2
  exit 1
fi
if [[ "$EUID" == 0 ]]; then
  printf 'Run as your normal login user; installation uses sudo when needed.\n' >&2
  exit 1
fi
source "$workspace_dir/ros_environment.sh"
dependency_dir="$workspace_dir/.dependencies/gazebo_ros_ws"
rosdep_paths=("$workspace_dir/src")
rosdep_skip=()
if [[ "$install_dependencies" == true ]]; then
  sudo apt-get update
  sudo apt-get install -y python3-colcon-common-extensions python3-rosdep
  if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then sudo rosdep init; fi
  rosdep update --rosdistro humble
fi
# Humble's Jammy ARM64 repository lacks gazebo_ros/gazebo_plugins binaries.
# Build the matching upstream release when they are absent from the environment.
if [[ "$(uname -m)" == aarch64 ]] && \
   { ! ros2 pkg prefix gazebo_ros >/dev/null 2>&1 || ! ros2 pkg prefix gazebo_plugins >/dev/null 2>&1; }; then
  source_dir="$dependency_dir/src/gazebo_ros_pkgs"
  if [[ "$install_dependencies" == true ]]; then
    # Jammy's main archive has Classic 11 binaries only for amd64. Use the
    # Open Robotics non-amd64 PPA linked by the upstream installation guide.
    if ! apt-cache policy gazebo libgazebo-dev | awk '/Candidate:/ {if ($2 == "(none)") exit 1; count++} END {if (count < 2) exit 1}'; then
      printf 'Adding Open Robotics Gazebo 11 ARM64 PPA (upstream: no support or updates).\n'
      sudo apt-get install -y software-properties-common
      sudo add-apt-repository -y ppa:openrobotics/gazebo11-non-amd64
      sudo apt-get update
    fi
    sudo apt-get install -y git build-essential cmake gazebo libgazebo-dev
    if [[ ! -e "$source_dir" ]]; then
      mkdir -p "$dependency_dir/src"
      git clone --depth 1 --branch 3.9.0 \
        https://github.com/ros-simulation/gazebo_ros_pkgs.git "$source_dir"
    fi
  fi
  if [[ ! -d "$source_dir/.git" ]] || \
     [[ "$(git -C "$source_dir" describe --tags --exact-match 2>/dev/null)" != 3.9.0 ]]; then
    printf 'Gazebo ROS source release 3.9.0 missing at %s. Run setup without --build-only.\n' "$source_dir" >&2
    exit 1
  fi
  if [[ -n "$(git -C "$source_dir" status --porcelain)" ]]; then
    printf 'Gazebo ROS source has local changes: %s. Review them before building.\n' "$source_dir" >&2
    exit 1
  fi
  if [[ "$install_dependencies" == true ]]; then
    # Ubuntu Jammy names these native packages gazebo/libgazebo-dev.
    # Their upstream rosdep keys refer to OSRF's gazebo11/libgazebo11-dev.
    rosdep install --from-paths "$dependency_dir/src" --ignore-src --rosdistro humble -y \
      --skip-keys 'gazebo11 libgazebo11-dev' \
      --dependency-types build --dependency-types buildtool --dependency-types build_export --dependency-types exec
  fi
  printf 'Building Gazebo ROS 3.9.0 natively, one compiler process at a time...\n'
  (
    cd "$dependency_dir"
    export CMAKE_BUILD_PARALLEL_LEVEL=1 MAKEFLAGS=-j1
    colcon build --symlink-install --executor sequential --packages-up-to gazebo_plugins \
      --cmake-args -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF
  )
  source "$dependency_dir/install/local_setup.bash"
fi
if [[ -d "$dependency_dir/src/gazebo_ros_pkgs" ]]; then
  rosdep_paths+=("$dependency_dir/src")
  rosdep_skip=(--skip-keys 'gazebo11 libgazebo11-dev')
fi
if [[ "$install_dependencies" == true ]]; then
  rosdep install --from-paths "${rosdep_paths[@]}" --ignore-src --rosdistro humble -y \
    "${rosdep_skip[@]}" --dependency-types build --dependency-types buildtool --dependency-types exec
fi
if ! command -v colcon >/dev/null; then printf 'colcon missing; run without --build-only.\n' >&2; exit 1; fi
cd "$workspace_dir"
colcon build --packages-select warehouse_2d --symlink-install --parallel-workers 1 \
  --cmake-args -DBUILD_TESTING=OFF
python3 - <<'PY'
import json, platform, pathlib, time
pathlib.Path('install/demo-build.json').write_text(json.dumps({
    'architecture': platform.machine(), 'workspace': str(pathlib.Path.cwd()),
    'built_at': time.time(), 'ros_distro': 'humble',
}, indent=2) + '\n')
PY
./check_recomputer.sh
printf '\nReady. Start with ./run_recomputer.sh\n'
