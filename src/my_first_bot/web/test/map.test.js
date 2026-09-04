import assert from 'node:assert/strict';
import test from 'node:test';

import { WarehouseMap } from '../src/map.js';

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
