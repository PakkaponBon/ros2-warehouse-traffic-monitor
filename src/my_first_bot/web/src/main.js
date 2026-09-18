import './styles.css';
import './dashboard.css';
import './map-workspace.css';
import {
  getBounds,
  getMap,
  getSideTasks,
  getState,
  setSideTask,
} from './api.js';
import {
  renderAnalytics,
  renderHeatAreaSummary,
  renderHotspots,
  renderLocalization,
  renderMetrics,
  renderStuckTimeline,
  renderUwbValidation,
  renderVehicleSummary,
  setConnection,
  setMode,
} from './components.js';
import { HEAT_METRICS, HEAT_GRADIENT, heatColor } from './heatmap.js';
import { WarehouseMap } from './map.js';
import { RouteSuggestionMap } from './route-map.js';

const app = document.querySelector('#app');
document.body.classList.add('dashboard');

app.innerHTML = `
  <a class="skip-link" href="#workspace">Skip to workspace</a>
  <aside class="app-sidebar">
    <a class="brand" href="/" aria-label="Warehouse Intelligence home">
      <span class="logo">W</span>
      <span>
        <strong>Warehouse</strong>
        <small>INTELLIGENCE</small>
      </span>
    </a>
    <div class="nav-caption">WORKSPACE</div>
    <nav class="workspace-nav" aria-label="Workspace">
      <button type="button" data-view="overview" aria-current="page">
        <span aria-hidden="true">◫</span>Overview</button>
      <button type="button" data-view="activity">
        <span aria-hidden="true">≋</span>Traffic history</button>
      <button type="button" data-view="dispatch">
        <span aria-hidden="true">↗</span>Dispatch a task</button>
      <button type="button" data-view="diagnostics">
        <span aria-hidden="true">⌁</span>Diagnostics</button>
    </nav>
    <div class="sidebar-bottom">
      <a href="/health.html">
        <span aria-hidden="true">♡</span> System health <span aria-hidden="true">↗</span>
      </a>
      <p>Warehouse operations<br>
        <span>Traffic & vehicle monitoring</span>
      </p>
    </div>
  </aside>
  <div class="app-workspace">
    <header class="workspace-topbar">
      <span>Operations <span class="breadcrumb">/ <b id="breadcrumb">Overview</b>
        </span>
      </span>
      <a class="mobile-health" href="/health.html">System health ↗</a>
      <div id="connection" class="connection" role="status">
        <i>
        </i>
        <span>Connecting…</span>
      </div>
    </header>
    <main id="workspace" tabindex="-1">
      <div class="page-heading">
        <div>
          <p class="eyebrow">WAREHOUSE OPERATIONS</p>
          <h1 id="pageTitle">Your warehouse, at a glance.</h1>
          <p id="pageDescription">See where your vehicles are and what needs attention.</p>
        </div>
        <span id="mode" class="mode">LIVE</span>
      </div>
      <section class="time-controls" aria-label="Time controls">
        <div class="time-controls-main">
          <button id="liveButton" class="secondary">● Live now</button>
          <label class="time-window" for="trailMinutes">Traffic window<select id="trailMinutes">
              <option value="1">Last minute</option>
              <option value="5" selected>Last 5 minutes</option>
              <option value="15">Last 15 minutes</option>
              <option value="60">Last hour</option>
            </select>
          </label>
          <button id="replayToggle" class="text-button" aria-expanded="false" aria-controls="replayControls">Replay history <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <div id="replayControls" class="replay-controls" hidden>
          <p class="control-hint">Choose a recorded time, then jump to it or play forward.</p>
          <div class="control-row">
            <label class="field">
              <span>Start time</span>
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
          </div>
          <div class="timeline-row">
            <span id="firstLog">First log —</span>
            <input id="timeline" aria-label="Recorded time" type="range" min="0" max="1" value="1" step="0.5">
            <span id="replayClock">Loading history…</span>
            <span id="lastLog">Latest log —</span>
          </div>
        </div>
      </section>
      <div id="dataNotice" class="data-notice" role="status" hidden>
      </div>
      <section data-workspace="overview" aria-label="Overview">
        <section id="metrics" class="metrics" aria-label="Traffic summary">
        </section>
        <div class="overview-grid">
          <section class="panel map-panel">
            <div class="panel-head">
              <div>
                <h2>Warehouse map</h2>
                <span class="sub">Explore your floor, vehicles, and traffic</span>
              </div>
              <details class="layer-menu">
                <summary>Layers <span aria-hidden="true">⌄</span>
                </summary>
                <div class="map-tools">
                  <span class="menu-label">MAP APPEARANCE</span>
                  <label><input id="labelLayer" type="checkbox" checked> Vehicle names</label>
                  <label><input id="gridLayer" type="checkbox"> Coordinate grid</label>
                  <span class="menu-label">SHOW ON MAP</span>
                  <label>
                    <input id="vehicleLayer" type="checkbox" checked> Vehicle positions</label>
                  <label>
                    <input id="densityLayer" type="checkbox"> Traffic heatmap</label>
                  <label>
                    <input id="pathLayer" type="checkbox"> Selected vehicle’s path</label>
                  <label>
                    <input id="stuckLayer" type="checkbox"> Stuck locations</label>
                  <label>
                    <input id="jamLayer" type="checkbox"> Congestion</label>
                  <label>
                    <input id="tagLayer" type="checkbox"> UWB sensor tags</label>
                  <label class="state-filter">Vehicle state <select id="stateFilter">
                      <option value="all">All states</option>
                      <option value="moving">Moving</option>
                      <option value="side_task">Travelling to side task</option>
                      <option value="returning_route">Returning to route</option>
                      <option value="side_work">Performing side work</option>
                      <option value="task_planning">Planning side task</option>
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
                </div>
              </details>
            </div>
            <div class="map-viewbar">
              <div class="map-presets" role="group" aria-label="Map view">
                <button type="button" data-map-view="vehicles" aria-pressed="true">Vehicles</button>
                <button type="button" data-map-view="heat" aria-pressed="false">Traffic heat</button>
                <button type="button" data-map-view="issues" aria-pressed="false">Issues</button>
              </div>
              <span id="mapViewHint" class="map-view-hint">Current vehicle positions</span>
            </div>
            <section id="heatControls" class="heat-controls" aria-label="Traffic heat settings" hidden>
              <div class="heat-control-fields">
                <label class="field"><span>Measure</span><select id="heatMetric">
                  <option value="count">Traffic activity</option>
                  <option value="vehicles">Vehicle coverage</option>
                  <option value="slow_samples">Slow & waiting activity</option>
                </select></label>
                <label class="field"><span>Show areas</span><select id="heatFilter">
                  <option value="0">All recorded areas</option>
                  <option value="50">Busier half</option>
                  <option value="80">Busiest 20%</option>
                </select></label>
                <label class="field heat-opacity"><span>Overlay strength <output id="heatOpacityValue" for="heatOpacity">65%</output></span>
                  <input id="heatOpacity" type="range" min="20" max="90" value="65" step="5" aria-label="Heat overlay strength">
                </label>
              </div>
              <p id="heatMetricHelp" class="heat-metric-help"></p>
            </section>
            <div class="map-wrap map-stage">
              <canvas id="map" width="1200" height="720" tabindex="0" role="img"
                aria-label="Interactive warehouse map. Select a vehicle on the map or in the fleet list. Use plus and minus to zoom, arrow keys to pan, and zero to fit the map." aria-describedby="mapNavigationHint"></canvas>
              <div id="mapTooltip" class="tooltip"></div>
              <div class="map-navigation" role="group" aria-label="Map navigation">
                <button id="mapZoomIn" type="button" aria-label="Zoom in" title="Zoom in (+)">+</button>
                <output id="mapZoomLevel" aria-label="Zoom level">100%</output>
                <button id="mapZoomOut" type="button" aria-label="Zoom out" title="Zoom out (-)" disabled>−</button>
                <button id="mapReset" type="button" title="Fit the full warehouse (0)">Fit</button>
              </div>
              <span id="mapNavigationHint" class="map-navigation-hint">Zoom in to explore · select a vehicle</span>
            </div>
            <div class="map-foot map-legend-row">
              <div id="vehicleLegend" class="legend" aria-label="Vehicle status colors">
                <span><i class="state-dot moving"></i>Moving</span>
                <span><i class="state-dot turning"></i>Turning</span>
                <span><i class="state-dot waiting"></i>Waiting</span>
                <span><i class="state-dot blocked"></i>Blocked</span>
                <span><i class="state-dot idle"></i>Idle / other</span>
              </div>
              <span id="issuesLegend" class="legend" hidden><span><i class="dot stuck"></i>Stuck location</span><span><i class="dot congestion"></i>Congestion</span></span>
            </div>
            <section id="heatInsights" class="heat-insights" aria-label="Traffic heat summary" hidden>
              <div id="heatLegend" class="heat-scale" hidden>
                <div class="heat-scale-title"><strong id="heatScaleTitle">Traffic activity</strong><span id="heatAreaCount"></span></div>
                <div id="heatScaleBar" class="heat-scale-bar" aria-hidden="true"></div>
                <div class="heat-scale-values"><span id="heatScaleLow"></span><span id="heatScaleHigh"></span></div>
                <p id="heatScaleNote">Colors are relative to this time window.</p>
              </div>
              <div class="heat-ranking-head"><strong id="heatRankingTitle">Most active areas</strong><span>Select an area to inspect it</span></div>
              <div id="heatAreas" class="heat-areas"></div>
            </section>
            <div id="mapSelection" class="map-selection">
              <div><span id="mapSelectionLabel" class="selection-label">EXPLORE THE MAP</span><p id="mapFocus" class="map-focus">Select a vehicle to see its route. Choose Traffic heat to explore busy areas.</p></div>
              <button id="clearMapSelection" type="button" class="text-button" hidden>Clear selection</button>
            </div>
            <details id="areaPanel" class="map-area-details" hidden>
              <summary>Area traffic breakdown</summary>
              <div id="heatAreaSummary"></div>
            </details>
            <div class="map-range">
              <span id="range" class="range">Loading traffic…</span>
            </div>
          </section>
          <section class="panel summary-panel">
            <div class="panel-head">
              <div>
                <h2>Your fleet <span id="fleetCount" class="count-badge">0</span>
                </h2>
                <span class="sub">Select a vehicle to locate it</span>
              </div>
              <label class="compact-toggle">
                <input id="fleetDetails" type="checkbox">Details</label>
            </div>
            <div id="summaryRows" class="summary-grid">
              <div class="empty">Waiting for vehicle data…</div>
            </div>
          </section>
        </div>
        <section class="panel attention-panel">
          <div class="panel-head">
            <div>
              <h2>Traffic highlights</h2>
              <span class="sub">Patterns in the selected time window</span>
            </div>
            <button type="button" class="text-button" data-open-view="activity">View history →</button>
          </div>
          <div id="analytics" class="analytics">
            <div class="empty">Waiting for traffic data…</div>
          </div>
        </section>
      </section>
      <section data-workspace="activity" aria-label="Traffic history" hidden>
        <div class="view-intro">
          <span class="intro-icon" aria-hidden="true">◷</span>
          <p>Explore slowdowns and recurring hotspots. Select an event to find it on the map, or use <b>Replay history</b> to review a recorded time.</p>
        </div>
        <div class="activity-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Traffic hotspots</h2>
                <span class="sub">Locations with the most stuck or congestion events</span>
              </div>
            </div>
            <div id="hotspots" class="hotspots">
            </div>
          </section>
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Stuck events over time</h2>
                <span class="sub">When vehicles were unable to move</span>
              </div>
            </div>
            <div id="stuckTimeline" class="stuck-timeline">
            </div>
          </section>
        </div>
      </section>
      <section data-workspace="dispatch" aria-label="Task dispatch" hidden>
        <section class="panel route-panel task-panel">
          <div class="panel-head">
            <div>
              <h2>Dispatch a task</h2>
              <span class="sub">Choose a forklift and a destination. It returns to its route when the work is done.</span>
            </div>
            <span class="tag control">SIMULATION CONTROL</span>
          </div>
          <div class="route-layout">
            <form id="taskForm" class="route-controls">
              <label class="field">
                <span>Forklift</span>
                <select id="taskVehicle">
                  <option value="">Waiting for vehicles…</option>
                </select>
              </label>
              <div class="route-coordinate-row">
                <label class="field">
                  <span>Destination X (m)</span>
                  <input id="taskX" required type="number" step="0.01" placeholder="Click map">
                </label>
                <label class="field">
                  <span>Destination Y (m)</span>
                  <input id="taskY" required type="number" step="0.01" placeholder="Click map">
                </label>
              </div>
              <label class="field">
                <span>Work duration (seconds)</span>
                <input id="taskDuration" required type="number" min="0" max="3600" step="1" value="10">
              </label>
              <div class="task-actions">
                <button id="dispatchTaskButton" type="submit">Dispatch task</button>
                <button id="cancelTaskButton" type="button" class="secondary">Cancel task</button>
              </div>
              <p id="taskStatus" role="status" class="route-status">Select a forklift, then click a destination on the map.</p>
              <p class="route-safety">Simulation only. Choose an open aisle on the map. The forklift will travel there, complete the work, and return to its route.</p>
            </form>
            <div class="route-map-wrap">
              <canvas id="taskMap" width="1000" height="560">
              </canvas>
              <div id="taskTooltip" class="tooltip">
              </div>
              <div class="route-map-legend">
                <span>
                  <i class="task-goal-dot">
                  </i>selected side-work destination</span>
                <span>Click a collision-free aisle location</span>
              </div>
            </div>
            <div id="taskResult" class="route-result task-result">
              <h3>What happens next</h3>
              <ol>
                <li>Travel to the selected destination</li>
                <li>Remain there for the work duration</li>
                <li>Return to the saved route checkpoint</li>
                <li>Resume the normal route automatically</li>
              </ol>
              <div id="taskLiveStatus" role="status" class="task-live-status">No side-work status received yet.</div>
            </div>
          </div>
        </section>
      </section>
      <section data-workspace="diagnostics" aria-label="Position diagnostics" hidden>
        <div class="view-intro">
          <span class="intro-icon" aria-hidden="true">⌁</span>
          <p>Technical position checks for troubleshooting. For connectivity and sensor availability, open <a href="/health.html">System health ↗</a>.</p>
        </div>
        <div class="activity-grid">
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
        </div>
      </section>
      <footer class="workspace-footer">
        <span>Warehouse Intelligence</span>
        <span>Position & traffic monitoring</span>
      </footer>
    </main>
  </div>
`;

