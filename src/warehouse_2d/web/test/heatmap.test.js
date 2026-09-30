import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHeatScale, heatColor } from '../src/heatmap.js';

const area = (count, x = count) => ({ x, y: 0, count, vehicles: 1, slow_samples: 0 });

test('heat scale excludes zero/missing readings and invalid positions', () => {
  const scale = buildHeatScale([area(0), area(-1), area(10), area(NaN), area(5, NaN)], 'count');
  assert.equal(scale.areas.length, 1);
  assert.equal(scale.min, 10);
  assert.equal(scale.max, 10);
  assert.equal(scale.fraction(10), .5);
  assert.equal(buildHeatScale([area(10)], 'slow_samples').visible.length, 0);
});

test('filter changes coverage without changing the color assigned to a reading', () => {
  const data = [1, 5, 15, 60, 200].map((value) => area(value));
  const all = buildHeatScale(data, 'count');
  const filtered = buildHeatScale(data, 'count', .8);
  assert.equal(all.visible.length, 5);
  assert.equal(filtered.visible.length, 1);
  assert.equal(filtered.threshold, 200);
  assert.equal(filtered.fraction(60), all.fraction(60));
  assert.equal(filtered.min, all.min);
  assert.equal(filtered.max, all.max);
  assert.deepEqual(data.map((item) => item.count), [1, 5, 15, 60, 200]);
});

test('equal-valued areas remain visible and tied thresholds retain all matches', () => {
  const scale = buildHeatScale([area(7, 1), area(7, 2), area(7, 3)], 'count', .8);
  assert.equal(scale.visible.length, 3);
  assert.equal(scale.fraction(7), .5);
  assert.deepEqual(buildHeatScale().visible, []);
});

test('color endpoints match the legend and metrics use independent scales', () => {
  assert.deepEqual(heatColor(0), [59, 130, 196]);
  assert.deepEqual(heatColor(1), [219, 81, 65]);
  const scale = buildHeatScale([area(50), { ...area(2), vehicles: 4 }], 'vehicles');
  assert.equal(scale.max, 4);
  assert.equal(scale.areas[0].count, 2);
});
