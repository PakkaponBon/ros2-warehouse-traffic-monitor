import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryPhase, deliverySummary, renderDeliveryJobs, renderStationActivity } from '../src/delivery.js';
import { getDelivery } from '../src/api.js';

const fleet = {
  online: true, pending_jobs: 3,
  stations: [{ id: 'receiving', label: 'Receiving', x: 1, y: 2 }, { id: 'shipping', label: 'Shipping', x: 3, y: 4 }],
  vehicles: [
    { vehicle_id: 'vehicle_1', task_id: 'job-1', phase: 'loading', pickup: 'receiving', dropoff: 'shipping', carrying: false, completed_jobs: 2 },
    { vehicle_id: 'vehicle_2', task_id: 'job-2', phase: 'to_dropoff', pickup: 'receiving', dropoff: 'shipping', carrying: true, completed_jobs: 4 },
    { vehicle_id: 'vehicle_3', task_id: null, phase: 'idle', carrying: false, completed_jobs: 1 },
  ],
};

test('live delivery counts exclude idle vehicles and show completed jobs for this session', () => {
  assert.deepEqual(deliverySummary(fleet), { vehicles: 3, active: 2, completed: 7, queued: 3 });
  assert.equal(deliverySummary(fleet, false), null);
  assert.equal(deliverySummary({ ...fleet, online: false }), null);
  assert.equal(deliverySummary(null), null);
});

test('phase progress distinguishes travelling, loading and unloading', () => {
  assert.equal(deliveryPhase('to_pickup').step, 0);
  assert.equal(deliveryPhase('loading').step, 1);
  assert.equal(deliveryPhase('to_dropoff').step, 2);
  assert.equal(deliveryPhase('unloading').step, 3);
  assert.equal(deliveryPhase('unknown').step, -1);
});

test('job rows resolve station names, distinguish cargo, and escape API text', () => {
  const root = {};
  const snapshot = structuredClone(fleet);
  snapshot.stations[0].label = '<img src=x onerror=alert(1)>';
  renderDeliveryJobs(root, snapshot, true);
  assert.match(root.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(root.innerHTML, /<img/);
  assert.match(root.innerHTML, /Shipping/);
  assert.match(root.innerHTML, /Carrying cargo/);
  assert.match(root.innerHTML, /aria-current="step"/);
  renderDeliveryJobs(root, snapshot, false);
  assert.match(root.innerHTML, /Waiting for live delivery updates/);
  assert.doesNotMatch(root.innerHTML, /job-1/);
});

test('stations show docking activity and stop reporting availability when offline', () => {
  const root = {};
  renderStationActivity(root, fleet);
  assert.match(root.innerHTML, /Loading \/ unloading/);
  assert.match(root.innerHTML, /2 assigned deliveries/);
  renderStationActivity(root, { ...fleet, online: false });
  assert.match(root.innerHTML, /Status unavailable/);
  assert.doesNotMatch(root.innerHTML, /Loading \/ unloading|assigned deliveries/);
});

test('delivery API rejects missing online status and malformed fleet arrays', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (path) => {
      assert.equal(path, '/api/tasks/delivery');
      return new Response(JSON.stringify(fleet));
    };
    assert.equal((await getDelivery()).vehicles.length, 3);
    globalThis.fetch = async () => new Response(JSON.stringify({ vehicles: [], stations: [] }));
    await assert.rejects(getDelivery(), /Delivery fleet unavailable/);
  } finally { globalThis.fetch = originalFetch; }
});
