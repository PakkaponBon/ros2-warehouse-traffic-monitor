import assert from 'node:assert/strict';
import test from 'node:test';

import { RouteSuggestionMap } from '../src/route-map.js';

function routeMap(rotated) {
  const map = Object.create(RouteSuggestionMap.prototype);
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

test('route map inverse projection preserves normal map coordinates', () => {
  const map = routeMap(false);
  const world = { x: 3, y: 7 };
  const pixel = map.project(world.x, world.y);
  assert.deepEqual(map.unproject(pixel.x, pixel.y), world);
});

test('route map inverse projection preserves rotated map coordinates', () => {
  const map = routeMap(true);
  const world = { x: -4, y: 12 };
  const pixel = map.project(world.x, world.y);
  assert.deepEqual(map.unproject(pixel.x, pixel.y), world);
});
