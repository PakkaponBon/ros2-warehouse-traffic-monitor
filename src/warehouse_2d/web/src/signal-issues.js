const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function vehicleSignalIssues(health) {
  if (!Array.isArray(health?.vehicles)) return { alerts: [], awaiting: 0 };
  const alerts = [];
  let awaiting = 0;
  for (const vehicle of health.vehicles) {
    if (vehicle.status === 'unknown') {
      awaiting += 1;
      continue;
    }
    if (vehicle.status === 'offline' || vehicle.status === 'stale') {
      alerts.push({
        vehicleId: vehicle.vehicle_id,
        type: 'position',
        detail: vehicle.status === 'offline' ? 'Position updates stopped' : 'Position updates delayed',
        ageSeconds: vehicle.age_seconds,
      });
      continue;
    }
    if (['stale', 'offline', 'unavailable'].includes(vehicle.lidar?.state)) {
      alerts.push({
        vehicleId: vehicle.vehicle_id,
        type: 'lidar',
        detail: vehicle.lidar.state === 'stale' ? 'LaserScan updates delayed'
          : vehicle.lidar.state === 'offline' ? 'LaserScan updates stopped'
            : vehicle.lidar.detail || 'Vehicle reports LiDAR unavailable',
      });
    }
    if (['stale', 'offline', 'unavailable'].includes(vehicle.localization?.state)) {
      alerts.push({
        vehicleId: vehicle.vehicle_id,
        type: 'localization',
        detail: vehicle.motion_state === 'localizing'
          ? 'Waiting for a usable localized position'
          : 'Localization updates unavailable',
      });
    }
  }
  return { alerts, awaiting };
}

export function renderSignalIssues(root, health, connected) {
  if (!connected) {
    root.innerHTML = '<strong>Live position checks unavailable</strong><span>Check the monitoring connection before treating this as an all-clear.</span>';
    return;
  }
  const { alerts, awaiting } = vehicleSignalIssues(health);
  const awaitingText = awaiting ? ` · ${awaiting} awaiting first position` : '';
  if (!alerts.length) {
    root.innerHTML = `<strong>No live position or localization alerts</strong><span>Based on available diagnostics${awaitingText}. An unknown sensor reading is not treated as a fault.</span>`;
    return;
  }
  root.innerHTML = `<strong>${alerts.length} live signal alert${alerts.length === 1 ? '' : 's'}${awaitingText}</strong>
    <ul>${alerts.map((alert) => `<li><b>${escapeHtml(alert.vehicleId)}</b> · ${escapeHtml(alert.detail)}${Number.isFinite(alert.ageSeconds) ? ` · last position ${alert.ageSeconds.toFixed(1)} s ago` : ''}</li>`).join('')}</ul>
    <a href="/health.html">Inspect vehicle health ↗</a>`;
}
