import assert from 'node:assert/strict';
import test from 'node:test';

import { getMap, getState } from '../src/api.js';


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
