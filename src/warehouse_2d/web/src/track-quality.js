export function describeTrackQuality(track) {
  if (!track?.points?.length) return 'No recorded route in this period';
  const quality = track.quality || {};
  const parts = [`${track.points.length.toLocaleString()} recorded points`];
  if (quality.last_recorded_at) {
    parts.push(`last recorded ${new Date(quality.last_recorded_at).toLocaleTimeString()}`);
  }
  if (Number.isFinite(quality.max_gap_s)) {
    parts.push(`largest gap ${quality.max_gap_s.toFixed(1)} s`);
  }
  if (quality.path_breaks) {
    parts.push(`${quality.path_breaks} path break${quality.path_breaks === 1 ? '' : 's'}`);
  }
  const reference = quality.simulation_reference;
  if (Number.isFinite(reference?.p95_error_m)) {
    parts.push(`simulator reference p95 error ${reference.p95_error_m.toFixed(2)} m`);
  }
  if (quality.frames?.length > 1 || (quality.frames?.length && quality.frames[0] !== 'map')) {
    parts.push('check coordinate frame');
  }
  return parts.join(' · ');
}
