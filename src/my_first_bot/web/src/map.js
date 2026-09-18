import { buildHeatScale, heatColor } from './heatmap.js';

const COLORS = ['#8d6bff', '#00a7d8', '#ef7d50', '#21a47b', '#d45fc0', '#789637', '#d99924', '#4a75dc', '#d35c69'];

function formatTimeWindow(start, end) {
  if (![Number(start), Number(end)].every(Number.isFinite)) return 'time unavailable';
  const first = new Date(Number(start) * 1000);
  const last = new Date(Number(end) * 1000);
  const sameDay = first.toLocaleDateString() === last.toLocaleDateString();
  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  if (sameDay) {
    return `${first.toLocaleDateString()} ${first.toLocaleTimeString([], timeOptions)}–${last.toLocaleTimeString([], timeOptions)}`;
  }
  return `${first.toLocaleString([], timeOptions)}–${last.toLocaleString([], timeOptions)}`;
}

export function heatTooltipLabel(value, metric = 'count') {
  const metricValue = Number(value[metric] || 0);
  const description = metric === 'vehicles'
    ? `${metricValue} unique vehicles`
    : metric === 'slow_samples'
      ? `${metricValue} slow samples`
      : `${metricValue} position samples`;
  const lines = [
    `Area x ${Number(value.x).toFixed(1)}, y ${Number(value.y).toFixed(1)}`,
    `${description} · average speed ${Number(value.average_speed || 0).toFixed(2)} m/s`,
  ];
  const peak = value.time_details?.peaks?.[metric];
  if (peak) {
    lines.push(`Busiest: ${formatTimeWindow(peak.start, peak.end)}`);
    if (peak.vehicle_ids?.length) lines.push(`Vehicles: ${peak.vehicle_ids.join(', ')}`);
  }
  lines.push('Click for full details');
  return lines.join('\n');
}

// Canvas-space camera. World/ROS projection remains independent of navigation.
export class MapViewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.scale = 1;
    this.x = 0;
    this.y = 0;
  }

  unproject(x, y) {
    return { x: (x - this.x) / this.scale, y: (y - this.y) / this.scale };
  }

  clamp() {
    this.x = Math.min(0, Math.max(this.canvas.width * (1 - this.scale), this.x));
    this.y = Math.min(0, Math.max(this.canvas.height * (1 - this.scale), this.y));
  }

  zoom(factor, x = this.canvas.width / 2, y = this.canvas.height / 2) {
    const anchor = this.unproject(x, y);
    this.scale = Math.min(5, Math.max(1, this.scale * factor));
    this.x = x - anchor.x * this.scale;
    this.y = y - anchor.y * this.scale;
    this.clamp();
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  reset() {
    this.scale = 1;
    this.x = 0;
    this.y = 0;
  }
}

