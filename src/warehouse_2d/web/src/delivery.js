const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const PHASES = {
  roaming: ['Roaming', -1],
  idle: ['Waiting for a job', -1],
  to_pickup: ['Going to pickup', 0],
  loading: ['Loading cargo', 1],
  to_dropoff: ['Delivering cargo', 2],
  unloading: ['Unloading cargo', 3],
};
const MOTION = {
  moving: 'Moving', turning: 'Turning', waiting_vehicle: 'Giving way',
  blocked_obstacle: 'Obstacle ahead', stalled: 'Unable to move', stuck: 'Stuck',
  loading: 'Loading', unloading: 'Unloading', localizing: 'Locating vehicle',
  sensor_wait: 'Waiting for sensor', planning: 'Planning route', idle: 'Idle',
};

export function deliveryPhase(phase) {
  const [label, step] = PHASES[phase] || ['Status unavailable', -1];
  return { label, step };
}

export function stationLabel(snapshot, id) {
  return snapshot?.stations?.find((station) => station.id === id)?.label || id || '—';
}

export function deliverySummary(snapshot, connected = true) {
  if (!connected || !snapshot?.online) return null;
  return {
    vehicles: snapshot.vehicles.length,
    active: snapshot.vehicles.filter((vehicle) => vehicle.phase === 'roaming' ? vehicle.destination : vehicle.task_id && vehicle.phase !== 'idle').length,
    completed: snapshot.vehicles.reduce((sum, vehicle) => sum + Number(vehicle.completed_goals ?? vehicle.completed_jobs ?? 0), 0),
    queued: snapshot.pending_jobs ?? null,
  };
}

export function renderDeliveryMetrics(root, snapshot, connected) {
  const counts = deliverySummary(snapshot, connected);
  const roaming = snapshot?.mode === 'roam';
  root.innerHTML = (roaming ? [
    ['Vehicles online', counts?.vehicles, 'Live roaming fleet', ''],
    ['Active routes', counts?.active, 'Independent random destinations', 'teal'],
    ['Goals reached', counts?.completed, 'New destination after each arrival', 'teal'],
    ['Sectors visited', counts ? snapshot.coverage?.visited_sectors : null, `${snapshot?.coverage?.reachable_sectors ?? '—'} reachable sectors`, 'orange'],
  ] : [
    ['Forklifts online', counts?.vehicles, 'Live delivery fleet', ''],
    ['Active deliveries', counts?.active, 'Pickup, loading, delivery & unloading', 'teal'],
    ['Deliveries completed', counts?.completed, 'Since this fleet session started', 'teal'],
    ['Jobs queued', counts?.queued, 'Waiting for an available forklift', 'orange'],
  ]).map(([label, value, detail, color]) => `<article class="metric ${color}">
    <span>${label}</span><strong>${value == null ? '—' : value.toLocaleString()}</strong>
    <small>${counts ? detail : 'Waiting for live fleet updates'}</small>
  </article>`).join('');
}

function cargo(vehicle) {
  if (vehicle.phase === 'roaming') return '<span class="cargo-badge">Roaming</span>';
  return `<span class="cargo-badge ${vehicle.carrying ? 'loaded' : ''}">${vehicle.carrying ? 'Carrying cargo' : 'Empty'}</span>`;
}

function progress(vehicle) {
  const { label, step } = deliveryPhase(vehicle.phase);
  if (vehicle.phase === 'roaming') return '';
  return `<div class="delivery-progress" aria-label="${escapeHtml(label)}">${['Pickup', 'Load', 'Deliver', 'Unload'].map((name, index) => `<span class="${index < step ? 'done' : index === step ? 'current' : ''}" ${index === step ? 'aria-current="step"' : ''}><i aria-hidden="true"></i>${name}</span>`).join('')}</div>`;
}

function routeLabel(vehicle, snapshot) {
  if (vehicle.phase === 'roaming') {
    const goal = vehicle.destination;
    return goal ? `Goal x ${Number(goal.x).toFixed(1)}, y ${Number(goal.y).toFixed(1)} m` : 'Choosing a destination';
  }
  return `${stationLabel(snapshot, vehicle.pickup)} → ${stationLabel(snapshot, vehicle.dropoff)}`;
}

