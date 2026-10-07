import assert from 'node:assert/strict';
import test from 'node:test';

import { renderSignalIssues, vehicleSignalIssues } from '../src/signal-issues.js';

test('only measured stale and unavailable signals become live alerts', () => {
  const { alerts, awaiting } = vehicleSignalIssues({ vehicles: [
    { vehicle_id: 'vehicle_1', status: 'unknown', localization: { state: 'unknown' }, lidar: { state: 'unknown' } },
    { vehicle_id: 'vehicle_2', status: 'stale', age_seconds: 8, localization: { state: 'stale' } },
    { vehicle_id: 'vehicle_3', status: 'online', motion_state: 'localizing', localization: { state: 'unavailable' }, lidar: { state: 'unknown' } },
    { vehicle_id: 'vehicle_4', status: 'online', localization: { state: 'unknown' }, lidar: { state: 'unknown' } },
  ] });
  assert.equal(awaiting, 1);
  assert.deepEqual(alerts.map(({ vehicleId, type }) => [vehicleId, type]), [
    ['vehicle_2', 'position'], ['vehicle_3', 'localization'],
  ]);
});

test('LiDAR alerts require a report or an observed scan timeout', () => {
  const { alerts } = vehicleSignalIssues({ vehicles: [
    { vehicle_id: 'vehicle_1', status: 'online', localization: { state: 'unknown' }, lidar: { state: 'unknown' } },
    { vehicle_id: 'vehicle_2', status: 'online', localization: { state: 'unavailable' }, lidar: { state: 'unavailable', detail: 'Waiting for scan' } },
    { vehicle_id: 'vehicle_3', status: 'online', localization: { state: 'online' }, lidar: { state: 'offline', age_seconds: 20 } },
  ] });
  assert.deepEqual(alerts.map(({ type }) => type), ['lidar', 'localization', 'lidar']);
});

test('a disconnected health API does not look like an all-clear', () => {
  const root = { innerHTML: '' };
  renderSignalIssues(root, null, false);
  assert.match(root.innerHTML, /checks unavailable/);
  assert.doesNotMatch(root.innerHTML, /No live position or localization alerts/);
});
