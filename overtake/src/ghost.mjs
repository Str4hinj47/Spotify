// Local-only, per-car replay. Never trust malformed browser storage.
export const GHOST_PREFIX = 'overtake-ghost-v1-';
export const MAX_GHOST_SAMPLES = 6000;
export function sanitizeGhost(value) {
  if (!value || value.version !== 1 || !Number.isFinite(value.time) || value.time <= 0 || value.time > 7200 || !Array.isArray(value.samples) || value.samples.length < 2 || value.samples.length > MAX_GHOST_SAMPLES) return null;
  let previousTime = -1, previousDistance = -1;
  for (const row of value.samples) {
    if (!Array.isArray(row) || row.length !== 4 || row.some(n => !Number.isFinite(n))) return null;
    const [t, roadS, offset, distance] = row;
    if (t < 0 || t <= previousTime || distance < previousDistance || distance < 0 || distance > 3000 || Math.abs(offset) > 30 || roadS < -100 || roadS > 3100 || t > value.time + .001) return null;
    previousTime = t; previousDistance = distance;
  }
  const first = value.samples[0], last = value.samples[value.samples.length - 1];
  if (first[0] !== 0 || first[1] !== 0 || first[3] !== 0 || Math.abs(last[0] - value.time) > .001 || last[3] < 2999.99) return null;
  return { version: 1, time: value.time, samples: value.samples.map(row => [...row]) };
}
export function loadGhost(storage, car) {
  try { const text = storage.getItem(GHOST_PREFIX + car); return text && text.length < 600000 ? sanitizeGhost(JSON.parse(text)) : null; } catch { return null; }
}
export function saveGhost(storage, car, replay) {
  const clean = sanitizeGhost(replay);
  if (!clean) return false;
  const old = loadGhost(storage, car);
  if (old && old.time <= clean.time) return false;
  try { storage.setItem(GHOST_PREFIX + car, JSON.stringify(clean)); return true; } catch { return false; }
}
export function ghostAt(replay, time) {
  const frames = replay.samples;
  if (time <= 0) return frames[0];
  if (time >= replay.time) return frames[frames.length - 1];
  let lo = 0, hi = frames.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frames[mid][0] <= time) lo = mid; else hi = mid; }
  const a = frames[lo], b = frames[hi], mix = (time - a[0]) / (b[0] - a[0]);
  return [time, a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix, a[3] + (b[3] - a[3]) * mix];
}
