const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const vehicleLabel = (vehicle) => vehicle.vehicle_id === 'my_robot'
  ? `${escapeHtml(vehicle.vehicle_id)} <span class="tag">AMR</span>`
  : escapeHtml(vehicle.vehicle_id);

const MOTION_STATES = {
  moving: ['Moving', 'moving'],
  turning: ['Turning normally', 'turning'],
  waiting_vehicle: ['Waiting for vehicle', 'waiting'],
  blocked_obstacle: ['Blocked by obstacle', 'blocked'],
  stalled: ['Commanded but not moving', 'blocked'],
  stuck: ['Stuck', 'blocked'],
  idle: ['Idle / intentional stop', 'idle'],
  planning: ['Planning next route', 'idle'],
  localizing: ['Waiting for localization', 'idle'],
  sensor_wait: ['Waiting for LiDAR', 'idle'],
  unknown: ['State unavailable', 'idle'],
};

function motionPresentation(vehicle) {
  const fallback = vehicle.speed >= 0.05 ? 'moving' : 'unknown';
  const state = vehicle.motion_state || fallback;
  const [label, className] = MOTION_STATES[state] || MOTION_STATES.unknown;
  return { state, label, className };
}

export function renderMetrics(root, data) {
  const moving = data.latest.filter((vehicle) => (
    motionPresentation(vehicle).state === 'moving'
  )).length;
  const localization = data.localization?.summary;
  const localizationValue = localization?.samples
    ? `${localization.mean_error.toFixed(2)} m`
    : '—';
  root.innerHTML = [
    ['samples', data.samples.toLocaleString(), 'Position samples', ''],
    ['vehicles', data.latest.length, 'Active vehicles', 'teal'],
    ['moving', moving, 'Moving now', 'teal'],
    ['stuck', data.stuck.length, 'Stuck hotspots', 'orange'],
    ['congestion', data.congestion.length, 'Congestion hotspots', 'red'],
    ['localization', localizationValue, 'Mean AMCL error', 'teal'],
  ].map((metric) => `<article class="metric ${metric[3]}"><strong>${metric[1]}</strong><span>${metric[2]}</span></article>`).join('');
}

export function renderVehicleSummary(root, vehicles, localizationVehicles = []) {
  if (!vehicles.length) {
    root.innerHTML = '<div class="empty">No fresh vehicle positions at the end of this range.</div>';
    return;
  }
  root.innerHTML = vehicles.map((vehicle) => {
    const motion = motionPresentation(vehicle);
    const localization = localizationVehicles.find(
      (value) => value.vehicle_id === vehicle.vehicle_id,
    );
    return `<article class="vehicle-card vehicle-action" data-vehicle="${escapeHtml(vehicle.vehicle_id)}" role="button" tabindex="0" title="Show ${escapeHtml(vehicle.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${motion.className}"></i>${vehicleLabel(vehicle)}</strong>
        <b class="speed">${vehicle.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${vehicle.x.toFixed(2)} m</b><b>y ${vehicle.y.toFixed(2)} m</b></div>
      ${localization ? `<div class="localization-error">LiDAR AMCL error <b>${localization.latest_error.toFixed(2)} m</b></div>` : ''}
      <small class="motion-state ${motion.className}">● ${motion.label}</small>
    </article>`;
  }).join('');
}

export function renderLocalization(root, localization) {
  const summary = localization?.summary;
  const vehicles = localization?.vehicles || [];
  if (!summary?.samples) {
    root.innerHTML = '<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';
    return;
  }
  const degrees = summary.mean_yaw_error * 180 / Math.PI;
  root.innerHTML = `
    <div class="localization-overview">
      <div><strong>${summary.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${summary.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${summary.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${degrees.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${vehicles.map((vehicle) => `
      <div class="localization-row">
        <span><b>${escapeHtml(vehicle.vehicle_id)}</b><small>${vehicle.samples} comparisons</small></span>
        <span><strong>${vehicle.mean_error.toFixed(2)} m</strong><small>latest ${vehicle.latest_error.toFixed(2)} m</small></span>
      </div>`).join('')}</div>`;
}

