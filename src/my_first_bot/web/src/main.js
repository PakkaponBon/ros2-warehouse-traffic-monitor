import './styles.css';
import {
  getBounds,
  getMap,
  getRouteSuggestion,
  getState,
} from './api.js';
import {
  renderAnalytics,
  renderHotspots,
  renderLocalization,
  renderMetrics,
  renderRouteSuggestion,
  renderStuckTimeline,
  renderUwbValidation,
  renderVehicleSummary,
  setConnection,
  setMode,
} from './components.js';
import { WarehouseMap } from './map.js';
import { RouteSuggestionMap } from './route-map.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <div class="logo">W</div>
      <div>
        <strong>Warehouse Intelligence</strong>
        <small>Traffic analytics and vehicle monitoring</small>
      </div>
    </div>
    <div id="connection" class="connection">
      <i></i>
      <span>Connecting…</span>
    </div>
    <nav class="top-links" aria-label="Dashboard pages">
      <a class="active" href="/">Traffic</a>
      <a href="/health.html">System health</a>
    </nav>
  </header>

  <section class="toolbar">
    <div class="control-row">
      <button id="liveButton" class="secondary">● Live now</button>

      <label class="field">
        <span>Replay starts at</span>
        <input id="selectedTime" type="datetime-local" step="1">
      </label>

      <button id="jumpButton" class="secondary">Jump to time</button>
      <button id="playButton">▶ Play to latest</button>

      <label class="field">
        <span>Playback speed</span>
        <select id="playSpeed">
          <option value="1">1× realtime</option>
          <option value="10">10×</option>
          <option value="60" selected>60×</option>
          <option value="300">300×</option>
        </select>
      </label>

      <label class="field">
        <span>Heat trail</span>
        <select id="trailMinutes">
          <option value="1">1 minute</option>
          <option value="5" selected>5 minutes</option>
          <option value="15">15 minutes</option>
          <option value="60">1 hour</option>
        </select>
      </label>

      <details class="advanced">
        <summary>Custom range</summary>
        <div class="advanced-range">
          <label class="field">
            <span>From</span>
            <input id="rangeStart" type="datetime-local" step="1">
          </label>
          <label class="field">
            <span>To</span>
            <input id="rangeEnd" type="datetime-local" step="1">
          </label>
          <button id="applyRange">Apply</button>
        </div>
      </details>

      <span id="mode" class="mode">LIVE</span>
    </div>

    <div class="timeline-row">
      <span id="firstLog">First log —</span>
      <input id="timeline" type="range" min="0" max="1" value="1" step="0.5">
      <span id="replayClock">Loading history…</span>
      <span id="lastLog">Latest log —</span>
    </div>
  </section>

  <main>
    <section id="metrics" class="metrics"></section>

    <section class="panel summary-panel">
      <div class="panel-head">
        <div>
          <h2>Vehicle summary</h2>
          <span class="sub">Current name, map position, speed, and movement state</span>
        </div>
        <span class="tag">MAP FRAME</span>
      </div>
      <div id="summaryRows" class="summary-grid">
        <div class="empty">Waiting for vehicle data…</div>
      </div>
    </section>

    <div class="content-grid">
      <div class="primary-column">
      <section class="panel map-panel">
        <div class="panel-head">
          <div>
            <h2>Warehouse traffic map</h2>
            <span class="sub">Landscape display · positions remain in the ROS map frame</span>
          </div>

          <div class="map-tools">
            <label><input id="pathLayer" type="checkbox"> Selected path</label>
            <label><input id="vehicleLayer" type="checkbox" checked> Positions</label>
            <label><input id="densityLayer" type="checkbox" checked> Heat</label>
            <label><input id="stuckLayer" type="checkbox"> Stuck</label>
            <label><input id="jamLayer" type="checkbox"> Congestion</label>
            <label><input id="tagLayer" type="checkbox" checked> UWB tags</label>
            <label class="state-filter">
              Vehicle state
              <select id="stateFilter">
                <option value="all">All states</option>
                <option value="moving">Moving</option>
                <option value="turning">Turning normally</option>
                <option value="waiting_vehicle">Waiting for vehicle</option>
                <option value="blocked_obstacle">Blocked by obstacle</option>
                <option value="stalled">Commanded but not moving</option>
                <option value="stuck">Stuck</option>
                <option value="idle">Idle / intentional stop</option>
                <option value="planning">Planning route</option>
                <option value="localizing">Localizing</option>
                <option value="sensor_wait">Waiting for LiDAR</option>
              </select>
            </label>
            <label>
              Heat metric
              <select id="heatMetric">
                <option value="count">Occupancy time</option>
                <option value="vehicles">Unique vehicles</option>
                <option value="slow_samples">Slow time</option>
              </select>
            </label>
            <label class="heat-control">
              Less heat
              <input id="heatFilter" type="range" min="0" max="95" value="78">
            </label>
          </div>
        </div>

        <div class="map-wrap">
          <canvas id="map" width="1200" height="720"></canvas>
          <div id="mapTooltip" class="tooltip"></div>
        </div>

        <div class="map-foot">
          <div class="legend">
            <span><i class="dot path"></i>vehicle path</span>
            <span><i class="dot low"></i>low traffic</span>
            <span><i class="dot high"></i>high traffic</span>
            <span><i class="dot stuck"></i>stuck</span>
            <span><i class="dot congestion"></i>congestion</span>
            <span><i class="dot vehicle"></i>position</span>
            <span><i class="dot uwb"></i>UWB tag</span>
          </div>
          <div class="state-legend" aria-label="Vehicle state legend">
            <span><i class="state-dot moving"></i>moving</span>
            <span><i class="state-dot turning"></i>turning</span>
            <span><i class="state-dot waiting"></i>waiting</span>
            <span><i class="state-dot blocked"></i>blocked / stuck</span>
            <span><i class="state-dot idle"></i>idle / system</span>
          </div>
          <span id="mapFocus" class="map-focus">Select a hotspot to locate it</span>
          <span id="range" class="range">Loading…</span>
        </div>
      </section>

      <section class="panel route-panel">
        <div class="panel-head">
          <div>
            <h2>Route suggestions</h2>
            <span class="sub">Compare the shortest path with a lower-traffic path for one forklift</span>
          </div>
          <span class="tag advisory">ADVISORY ONLY</span>
        </div>

        <div class="route-layout">
          <form id="routeForm" class="route-controls">
            <label class="field">
              <span>Forklift</span>
              <select id="routeVehicle"><option value="">Waiting for vehicles…</option></select>
            </label>
            <div class="route-coordinate-row">
              <label class="field">
                <span>Destination X (m)</span>
                <input id="routeX" type="number" step="0.01" placeholder="Click map">
              </label>
              <label class="field">
                <span>Destination Y (m)</span>
                <input id="routeY" type="number" step="0.01" placeholder="Click map">
              </label>
            </div>
            <label class="field">
              <span>Nominal speed</span>
              <select id="routeSpeed">
                <option value="0.6">0.6 m/s</option>
                <option value="0.8" selected>0.8 m/s</option>
                <option value="1.2">1.2 m/s</option>
              </select>
            </label>
            <button id="suggestRouteButton" type="submit">Suggest lower-risk route</button>
            <p id="routeStatus" class="route-status">Select a forklift, then click its destination on the mini-map.</p>
            <p class="route-safety">This tool never publishes <code>cmd_vel</code> or a Nav2 goal.</p>
          </form>

          <div class="route-map-wrap">
            <canvas id="routeMap" width="1000" height="560"></canvas>
            <div id="routeTooltip" class="tooltip"></div>
            <div class="route-map-legend">
              <span><i class="route-line baseline"></i>shortest</span>
              <span><i class="route-line suggested"></i>suggested</span>
              <span><i class="route-risk-dot"></i>traffic risk</span>
            </div>
          </div>

          <div id="routeResult" class="route-result">
            <div class="empty">Choose a forklift and click a destination on the route map.</div>
          </div>
        </div>
      </section>
      </div>

      <aside class="side-column">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>2D LiDAR localization</h2>
              <span class="sub">AMCL estimate compared with Gazebo truth</span>
            </div>
            <span class="tag">NO IMU</span>
          </div>
          <div id="localization" class="localization-panel">
            <div class="empty">Waiting for localization samples…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>UWB localization validation</h2>
              <span class="sub">Time-aligned UWB and AMCL comparison</span>
            </div>
            <span class="tag">CHECK ONLY</span>
          </div>
          <div id="uwbValidation" class="uwb-validation">
            <div class="empty">Waiting for UWB validation…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Traffic insights</h2>
              <span class="sub">What needs attention in this time range</span>
            </div>
          </div>
          <div id="analytics" class="analytics">
            <div class="empty">Waiting for history data…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Top hotspots</h2>
              <span class="sub">Highest event counts in this range</span>
            </div>
          </div>
          <div id="hotspots" class="hotspots">
            <div class="empty">No hotspots found.</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Stuck by time</h2>
              <span class="sub">When, where, and how many vehicles were stuck</span>
            </div>
          </div>
          <div id="stuckTimeline" class="stuck-timeline">
            <div class="empty">No stuck vehicles in this time range.</div>
          </div>
        </section>
      </aside>
    </div>
  </main>
