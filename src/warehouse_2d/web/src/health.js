import './styles.css';
import './dashboard.css';
import './health.css';
import { getHealth, setSimulationFault } from './api.js';

const app = document.querySelector('#app');
document.body.classList.add('dashboard', 'health-page');

app.innerHTML = `
  <a class="skip-link" href="#workspace">Skip to workspace</a>
  <aside class="app-sidebar">
    <a class="brand" href="/" aria-label="Warehouse Intelligence home">
      <span class="logo">W</span><span><strong>Warehouse</strong><small>INTELLIGENCE</small></span>
    </a>
    <div class="nav-caption">WORKSPACE</div>
    <nav class="workspace-nav" aria-label="Workspace">
      <a href="/#overview"><span aria-hidden="true">◫</span>Overview</a>
      <a href="/#activity"><span aria-hidden="true">≋</span>Traffic history</a>
      <a href="/#dispatch"><span aria-hidden="true">↗</span>Dispatch a task</a>
      <a href="/#diagnostics"><span aria-hidden="true">⌁</span>Diagnostics</a>
    </nav>
    <div class="sidebar-bottom">
      <a href="/health.html" aria-current="page"><span aria-hidden="true">♡</span>System health</a>
      <p>Warehouse operations<br><span>Traffic & vehicle monitoring</span></p>
    </div>
  </aside>
  <div class="app-workspace">
    <header class="workspace-topbar">
      <span>Operations <span class="breadcrumb">/ <b>System health</b></span></span>
      <div id="connection" class="connection" role="status"><i></i><span>Connecting…</span></div>
    </header>
    <main id="workspace" class="health-main" tabindex="-1">
      <div class="page-heading">
        <div><p class="eyebrow">SYSTEM HEALTH</p><h1>Keep your warehouse connected.</h1><p id="pageDescription">Check service availability and find vehicles that need attention.</p></div>
        <button id="refreshHealth" type="button" class="secondary">Refresh status</button>
      </div>
      <section id="healthOverview" class="health-overview" role="status">
        <span id="overviewIcon" class="overview-icon" aria-hidden="true">◷</span>
        <div><h2 id="overviewTitle">Connecting to your warehouse…</h2><p id="overviewDescription">Waiting for the latest health report.</p></div>
        <span id="healthUpdated" class="health-updated">Auto-refreshes every 2 seconds</span>
      </section>
      <section id="healthMetrics" class="metrics health-metrics" aria-label="Vehicle connectivity">
        ${['Reporting', 'Delayed updates', 'Offline', 'Not yet seen'].map((label) => `<article class="metric"><span>${label}</span><strong>—</strong><small>Waiting for health data</small></article>`).join('')}
      </section>
      <section class="panel health-services-panel">
        <div class="panel-head"><div><h2>Core services</h2><span class="sub">The services that keep monitoring available</span></div><span id="serviceCount" class="tag">Checking…</span></div>
        <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
      </section>
      <section class="panel health-vehicles-panel">
        <div class="panel-head">
          <div><h2>Vehicle health <span id="vehicleCount" class="count-badge">—</span></h2><span class="sub">Open a vehicle for sensor readings and technical details</span></div>
          <div class="health-filters" role="group" aria-label="Filter vehicles">
            <button type="button" data-filter="all" aria-pressed="true">All vehicles</button>
            <button type="button" data-filter="attention" aria-pressed="false">Needs attention <span id="attentionCount">—</span></button>
          </div>
        </div>
        <div id="vehicles" class="health-vehicles"><div class="empty">Waiting for vehicle health…</div></div>
      </section>
    <details id="faultPanel" class="panel fault-panel" hidden>
      <summary class="panel-head">
        <div><h2>Simulation testing</h2><span class="sub">Advanced controls · deliberately interrupt simulated vehicles</span></div>
        <span id="faultCount" class="tag fault-warning">SIMULATION ONLY</span>
      </summary>
      <div class="fault-controls">
        <label class="field"><span>Forklift</span><select id="faultVehicle"></select></label>
        <div class="fault-buttons" aria-label="Persistent simulation faults">
          <button type="button" class="secondary fault-toggle" data-fault="freeze">Freeze drivetrain</button>
          <button type="button" class="secondary fault-toggle" data-fault="lidar_dropout">Drop LiDAR</button>
          <button type="button" class="secondary fault-toggle" data-fault="uwb_dropout">Drop UWB</button>
          <button type="button" class="secondary fault-toggle" data-fault="localization_loss">Lose localization</button>
        </div>
        <div class="fault-buttons" aria-label="One-shot simulation actions">
          <button type="button" data-action="teleport">Teleport +6 m</button>
          <button type="button" class="secondary" data-action="restore">Restore pose</button>
          <button type="button" class="fault-clear" data-action="clear_all">Clear faults</button>
        </div>
      </div>
      <div class="fault-status"><span id="activeFaults">No active faults</span><span id="faultResult" role="status">Ready</span></div>
    </details>

      <details class="health-reference">
        <summary>How status is determined</summary>
        <p id="thresholds">Waiting for reporting thresholds…</p>
        <p>Vehicle connectivity is based on the age of its last position update. Sensor checks are separate; an unknown reading means that a diagnostic is not available.</p>
        <span id="version" class="tag">VERSION —</span>
      </details>
      <footer class="workspace-footer"><span>Warehouse Intelligence</span><span>Live service & vehicle monitoring</span></footer>
    </main>
  </div>
`;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const statusLabel = (status) => (status || 'unknown').replaceAll('_', ' ');
const formatAge = (seconds) => {
  if (!Number.isFinite(seconds)) return 'Never';
  if (seconds < 60) return `${seconds.toFixed(1)} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} h ago`;
};
const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const badge = (status) => `<span class="health-badge ${escapeHtml(status || 'unknown')}">${escapeHtml(statusLabel(status))}</span>`;
const valueOrUnknown = (value, suffix = '') => (
  Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : 'Unknown'
);