const $ = (selector) => document.querySelector(selector);
const map = new WarehouseMap($('#map'));
const taskMap = new RouteSuggestionMap($('#taskMap'), $('#taskTooltip'));

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
  selectedHeat: null,
  selectedVehicle: null,
  taskLoading: false,
  taskStatuses: [],
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
    grid: $('#gridLayer').checked,
    labels: $('#labelLayer').checked,
    vehicles: $('#vehicleLayer').checked,
    heat: $('#densityLayer').checked,
    heatMetric: $('#heatMetric').value,
    heatOpacity: Number($('#heatOpacity').value) / 100,
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
  syncMapControls();
}

function render(data) {
  state.data = data;
  renderMetrics($('#metrics'), data);
  $('#fleetCount').textContent = data.latest.length;
  const focusedVehicle = document.activeElement?.closest('#summaryRows [data-vehicle]')?.dataset.vehicle;
  renderVehicleSummary(
    $('#summaryRows'),
    data.latest,
    data.localization?.vehicles || [],
  );
  if (focusedVehicle) {
    [...$('#summaryRows').querySelectorAll('[data-vehicle]')]
      .find((card) => card.dataset.vehicle === focusedVehicle)?.focus({ preventScroll: true });
  }
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
    const vehicle = data.latest.find((item) => item.vehicle_id === state.selectedVehicle);
    $('#mapFocus').textContent = vehicle
      ? `${vehicle.vehicle_id} · ${vehicle.motion_state?.replaceAll('_', ' ') || 'State unavailable'} · ${vehicle.speed.toFixed(2)} m/s · x ${vehicle.x.toFixed(1)}, y ${vehicle.y.toFixed(1)}`
      : `${state.selectedVehicle} · No current position in this time window`;
  }
  renderAnalytics($('#analytics'), data.analytics);
  if (state.selectedHeat) {
    const selectedValue = data.density.find((value) => (
      Math.abs(Number(value.x) - Number(state.selectedHeat.value.x)) < 0.001
      && Math.abs(Number(value.y) - Number(state.selectedHeat.value.y)) < 0.001
    ));
    if (selectedValue) {
      state.selectedHeat.value = selectedValue;
      renderHeatAreaSummary(
        $('#heatAreaSummary'),
        selectedValue,
        state.selectedHeat.metric,
      );
    } else {
      clearMapSelection();
    }
  }
  renderHotspots($('#hotspots'), data);
  renderStuckTimeline($('#stuckTimeline'), data.stuck_timeline);
  updateTaskVehicles(data.latest);
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