`;

const $ = (selector) => document.querySelector(selector);
const map = new WarehouseMap($('#map'));
const routeMap = new RouteSuggestionMap($('#routeMap'), $('#routeTooltip'));

const state = {
  data: null,
  bounds: null,
  cursor: null,
  auto: true,
  loading: false,
  playing: false,
  playbackEnd: null,
  playbackStart: null,
  lastTick: 0,
  debounce: null,
  selectedHotspot: null,
  selectedVehicle: null,
  route: null,
  routeLoading: false,
};

const emptyData = {
  samples: 0,
  latest: [],
  density: [],
  tracks: [],
  stuck: [],
  stuck_timeline: { bucket_seconds: 60, buckets: [] },
  congestion: [],
  start: new Date().toISOString(),
  end: new Date().toISOString(),
  analytics: {},
  localization: { summary: { samples: 0 }, vehicles: [] },
  uwb_validation: { live: true, summary: {}, vehicles: [] },
  localization_recovery: { live: true, summary: {}, vehicles: [] },
};

function localInput(date) {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return value.toISOString().slice(0, 19);
}

function setSelected(epoch) {
  $('#selectedTime').value = localInput(new Date(epoch * 1000));
}

function updateReplay(epoch) {
  if (epoch === null) return;

  $('#timeline').value = epoch;
  $('#replayClock').textContent = new Date(epoch * 1000).toLocaleString();
}

function clamp(epoch) {
  return state.bounds
    ? Math.max(state.bounds.first, Math.min(state.bounds.last, epoch))
    : epoch;
}

function options() {
  return {
    paths: $('#pathLayer').checked,
    vehicles: $('#vehicleLayer').checked,
    heat: $('#densityLayer').checked,
    heatMetric: $('#heatMetric').value,
    stuck: $('#stuckLayer').checked,
    congestion: $('#jamLayer').checked,
    tags: $('#tagLayer').checked,
    stateFilter: $('#stateFilter').value,
    heatFilter: Number($('#heatFilter').value) / 100,
  };
}

function redraw() {
  if (!state.data) return;
  map.draw(state.data, options());
}

function render(data) {
  state.data = data;
  renderMetrics($('#metrics'), data);
  renderVehicleSummary(
    $('#summaryRows'),
    data.latest,
    data.localization?.vehicles || [],
  );
  renderLocalization($('#localization'), data.localization);
  renderUwbValidation(
    $('#uwbValidation'),
    data.uwb_validation,
    data.localization_recovery,
  );
  if (state.selectedVehicle) {
    const selected = [...document.querySelectorAll('#summaryRows [data-vehicle]')].find((card) => (
      card.dataset.vehicle === state.selectedVehicle
    ));
    if (selected) selected.classList.add('selected');
  }
  renderAnalytics($('#analytics'), data.analytics);
  renderHotspots($('#hotspots'), data);
  renderStuckTimeline($('#stuckTimeline'), data.stuck_timeline);
  updateRouteVehicles(data.latest);
  if (state.selectedHotspot) {
    const selected = [...document.querySelectorAll('#hotspots [data-hotspot]')].find((row) => (
      Math.abs(Number(row.dataset.x) - state.selectedHotspot.x) < 0.001
      && Math.abs(Number(row.dataset.y) - state.selectedHotspot.y) < 0.001
      && row.dataset.type === state.selectedHotspot.type
    ));
    if (selected) selected.classList.add('selected');
  }

  $('#range').textContent = data.samples
    ? `${new Date(data.start).toLocaleString()} — ${new Date(data.end).toLocaleString()}`
    : 'Waiting for ROS traffic history';

  redraw();
}

function updateRouteVehicles(vehicles) {
  const select = $('#routeVehicle');
  const previous = select.value;
  select.replaceChildren(...(
    vehicles.length
      ? vehicles.map((vehicle) => new Option(vehicle.vehicle_id, vehicle.vehicle_id))
      : [new Option('No vehicles in this time range', '')]
  ));
  const preferred = state.selectedVehicle || previous;
  if (vehicles.some((vehicle) => vehicle.vehicle_id === preferred)) {
    select.value = preferred;
  }
}

async function load(query) {
  if (state.loading) return;

  state.loading = true;
  try {
    render(await getState(query));
    setConnection(true, `Updated ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    setConnection(false, `Monitor offline · ${error.message}`);
  } finally {
    state.loading = false;
  }
}

