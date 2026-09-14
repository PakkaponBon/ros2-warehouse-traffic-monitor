import './styles.css';
import { getHealth, setSimulationFault } from './api.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <div class="logo">W</div>
      <div><strong>Warehouse Intelligence</strong><small>System health</small></div>
    </div>
    <div id="connection" class="connection"><i></i><span>Connecting…</span></div>
    <nav class="top-links" aria-label="Dashboard pages">
      <a href="/">Traffic</a>
      <a class="active" href="/health.html">System health</a>
    </nav>
  </header>
  <main class="health-main">
    <section class="health-intro panel">
      <div>
        <h1>System health</h1>
        <p>Live telemetry freshness and diagnostic availability. This page is read-only.</p>
      </div>
      <div id="thresholds" class="health-thresholds">Loading thresholds…</div>
    </section>
    <section id="faultPanel" class="panel fault-panel" hidden>
      <div class="panel-head">
        <div><h2>Simulation fault injection</h2><span class="sub">Exercise monitoring and recovery without changing real forklift interfaces</span></div>
        <span class="tag fault-warning">GAZEBO ONLY</span>
      </div>
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
      <div class="fault-status"><span id="activeFaults">No active faults</span><span id="faultResult">Ready</span></div>
    </section>
    <section id="healthMetrics" class="metrics health-metrics"></section>
    <section class="panel health-services-panel">
      <div class="panel-head"><div><h2>Services</h2><span class="sub">API, database, and recorder status</span></div><span id="version" class="tag">VERSION —</span></div>
      <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
    </section>
    <section class="panel health-vehicles-panel">
      <div class="panel-head"><div><h2>Forklifts</h2><span class="sub">Position telemetry, localization, UWB, and sensor diagnostics</span></div><span class="tag">MONITORING</span></div>
      <div id="vehicles" class="health-vehicles"><div class="empty">Waiting for vehicle health…</div></div>
    </section>
  </main>
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
      name: 'Web API',
      status: services.web_api?.status,
      detail: 'Health endpoint responding',
      meta: 'Browser ↔ monitoring API',
    },
    {
      name: 'Traffic recorder',
      status: recorder.status,
      detail: recorder.detail || 'Recorder state unavailable',
      meta: `Newest sample ${formatAge(recorder.age_seconds)}`,
    },
    {
      name: 'SQLite database',
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

function renderVehicles(vehicles) {
  if (!vehicles.length) {
    $('#vehicles').innerHTML = '<div class="empty">No configured or recorded vehicles.</div>';
    return;
  }
  $('#vehicles').innerHTML = vehicles.map((vehicle) => {
    const position = vehicle.position
      ? `x ${vehicle.position.x.toFixed(2)}, y ${vehicle.position.y.toFixed(2)} · ${escapeHtml(vehicle.position.frame_id)}`
      : 'No position received';
    const localization = vehicle.localization || {};
    const uwb = vehicle.uwb || {};
    const lidar = vehicle.lidar || {};
    const injected = vehicle.injected_faults || [];
    const uwbDisplayState = uwb.freshness === 'online'
      ? uwb.state
      : uwb.freshness || 'unknown';
    return `
      <article class="health-vehicle ${escapeHtml(vehicle.status)}">
        <div class="health-vehicle-head">
          <div><strong>${escapeHtml(vehicle.vehicle_id)}</strong><small>${position}</small>${injected.length ? `<small class="injected-fault">Injected: ${escapeHtml(injected.map((fault) => faultLabels[fault] || fault).join(', '))}</small>` : ''}</div>
          ${badge(vehicle.status)}
        </div>
        <div class="health-detail-grid">
          <div><span>Last telemetry</span><b>${formatAge(vehicle.age_seconds)}</b><small>${vehicle.last_seen ? new Date(vehicle.last_seen).toLocaleString() : 'Never received'}</small></div>
          <div><span>Motion</span><b>${escapeHtml(statusLabel(vehicle.motion_state))}</b><small>${valueOrUnknown(vehicle.speed, ' m/s')}</small></div>
          <div><span>Localization</span>${badge(localization.state)}<small>${escapeHtml(localization.source || 'No localization source')} · covariance ${valueOrUnknown(localization.covariance_trace)}</small></div>
          <div><span>UWB validation</span>${badge(uwbDisplayState)}<small>Last result ${escapeHtml(statusLabel(uwb.state))} · ${uwb.visible_tag_count || 0} tags · ${formatAge(uwb.age_seconds)}</small></div>
          <div><span>LiDAR</span>${badge(lidar.state)}<small>${escapeHtml(lidar.detail || 'No sensor diagnostic')}</small></div>
        </div>
      </article>
    `;
  }).join('');
}

function render(payload) {
  const summary = payload.summary;
  $('#healthMetrics').innerHTML = [
    ['total', summary.total, 'Configured/observed', ''],
    ['online', summary.online, 'Online', 'teal'],
    ['stale', summary.stale, 'Stale', 'orange'],
    ['offline', summary.offline, 'Offline', 'red'],
    ['unknown', summary.unknown, 'Never observed', ''],
  ].map(([name, value, label, color]) => `<article class="metric ${color}" data-status="${name}"><strong>${value}</strong><span>${label}</span></article>`).join('');
  $('#thresholds').textContent = `Online < ${payload.thresholds.online_under_seconds}s · stale to ${payload.thresholds.offline_over_seconds}s · then offline`;
  $('#version').textContent = `VERSION ${payload.software_version}`;
  renderFaultControls(payload.simulation_faults, payload.vehicles);
  renderServices(payload.services);
  renderVehicles(payload.vehicles);
}

async function applyFault(request) {
  if (faultBusy) return;
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
    document.querySelectorAll('#faultPanel button').forEach((button) => { button.disabled = false; });
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
  try {
    const payload = await getHealth();
    latestPayload = payload;
    render(payload);
    $('#connection').className = 'connection';
    $('#connection span').textContent = `Updated ${new Date(payload.generated_at).toLocaleTimeString()}`;
  } catch (error) {
    $('#connection').className = 'connection error';
    $('#connection span').textContent = `Health unavailable · ${error.message}`;
  } finally {
    loading = false;
  }
}

refresh();
setInterval(refresh, 2000);