function clearHeatSelection() {
  $('#areaPanel').hidden = true;
  $('#areaPanel').open = false;
  state.selectedHeat = null;
  renderHeatAreaSummary($('#heatAreaSummary'), null);
}

function selectHeatArea(value, metric) {
  $('#areaPanel').hidden = false;
  state.selectedHeat = { value, metric };
  state.selectedVehicle = null;
  state.selectedHotspot = null;
  document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => item.classList.remove('selected'));
  document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => item.classList.remove('selected'));
  $('#pathLayer').checked = false;
  renderHeatAreaSummary($('#heatAreaSummary'), value, metric);
  map.focusAt({
    x: Number(value.x),
    y: Number(value.y),
    type: 'Heat area',
    events: Number(value[metric] || 0),
  });
  const peak = value.time_details?.peaks?.[metric];
  const peakText = peak
    ? ` · busiest ${new Date(peak.start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';
  $('#mapFocus').textContent = `${Number(value[metric] || 0).toLocaleString()} ${HEAT_METRICS[metric].unit} · x ${Number(value.x).toFixed(1)}, y ${Number(value.y).toFixed(1)}${peakText}`;
  redraw();
}
map.setHeatSelectionHandler(selectHeatArea);

function updateTaskVehicles(vehicles) {
  const select = $('#taskVehicle');
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
    $('#dataNotice').hidden = true;
  } catch (error) {
    setConnection(false, 'Monitor offline');
    $('#dataNotice').hidden = false;
    $('#dataNotice').textContent = 'Live updates are unavailable. Displayed data may be out of date. Reconnecting automatically…';
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

function selectVehicle(card, scrollToMap = true) {
  clearHeatSelection();
  state.selectedVehicle = card.dataset.vehicle;
  state.selectedHotspot = null;
  document.querySelectorAll('#summaryRows [data-vehicle]').forEach((item) => {
    item.classList.toggle('selected', item === card);
  });
  document.querySelectorAll('#hotspots [data-hotspot]').forEach((item) => item.classList.remove('selected'));
  $('#pathLayer').checked = true;
  map.focusVehicle(state.selectedVehicle);
  if ([...$('#taskVehicle').options].some((option) => option.value === state.selectedVehicle)) {
    $('#taskVehicle').value = state.selectedVehicle;
    renderSelectedTaskStatus();
  }

  const vehicle = state.data?.latest?.find((item) => item.vehicle_id === state.selectedVehicle);
  $('#mapFocus').textContent = vehicle
    ? `${state.selectedVehicle} path · x ${vehicle.x.toFixed(1)} · y ${vehicle.y.toFixed(1)} · ${vehicle.speed.toFixed(2)} m/s`
    : `${state.selectedVehicle} path`;
  showView('overview');
  redraw();
  if (scrollToMap) $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
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

function selectHotspot(row, scrollToMap = true) {

  clearHeatSelection();
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
  showView('overview');
  redraw();
  if (scrollToMap) $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#hotspots').addEventListener('click', (event) => {
  const row = event.target.closest('[data-hotspot]');
  if (row) selectHotspot(row);
});

$('#stuckTimeline').addEventListener('click', (event) => {
  const row = event.target.closest('[data-stuck-time]');
  if (!row) return;

  clearHeatSelection();
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
  showView('overview');
  redraw();
  $('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function selectInsight(row) {
  clearHeatSelection();
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
  showView('overview');
  redraw();
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
  'labelLayer',
  'gridLayer',
  'pathLayer',
  'vehicleLayer',
  'densityLayer',
  'stuckLayer',
  'jamLayer',
  'tagLayer',
  'heatMetric',
  'heatFilter',
  'heatOpacity',
].forEach((id) => $(`#${id}`).addEventListener('input', redraw));

