# Warehouse operations frontend

The main interface for this delivery workspace. Overview shows the live fleet,
job phases, cargo, completion counts, and docking points; `/#deliveries` lists
jobs and stations. Traffic history and LiDAR diagnostics are also available.

Run `npm ci` then `npm run dev` for development on port 5174. `/api` and
`/map.png` proxy to `http://127.0.0.1:8080`, configurable through
`WAREHOUSE_API_TARGET`. `npm run build` replaces this directory's `dist/` only.
The ROS launch serves that build on port 8080. Offline mode displays the saved
map and unknown counts, without invented vehicle data. Live cargo overlays are
excluded during historical traffic playback.
