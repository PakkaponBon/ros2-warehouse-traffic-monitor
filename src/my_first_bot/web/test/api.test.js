import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHealth,
  getMap,
  getRouteSuggestion,
  getState,
} from '../src/api.js';


test('getMap accepts complete map metadata', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    origin: [-1, -2, 0],
    width: 100,
    height: 80,
    resolution: 0.05,
  }));
  assert.equal((await getMap()).width, 100);
});


test('getMap rejects incomplete metadata', async () => {
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(getMap(), /Map metadata unavailable/);
});


test('getState rejects an invalid API payload', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ latest: [] }));
  await assert.rejects(getState({ hours: 1 }), /Traffic history unavailable/);
});


test('getHealth accepts measured service and vehicle health', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    services: { web_api: { status: 'online' } },
    vehicles: [{ vehicle_id: 'vehicle_1', status: 'online' }],
  }));
  assert.equal((await getHealth()).vehicles[0].status, 'online');
});


test('getHealth rejects a placeholder or incomplete payload', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
  await assert.rejects(getHealth(), /System health unavailable/);
});


test('getRouteSuggestion posts an advisory route request', async () => {
  let request;
  globalThis.fetch = async (path, options) => {
    request = { path, options };
    return new Response(JSON.stringify({
      advisory_only: true,
      baseline: { points: [[0, 0], [1, 0]] },
      suggested: { points: [[0, 0], [1, 1], [1, 0]] },
    }));
  };

  await getRouteSuggestion({ vehicle_id: 'vehicle_1', destination: { x: 1, y: 0 } });

  assert.equal(request.path, '/api/routes/suggest');
  assert.equal(request.options.method, 'POST');
  assert.equal(JSON.parse(request.options.body).vehicle_id, 'vehicle_1');
});
