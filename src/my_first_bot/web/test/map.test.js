import assert from 'node:assert/strict';
import test from 'node:test';

import { heatTooltipLabel, WarehouseMap } from '../src/map.js';

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

test('heat tooltip gives a concise peak summary and points to click details', () => {
  const label = heatTooltipLabel({
    x: 4.25,
    y: -2.75,
    count: 90,
    vehicles: 3,
    average_speed: 0.24,
    slow_samples: 36,
    time_details: {
      peaks: {
        count: {
          start: 100,
          end: 400,
          count: 30,
          vehicles: 2,
          slow_samples: 12,
          vehicle_ids: ['vehicle_2', 'vehicle_5'],
          slow_vehicle_ids: ['vehicle_5'],
          slow_vehicle_states: [
            { vehicle_id: 'vehicle_5', states: ['waiting_vehicle'] },
          ],
        },
      },
      stuck: {
        events: 2,
        vehicles: 1,
        peak: { start: 100, end: 400 },
      },
    },
  }, 'count');

  assert.match(label, /Area x 4\.3, y -2\.8/);
  assert.match(label, /90 position samples · average speed 0\.24 m\/s/);
  assert.match(label, /Busiest:/);
  assert.match(label, /Vehicles: vehicle_2, vehicle_5/);
  assert.match(label, /Click for full details/);
  assert.doesNotMatch(label, /Slow\/problem:/);
  assert.doesNotMatch(label, /Confirmed stuck:/);
});