$('#heatMetric').addEventListener('change', () => {
  if (state.selectedHeat) {
    selectHeatArea(state.selectedHeat.value, $('#heatMetric').value);
  }
});

$('#heatAreas').addEventListener('click', (event) => {
  const button = event.target.closest('[data-heat-area]');
  if (!button) return;
  const value = state.data?.density.find((area) => `${area.x},${area.y}` === button.dataset.heatArea);
  if (value) {
    selectHeatArea(value, $('#heatMetric').value);
    $('#areaPanel').open = true;
  }
});

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

function taskStatusText(status) {
  if (!status) return 'No side-work status received for this vehicle.';
  const task = status.task_id ? `Task ${status.task_id}` : 'Task';
  const reason = status.reason ? ` · ${status.reason.replaceAll('_', ' ')}` : '';
  return `${task}: ${status.status.replaceAll('_', ' ')}${reason}`;
}

function renderSelectedTaskStatus() {
  const vehicleId = $('#taskVehicle').value;
  const status = state.taskStatuses.find((item) => item.vehicle_id === vehicleId);
  $('#taskLiveStatus').textContent = taskStatusText(status);
}

async function refreshTaskStatus() {
  try {
    const snapshot = await getSideTasks();
    state.taskStatuses = snapshot.statuses;
    renderSelectedTaskStatus();
    if (!snapshot.enabled) {
      $('#taskStatus').className = 'route-status error';
      $('#taskStatus').textContent = 'Side-work controls are disabled in this launch.';
    }
  } catch (error) {
    $('#taskLiveStatus').textContent = `Task status unavailable: ${error.message}`;
  }
}

