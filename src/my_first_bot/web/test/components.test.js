import assert from 'node:assert/strict';
import test from 'node:test';

import { renderHeatAreaSummary } from '../src/components.js';

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
      },
      stuck: {
        events: 2,
        vehicles: 1,
        peak: { start: 100, end: 400 },
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
});

test('selected heat area shows a clear empty instruction', () => {
  const root = { innerHTML: '' };
  renderHeatAreaSummary(root, null);
  assert.match(root.innerHTML, /Click a colored heat spot/);
});
