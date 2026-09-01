async function request(path) {
  const response = await fetch(path, { cache: 'no-store' });
  const body = await response.text();
  let value;
  try {
    value = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`API returned invalid JSON (${response.status})`);
  }
  if (!response.ok) throw new Error(value.error || response.statusText);
  return value;
}

export async function getMap() {
  const map = await request('/api/map');
  if (!Array.isArray(map.origin) || !map.width || !map.height || !map.resolution) {
    throw new Error('Map metadata unavailable');
  }
  return map;
}
export const getBounds = () => request('/api/bounds');
export async function getState(query) {
  const state = await request(`/api/state?${new URLSearchParams(query)}`);
  if (!Array.isArray(state.latest) || !Array.isArray(state.density)) {
    throw new Error('Traffic history unavailable');
  }
  return state;
}
