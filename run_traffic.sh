#!/usr/bin/env bash
set -eo pipefail
workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$workspace_dir/run_delivery.sh" \
  profile:=warehouse_roads \
  "delivery_config:=$workspace_dir/src/warehouse_2d/config/warehouse_traffic_roads.yaml" \
  "$@"