const faultLabels = {
  freeze: 'drivetrain frozen',
  lidar_dropout: 'LiDAR dropped',
  uwb_dropout: 'UWB dropped',
  localization_loss: 'localization lost',
};
let latestPayload = null;
let faultBusy = false;
let healthAvailable = false;
let vehicleFilter = 'all';
const expandedVehicles = new Set();

function faultsFor(state, vehicleId) {
  const entry = state?.active?.find((item) => item.vehicle_id === vehicleId);
  return new Set(entry?.faults || []);
}

function renderFaultControls(state, vehicles) {
  const panel = $('#faultPanel');
  panel.hidden = !state?.enabled;
  if (!state?.enabled) return;
  const select = $('#faultVehicle');
  const ids = vehicles.map((vehicle) => vehicle.vehicle_id).filter((id) => id.startsWith('vehicle_'));
  const previous = select.value;
  const signature = ids.join('|');
  if (select.dataset.vehicles !== signature) {
    select.innerHTML = ids.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('');
    select.dataset.vehicles = signature;
    if (ids.includes(previous)) select.value = previous;
  }
  const selected = select.value || ids[0];
  const active = faultsFor(state, selected);
  document.querySelectorAll('.fault-toggle').forEach((button) => {
    const enabled = active.has(button.dataset.fault);
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
  });
  $('#activeFaults').textContent = active.size
    ? `${selected}: ${[...active].map((fault) => faultLabels[fault] || fault).join(', ')}`
    : `${selected || 'No vehicle'}: no active faults`;
  const faultCount = (state.active || []).reduce((total, entry) => total + (entry.faults?.length || 0), 0);
  $('#faultCount').textContent = faultCount ? `${faultCount} ACTIVE FAULT${faultCount === 1 ? '' : 'S'}` : 'SIMULATION ONLY';
  document.querySelectorAll('#faultPanel button').forEach((button) => {
    button.disabled = faultBusy || !healthAvailable || !selected;
  });
  if (faultBusy) return;
  const last = state.last_action;
  $('#faultResult').textContent = last
    ? `${statusLabel(last.action)} ${last.vehicle_id || ''}: ${statusLabel(last.status)}${last.detail ? ` · ${last.detail}` : ''}`
    : 'Ready';
}

function renderServices(services) {
  const database = services.database || {};
  const recorder = services.traffic_recorder || {};
  const values = [
    {
      name: 'Monitoring API',
      status: services.web_api?.status,
      detail: services.web_api?.status === 'online' ? 'Connected to the monitoring service' : 'Monitoring service status unavailable',
      meta: 'Browser ↔ monitoring API',
    },
    {
      name: 'Traffic recorder',
      status: recorder.status,
      detail: recorder.detail || 'Recorder state unavailable',
      meta: `Newest sample ${formatAge(recorder.age_seconds)}`,
    },
    {
      name: 'Traffic database',
      status: database.status,
      detail: `${Number(database.samples || 0).toLocaleString()} position samples`,
      meta: `${escapeHtml(database.file || 'database')} · ${formatBytes(database.bytes)}`,
    },
  ];
  $('#services').innerHTML = values.map((service) => `
    <article class="health-service">
      <div><strong>${escapeHtml(service.name)}</strong>${badge(service.status)}</div>
      <p>${escapeHtml(service.detail)}</p>
      <small>${service.meta}</small>
    </article>
  `).join('');
}