async function refreshBounds(initial = false) {
  try {
    const bounds = await getBounds();
    if (bounds.empty) {
      $('#replayClock').textContent = 'No recorded history';
      return;
    }

    const firstAvailableHistory = state.bounds === null;
    state.bounds = bounds;
    $('#timeline').min = bounds.first;
    $('#timeline').max = bounds.last;
    $('#selectedTime').min = localInput(new Date(bounds.first * 1000));
    $('#selectedTime').max = localInput(new Date(bounds.last * 1000));
    $('#firstLog').textContent = `First ${new Date(bounds.first * 1000).toLocaleString()}`;
    $('#lastLog').textContent = `Latest ${new Date(bounds.last * 1000).toLocaleString()}`;

    if (initial || firstAvailableHistory || !$('#selectedTime').value) {
      state.cursor = bounds.last;
      setSelected(Math.max(bounds.first, bounds.last - 300));
      $('#rangeStart').value = localInput(new Date(bounds.first * 1000));
      $('#rangeEnd').value = localInput(new Date(bounds.last * 1000));
    }

    if (state.cursor === null || state.auto) state.cursor = bounds.last;
    updateReplay(state.cursor);
  } catch {
    $('#replayClock').textContent = 'History unavailable';
  }
}

function pause(mode = 'PAUSED') {
  state.playing = false;
  state.lastTick = 0;
  $('#playButton').textContent = '▶ Play to latest';
  $('#playButton').className = '';

  if (mode) setMode(mode);
}

