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
source /opt/ros/humble/setup.bash
if [[ "$install_dependencies" == true ]]; then
  sudo apt-get update
  sudo apt-get install -y python3-colcon-common-extensions python3-rosdep
  if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then sudo rosdep init; fi
  rosdep update --rosdistro humble
  rosdep install --from-paths "$workspace_dir/src" --ignore-src --rosdistro humble -y \
    --dependency-types build --dependency-types buildtool --dependency-types exec
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
