import './styles.css';
import { getHealth } from './api.js';

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
    <section id="healthMetrics" class="metrics health-metrics"></section>
    <section class="panel health-services-panel">
      <div class="panel-head"><div><h2>Services</h2><span class="sub">API, database, and recorder status</span></div><span id="version" class="tag">VERSION —</span></div>
      <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
    </section>
    <section class="panel health-vehicles-panel">
      <div class="panel-head"><div><h2>Forklifts</h2><span class="sub">Position telemetry, localization, UWB, and sensor diagnostics</span></div><span class="tag">READ ONLY</span></div>
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
    const uwbDisplayState = uwb.freshness === 'online'
      ? uwb.state
      : uwb.freshness || 'unknown';
    return `
      <article class="health-vehicle ${escapeHtml(vehicle.status)}">
        <div class="health-vehicle-head">
          <div><strong>${escapeHtml(vehicle.vehicle_id)}</strong><small>${position}</small></div>
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
  renderServices(payload.services);
  renderVehicles(payload.vehicles);
}

let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const payload = await getHealth();
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