function completedLabel(vehicle) {
  return vehicle.phase === 'roaming' ? `${Number(vehicle.completed_goals || 0)} goals reached` : `${Number(vehicle.completed_jobs || 0)} delivered`;
}

export function renderDeliveryFleet(root, telemetry, snapshot, selectedVehicle) {
  root.innerHTML = snapshot.vehicles.map((vehicle) => {
    const observed = telemetry.find((item) => item.vehicle_id === vehicle.vehicle_id);
    const speed = Number.isFinite(observed?.speed) ? `${observed.speed.toFixed(2)} m/s` : 'Speed unavailable';
    const phase = deliveryPhase(vehicle.phase);
    const motion = MOTION[vehicle.motion_state] || 'Status unavailable';
    const issue = ['blocked_obstacle', 'stalled', 'stuck'].includes(vehicle.motion_state);
    return `<article class="vehicle-card vehicle-action delivery-vehicle ${selectedVehicle === vehicle.vehicle_id ? 'selected' : ''}" data-vehicle="${escapeHtml(vehicle.vehicle_id)}" tabindex="0" role="button" aria-label="Locate ${escapeHtml(vehicle.vehicle_id)} on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${issue ? 'blocked' : ''}"></i>${escapeHtml(vehicle.vehicle_id.replace('vehicle_', 'Forklift '))}</strong><b class="speed">${speed}</b></div>
      <div class="delivery-vehicle-route"><span>${escapeHtml(routeLabel(vehicle, snapshot))}</span></div>
      ${progress(vehicle)}
      <div class="delivery-vehicle-foot">${vehicle.phase === 'roaming' ? '' : `<small>${escapeHtml(phase.label)}</small>`}${cargo(vehicle)}</div>
      <small class="delivery-motion ${issue ? 'blocked' : ''}">${motion} · ${completedLabel(vehicle)}</small>
      ${observed ? `<div class="vehicle-position">Position <b>x ${observed.x.toFixed(2)} m</b><b>y ${observed.y.toFixed(2)} m</b></div>` : ''}
    </article>`;
  }).join('') || '<div class="empty">Waiting for vehicles to join the fleet.</div>';
}

export function renderDeliveryJobs(root, snapshot, connected) {
  if (!connected || !snapshot?.online) {
    root.innerHTML = '<tr><td colspan="6" class="empty">Waiting for live delivery updates.</td></tr>';
    return;
  }
  root.innerHTML = snapshot.vehicles.map((vehicle) => `<tr>
    <td><button type="button" class="text-button" data-delivery-vehicle="${escapeHtml(vehicle.vehicle_id)}">${escapeHtml(vehicle.vehicle_id.replace('vehicle_', 'Forklift '))} ↗</button></td>
    <td><span class="delivery-job-id">${escapeHtml(vehicle.task_id)}</span></td>
    <td><div class="delivery-job-route"><span>${escapeHtml(routeLabel(vehicle, snapshot))}</span></div></td>
    <td>${progress(vehicle)}<small>${escapeHtml(deliveryPhase(vehicle.phase).label)}</small></td>
    <td>${cargo(vehicle)}</td><td>${Number(vehicle.completed_goals ?? vehicle.completed_jobs ?? 0).toLocaleString()}</td>
  </tr>`).join('') || '<tr><td colspan="6" class="empty">No delivery jobs have been assigned yet.</td></tr>';
}

export function renderStationActivity(root, snapshot) {
  root.innerHTML = (snapshot?.stations || []).map((station, index) => {
    const assigned = snapshot.online ? snapshot.vehicles.filter((vehicle) => vehicle.task_id && (vehicle.pickup === station.id || vehicle.dropoff === station.id)) : [];
    const docked = assigned.some((vehicle) => (vehicle.phase === 'loading' && vehicle.pickup === station.id) || (vehicle.phase === 'unloading' && vehicle.dropoff === station.id));
    return `<article class="delivery-station"><span class="station-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(station.label)}</h3><p>${!snapshot.online ? 'Status unavailable' : docked ? 'Loading / unloading' : assigned.length ? `${assigned.length} assigned ${assigned.length === 1 ? 'delivery' : 'deliveries'}` : 'Available'}</p></div><i class="station-availability ${!snapshot.online ? 'unknown' : docked ? 'busy' : ''}" aria-hidden="true"></i></article>`;
  }).join('') || '<div class="empty">Docking points will appear when the fleet connects.</div>';
}