taskMap.onDestination((point) => {
  $('#taskX').value = point.x.toFixed(2);
  $('#taskY').value = point.y.toFixed(2);
  taskMap.setDestination(point);
  $('#taskStatus').className = 'route-status';
  $('#taskStatus').textContent = `Task destination selected at x ${point.x.toFixed(2)}, y ${point.y.toFixed(2)}.`;
});

$('#taskVehicle').addEventListener('change', renderSelectedTaskStatus);

$('#taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.taskLoading) return;

  const vehicleId = $('#taskVehicle').value;
  const x = Number($('#taskX').value);
  const y = Number($('#taskY').value);
  const dwellSeconds = Number($('#taskDuration').value);
  const status = $('#taskStatus');
  if (!vehicleId || !$('#taskX').value || !$('#taskY').value || !$('#taskDuration').value
      || !Number.isFinite(x) || !Number.isFinite(y)
      || !Number.isFinite(dwellSeconds) || dwellSeconds < 0 || dwellSeconds > 3600) {
    status.className = 'route-status error';
    status.textContent = 'Choose a forklift, destination, and work duration from 0–3600 seconds.';
    return;
  }
  if (!state.auto) {
    status.className = 'route-status error';
    status.textContent = 'Return to Live mode before dispatching a vehicle.';
    return;
  }

  state.taskLoading = true;
  $('#dispatchTaskButton').disabled = true;
  $('#cancelTaskButton').disabled = true;
  status.className = 'route-status loading';
  status.textContent = `Dispatching ${vehicleId}…`;
  try {
    const snapshot = await setSideTask({
      vehicle_id: vehicleId,
      x,
      y,
      dwell_seconds: dwellSeconds,
    });
    state.taskStatuses = snapshot.statuses;
    status.className = 'route-status success';
    status.textContent = `${vehicleId}: task request sent. Waiting for the controller acknowledgement.`;
    renderSelectedTaskStatus();
    setTimeout(refreshTaskStatus, 350);
  } catch (error) {
    status.className = 'route-status error';
    status.textContent = error.message;
  } finally {
    state.taskLoading = false;
    $('#dispatchTaskButton').disabled = false;
    $('#cancelTaskButton').disabled = false;
  }
});

