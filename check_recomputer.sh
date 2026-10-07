#!/usr/bin/env bash
set -eo pipefail
workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == -h || "${1:-}" == --help ]]; then
  printf 'Usage: ./check_recomputer.sh\nRead-only check of OS, native ROS dependencies and bundled demo resources.\n'
  exit 0
fi
if [[ "$#" != 0 ]]; then printf 'Unknown arguments.\n' >&2; exit 2; fi
source /etc/os-release
printf 'Host: %s; architecture: %s\n' "$PRETTY_NAME" "$(uname -m)"
if [[ -r /proc/device-tree/model ]]; then tr -d '\0' < /proc/device-tree/model; printf '\n'; fi
if [[ -r /etc/nv_tegra_release ]]; then head -n 1 /etc/nv_tegra_release; fi
free -h
df -h "$workspace_dir"
if [[ "$ID" != ubuntu || "$VERSION_ID" != 22.04 ]]; then
  printf 'FAIL: native demo expects Ubuntu 22.04. See RECOMPUTER.md before installing.\n' >&2; exit 1
fi
if [[ ! -f /opt/ros/humble/setup.bash ]]; then printf 'FAIL: ROS 2 Humble is missing.\n' >&2; exit 1; fi
source "$workspace_dir/ros_environment.sh"
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_cyclonedds_cpp}"
python3 - "$workspace_dir" <<'PY'
import pathlib, platform, sys, json, xml.etree.ElementTree as ET
from ament_index_python.packages import get_package_prefix, PackageNotFoundError
root = pathlib.Path(sys.argv[1])
missing = []
manifest = ET.parse(root/'src/warehouse_2d/package.xml')
for element in manifest.findall('exec_depend'):
    name = element.text
    if name.startswith('python3-'):
        continue
    try:
        get_package_prefix(name)
    except PackageNotFoundError:
        missing.append(name)
for name in ('PIL', 'yaml', 'rclpy'):
    try:
        __import__(name)
    except ImportError:
        missing.append(name)
for package, name in (
    ('gazebo_plugins', 'libgazebo_ros_planar_move.so'),
    ('gazebo_plugins', 'libgazebo_ros_ray_sensor.so'),
    ('gazebo_ros', 'libgazebo_ros_state.so'),
):
    try:
        plugin = pathlib.Path(get_package_prefix(package))/'lib'/name
        if not plugin.is_file(): missing.append(str(plugin))
    except PackageNotFoundError:
        pass
for name in ('maps/delivery_site.yaml', 'maps/delivery_site.pgm', 'maps/delivery_site.png',
             'worlds/delivery_site.world', 'web/dist/index.html'):
    if not (root/'src/warehouse_2d'/name).is_file(): missing.append(name)
marker = root/'install/demo-build.json'
if marker.exists():
    build = json.loads(marker.read_text())
    if build.get('architecture') != platform.machine() or build.get('workspace') != str(root):
        missing.append('native build: build was copied from another host/path; rebuild here')
if not (root/'install/setup.bash').is_file(): missing.append('workspace build: run ./setup_recomputer.sh')
if missing:
    print('FAIL: missing/incompatible resources:\n  ' + '\n  '.join(missing))
    sys.exit(1)
print('PASS: native dependencies and bundled demo resources are present')
PY
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  printf 'No desktop display: use the default headless preset.\n'
fi
if command -v nvpmodel >/dev/null; then nvpmodel -q || true; fi
printf 'Middleware: %s\n' "$RMW_IMPLEMENTATION"
