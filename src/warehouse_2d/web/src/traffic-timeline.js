const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function describeTrafficBucket(bucket) {
  const start = new Date(Number(bucket.start) * 1000).toLocaleString();
  const end = new Date(Number(bucket.end) * 1000).toLocaleString();
  const delayed = bucket.slow_vehicle_ids || [];
  const issues = bucket.issue_vehicle_ids || [];
  return start + ' – ' + end
    + ' · ' + delayed.length + ' ' + (delayed.length === 1 ? 'vehicle' : 'vehicles') + ' with delay readings'
    + (delayed.length ? ': ' + delayed.join(', ') : '')
    + ' · ' + Number(bucket.stuck_events || 0) + ' active stuck'
    + ' · ' + Number(bucket.congestion_events || 0) + ' active congestion'
    + (issues.length ? ' · Issue vehicles: ' + issues.join(', ') : '');
}

export function renderTrafficTimeline(root, timeline, selectedStart = null) {
  const buckets = timeline?.buckets || [];
  if (!buckets.length) {
    root.innerHTML = '<div class="empty">No recorded traffic in this period.</div>';
    return;
  }
  const maxSlow = Math.max(1, ...buckets.map((bucket) => Number(bucket.slow_vehicles || 0)));
  const bars = buckets.map((bucket) => {
    const delayed = Number(bucket.slow_vehicles || 0);
    const height = delayed ? Math.max(10, Math.round(delayed / maxSlow * 100)) : 4;
    const selected = selectedStart !== null && Number(selectedStart) === Number(bucket.start);
    const description = escapeHtml(describeTrafficBucket(bucket));
    const stuck = Number(bucket.stuck_events || 0);
    const congestion = Number(bucket.congestion_events || 0);
    return '<button type="button" class="traffic-time-bin' + (selected ? ' selected' : '')
      + '" data-traffic-start="' + Number(bucket.start) + '" data-traffic-end="' + Number(bucket.end)
      + '" aria-label="' + description + '" title="' + description + '" aria-pressed="' + selected + '">'
      + '<span class="traffic-time-events" aria-hidden="true">'
      + (stuck ? '<i class="traffic-event stuck"></i>' : '')
      + (congestion ? '<i class="traffic-event congestion"></i>' : '')
      + '</span><span class="traffic-time-bar' + (delayed ? ' has-delay' : '')
      + '" style="height:' + height + '%"></span></button>';
  }).join('');
  const first = new Date(Number(buckets[0].start) * 1000).toLocaleString();
  const last = new Date(Number(buckets[buckets.length - 1].end) * 1000).toLocaleString();
  const minutes = Number(timeline.bucket_seconds || 60) / 60;
  root.innerHTML = '<div class="traffic-chart-scroll"><div class="traffic-chart-plot" style="--traffic-columns:'
    + buckets.length + ';min-width:' + Math.max(300, buckets.length * 28) + 'px">' + bars
    + '</div></div><div class="traffic-chart-axis"><span>' + escapeHtml(first)
    + '</span><span>' + escapeHtml(last) + '</span></div>'
    + '<p class="traffic-chart-note">Distinct vehicles with delay readings per '
    + minutes + ' minute' + (minutes === 1 ? '' : 's')
    + '. Dots mark confirmed issues active in that period; bar height is not elapsed time.</p>';
}