$('#cancelTaskButton').addEventListener('click', async () => {
  if (state.taskLoading) return;
  const vehicleId = $('#taskVehicle').value;
  const status = $('#taskStatus');
  if (!vehicleId) {
    status.className = 'route-status error';
    status.textContent = 'Choose a forklift to cancel its active task.';
    return;
  }
  state.taskLoading = true;
  $('#dispatchTaskButton').disabled = true;
  $('#cancelTaskButton').disabled = true;
  try {
    await setSideTask({ action: 'cancel', vehicle_id: vehicleId });
    status.className = 'route-status success';
    status.textContent = `${vehicleId}: cancellation request sent.`;
    setTimeout(refreshTaskStatus, 350);
  } catch (error) {
    status.className = 'route-status error';
    status.textContent = error.message;
  } finally {
    state.taskLoading = false;
    $('#dispatchTaskButton').disabled = false;
    $('#cancelTaskButton').disabled = false;
  }
});


function syncHeatInsights() {
  const metric = $('#heatMetric').value;
  const config = HEAT_METRICS[metric];
  const scale = map.heatScale;
  if (!scale) return;
  $('#heatMetricHelp').textContent = config.description;
  $('#heatOpacityValue').textContent = `${$('#heatOpacity').value}%`;
  $('#heatLegend').hidden = !scale.areas.length;
  $('#heatScaleTitle').textContent = config.label;
  $('#heatAreaCount').textContent = `${scale.visible.length.toLocaleString()} of ${scale.areas.length.toLocaleString()} areas shown`;
  $('#heatScaleBar').style.background = scale.min === scale.max ? `rgb(${heatColor(.5).join(',')})` : HEAT_GRADIENT;
  $('#heatScaleLow').textContent = `${scale.min.toLocaleString()} ${config.unit}`;
  $('#heatScaleHigh').textContent = `${scale.max.toLocaleString()} ${config.unit}`;
  $('#heatScaleNote').textContent = scale.min === scale.max
    ? 'All recorded areas have the same value.'
    : 'Relative intensity within this time window · colors stay consistent when filtering.';
  if (Number($('#heatFilter').value) > 0) $('#heatScaleNote').textContent += ` Showing ≥ ${scale.threshold.toLocaleString()} ${config.unit}; ties are included.`;
  $('#heatRankingTitle').textContent = config.ranking;
  const root = $('#heatAreas');
  const html = scale.visible.length ? scale.visible.slice(0, 3).map((area, index) => {
    const selected = state.selectedHeat?.value.x === area.x && state.selectedHeat?.value.y === area.y;
    return `<button type="button" class="heat-area-button" data-heat-area="${Number(area.x)},${Number(area.y)}" aria-pressed="${selected}">
      <span class="heat-rank">${index + 1}</span><span><strong>${Number(area[metric]).toLocaleString()} <small>${config.unit}</small></strong><small>x ${Number(area.x).toFixed(1)} · y ${Number(area.y).toFixed(1)}</small></span><span aria-hidden="true">↗</span>
    </button>`;
  }).join('') : `<p class="heat-empty">${state.data === emptyData ? 'Waiting for traffic data from the monitor.' : `${config.empty} Try another measure or a longer traffic window.`}</p>`;
  if (root.innerHTML !== html) {
    const focused = document.activeElement?.closest('[data-heat-area]')?.dataset.heatArea;
    root.innerHTML = html;
    if (focused) [...root.querySelectorAll('[data-heat-area]')].find((button) => button.dataset.heatArea === focused)?.focus({ preventScroll: true });
  }
  if (state.selectedHeat) {
    const value = state.selectedHeat.value;
    $('#mapFocus').textContent = `${Number(value[metric] || 0).toLocaleString()} ${config.unit} · average speed ${Number(value.average_speed || 0).toFixed(2)} m/s · x ${Number(value.x).toFixed(1)}, y ${Number(value.y).toFixed(1)}`;
    if (!scale.visible.includes(value)) $('#mapFocus').textContent += ' · Outside the current heat filter';
  }
}

