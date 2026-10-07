import assert from 'node:assert/strict';
import test from 'node:test';

import { describeTrackQuality } from '../src/track-quality.js';

test('route summary distinguishes recording gaps from simulation reference error', () => {
  const summary = describeTrackQuality({
    points: [[0, 0, 100, 0.5], [1, 0, 101, 0.5]],
    quality: {
      max_gap_s: 1,
      path_breaks: 2,
      frames: ['map'],
      simulation_reference: { p95_error_m: 3.81 },
    },
  });
  assert.match(summary, /2 recorded points/);
  assert.match(summary, /largest gap 1\.0 s/);
  assert.match(summary, /2 path breaks/);
  assert.match(summary, /simulator reference p95 error 3\.81 m/);
});

test('route without truth data does not claim measured position accuracy', () => {
  const summary = describeTrackQuality({
    points: [[0, 0, 100, 0.5]],
    quality: { max_gap_s: 0, path_breaks: 0, frames: ['map'], simulation_reference: null },
  });
  assert.doesNotMatch(summary, /reference|error/);
});
