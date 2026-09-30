const status = document.querySelector('#status');
const output = document.querySelector('#output');
const options = new URLSearchParams(window.location.search);
const limit = Math.max(1, Math.min(500, Number(options.get('limit')) || 100));
const refreshMilliseconds = Math.max(
  1000,
  Math.min(60000, Number(options.get('refresh')) || 5000),
);

let loading = false;

async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch(`/api/debug?limit=${limit}`, { cache: 'no-store' });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from API (${response.status})`);
    }
    if (!response.ok) throw new Error(payload.error || response.statusText);
    output.textContent = JSON.stringify(payload, null, 2);
    status.className = '';
    status.textContent = `OK · updated ${new Date().toLocaleTimeString()} · ${limit} newest rows per table · refresh ${refreshMilliseconds / 1000}s`;
    document.title = 'OK · Warehouse raw diagnostics';
  } catch (error) {
    status.className = 'error';
    status.textContent = `ERROR · ${error.message}`;
    document.title = 'ERROR · Warehouse raw diagnostics';
  } finally {
    loading = false;
  }
}

refresh();
setInterval(refresh, refreshMilliseconds);