function syncMapControls() {
  const heat = $('#densityLayer').checked;
  const issues = $('#stuckLayer').checked && $('#jamLayer').checked;
  const vehicles = $('#vehicleLayer').checked;
  const view = vehicles && !heat && !$('#stuckLayer').checked && !$('#jamLayer').checked ? 'vehicles'
    : vehicles && heat && !$('#stuckLayer').checked && !$('#jamLayer').checked ? 'heat'
      : vehicles && !heat && issues ? 'issues' : 'custom';
  document.querySelectorAll('[data-map-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mapView === view));
  });
  $('#mapViewHint').textContent = { vehicles: 'Current vehicle positions', heat: 'Traffic in the selected time window', issues: 'Recorded stuck & congestion locations', custom: 'Custom layer selection' }[view];
  $('#vehicleLegend').hidden = !vehicles;
  $('#heatControls').hidden = !heat;
  $('#heatInsights').hidden = !heat;
  if (heat) syncHeatInsights();
  $('#issuesLegend').hidden = !$('#stuckLayer').checked && !$('#jamLayer').checked;
  const selected = state.selectedVehicle || state.selectedHeat || state.selectedHotspot;
  $('#mapSelection').classList.toggle('has-selection', Boolean(selected));
  $('#clearMapSelection').hidden = !selected;
  $('#mapSelectionLabel').textContent = state.selectedVehicle ? 'SELECTED VEHICLE'
    : state.selectedHeat ? 'SELECTED AREA' : state.selectedHotspot ? 'SELECTED EVENT' : heat ? 'EXPLORE TRAFFIC' : 'EXPLORE THE MAP';
  if (!selected) $('#mapFocus').textContent = heat
    ? 'Select a colored area or a ranked area above to see its activity, speed, and busiest time.'
    : 'Select a vehicle to see its route. Choose Traffic heat to explore busy areas.';
  updateMapNavigationHint();
}

function clearMapSelection() {
  clearHeatSelection();
  state.selectedVehicle = null;
  state.selectedHotspot = null;
  $('#pathLayer').checked = false;
  map.clearSelection();
  document.querySelectorAll('#summaryRows .selected, #hotspots .selected').forEach((item) => item.classList.remove('selected'));
  $('#mapFocus').textContent = 'Select a vehicle to see its route. Choose Traffic heat to explore busy areas.';
  redraw();
}

function updateMapNavigationHint() {
  $('#mapNavigationHint').textContent = map.viewport.scale > 1 ? 'Drag to move · Fit to see the full floor'
    : $('#densityLayer').checked ? 'Select a colored area · zoom for a closer look' : 'Zoom in to explore · select a vehicle';
}