export function renderUwbValidation(root, validation, recovery = {}) {
  const vehicles = validation?.vehicles || [];
  const summary = validation?.summary || {};
  if (!vehicles.length) {
    root.innerHTML = validation?.historical
      ? '<div class="empty">No recorded UWB validation in this time range.</div>'
      : '<div class="empty">Waiting for live UWB validation…</div>';
    return;
  }
  const presentations = {
    confirmed: ['Confirmed', 'confirmed'],
    caution: ['Caution', 'caution'],
    disagreement: ['Disagreement', 'disagreement'],
    uwb_unavailable: ['UWB unavailable', 'unavailable'],
    waiting_amcl: ['Waiting for AMCL', 'unavailable'],
    unsynchronized: ['Time mismatch', 'unavailable'],
  };
  const unavailable = (summary.uwb_unavailable || 0)
    + (summary.waiting_amcl || 0)
    + (summary.unsynchronized || 0);
  const asOf = validation.as_of
    ? new Date(validation.as_of).toLocaleString()
    : null;
  const recoveryVehicles = recovery?.vehicles || [];
  const recoveryByVehicle = new Map(
    recoveryVehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]),
  );
  const recoverySummary = recovery?.summary || {};
  const interlock = recoveryVehicles.length
    ? `<div class="recovery-summary ${recoverySummary.interlocked ? 'active' : ''}">
        <b>Motion interlock</b>
        <span>${recoverySummary.ready || 0} ready · ${recoverySummary.interlocked || 0} stopped/recovering</span>
      </div>`
    : '';
  root.innerHTML = `
    ${interlock}
    <div class="uwb-overview">
      <div><strong>${summary.confirmed || 0}</strong><small>Confirmed</small></div>
      <div><strong>${summary.caution || 0}</strong><small>Caution</small></div>
      <div><strong>${summary.disagreement || 0}</strong><small>Disagree</small></div>
      <div><strong>${unavailable}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${vehicles.map((vehicle) => {
      const [label, className] = presentations[vehicle.state] || ['Unknown', 'unavailable'];
      const error = Number.isFinite(vehicle.error_m)
        ? `${vehicle.error_m.toFixed(2)} m difference`
        : vehicle.state === 'unsynchronized' && Number.isFinite(vehicle.measurement_skew_s)
          ? `${vehicle.measurement_skew_s.toFixed(2)} s time mismatch`
          : vehicle.uwb_reason?.replaceAll('_', ' ') || 'No comparison';
      const pending = vehicle.raw_state && vehicle.raw_state !== vehicle.state
        ? ` · checking ${vehicle.raw_state.replaceAll('_', ' ')}`
        : '';
      const recoveryState = recoveryByVehicle.get(vehicle.vehicle_id);
      const recoveryText = recoveryState
        ? ` · interlock ${recoveryState.state.replaceAll('_', ' ')}`
        : '';
      return `<div class="uwb-row">
        <span><b>${escapeHtml(vehicle.vehicle_id)}</b><small>${vehicle.visible_tag_count || 0} tags visible · ${escapeHtml(error)}${escapeHtml(pending)}${escapeHtml(recoveryText)}</small></span>
        <strong class="uwb-state ${className}">${label}</strong>
      </div>`;
    }).join('')}</div>
    <p class="uwb-note">${validation.live ? 'Live comparison' : `Recorded comparison${asOf ? ` at ${asOf}` : ''}`}. AMCL remains the position source; UWB is confirmation only.</p>`;
}

export function renderAnalytics(root, analytics) {
  const location = analytics?.most_stuck_location;
  const path = analytics?.worst_path;
  const timeRange = (start, end) => start
    ? `${new Date(start * 1000).toLocaleString()} → ${new Date((end || start) * 1000).toLocaleString()}`
    : 'No slow/stuck interval in this range';
  root.innerHTML = `
    <div class="insight-row ${location ? 'insight-action' : ''}" ${location ? `data-insight="stuck" role="button" tabindex="0" data-x="${location.x}" data-y="${location.y}" data-events="${location.events}" data-first="${location.first_started || ''}" data-last="${location.last_ended || ''}"` : ''}>
      <i class="insight-icon orange">!</i><div><b>Most stuck position</b><small>${location ? `x ${location.x.toFixed(2)} · y ${location.y.toFixed(2)} · ${location.events} event(s)` : 'No stuck position recorded'}</small>${location ? `<em>${timeRange(location.first_started, location.last_ended)}</em>` : ''}</div>
    </div>
    <div class="insight-row ${path ? 'insight-action' : ''}" ${path ? `data-insight="path" role="button" tabindex="0" data-vehicle="${escapeHtml(path.vehicle_id)}"` : ''}>
      <i class="insight-icon red">↝</i><div><b>Worst vehicle path</b><small>${path ? `${escapeHtml(path.vehicle_id)} · ${path.reason}` : 'No vehicle path recorded'}</small>${path ? `<em>${path.distance_m.toFixed(1)} m travelled · ${path.slow_seconds.toFixed(0)} s slow</em>` : ''}</div>
    </div>
    <div class="insight-row ${path ? 'insight-action' : ''}" ${path ? `data-insight="window" role="button" tabindex="0" data-vehicle="${escapeHtml(path.vehicle_id)}"` : ''}>
      <i class="insight-icon blue">◷</i><div><b>Bad path window</b><small>${path ? timeRange(path.bad_when_start, path.bad_when_end) : 'No bad interval found'}</small>${path ? `<em>Average speed ${path.average_speed.toFixed(2)} m/s</em>` : ''}</div>
    </div>`;
}