function loadFrame(epoch) {
  if (!state.bounds) return;

  state.auto = false;
  state.cursor = clamp(epoch);
  updateReplay(state.cursor);

  const trail = Number($('#trailMinutes').value) * 60;
  const historyStart = state.playing && state.playbackStart !== null
    ? state.playbackStart
    : Math.max(state.bounds.first, state.cursor - trail);
  const start = Math.min(state.cursor - 0.001, historyStart);

  load({
    start: new Date(start * 1000).toISOString(),
    end: new Date(state.cursor * 1000).toISOString(),
  });
}

function goLive() {
  pause(null);
  state.auto = true;
  state.playbackStart = null;
  setMode('LIVE');

  if (state.bounds) {
    state.cursor = state.bounds.last;
    updateReplay(state.cursor);
  }

  load({ hours: Number($('#trailMinutes').value) / 60 });
}

function jump() {
  pause('HISTORY');
  const value = $('#selectedTime').value;
  if (!value) return;

  loadFrame(new Date(value).getTime() / 1000);
}

function togglePlayback() {
  if (state.playing) {
    pause();
    return;
  }

  if (!state.bounds) return;

  state.auto = false;
  const selectedEpoch = new Date($('#selectedTime').value).getTime() / 1000;
  state.cursor = clamp(Number.isFinite(selectedEpoch) ? selectedEpoch : state.bounds.first);
  state.playbackStart = state.cursor;
  state.playbackEnd = state.bounds.last;
  state.playing = true;
  state.lastTick = performance.now();
  setMode('REPLAY');
  $('#playButton').textContent = '❚❚ Pause replay';
  $('#playButton').className = 'playing';
  loadFrame(state.cursor);
}

function playbackStep() {
  if (!state.playing) return;

  const now = performance.now();
  if (state.loading) {
    state.lastTick = now;
    return;
  }

  const elapsed = Math.min(2, (now - state.lastTick) / 1000);
  state.lastTick = now;
  state.cursor = Math.min(
    state.playbackEnd,
    state.cursor + elapsed * Number($('#playSpeed').value),
  );
  setSelected(state.cursor);
  loadFrame(state.cursor);

  if (state.cursor >= state.playbackEnd) pause('HISTORY');
}

