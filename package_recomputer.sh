#!/usr/bin/env bash
set -eo pipefail
workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == -h || "${1:-}" == --help ]]; then
  printf 'Usage: ./package_recomputer.sh [output.tar.gz]\nExport source, map and prebuilt frontend; excludes native build outputs and runtime data.\nBuild the frontend before export if it has changed.\n'
  exit 0
fi
if [[ "$#" -gt 1 ]]; then printf 'Too many arguments.\n' >&2; exit 2; fi
output="${1:-$workspace_dir/artifacts/warehouse_demo_recomputer.tar.gz}"
output="$(realpath -m -- "$output")"
if [[ -e "$output" || -e "$output.sha256" ]]; then
  printf 'Output already exists; choose a new name: %s\n' "$output" >&2; exit 1
fi
if [[ ! -f "$workspace_dir/src/warehouse_2d/web/dist/index.html" ]]; then
  printf 'Bundled frontend missing; build it first.\n' >&2; exit 1
fi
mkdir -p -- "$(dirname -- "$output")"
tar -czf "$output" --exclude=node_modules --exclude=__pycache__ --exclude=.pytest_cache \
  --exclude=.vite --exclude=.git --exclude=build --exclude=install --exclude=log \
  --exclude='*.log' --exclude='.env*' --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='*.sqlite' --exclude='*.sqlite3' \
  -C "$workspace_dir" README.md RECOMPUTER.md requirements.txt \
  run_demo.sh run_delivery.sh run_mapping.sh run_traffic.sh ros_environment.sh \
  setup_recomputer.sh check_recomputer.sh run_recomputer.sh package_recomputer.sh verify_recomputer_demo.py \
  src/warehouse_2d
(cd "$(dirname -- "$output")" && sha256sum "$(basename -- "$output")" > "$(basename -- "$output").sha256")
printf 'Prepared %s\nChecksum: %s.sha256\n' "$output" "$output"