export function renderHotspots(root, data) {
  const events = [
    ...data.congestion.map((value) => ({ ...value, type: 'Congestion', color: 'var(--red)' })),
    ...data.stuck.map((value) => ({ ...value, type: 'Stuck', color: 'var(--orange)' })),
  ].sort((a, b) => b.events - a.events).slice(0, 6);
  root.innerHTML = events.length ? events.map((value) => `<button type="button" class="hotspot-row" data-hotspot
    data-x="${value.x}" data-y="${value.y}" data-type="${value.type}"
    data-events="${value.events}" data-first="${value.first_started || ''}" data-last="${value.last_ended || ''}"
    title="Show ${value.type.toLowerCase()} location on the map">
    <span><b style="color:${value.color}">${value.type}</b><small>x ${value.x.toFixed(1)} · y ${value.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${value.events}×</strong><small>View map</small></span>
  </button>`).join('') : '<div class="empty">No stuck or congestion events.</div>';
}

export function renderStuckTimeline(root, timeline) {
  const buckets = timeline?.buckets || [];
  if (!buckets.length) {
    root.innerHTML = '<div class="empty">No stuck vehicles in this time range.</div>';
    return;
  }
  const bucketSeconds = timeline.bucket_seconds || 60;
  const bucketLabel = bucketSeconds < 3600
    ? `${bucketSeconds / 60} minute${bucketSeconds === 60 ? '' : 's'}`
    : `${bucketSeconds / 3600} hour${bucketSeconds === 3600 ? '' : 's'}`;
  root.innerHTML = `
    <p class="timeline-note">Busiest stuck location per ${bucketLabel}; newest first.</p>
    <div class="stuck-time-list">${[...buckets].reverse().map((bucket) => {
      const hotspot = bucket.hotspot;
      const time = new Date(bucket.start * 1000).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
      });
      const vehicles = hotspot.vehicle_ids.map(escapeHtml).join(', ');
      return `<button type="button" class="stuck-time-row" data-stuck-time
        data-x="${hotspot.x}" data-y="${hotspot.y}"
        data-time="${bucket.start}" data-count="${hotspot.vehicles}"
        title="Show this stuck location on the map">
        <span><b>${time}</b><small>x ${hotspot.x.toFixed(1)} · y ${hotspot.y.toFixed(1)}</small></span>
        <span><strong>${hotspot.vehicles}</strong><small>at hotspot · ${bucket.total_vehicles} total</small></span>
        <em>${vehicles}</em>
      </button>`;
    }).join('')}</div>`;
}

export function renderRouteSuggestion(root, route) {
  if (!route) {
    root.innerHTML = '<div class="empty">Choose a forklift and click a destination on the route map.</div>';
    return;
  }
  const duration = (seconds) => seconds >= 60
    ? `${(seconds / 60).toFixed(1)} min`
    : `${seconds.toFixed(0)} sec`;
  const addedDistance = route.suggested.distance_m - route.baseline.distance_m;
  const snapped = route.destination.snapped
    ? '<p class="route-warning">Destination was moved to the nearest collision-clear map cell.</p>'
    : '';
  root.innerHTML = `
    <div class="route-result-grid">
      <div><small>Suggested distance</small><strong>${route.suggested.distance_m.toFixed(1)} m</strong><span>${addedDistance > 0.05 ? `+${addedDistance.toFixed(1)} m vs shortest` : 'same as shortest'}</span></div>
      <div><small>Estimated time</small><strong>${duration(route.suggested.eta_s)}</strong><span>at selected nominal speed</span></div>
      <div><small>Traffic risk</small><strong>${route.suggested.risk_score.toFixed(0)} / 100</strong><span>${route.risk_reduction.toFixed(1)} points lower</span></div>
      <div><small>Hotspots avoided</small><strong>${route.hotspots_avoided}</strong><span>from this history window</span></div>
    </div>
    <p class="route-explanation">${escapeHtml(route.explanation)}</p>
    ${snapped}
    <p class="route-meta">Generated ${new Date(route.generated_at).toLocaleString()} using traffic from ${new Date(route.traffic_window.start).toLocaleString()} to ${new Date(route.traffic_window.end).toLocaleString()}.</p>`;
}

export function setConnection(connected, message) {
  const root = document.querySelector('#connection');
  root.classList.toggle('error', !connected);
  root.querySelector('span').textContent = message;
}

export function setMode(mode) {
  const root = document.querySelector('#mode');
  root.textContent = mode;
  root.className = `mode ${mode.toLowerCase()}`;
}
