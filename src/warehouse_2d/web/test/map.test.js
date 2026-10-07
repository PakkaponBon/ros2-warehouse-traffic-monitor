import assert from 'node:assert/strict';
import test from 'node:test';

import { heatTooltipLabel, MapViewport, WarehouseMap } from '../src/map.js';

function mapProjection(rotated) {
  const map = Object.create(WarehouseMap.prototype);
  map.info = {
    origin: [-10, -20],
    resolution: 1,
    width: 20,
    height: 40,
  };
  map.canvas = { width: rotated ? 800 : 400, height: 400 };
  map.rotated = rotated;
  return map;
}

test('portrait landscape projection preserves ROS map corners', () => {
  const map = mapProjection(true);
  assert.deepEqual(map.project(-10, -20), { x: 0, y: 0 });
  assert.deepEqual(map.project(10, 20), { x: 800, y: 400 });
});

test('normal projection keeps map north at the top', () => {
  const map = mapProjection(false);
  assert.deepEqual(map.project(-10, -20), { x: 0, y: 400 });
  assert.deepEqual(map.project(10, 20), { x: 400, y: 0 });
});

test('zoom keeps the map point under the pointer fixed and respects limits', () => {
  const camera = new MapViewport({ width: 800, height: 400 });
  const before = camera.unproject(250, 120);
  camera.zoom(2, 250, 120);
  assert.deepEqual(camera.unproject(250, 120), before);
  camera.zoom(100);
  assert.equal(camera.scale, 5);
  camera.zoom(.001);
  assert.equal(camera.scale, 1);
  assert.equal(Math.abs(camera.x), 0);
  assert.equal(Math.abs(camera.y), 0);
});

test('panning stays inside the warehouse and fit restores the whole map', () => {
  const camera = new MapViewport({ width: 800, height: 400 });
  camera.zoom(2);
  camera.pan(-10000, 10000);
  assert.equal(camera.x, -800);
  assert.equal(camera.y, 0);
  camera.reset();
  assert.deepEqual(camera.unproject(800, 400), { x: 800, y: 400 });
  assert.equal(camera.scale, 1);
});

test('vehicle and heat hit testing remains correct after zoom, pan, and CSS scaling', () => {
  for (const rotated of [true, false]) {
    const map = mapProjection(rotated);
    map.canvas.getBoundingClientRect = () => ({ left: 100, top: 60, width: 400, height: 200 });
    map.viewport = new MapViewport(map.canvas);
    const point = map.project(0, 0);
    map.viewport.zoom(2);
    map.viewport.pan(-20, 30);
    map.hits = [
      { ...point, radius: 20, priority: 0, heatValue: { count: 4 } },
      { ...point, radius: 15, priority: 3, vehicleId: 'vehicle_1' },
    ];
    const event = {
      clientX: 100 + (point.x * map.viewport.scale + map.viewport.x) * 400 / map.canvas.width,
      clientY: 60 + (point.y * map.viewport.scale + map.viewport.y) * 200 / map.canvas.height,
    };
    assert.equal(map.hitAt(event).vehicleId, 'vehicle_1');
    assert.deepEqual(map.hitAt(event, true).heatValue, { count: 4 });
    assert.equal(map.hitAt({ clientX: -1000, clientY: -1000 }), undefined);
  }
});

test('normal downsampled movement remains one continuous path', () => {
  const map = mapProjection(false);
  const segments = map.trackSegments([
    [0, 0, 10],
    [1.8, 0, 11],
    [3.8, 0, 12],
  ]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].length, 3);
});

test('teleport or localization jump starts a separate path segment', () => {
  const map = mapProjection(false);
  const segments = map.trackSegments([
    [0, 0, 10],
    [1, 0, 11],
    [20, 20, 12],
    [21, 20, 13],
  ]);
  assert.equal(segments.length, 2);
  assert.deepEqual(segments.map((segment) => segment.length), [2, 2]);
});

test('heat hover identifies delayed and confirmed-issue vehicles rather than all visitors', () => {
  const label = heatTooltipLabel({
    x: 4.25, y: -2.75, count: 90, average_speed: 0.24,
    time_details: {
      peaks: {
        count: { start: 100, end: 160, count: 30, slow_samples: 0,
          vehicle_ids: ['vehicle_2', 'vehicle_5'] },
        slow_samples: { start: 300, end: 360, slow_samples: 12,
          slow_vehicle_states: [{ vehicle_id: 'vehicle_5', states: ['waiting_vehicle'] }] },
      },
      stuck: { events: 1, vehicle_ids: ['vehicle_5'], latest: { start: 315, end: 355 } },
      congestion: { events: 1, vehicle_ids: ['vehicle_5', 'vehicle_8'],
        latest: { start: 325, end: 350 } },
    },
  }, 'count');

  assert.match(label, /90 position readings \(not seconds\)/);
  assert.match(label, /Worst delay:/);
  assert.match(label, /Slow \/ blocked: vehicle_5 \(waiting vehicle\)/);
  assert.match(label, /Confirmed stuck: 1 event\(s\) · vehicle_5/);
  assert.match(label, /Confirmed congestion nearby: 1 event\(s\) · vehicle_5, vehicle_8/);
  assert.doesNotMatch(label, /Slow \/ blocked: vehicle_2/);
});

test('heat hover does not call ordinary vehicle visits a traffic problem', () => {
  const label = heatTooltipLabel({ x: 1, y: 2, count: 10, time_details: {
    peaks: { slow_samples: { slow_samples: 0 } },
    stuck: { events: 0 }, congestion: { events: 0 },
  } });
  assert.match(label, /No recorded delay or confirmed issue/);
});

test('heat view hover and click prefer the heat area over an overlapping vehicle', () => {
  const map = mapProjection(false);
  map.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
  map.viewport = new MapViewport(map.canvas);
  const point = map.project(0, 0);
  map.hits = [
    { ...point, radius: 20, priority: 0, heatValue: { x: 0, y: 0 }, heatMetric: 'slow_samples', label: 'Heat area' },
    { ...point, radius: 15, priority: 3, vehicleId: 'vehicle_1', label: 'Vehicle' },
  ];
  map.lastOptions = { heat: true, stuck: false, congestion: false };
  map.tooltip = { style: {}, textContent: '' };
  map.canvas.parentElement = { getBoundingClientRect: () => ({ left: 0, top: 0 }),
    clientWidth: 400, clientHeight: 400 };
  const calls = [];
  map.onHeatSelect = () => calls.push('heat');
  map.onVehicleSelect = () => calls.push('vehicle');
  const event = { clientX: point.x, clientY: point.y };
  map.showTooltip(event);
  assert.equal(map.tooltip.textContent, 'Heat area');
  map.selectItem(event);
  assert.deepEqual(calls, ['heat']);
});