function applyRange() {
  const start = $('#rangeStart').value;
  const end = $('#rangeEnd').value;
  if (!start || !end) return;

  pause('HISTORY');
  state.auto = false;
  load({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
}

$('#liveButton').addEventListener('click', goLive);
$('#jumpButton').addEventListener('click', jump);
$('#playButton').addEventListener('click', togglePlayback);
$('#applyRange').addEventListener('click', applyRange);

$('#stateFilter').addEventListener('change', redraw);

function selectVehicle(card) {
  state.selectedVehicle = card.dataset.vehicle;
  state.selectedHotspot = null;
  document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => {
    item.classList.toggle('selected', item === card);
  });
  document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => item.classList.remove('selected'));
  $('#pathLayer').checked = true;
  map.focusVehicle(state.selectedVehicle);
  if ([...$('#routeVehicle').options].some((option) => option.value === state.selectedVehicle)) {
    $('#routeVehicle').value = state.selectedVehicle;
  }

  const vehicle = state.data?.latest?.find((item) => item.vehicle_id === state.selectedVehicle);
  $('#mapFocus').textContent = vehicle
    ? `${state.selectedVehicle} path · x ${vehicle.x.toFixed(1)} · y ${vehicle.y.toFixed(1)} · ${vehicle.speed.toFixed(2)} m/s`
    : `${state.selectedVehicle} path`;
  $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#summaryRows').addEventListener('click', (event) => {
  const card = event.target.closest('[data-vehicle]');
  if (card) selectVehicle(card);
});

$('#summaryRows').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('[data-vehicle]');
  if (!card) return;
  event.preventDefault();
  selectVehicle(card);
});

$('#hotspots').addEventListener('click', (event) => {
  const row = event.target.closest('[data-hotspot]');
  if (!row) return;

  state.selectedVehicle = null;
  $('#pathLayer').checked = false;
  document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => item.classList.remove('selected'));
  state.selectedHotspot = {
    x: Number(row.dataset.x),
    y: Number(row.dataset.y),
    type: row.dataset.type,
    events: Number(row.dataset.events),
    first_started: Number(row.dataset.first) || null,
    last_ended: Number(row.dataset.last) || null,
  };

  document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => {
    item.classList.toggle('selected', item === row);
  });
  map.focusAt(state.selectedHotspot);

  const time = state.selectedHotspot.first_started
    ? `${new Date(state.selectedHotspot.first_started * 1000).toLocaleString()} → ${new Date((state.selectedHotspot.last_ended || state.selectedHotspot.first_started) * 1000).toLocaleString()}`
    : 'time unavailable';
  $('#mapFocus').textContent = `${state.selectedHotspot.type} · x ${state.selectedHotspot.x.toFixed(1)} · y ${state.selectedHotspot.y.toFixed(1)} · ${state.selectedHotspot.events} event(s) · ${time}`;
  $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#stuckTimeline').addEventListener('click', (event) => {
  const row = event.target.closest('[data-stuck-time]');
  if (!row) return;

  state.selectedVehicle = null;
  $('#pathLayer').checked = false;
  document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => item.classList.remove('selected'));
  document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => item.classList.remove('selected'));
  state.selectedHotspot = {
    x: Number(row.dataset.x),
    y: Number(row.dataset.y),
    type: 'Stuck',
    events: Number(row.dataset.count),
    first_started: Number(row.dataset.time),
    last_ended: Number(row.dataset.time),
  };
  map.focusAt(state.selectedHotspot);
  setSelected(Number(row.dataset.time));
  $('#mapFocus').textContent = `Stuck at ${new Date(Number(row.dataset.time) * 1000).toLocaleTimeString()} · x ${state.selectedHotspot.x.toFixed(1)} · y ${state.selectedHotspot.y.toFixed(1)} · ${state.selectedHotspot.events} vehicle(s)`;
  $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function selectInsight(row) {
  if (row.dataset.insight === 'stuck') {
    state.selectedVehicle = null;
    $('#pathLayer').checked = false;
    document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => item.classList.remove('selected'));
    state.selectedHotspot = {
      x: Number(row.dataset.x),
      y: Number(row.dataset.y),
      type: 'Stuck',
      events: Number(row.dataset.events),
      first_started: Number(row.dataset.first) || null,
      last_ended: Number(row.dataset.last) || null,
    };
    map.focusAt(state.selectedHotspot);
    $('#mapFocus').textContent = `Stuck · x ${state.selectedHotspot.x.toFixed(1)} · y ${state.selectedHotspot.y.toFixed(1)} · ${state.selectedHotspot.events} event(s)`;
  } else {
    const vehicleId = row.dataset.vehicle;
    const path = state.data?.analytics?.worst_path;
    state.selectedVehicle = vehicleId;
    state.selectedHotspot = null;
    $('#pathLayer').checked = true;
    document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => {
      item.classList.toggle('selected', item.dataset.vehicle === vehicleId);
    });
    document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => item.classList.remove('selected'));
    map.focusVehicle(vehicleId);
    $('#mapFocus').textContent = `${vehicleId} path · ${row.dataset.insight === 'window' ? 'bad interval' : 'worst path'}${path ? ` · ${path.slow_seconds.toFixed(0)} s slow` : ''}`;
  }
  $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#analytics').addEventListener('click', (event) => {
  const row = event.target.closest('[data-insight]');
  if (row) selectInsight(row);
});