export class WarehouseMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.info = { origin: [-18.6, -26.3], resolution: 0.05, width: 607, height: 1004 };
    this.image = null;
    this.hits = [];
    this.focused = null;
    this.focusedVehicle = null;
    this.lastData = null;
    this.lastOptions = null;
    this.rotated = false;
    this.onHeatSelect = null;
    this.onVehicleSelect = null;
    this.onEventSelect = null;
    this.onViewportChange = null;
    this.viewport = new MapViewport(canvas);
    this.drag = null;
    this.suppressClick = false;
    this.tooltip = document.querySelector('#mapTooltip');
    canvas.addEventListener('mousemove', (event) => this.showTooltip(event));
    canvas.addEventListener('click', (event) => this.selectItem(event));
    canvas.addEventListener('mouseleave', () => { this.tooltip.style.display = 'none'; });
    canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      this.suppressClick = false;
      if (this.viewport.scale === 1) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      this.suppressClick = false;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      this.drag.moved = true;
      const box = canvas.getBoundingClientRect();
      this.viewport.pan(dx * canvas.width / box.width, dy * canvas.height / box.height);
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      this.tooltip.style.display = 'none';
      this.refreshView();
    });
    const finishDrag = (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      this.suppressClick = this.drag.moved;
      this.drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('lostpointercapture', finishDrag);
    canvas.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      this.zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15,
        (event.clientX - box.left) * canvas.width / box.width,
        (event.clientY - box.top) * canvas.height / box.height);
    }, { passive: false });
    canvas.addEventListener('keydown', (event) => {
      if (event.key === '+' || event.key === '=') this.zoomBy(1.3);
      else if (event.key === '-') this.zoomBy(1 / 1.3);
      else if (event.key === '0') this.resetView();
      else if (event.key.startsWith('Arrow') && this.viewport.scale > 1) {
        const step = canvas.width * .08;
        this.viewport.pan(event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0,
          event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0);
        this.refreshView();
      } else return;
      event.preventDefault();
    });
    this.resizeObserver = new ResizeObserver(() => {
      if (canvas.getBoundingClientRect().width) this.refreshView();
    });
    this.resizeObserver.observe(canvas);

  }

  async load(info, source = '/map.png') {
    this.info = info;
    // ROS map coordinates remain unchanged. Portrait maps are only rotated in
    // the browser so a warehouse fills the landscape dashboard.
    this.rotated = this.height() > this.width() * 1.1;
    this.canvas.width = this.rotated ? 1600 : 1200;
    const displayRatio = this.rotated
      ? this.width() / this.height()
      : this.height() / this.width();
    this.canvas.height = Math.max(1, Math.round(this.canvas.width * displayRatio));
    this.viewport.reset();
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { this.image = image; resolve(); };
      image.onerror = () => resolve();
      image.src = `${source}?${Date.now()}`;
    });
  }

  width() { return this.info.width * this.info.resolution; }
  height() { return this.info.height * this.info.resolution; }

  project(x, y) {
    const mapX = (x - this.info.origin[0]) / this.width();
    const mapY = (y - this.info.origin[1]) / this.height();
    if (this.rotated) {
      return {
        x: mapY * this.canvas.width,
        y: mapX * this.canvas.height,
      };
    }
    return {
      x: mapX * this.canvas.width,
      y: (1 - mapY) * this.canvas.height,
    };
  }

  // Keep markers and labels readable in CSS pixels at every viewport size/zoom.
  markerUnit() {
    const width = this.canvas.getBoundingClientRect().width || this.canvas.width;
    return this.canvas.width / width / this.viewport.scale;
  }

  refreshView() {
    this.tooltip.style.display = 'none';
    this.canvas.classList.toggle('is-zoomed', this.viewport.scale > 1);
    if (this.lastData && this.lastOptions) this.draw(this.lastData, this.lastOptions);
    this.onViewportChange?.(this.viewport.scale);
  }

  zoomBy(factor, x, y) {
    this.viewport.zoom(factor, x, y);
    this.refreshView();
  }

  resetView() {
    this.viewport.reset();
    this.refreshView();
  }

  revealPoint(point) {
    if (!point || this.viewport.scale === 1) return;
    const projected = this.project(Number(point.x), Number(point.y));
    const screenX = projected.x * this.viewport.scale + this.viewport.x;
    const screenY = projected.y * this.viewport.scale + this.viewport.y;
    const margin = this.canvas.width * .06;
    if (screenX >= margin && screenX <= this.canvas.width - margin
        && screenY >= margin && screenY <= this.canvas.height - margin) return;
    this.viewport.x = this.canvas.width / 2 - projected.x * this.viewport.scale;
    this.viewport.y = this.canvas.height / 2 - projected.y * this.viewport.scale;
    this.viewport.clamp();
  }

  clearSelection() {
    this.focused = null;
    this.focusedVehicle = null;
    this.refreshView();
  }

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#f1f5f3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.image) {
      if (this.rotated) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(this.image, 0, 0, canvas.height, canvas.width);
        ctx.restore();
      } else {
        ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      }
    }
    ctx.fillStyle = '#ffffff18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.lastOptions?.grid) return;
    ctx.strokeStyle = '#b8c7bf66';
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui';
    ctx.fillStyle = '#536875';
    const step = this.width() > 35 ? 5 : 4;
    const x0 = Math.ceil(this.info.origin[0] / step) * step;
    const x1 = this.info.origin[0] + this.width();
    for (let x = x0; x <= x1; x += step) {
      const start = this.project(x, this.info.origin[1]);
      const end = this.project(x, this.info.origin[1] + this.height());
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      if (this.rotated) ctx.fillText(`${x.toFixed(0)} m`, 7, start.y - 4);
      else ctx.fillText(`${x.toFixed(0)} m`, start.x + 4, canvas.height - 8);
    }
    const y0 = Math.ceil(this.info.origin[1] / step) * step;
    const y1 = this.info.origin[1] + this.height();
    for (let y = y0; y <= y1; y += step) {
      const start = this.project(this.info.origin[0], y);
      const end = this.project(this.info.origin[0] + this.width(), y);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      if (this.rotated) ctx.fillText(`${y.toFixed(0)} m`, start.x + 4, canvas.height - 8);
      else ctx.fillText(`${y.toFixed(0)} m`, 7, start.y - 4);
    }

  }

  drawHeat(data, filter, metric = 'count', opacity = .65) {
    if (this.heatCache?.density !== data.density || this.heatCache.metric !== metric || this.heatCache.filter !== filter) {
      this.heatScale = buildHeatScale(data.density, metric, filter);
      this.heatCache = { density: data.density, metric, filter };
    }
    const alpha = Math.max(.2, Math.min(.9, opacity));
    // Paint lower values first; retain the same color scale when low values are hidden.
    [...this.heatScale.visible].reverse().forEach((value) => {
      const amount = this.heatScale.fraction(Number(value[metric]));
      const radius = 16 + 12 * amount;
      const { x, y } = this.project(value.x, value.y);
      const rgb = heatColor(amount).join(', ');
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
      gradient.addColorStop(.4, `rgba(${rgb}, ${alpha * .75})`);
      gradient.addColorStop(1, `rgba(${rgb}, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath(); this.ctx.arc(x, y, radius, 0, Math.PI * 2); this.ctx.fill();
      this.hits.push({ x, y, radius, priority: 0,
        label: heatTooltipLabel(value, metric), heatValue: value, heatMetric: metric });
    });
  }

  trackColor(id) {
    let value = 0; for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
    return COLORS[value % COLORS.length];
  }

  trackSegments(points) {
    const segments = [];
    let segment = [];
    let previous = null;
    for (const point of points) {
      const current = {
        x: Number(point[0]),
        y: Number(point[1]),
        time: Number(point[2]),
      };
      if (![current.x, current.y, current.time].every(Number.isFinite)) {
        if (segment.length > 1) segments.push(segment);
        segment = [];
        previous = null;
        continue;
      }
      if (previous) {
        const elapsed = current.time - previous.time;
        const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
        // Allow normal fast movement and history downsampling. Long telemetry
        // gaps and impossible jumps still start a new segment so a lost AMCL
        // fix or Gazebo teleport is never presented as real travel.
        const plausibleDistance = Math.max(2.5, elapsed * 2.2 + 0.75);
        if (elapsed <= 0 || elapsed > 12 || distance > plausibleDistance) {
          if (segment.length > 1) segments.push(segment);
          segment = [];
        }
      }
      segment.push(current);
      previous = current;
    }
    if (segment.length > 1) segments.push(segment);
    return segments;
  }

  traceSegment(segment) {
    this.ctx.beginPath();
    segment.forEach((point, index) => {
      const projected = this.project(point.x, point.y);
      if (index === 0) this.ctx.moveTo(projected.x, projected.y);
      else this.ctx.lineTo(projected.x, projected.y);
    });
  }

  drawPathArrows(segment, color) {
    let distanceSinceArrow = 0;
    for (let index = 1; index < segment.length; index += 1) {
      const first = this.project(segment[index - 1].x, segment[index - 1].y);
      const second = this.project(segment[index].x, segment[index].y);
      distanceSinceArrow += Math.hypot(second.x - first.x, second.y - first.y);
      if (distanceSinceArrow < 90) continue;
      distanceSinceArrow = 0;
      const angle = Math.atan2(second.y - first.y, second.x - first.x);
      this.ctx.save();
      this.ctx.translate(second.x, second.y);
      this.ctx.rotate(angle);
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = '#071521';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(8, 0);
      this.ctx.lineTo(-5, -5);
      this.ctx.lineTo(-2, 0);
      this.ctx.lineTo(-5, 5);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawPaths(data) {
    if (!this.focusedVehicle) return;
    (data.tracks || []).forEach((track) => {
      if (track.points.length < 2) return;
      if (this.focusedVehicle && track.vehicle_id !== this.focusedVehicle) return;
      const color = this.trackColor(track.vehicle_id);
      const segments = this.trackSegments(track.points);
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      for (const segment of segments) {
        // Dark outline separates the selected path from dense heat overlays.
        this.traceSegment(segment);
        this.ctx.strokeStyle = '#ffffffdd';
        this.ctx.lineWidth = 5 * this.markerUnit();
        this.ctx.stroke();
        this.traceSegment(segment);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2.5 * this.markerUnit();
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 0;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.drawPathArrows(segment, color);
      }
      this.ctx.restore();
    });
  }

  circle(value, radius, color, label, stroke, type) {
    radius *= this.markerUnit() * .7;
    const { x, y } = this.project(value.x, value.y);
    this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(x, y, radius, 0, Math.PI * 2); this.ctx.fill();
    if (stroke) { this.ctx.strokeStyle = stroke; this.ctx.lineWidth = 2; this.ctx.stroke(); }
    this.hits.push({ x, y, radius: Math.max(radius, 12), priority: 2, label, eventValue: value, eventType: type });
  }

  drawVehicle(vehicle) {
    const { x, y } = this.project(vehicle.x, vehicle.y);
    const state = vehicle.motion_state || (vehicle.speed < 0.05 ? 'unknown' : 'moving');
    const stateColors = {
      moving: '#208366',
      side_task: '#208366',
      returning_route: '#208366',
      side_work: '#c28c30',
      task_planning: '#91a7b9',
      turning: '#3c84b5',
      waiting_vehicle: '#c28c30',
      blocked_obstacle: '#ff6856',
      stalled: '#ff5263',
      stuck: '#cb5b51',
      idle: '#91a7b9',
      planning: '#91a7b9',
      localizing: '#91a7b9',
      sensor_wait: '#91a7b9',
      unknown: '#91a7b9',
    };
    const color = stateColors[state] || stateColors.unknown;
    const unit = this.markerUnit();
    const selected = vehicle.vehicle_id === this.focusedVehicle;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(unit, unit);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = '#23413630'; this.ctx.shadowBlur = 5;
    this.ctx.beginPath(); this.ctx.arc(0, 0, selected ? 10 : 8, 0, Math.PI * 2); this.ctx.fill();
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = color;
    this.ctx.beginPath(); this.ctx.arc(0, 0, selected ? 6.5 : 5.5, 0, Math.PI * 2); this.ctx.fill();
    if (this.lastOptions?.labels !== false || selected) {
      const label = vehicle.vehicle_id === 'my_robot' ? 'AMR' : vehicle.vehicle_id.replace('vehicle_', 'V').replace('forklift_', 'F');
      this.ctx.font = '600 11px system-ui';
      const width = this.ctx.measureText(label).width + 14;
      this.ctx.fillStyle = selected ? '#176f56' : '#fffffff2';
      this.ctx.beginPath(); this.ctx.roundRect(-width / 2, -30, width, 19, 5); this.ctx.fill();
      this.ctx.fillStyle = selected ? '#ffffff' : '#334d41';
      this.ctx.textAlign = 'center'; this.ctx.fillText(label, 0, -17);
    }
    this.ctx.restore();
    this.hits.push({ x, y, radius: 15 * unit, priority: 3, vehicleId: vehicle.vehicle_id,
      label: `${vehicle.vehicle_id} · ${state.replaceAll('_', ' ')} · ${vehicle.speed.toFixed(2)} m/s\nClick to see this vehicle’s route` });
  }

  drawUwbTags() {
    (this.info.uwb_tags || []).forEach((tag) => {
      const { x, y } = this.project(Number(tag.x), Number(tag.y));
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(Math.PI / 4);
      this.ctx.globalAlpha = tag.enabled === false ? 0.35 : 1;
      this.ctx.fillStyle = '#f04df2';
      this.ctx.shadowColor = '#f04df2';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(-7, -7, 14, 14);
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#53145f';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-7, -7, 14, 14);
      this.ctx.restore();
      this.ctx.font = 'bold 10px system-ui';
      this.ctx.fillStyle = '#6e187c';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(tag.id, x, y - 13);
      this.ctx.textAlign = 'start';
      this.hits.push({
        x,
        y,
        radius: 14,
        priority: 3,
        label: `UWB tag ${tag.id} · ${tag.enabled === false ? 'disabled' : 'enabled'} · battery ${Number(tag.battery_pct ?? 100).toFixed(0)}% · x ${Number(tag.x).toFixed(1)}, y ${Number(tag.y).toFixed(1)}, z ${Number(tag.z).toFixed(1)} m`,
      });
    });
  }

  draw(data, options) {
    this.lastData = data;
    this.lastOptions = options;
    this.hits = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.viewport.x, this.viewport.y);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);
    this.drawGrid();
    if (options.heat) this.drawHeat(data, options.heatFilter, options.heatMetric, options.heatOpacity);
    if (options.paths) this.drawPaths(data);
    if (options.stuck) data.stuck.slice(0, 12).forEach((value) => this.circle(value, 8 + Math.min(10, Math.log2(value.events + 1) * 2), '#ffbf47cc', `${value.events} stuck event(s) · ${Math.round(value.duration)} seconds`, '#fff0bd', 'Stuck'));
    if (options.congestion) data.congestion.slice(0, 12).forEach((value) => this.circle(value, 10 + Math.min(14, value.max_vehicles * 2), '#ff5263b8', `${value.events} congestion event(s) · up to ${value.max_vehicles} vehicles`, '#ff9ba5', 'Congestion'));
    if (options.vehicles) {
      const visibleVehicles = options.stateFilter === 'all'
        ? data.latest
        : data.latest.filter((vehicle) => {
          const state = vehicle.motion_state || (vehicle.speed < 0.05 ? 'unknown' : 'moving');
          return state === options.stateFilter;
        });
      visibleVehicles.forEach((vehicle) => this.drawVehicle(vehicle));
    }
    // Infrastructure markers stay above heat and traffic overlays so their
    // surveyed positions remain visible even in dense areas.
    if (options.tags) this.drawUwbTags();
    this.drawFocus();
    this.drawVehicleFocus(data);
    this.ctx.restore();
  }

  focusAt(value) {
    this.focused = value;
    this.focusedVehicle = null;
    this.revealPoint(value);
    if (this.lastData && this.lastOptions) this.draw(this.lastData, this.lastOptions);
  }

  focusVehicle(vehicleId) {
    this.focused = null;
    this.focusedVehicle = vehicleId;
    this.revealPoint(this.lastData?.latest?.find((vehicle) => vehicle.vehicle_id === vehicleId));
    if (this.lastData && this.lastOptions) this.draw(this.lastData, this.lastOptions);
  }

  setHeatSelectionHandler(handler) {
    this.onHeatSelect = typeof handler === 'function' ? handler : null;
  }

  drawFocus() {
    if (!this.focused || !Number.isFinite(Number(this.focused.x)) || !Number.isFinite(Number(this.focused.y))) return;
    const { x, y } = this.project(Number(this.focused.x), Number(this.focused.y));
    const color = this.focused.type === 'Congestion' ? '#cb5b51' : this.focused.type === 'Heat area' ? '#3777b0' : '#c28c30';
    const label = this.focused.type === 'Heat area' ? 'Selected heat area' : `${this.focused.type} · ${this.focused.events} event(s)`;
    const unit = this.markerUnit();
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2 * unit;
    this.ctx.beginPath(); this.ctx.arc(x, y, 15 * unit, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.setLineDash([3 * unit, 4 * unit]);
    this.ctx.beginPath(); this.ctx.arc(x, y, 21 * unit, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.restore();
    this.hits.push({ x, y, radius: 22 * unit, priority: 1, label: `${label} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}` });
  }

  drawVehicleFocus(data) {
    if (!this.focusedVehicle) return;
    const vehicle = (data.latest || []).find((item) => item.vehicle_id === this.focusedVehicle);
    const track = (data.tracks || []).find((item) => item.vehicle_id === this.focusedVehicle);
    const point = vehicle || (track?.points?.length ? { x: track.points.at(-1)[0], y: track.points.at(-1)[1] } : null);
    if (!point) return;
    const { x, y } = this.project(Number(point.x), Number(point.y));
    const unit = this.markerUnit();
    this.ctx.save();
    this.ctx.strokeStyle = '#176f56'; this.ctx.lineWidth = 2 * unit;
    this.ctx.beginPath(); this.ctx.arc(x, y, 13 * unit, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.restore();
    this.hits.push({ x, y, radius: 16 * unit, priority: 4, vehicleId: this.focusedVehicle,
      label: `${this.focusedVehicle} · selected route` });
  }

  hitAt(event, heatOnly = false) {
    const box = this.canvas.getBoundingClientRect();
    const screenX = (event.clientX - box.left) * this.canvas.width / box.width;
    const screenY = (event.clientY - box.top) * this.canvas.height / box.height;
    const { x, y } = this.viewport.unproject(screenX, screenY);
    return this.hits
      .filter((item) => !heatOnly || item.heatValue)
      .map((item) => ({ ...item, distance: Math.hypot(item.x - x, item.y - y) }))
      .filter((item) => item.distance <= item.radius)
      .sort((first, second) => (
        Number(second.priority || 0) - Number(first.priority || 0)
        || first.distance - second.distance
      ))[0];
  }

  selectItem(event) {
    if (this.suppressClick) { this.suppressClick = false; return; }
    const hit = this.hitAt(event);
    if (hit?.vehicleId && this.onVehicleSelect) this.onVehicleSelect(hit.vehicleId);
    else if (hit?.eventValue && this.onEventSelect) this.onEventSelect(hit.eventValue, hit.eventType);
    else this.selectHeat(event);
    this.tooltip.style.display = 'none';
  }

  selectHeat(event) {
    const hit = this.hitAt(event, true);
    if (!hit || !this.onHeatSelect) return;
    this.onHeatSelect(hit.heatValue, hit.heatMetric);
    this.tooltip.style.display = 'none';
  }

  showTooltip(event) {
    if (this.drag?.moved) return;
    const hit = this.hitAt(event);
    if (!hit) { this.tooltip.style.display = 'none'; return; }
    this.tooltip.textContent = hit.label; this.tooltip.style.display = 'block';
    const wrapper = this.canvas.parentElement;
    const wrapperBox = wrapper.getBoundingClientRect();
    const preferredLeft = event.clientX - wrapperBox.left + 14;
    const preferredTop = event.clientY - wrapperBox.top + 14;
    const left = Math.max(6, Math.min(preferredLeft, wrapper.clientWidth - this.tooltip.offsetWidth - 6));
    const top = Math.max(6, Math.min(preferredTop, wrapper.clientHeight - this.tooltip.offsetHeight - 6));
    this.tooltip.style.left = `${left}px`; this.tooltip.style.top = `${top}px`;
  }
}