function vehicleIssues(vehicle) {
  const issues = [];
  if (vehicle.status === 'offline') issues.push('No recent position updates');
  else if (vehicle.status === 'stale') issues.push('Position updates are delayed');
  else if (vehicle.status !== 'online') issues.push('No position received yet');
  if (['stale', 'offline', 'unavailable'].includes(vehicle.localization?.state)) issues.push('Check localization');
  if (vehicle.lidar?.state === 'unavailable') issues.push('LiDAR unavailable');
  if (['stale', 'offline'].includes(vehicle.uwb?.freshness)) issues.push('UWB updates are delayed or missing');
  else if (['caution', 'disagreement', 'unavailable', 'uwb_unavailable', 'waiting_amcl', 'unsynchronized'].includes(vehicle.uwb?.state)) issues.push('Check UWB validation');
  if (vehicle.injected_faults?.length) issues.push('Simulation fault active');
  return issues;
}

function renderVehicles(vehicles) {
  const focusedId = document.activeElement?.closest('[data-health-vehicle]')?.dataset.healthVehicle;
  const filtered = vehicles.filter((vehicle) => vehicleFilter === 'all' || vehicleIssues(vehicle).length)
    .sort((a, b) => Number(Boolean(vehicleIssues(b).length)) - Number(Boolean(vehicleIssues(a).length))
      || a.vehicle_id.localeCompare(b.vehicle_id, undefined, { numeric: true }));
  if (!filtered.length) {
    $('#vehicles').innerHTML = `<div class="empty">${vehicles.length ? 'No vehicles need attention based on the available checks.' : 'No configured or recorded vehicles yet.'}</div>`;
    return;
  }
  $('#vehicles').innerHTML = filtered.map((vehicle) => {
    const issues = vehicleIssues(vehicle);
    const position = vehicle.position
      ? `x ${vehicle.position.x.toFixed(2)}, y ${vehicle.position.y.toFixed(2)} · ${escapeHtml(vehicle.position.frame_id)}`
      : 'No position received';
    const localization = vehicle.localization || {};
    const uwb = vehicle.uwb || {};
    const lidar = vehicle.lidar || {};
    const injected = vehicle.injected_faults || [];
    const uwbDisplayState = uwb.freshness === 'online' ? uwb.state : uwb.freshness || 'unknown';
    return `
      <details class="health-vehicle ${escapeHtml(vehicle.status)}" data-health-vehicle="${escapeHtml(vehicle.vehicle_id)}" ${expandedVehicles.has(vehicle.vehicle_id) ? 'open' : ''}>
        <summary class="health-vehicle-head">
          <span class="vehicle-health-name"><strong>${escapeHtml(vehicle.vehicle_id)}</strong><small class="${issues.length ? 'vehicle-issue' : ''}">${issues.length ? escapeHtml(issues.join(' · ')) : 'Position updates are current'}</small></span>
          <span class="vehicle-health-age">${formatAge(vehicle.age_seconds)}</span>
          ${badge(vehicle.status)}<span class="expand-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="vehicle-diagnostics">
          <div class="vehicle-position-note">${position}${injected.length ? `<span class="injected-fault">Simulation: ${escapeHtml(injected.map((fault) => faultLabels[fault] || fault).join(', '))}</span>` : ''}</div>
          <div class="health-detail-grid">
            <div><span>Last position update</span><b>${formatAge(vehicle.age_seconds)}</b><small>${vehicle.last_seen ? new Date(vehicle.last_seen).toLocaleString() : 'Never received'}</small></div>
            <div><span>Movement</span><b>${escapeHtml(statusLabel(vehicle.motion_state))}</b><small>${valueOrUnknown(vehicle.speed, ' m/s')}</small></div>
            <div><span>Localization</span>${badge(localization.state)}<small>${escapeHtml(localization.source || 'No localization source')} · covariance ${valueOrUnknown(localization.covariance_trace)}</small></div>
            <div><span>UWB validation</span>${badge(uwbDisplayState)}<small>Last result ${escapeHtml(statusLabel(uwb.state))} · ${uwb.visible_tag_count || 0} tags · ${formatAge(uwb.age_seconds)}</small></div>
            <div><span>LiDAR</span>${badge(lidar.state)}<small>${escapeHtml(lidar.detail || 'No sensor diagnostic')}</small></div>
          </div>
        </div>
      </details>`;
  }).join('');
  $('#vehicles').querySelectorAll('[data-health-vehicle]').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      if (details.open) expandedVehicles.add(details.dataset.healthVehicle);
      else expandedVehicles.delete(details.dataset.healthVehicle);
    });
    if (details.dataset.healthVehicle === focusedId) details.querySelector('summary').focus({ preventScroll: true });
  });
}

