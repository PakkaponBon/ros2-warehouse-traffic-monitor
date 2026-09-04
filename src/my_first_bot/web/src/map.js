const COLORS = ['#8d6bff', '#00a7d8', '#ef7d50', '#21a47b', '#d45fc0', '#789637', '#d99924', '#4a75dc', '#d35c69'];

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
    this.tooltip = document.querySelector('#mapTooltip');
    canvas.addEventListener('mousemove', (event) => this.showTooltip(event));
    canvas.addEventListener('mouseleave', () => { this.tooltip.style.display = 'none'; });
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

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#e9eef0';
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
    ctx.strokeStyle = '#aebbc499';
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
    ctx.strokeStyle = '#43596a'; ctx.lineWidth = 7; ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  }

  drawHeat(data, filter, metric = 'count') {
    if (!data.density.length) return;
    const counts = data.density.map((value) => Number(value[metric] || 0)).sort((a, b) => a - b);
    const minimum = counts[Math.floor((counts.length - 1) * filter)] || 0;
    const cap = Math.max(minimum + 1, counts[Math.floor((counts.length - 1) * 0.95)] || 1);
    const low = Math.log1p(minimum); const span = Math.max(0.001, Math.log1p(cap) - low);
    data.density.forEach((value) => {
      const metricValue = Number(value[metric] || 0);
      if (metricValue < minimum) return;
      const amount = Math.max(0, Math.min(1, (Math.log1p(metricValue) - low) / span));
      const radius = 12 + 16 * amount;
      const { x, y } = this.project(value.x, value.y);
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      const hue = Math.round(210 * (1 - amount));
      gradient.addColorStop(0, `hsla(${hue}, 90%, 53%, ${0.15 + 0.4 * amount})`);
      gradient.addColorStop(1, `hsla(${hue}, 90%, 53%, 0)`);
      this.ctx.fillStyle = gradient; this.ctx.beginPath(); this.ctx.arc(x, y, radius, 0, Math.PI * 2); this.ctx.fill();
      const description = metric === 'vehicles'
        ? `${metricValue} unique vehicle(s)`
        : metric === 'slow_samples'
          ? `${metricValue} slow sample(s)`
          : `${metricValue} occupancy sample(s)`;
      this.hits.push({
        x,
        y,
        radius,
        label: `${description} · average ${Number(value.average_speed || 0).toFixed(2)} m/s`,
      });
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
        this.ctx.strokeStyle = '#071521cc';
        this.ctx.lineWidth = 8;
        this.ctx.stroke();
        this.traceSegment(segment);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4.5;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 5;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.drawPathArrows(segment, color);
      }
      this.ctx.restore();
    });
  }

  circle(value, radius, color, label, stroke) {
    const { x, y } = this.project(value.x, value.y);
    this.ctx.fillStyle = color; this.ctx.beginPath(); this.ctx.arc(x, y, radius, 0, Math.PI * 2); this.ctx.fill();
    if (stroke) { this.ctx.strokeStyle = stroke; this.ctx.lineWidth = 2; this.ctx.stroke(); }
    this.hits.push({ x, y, radius: Math.max(radius, 12), label });
  }

  drawVehicle(vehicle) {
    const { x, y } = this.project(vehicle.x, vehicle.y);
    const state = vehicle.motion_state || (vehicle.speed < 0.05 ? 'unknown' : 'moving');
    const stateColors = {
      moving: '#25d0ae',
      turning: '#3da4ff',
      waiting_vehicle: '#ffbf47',
      blocked_obstacle: '#ff6856',
      stalled: '#ff5263',
      stuck: '#ff5263',
      idle: '#91a7b9',
      planning: '#91a7b9',
      localizing: '#91a7b9',
      sensor_wait: '#91a7b9',
      unknown: '#91a7b9',
    };
    const color = vehicle.vehicle_id === 'my_robot'
      ? '#ffffff'
      : stateColors[state] || stateColors.unknown;
    this.ctx.shadowColor = '#07111a'; this.ctx.shadowBlur = 8; this.ctx.fillStyle = color;
    this.ctx.beginPath(); this.ctx.arc(x, y, 9, 0, Math.PI * 2); this.ctx.fill(); this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = '#132638'; this.ctx.lineWidth = 2; this.ctx.stroke();
    const label = vehicle.vehicle_id.replace('vehicle_', 'V'); this.ctx.font = 'bold 11px system-ui';
    const labelWidth = this.ctx.measureText(label).width + 10; this.ctx.fillStyle = '#0b1825e8';
    this.ctx.fillRect(x - labelWidth / 2, y - 29, labelWidth, 16); this.ctx.fillStyle = '#f2f7fa';
    this.ctx.textAlign = 'center'; this.ctx.fillText(label, x, y - 17); this.ctx.textAlign = 'start';
    this.hits.push({ x, y, radius: 13, label: `${vehicle.vehicle_id} · ${state.replaceAll('_', ' ')} · ${vehicle.speed.toFixed(2)} m/s · x ${vehicle.x.toFixed(2)}, y ${vehicle.y.toFixed(2)}` });
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
        label: `UWB tag ${tag.id} · ${tag.enabled === false ? 'disabled' : 'enabled'} · battery ${Number(tag.battery_pct ?? 100).toFixed(0)}% · x ${Number(tag.x).toFixed(1)}, y ${Number(tag.y).toFixed(1)}, z ${Number(tag.z).toFixed(1)} m`,
      });
    });
  }

  draw(data, options) {
    this.lastData = data;
    this.lastOptions = options;
    this.hits = []; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.drawGrid();
    if (options.heat) this.drawHeat(data, options.heatFilter, options.heatMetric);
    if (options.paths) this.drawPaths(data);
    if (options.stuck) data.stuck.slice(0, 12).forEach((value) => this.circle(value, 8 + Math.min(10, Math.log2(value.events + 1) * 2), '#ffbf47cc', `${value.events} stuck event(s) · ${Math.round(value.duration)} seconds`, '#fff0bd'));
    if (options.congestion) data.congestion.slice(0, 12).forEach((value) => this.circle(value, 10 + Math.min(14, value.max_vehicles * 2), '#ff5263b8', `${value.events} congestion event(s) · up to ${value.max_vehicles} vehicles`, '#ff9ba5'));
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
  }

  focusAt(value) {
    this.focused = value;
    this.focusedVehicle = null;
    if (this.lastData && this.lastOptions) this.draw(this.lastData, this.lastOptions);
  }

  focusVehicle(vehicleId) {
    this.focused = null;
    this.focusedVehicle = vehicleId;
    if (this.lastData && this.lastOptions) this.draw(this.lastData, this.lastOptions);
  }

  drawFocus() {
    if (!this.focused || !Number.isFinite(Number(this.focused.x)) || !Number.isFinite(Number(this.focused.y))) return;
    const { x, y } = this.project(Number(this.focused.x), Number(this.focused.y));
    const color = this.focused.type === 'Congestion' ? '#ff5263' : '#ffbf47';
    const label = `${this.focused.type} · ${this.focused.events} event(s)`;
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 14;
    this.ctx.beginPath(); this.ctx.arc(x, y, 20, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath(); this.ctx.moveTo(x - 30, y); this.ctx.lineTo(x + 30, y); this.ctx.moveTo(x, y - 30); this.ctx.lineTo(x, y + 30); this.ctx.stroke();
    this.ctx.font = 'bold 11px system-ui';
    const width = this.ctx.measureText(label).width + 14;
    this.ctx.fillStyle = '#07111aeb';
    this.ctx.fillRect(x - width / 2, y + 27, width, 18);
    this.ctx.fillStyle = '#f2f7fa';
    this.ctx.textAlign = 'center'; this.ctx.fillText(label, x, y + 40); this.ctx.textAlign = 'start';
    this.ctx.restore();
    this.hits.push({ x, y, radius: 32, label: `${label} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}` });
  }

  drawVehicleFocus(data) {
    if (!this.focusedVehicle) return;
    const vehicle = (data.latest || []).find((item) => item.vehicle_id === this.focusedVehicle);
    const track = (data.tracks || []).find((item) => item.vehicle_id === this.focusedVehicle);
    const point = vehicle || (track?.points?.length ? { x: track.points.at(-1)[0], y: track.points.at(-1)[1] } : null);
    if (!point) return;
    const { x, y } = this.project(Number(point.x), Number(point.y));
    this.ctx.save();
    this.ctx.strokeStyle = '#b06cff'; this.ctx.lineWidth = 3; this.ctx.shadowColor = '#b06cff'; this.ctx.shadowBlur = 16;
    this.ctx.beginPath(); this.ctx.arc(x, y, 22, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.shadowBlur = 0; this.ctx.font = 'bold 11px system-ui';
    const label = `${this.focusedVehicle} path`;
    const width = this.ctx.measureText(label).width + 14;
    this.ctx.fillStyle = '#07111aeb'; this.ctx.fillRect(x - width / 2, y + 28, width, 18);
    this.ctx.fillStyle = '#f2f7fa'; this.ctx.textAlign = 'center'; this.ctx.fillText(label, x, y + 41); this.ctx.textAlign = 'start';
    this.ctx.restore();
    this.hits.push({ x, y, radius: 34, label: `${label} · x ${Number(point.x).toFixed(2)}, y ${Number(point.y).toFixed(2)}` });
  }

  showTooltip(event) {
    const box = this.canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) * this.canvas.width / box.width;
    const y = (event.clientY - box.top) * this.canvas.height / box.height;
    const hit = this.hits.slice().reverse().find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius);
    if (!hit) { this.tooltip.style.display = 'none'; return; }
    this.tooltip.textContent = hit.label; this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${event.clientX - box.left + 14}px`; this.tooltip.style.top = `${event.clientY - box.top + 14}px`;
  }
}
