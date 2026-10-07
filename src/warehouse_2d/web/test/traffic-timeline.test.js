import assert from 'node:assert/strict';
import test from 'node:test';

import { describeTrafficBucket, renderTrafficTimeline } from '../src/traffic-timeline.js';

test('traffic chart shows distinct vehicle count, issue markers, and selectable time', () => {
  const root = { innerHTML: '' };
  const bucket = {
    start: 100, end: 160, slow_vehicles: 2,
    slow_vehicle_ids: ['vehicle_1', 'vehicle_2'],
    stuck_events: 1, congestion_events: 1,
    issue_vehicle_ids: ['vehicle_2'],
  };
  renderTrafficTimeline(root, { bucket_seconds: 60, buckets: [bucket] }, 100);
  assert.match(root.innerHTML, /data-traffic-start="100"/);
  assert.match(root.innerHTML, /aria-pressed="true"/);
  assert.match(root.innerHTML, /vehicle_1, vehicle_2/);
  assert.match(root.innerHTML, /traffic-event stuck/);
  assert.match(root.innerHTML, /traffic-event congestion/);
  assert.match(describeTrafficBucket(bucket), /2 vehicles with delay readings/);
  assert.match(root.innerHTML, /bar height is not elapsed time/);
});

test('traffic chart escapes vehicle identifiers in hover text', () => {
  const root = { innerHTML: '' };
  renderTrafficTimeline(root, { bucket_seconds: 60, buckets: [{
    start: 100, end: 160, slow_vehicles: 1,
    slow_vehicle_ids: ['<vehicle&1>'], issue_vehicle_ids: [],
  }] });
  assert.match(root.innerHTML, /&lt;vehicle&amp;1&gt;/);
  assert.doesNotMatch(root.innerHTML, /aria-pressed="true"/);
});

test('zero timestamp is not shown as selected without a click', () => {
  const root = { innerHTML: '' };
  renderTrafficTimeline(root, { bucket_seconds: 60, buckets: [{
    start: 0, end: 60, slow_vehicles: 0,
  }] });
  assert.match(root.innerHTML, /aria-pressed="false"/);
});