function render(payload) {
  const summary = payload.summary;
  const attention = payload.vehicles.filter((vehicle) => vehicleIssues(vehicle).length).length;
  const services = ['web_api', 'traffic_recorder', 'database'];
  const serviceIssues = services.filter((key) => payload.services[key]?.status !== 'online').length;
  const needsAttention = attention || serviceIssues;
  $('#healthOverview').className = `health-overview ${needsAttention ? 'attention' : 'connected'}`;
  $('#overviewIcon').textContent = needsAttention ? '!' : '✓';
  $('#overviewTitle').textContent = needsAttention ? 'Some checks need your attention' : 'Monitoring services are connected';
  $('#overviewDescription').textContent = needsAttention
    ? [attention ? `${attention} vehicle${attention === 1 ? '' : 's'} with delayed updates or diagnostic issues` : '', serviceIssues ? `${serviceIssues} service${serviceIssues === 1 ? '' : 's'} to check` : ''].filter(Boolean).join(' · ')
    : summary.total ? 'Vehicle position updates are current. Open a vehicle to review individual sensor checks.' : 'No vehicles have been configured or recorded yet.';
  $('#healthUpdated').textContent = `Checked ${new Date(payload.generated_at).toLocaleTimeString()}`;
  $('#serviceCount').textContent = `${services.length - serviceIssues} / ${services.length} online`;
  $('#vehicleCount').textContent = summary.total;
  $('#attentionCount').textContent = attention;
  $('#healthMetrics').innerHTML = [
    ['online', summary.online, 'Reporting', 'teal', 'Recent position updates'],
    ['stale', summary.stale, 'Delayed updates', 'orange', 'Updates older than expected'],
    ['offline', summary.offline, 'Offline', 'red', 'No recent position updates'],
    ['unknown', summary.unknown, 'Not yet seen', '', 'No position received'],
  ].map(([name, value, label, color, hint]) => `<article class="metric ${color}" data-status="${name}"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join('');
  $('#thresholds').textContent = `Reporting: less than ${payload.thresholds.online_under_seconds}s since the last update. Delayed: up to ${payload.thresholds.offline_over_seconds}s. Offline: older than ${payload.thresholds.offline_over_seconds}s.`;
  $('#version').textContent = `VERSION ${payload.software_version}`;
  renderFaultControls(payload.simulation_faults, payload.vehicles);
  renderServices(payload.services);
  renderVehicles(payload.vehicles);
}

$('#refreshHealth').addEventListener('click', refresh);
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    vehicleFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((filter) => filter.setAttribute('aria-pressed', String(filter === button)));
    if (latestPayload) renderVehicles(latestPayload.vehicles);
  });
});

async function applyFault(request) {
  if (faultBusy || !healthAvailable) return;
  faultBusy = true;
  document.querySelectorAll('#faultPanel button').forEach((button) => { button.disabled = true; });
  $('#faultResult').textContent = 'Applying simulation fault…';
  try {
    const state = await setSimulationFault(request);
    if (latestPayload) latestPayload.simulation_faults = state;
    renderFaultControls(state, latestPayload?.vehicles || []);
    await refresh();
  } catch (error) {
    $('#faultResult').textContent = `Failed: ${error.message}`;
  } finally {
    faultBusy = false;
    document.querySelectorAll('#faultPanel button').forEach((button) => { button.disabled = !healthAvailable || !$('#faultVehicle').value; });
  }
}

$('#faultVehicle').addEventListener('change', () => {
  renderFaultControls(latestPayload?.simulation_faults, latestPayload?.vehicles || []);
});
$('#faultPanel').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const vehicleId = $('#faultVehicle').value;
  if (!vehicleId) return;
  if (button.dataset.fault) {
    const active = faultsFor(latestPayload?.simulation_faults, vehicleId);
    applyFault({
      action: 'set',
      vehicle_id: vehicleId,
      fault: button.dataset.fault,
      enabled: !active.has(button.dataset.fault),
    });
  } else if (button.dataset.action) {
    applyFault({ action: button.dataset.action, vehicle_id: vehicleId });
  }
});

let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  $('#refreshHealth').disabled = true;
  try {
    const payload = await getHealth();
    latestPayload = payload;
    healthAvailable = true;
    render(payload);
    $('#connection').className = 'connection';
    $('#connection span').textContent = `Updated ${new Date(payload.generated_at).toLocaleTimeString()}`;
  } catch (error) {
    $('#connection').className = 'connection error';
    healthAvailable = false;
    $('#connection span').textContent = 'Monitor offline';
    $('#healthOverview').className = 'health-overview unavailable';
    $('#overviewIcon').textContent = '!';
    $('#overviewTitle').textContent = 'Unable to reach the monitor';
    $('#overviewDescription').textContent = latestPayload
      ? 'The information below is from the last successful update and may be out of date. Reconnecting automatically…'
      : 'Health information is not available yet. Check that the warehouse monitor is running. Reconnecting automatically…';
    document.querySelectorAll('#faultPanel button').forEach((button) => { button.disabled = true; });
  } finally {
    loading = false;
    $('#refreshHealth').disabled = false;
  }
}

refresh();
setInterval(refresh, 2000);
