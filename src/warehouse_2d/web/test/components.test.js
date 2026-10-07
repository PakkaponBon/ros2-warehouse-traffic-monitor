import assert from 'node:assert/strict';
import test from 'node:test';

import { renderHeatAreaSummary, renderLocalization, renderStuckTimeline } from '../src/components.js';

test('selected heat area renders the complete human-readable breakdown', () => {
  const root = { innerHTML: '' };
  renderHeatAreaSummary(root, {
    x: -4.75,
    y: 11.25,
    count: 80,
    average_speed: 0.37,
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
        slow_samples: {
          start: 300, end: 360, slow_samples: 14,
          slow_vehicle_states: [
            { vehicle_id: 'vehicle_5', states: ['waiting_vehicle'] },
          ],
        },
      },
      stuck: {
        events: 2,
        vehicles: 1,
        vehicle_ids: ['vehicle_5'],
        latest: { start: 320, end: 355 },
      },
      congestion: {
        events: 1,
        vehicle_ids: ['vehicle_5', 'vehicle_8'],
        latest: { start: 325, end: 350 },
      },
    },
  }, 'count');

  assert.match(root.innerHTML, /Selected|Map area/);
  assert.match(root.innerHTML, /x -4\.8 m · y 11\.3 m/);
  assert.match(root.innerHTML, /Position samples/);
  assert.match(root.innerHTML, /vehicle_2, vehicle_5/);
  assert.match(root.innerHTML, /vehicle_5 \(waiting vehicle\)/);
  assert.match(root.innerHTML, /Confirmed stuck/);
  assert.match(root.innerHTML, /2 event\(s\), 1 vehicle\(s\)/);
  assert.match(root.innerHTML, /Worst delay time/);
  assert.match(root.innerHTML, /Confirmed congestion/);
  assert.match(root.innerHTML, /vehicle_5, vehicle_8/);
});

test('selected heat area shows a clear empty instruction', () => {
  const root = { innerHTML: '' };
  renderHeatAreaSummary(root, null);
  assert.match(root.innerHTML, /Click a colored heat spot/);
});

test('issue timeline names both event types, period, and affected vehicles', () => {
  const root = { innerHTML: '' };
  renderStuckTimeline(root, { bucket_seconds: 60, buckets: [{
    start: 100, end: 160, total_vehicles: 2,
    stuck_events: 1, congestion_events: 1,
    hotspot: { x: 4.1, y: 5.2, events: 2, vehicles: 2,
      last_event_at: 150, stuck_events: 1, congestion_events: 1,
      vehicle_ids: ['vehicle_1', 'vehicle_2'] },
  }] });
  assert.match(root.innerHTML, /1 stuck · 1 congestion/);
  assert.match(root.innerHTML, /data-type="Mixed issues"/);
  assert.match(root.innerHTML, /vehicle_1, vehicle_2/);
  assert.match(root.innerHTML, /data-end="160"/);
  assert.match(root.innerHTML, /data-inspect-end="150"/);
});

test('localization panel does not claim accuracy without a reference', () => {
  const root = { innerHTML: '' };
  renderLocalization(root, { summary: { samples: 0 }, vehicles: [] });
  assert.match(root.innerHTML, /absolute position error cannot be measured/);
  assert.doesNotMatch(root.innerHTML, /0\.00 m/);
});
