// Shared by the canvas and its legend so filtering never silently changes colors.
export const HEAT_METRICS = {
  count: { label: 'Traffic activity', unit: 'samples', description: 'Recorded position samples per area. More samples indicate more activity, not elapsed time.', empty: 'No traffic samples in this time window.', ranking: 'Most active areas' },
  vehicles: { label: 'Vehicle coverage', unit: 'vehicles', description: 'Distinct vehicles recorded in each area during this time window.', empty: 'No vehicle coverage recorded in this time window.', ranking: 'Most visited areas' },
  slow_samples: { label: 'Slow & waiting activity', unit: 'slow samples', description: 'Recorded waiting, blocked, stalled, or stuck readings; also low-speed readings with an unknown state. These are samples, not seconds.', empty: 'No slow or waiting samples in this time window.', ranking: 'Areas with most slow readings' },
};

export const HEAT_COLORS = ['#3b82c4', '#28a8aa', '#efbb4b', '#db5141'];
export const HEAT_GRADIENT = `linear-gradient(90deg, ${HEAT_COLORS.join(', ')})`;

export function heatColor(amount) {
  const scaled = Math.max(0, Math.min(1, amount)) * (HEAT_COLORS.length - 1);
  const index = Math.min(HEAT_COLORS.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const rgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const first = rgb(HEAT_COLORS[index]);
  const second = rgb(HEAT_COLORS[index + 1]);
  return first.map((channel, i) => Math.round(channel + (second[i] - channel) * mix));
}

export function buildHeatScale(density = [], metric = 'count', filter = 0) {
  const areas = density.filter((area) => Number.isFinite(Number(area.x)) && Number.isFinite(Number(area.y))
    && Number.isFinite(Number(area[metric])) && Number(area[metric]) > 0)
    .slice().sort((a, b) => Number(b[metric]) - Number(a[metric]) || Number(a.x) - Number(b.x) || Number(a.y) - Number(b.y));
  const min = areas.length ? Number(areas.at(-1)[metric]) : 0;
  const max = areas.length ? Number(areas[0][metric]) : 0;
  const percentile = Number.isFinite(filter) ? Math.max(0, Math.min(.95, filter)) : 0;
  const visibleCount = Math.max(1, Math.ceil(areas.length * (1 - percentile)));
  const threshold = areas.length ? Number(areas[visibleCount - 1][metric]) : 0;
  const fraction = (value) => max === min ? .5
    : Math.max(0, Math.min(1, (Math.log1p(value) - Math.log1p(min)) / (Math.log1p(max) - Math.log1p(min))));
  return { min, max, threshold, areas, visible: areas.filter((area) => Number(area[metric]) >= threshold), fraction };
}