map.onViewportChange = (scale) => {
  $('#mapZoomLevel').textContent = `${Math.round(scale * 100)}%`;
  $('#mapZoomIn').disabled = scale >= 5;
  $('#mapZoomOut').disabled = scale <= 1;
  updateMapNavigationHint();
};
map.onVehicleSelect = (vehicleId) => {
  const card = [...$('#summaryRows').querySelectorAll('[data-vehicle]')].find((item) => item.dataset.vehicle === vehicleId);
  if (card) selectVehicle(card, false);
};
map.onEventSelect = (value, type) => {
  const row = [...$('#hotspots').querySelectorAll('[data-hotspot]')].find((item) => (
    Number(item.dataset.x) === Number(value.x) && Number(item.dataset.y) === Number(value.y) && item.dataset.type === type
  ));
  selectHotspot(row || { dataset: {
    x: value.x, y: value.y, type, events: value.events,
    first: value.first_started, last: value.last_ended,
  } }, false);
};
$('#mapZoomIn').addEventListener('click', () => map.zoomBy(1.3));
$('#mapZoomOut').addEventListener('click', () => map.zoomBy(1 / 1.3));
$('#mapReset').addEventListener('click', () => map.resetView());
$('#clearMapSelection').addEventListener('click', clearMapSelection);
document.querySelectorAll('[data-map-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.mapView;
    $('#vehicleLayer').checked = true;
    $('#densityLayer').checked = view === 'heat';
    $('#stuckLayer').checked = view === 'issues';
    $('#jamLayer').checked = view === 'issues';
    redraw();
  });
});

const views = {
  overview: ['Overview', 'Your warehouse, at a glance.', 'See where your vehicles are and what needs attention.'],
  activity: ['Traffic history', 'Understand your traffic.', 'Find recurring slowdowns and explore recorded events.'],
  dispatch: ['Dispatch a task', 'Put your fleet to work.', 'Send a simulated forklift to a temporary job.'],
  diagnostics: ['Diagnostics', 'A closer look at positioning.', 'Compare sensor readings and investigate position accuracy.'],
};

function showView(name, updateHash = true) {
  if (!views[name]) name = 'overview';
  document.querySelectorAll('[data-workspace]').forEach((section) => {
    section.hidden = section.dataset.workspace !== name;
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const [label, title, description] = views[name];
  $('#breadcrumb').textContent = label;
  $('#pageTitle').textContent = title;
  $('#pageDescription').textContent = description;
  document.title = `${label} · Warehouse Intelligence`;
  if (updateHash && location.hash !== `#${name}`) location.hash = name;
}

document.querySelectorAll('[data-view], [data-open-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view || button.dataset.openView));
});
window.addEventListener('hashchange', () => {
  if (location.hash !== '#workspace') showView(location.hash.slice(1), false);
});
showView(location.hash.slice(1), false);
$('#replayToggle').addEventListener('click', () => {
  const expanded = $('#replayToggle').getAttribute('aria-expanded') !== 'true';
  $('#replayToggle').setAttribute('aria-expanded', String(expanded));
  $('#replayControls').hidden = !expanded;
});
$('#fleetDetails').addEventListener('change', (event) => {
  $('#summaryRows').classList.toggle('show-details', event.target.checked);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const menu = $('.layer-menu');
    if (menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  }
});
document.addEventListener('click', (event) => {
  const menu = $('.layer-menu');
  if (!menu.contains(event.target)) menu.open = false;
});

async function boot() {
  render(emptyData);
  // Unknown counts must not look like a successfully observed empty warehouse.
  $('#metrics').querySelectorAll('.metric strong').forEach((value) => { value.textContent = '—'; });
  $('#metrics').querySelectorAll('.metric small').forEach((label) => { label.textContent = 'Waiting for traffic data'; });
  $('#fleetCount').textContent = '—';

  try {
    const mapInfo = await getMap();
    await Promise.all([map.load(mapInfo), taskMap.load(mapInfo)]);
    redraw();
  } catch {
    await Promise.all([
      map.load(map.info, '/fallback-map.png'),
      taskMap.load(taskMap.info, '/fallback-map.png'),
    ]);
    map.draw(emptyData, options());
    setConnection(false, 'Map preview · ROS monitor offline');
  }

  await refreshBounds(true);
  await refreshTaskStatus();
  goLive();
}

boot();
setInterval(playbackStep, 400);

let refreshCycle = 0;
setInterval(() => {
  if (state.auto) goLive();
  refreshTaskStatus();
  refreshCycle += 1;
  if (refreshCycle % 5 === 0) refreshBounds();
}, 2000);
