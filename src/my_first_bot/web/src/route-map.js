export class RouteSuggestionMap {
  constructor(canvas, tooltip) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tooltip = tooltip;
    this.info = { origin: [-10, -10], resolution: 1, width: 20, height: 20 };
    this.image = null;
    this.rotated = false;
    this.route = null;
    this.destinationHandler = null;
    canvas.addEventListener('click', (event) => {
      if (this.destinationHandler) this.destinationHandler(this.eventToWorld(event));
    });
    canvas.addEventListener('mousemove', (event) => this.showCoordinates(event));
    canvas.addEventListener('mouseleave', () => { this.tooltip.style.display = 'none'; });
  }

  width() { return this.info.width * this.info.resolution; }

  height() { return this.info.height * this.info.resolution; }

  project(x, y) {
    const mapX = (x - this.info.origin[0]) / this.width();
    const mapY = (y - this.info.origin[1]) / this.height();
    if (this.rotated) {
      return { x: mapY * this.canvas.width, y: mapX * this.canvas.height };
    }
    return { x: mapX * this.canvas.width, y: (1 - mapY) * this.canvas.height };
  }

  unproject(x, y) {
    if (this.rotated) {
      return {
        x: this.info.origin[0] + (y / this.canvas.height) * this.width(),
        y: this.info.origin[1] + (x / this.canvas.width) * this.height(),
      };
    }
    return {
      x: this.info.origin[0] + (x / this.canvas.width) * this.width(),
      y: this.info.origin[1] + (1 - y / this.canvas.height) * this.height(),
    };
  }

  eventToWorld(event) {
    const box = this.canvas.getBoundingClientRect();
    return this.unproject(
      (event.clientX - box.left) * this.canvas.width / box.width,
      (event.clientY - box.top) * this.canvas.height / box.height,
    );
  }

  async load(info, source = '/map.png') {
    this.info = info;
    this.rotated = this.height() > this.width() * 1.1;
    this.canvas.width = this.rotated ? 1200 : 1000;
    const ratio = this.rotated
      ? this.width() / this.height()
      : this.height() / this.width();
    this.canvas.height = Math.max(1, Math.round(this.canvas.width * ratio));
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { this.image = image; this.draw(); resolve(); };
      image.onerror = () => { this.draw(); resolve(); };
      image.src = `${source}?${Date.now()}`;
    });
  }

  onDestination(handler) {
    this.destinationHandler = handler;
  }

  setRoute(route) {
    this.route = route;
    this.draw();
  }

  drawBase() {
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
    ctx.fillStyle = '#ffffff12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#43596a';
    ctx.lineWidth = 7;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  }

  drawPolyline(points, color, width, dashed = false) {
    if (!points || points.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dashed ? [11, 8] : []);
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      const point = this.project(x, y);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  drawMarker(position, color, label) {
    if (!position) return;
    const point = this.project(position.x, position.y);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#07111d';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = 'bold 12px system-ui';
    ctx.fillStyle = '#07111ddd';
    ctx.fillRect(point.x + 12, point.y - 13, ctx.measureText(label).width + 10, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, point.x + 17, point.y);
    ctx.restore();
  }

  draw() {
    this.drawBase();
    if (!this.route) return;
    const ctx = this.ctx;
    for (const cell of this.route.risk_cells || []) {
      const point = this.project(cell.x, cell.y);
      const radius = 4 + 8 * cell.risk;
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0, point.x, point.y, radius,
      );
      gradient.addColorStop(0, `rgba(255, 82, 99, ${0.12 + cell.risk * 0.48})`);
      gradient.addColorStop(1, 'rgba(255, 82, 99, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawPolyline(this.route.baseline.points, '#70869a', 4, true);
    this.drawPolyline(this.route.suggested.points, '#25d0ae', 6);
    this.drawMarker(this.route.start, '#3da4ff', 'START');
    this.drawMarker(this.route.destination, '#b06cff', 'GOAL');
  }

  showCoordinates(event) {
    const box = this.canvas.getBoundingClientRect();
    const point = this.eventToWorld(event);
    this.tooltip.textContent = `Set destination · x ${point.x.toFixed(2)}, y ${point.y.toFixed(2)}`;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${event.clientX - box.left + 14}px`;
    this.tooltip.style.top = `${event.clientY - box.top + 14}px`;
  }
}