$('#analytics').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = event.target.closest('[data-insight]');
  if (!row) return;
  event.preventDefault();
  selectInsight(row);
});

[
  'pathLayer',
  'vehicleLayer',
  'densityLayer',
  'stuckLayer',
  'jamLayer',
  'tagLayer',
  'heatMetric',
  'heatFilter',
].forEach((id) => $(`#${id}`).addEventListener('input', redraw));

$('#trailMinutes').addEventListener('change', () => (
  state.auto ? goLive() : state.cursor !== null && loadFrame(state.cursor)
));

['selectedTime', 'rangeStart', 'rangeEnd'].forEach((id) => (
  $(`#${id}`).addEventListener('focus', () => {
    state.auto = false;
    pause('PAUSED');
  })
));

$('#timeline').addEventListener('input', (event) => {
  state.auto = false;
  pause('HISTORY');
  state.cursor = Number(event.target.value);
  setSelected(state.cursor);
  updateReplay(state.cursor);
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => loadFrame(state.cursor), 120);
});

function clearRouteSuggestion() {
  state.route = null;
  routeMap.setRoute(null);
  renderRouteSuggestion($('#routeResult'), null);
}

routeMap.onDestination((point) => {
  $('#routeX').value = point.x.toFixed(2);
  $('#routeY').value = point.y.toFixed(2);
  $('#routeStatus').className = 'route-status';
  $('#routeStatus').textContent = `Destination selected at x ${point.x.toFixed(2)}, y ${point.y.toFixed(2)}. Generate the suggestion when ready.`;
});

$('#routeVehicle').addEventListener('change', clearRouteSuggestion);

$('#routeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.routeLoading) return;

  const vehicleId = $('#routeVehicle').value;
  const x = Number($('#routeX').value);
  const y = Number($('#routeY').value);
  const status = $('#routeStatus');
  if (!vehicleId || !Number.isFinite(x) || !Number.isFinite(y)) {
    status.className = 'route-status error';
    status.textContent = 'Choose a forklift and set both destination coordinates.';
    return;
  }
  if (!state.data?.samples) {
    status.className = 'route-status error';
    status.textContent = 'No recorded traffic is available in this dashboard time range.';
    return;
  }

  state.routeLoading = true;
  $('#suggestRouteButton').disabled = true;
  status.className = 'route-status loading';
  status.textContent = 'Calculating collision-clear alternatives…';
  try {
    state.route = await getRouteSuggestion({
      vehicle_id: vehicleId,
      destination: { x, y },
      nominal_speed_mps: Number($('#routeSpeed').value),
      start: state.data.start,
      end: state.data.end,
    });
    routeMap.setRoute(state.route);
    renderRouteSuggestion($('#routeResult'), state.route);
    status.className = 'route-status success';
    status.textContent = `${vehicleId}: route ready. Green is the suggested path; dashed gray is the shortest path.`;
  } catch (error) {
    clearRouteSuggestion();
    status.className = 'route-status error';
    status.textContent = error.message;
  } finally {
    state.routeLoading = false;
    $('#suggestRouteButton').disabled = false;
  }
});

async function boot() {
  render(emptyData);

  try {
    const mapInfo = await getMap();
    await Promise.all([map.load(mapInfo), routeMap.load(mapInfo)]);
    redraw();
  } catch {
    await Promise.all([
      map.load(map.info, '/fallback-map.png'),
      routeMap.load(routeMap.info, '/fallback-map.png'),
    ]);
    map.draw(emptyData, options());
    setConnection(false, 'Map preview · ROS monitor offline');
  }

  await refreshBounds(true);
  goLive();
}

boot();
setInterval(playbackStep, 400);

let refreshCycle = 0;
setInterval(() => {
  if (state.auto) goLive();
  refreshCycle += 1;
  if (refreshCycle % 5 === 0) refreshBounds();
}, 2000);
