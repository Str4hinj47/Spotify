// Local run history and per-mode personal bests. No account, no network.
import { medalFor, RUN_MODES, eventFor } from './run.mjs';
import { CAR_CONTENT } from './content/cars.mjs';

const MODES = Object.keys(RUN_MODES);
const CARS = CAR_CONTENT.map(car => car.id);

export function emptyRecords() {
  const modes = {};
  for (const m of MODES) modes[m] = { bestScore: 0, bestDistance: 0, bestTime: null, period: null, runs: 0, recent: [] };
  return { version: 2, modes };
}

export function sanitizeRecords(raw) {
  const out = emptyRecords();
  if (!raw || typeof raw !== 'object' || !raw.modes) return out;
  for (const m of MODES) {
    const src = raw.modes[m];
    if (!src || typeof src !== 'object') continue;
    const rec = out.modes[m];
    rec.bestScore = Math.max(0, Number(src.bestScore) || 0);
    rec.bestDistance = Math.max(0, Number(src.bestDistance) || 0);
    rec.bestTime = Number.isFinite(src.bestTime) && src.bestTime > 0 ? src.bestTime : null;
    rec.period = Number.isInteger(src.period) ? src.period : null;
    rec.runs = Math.max(0, Math.floor(Number(src.runs) || 0));
    if (Array.isArray(src.recent)) {
      rec.recent = src.recent.filter((r) => r && typeof r === 'object' && CARS.includes(r.car) && Number.isFinite(Number(r.score)))
        .slice(0, 8)
        .map((r) => ({
          mode: m, car: r.car, eventPeriod: Number.isInteger(r.eventPeriod) ? r.eventPeriod : null, score: Math.max(0, Math.round(Number(r.score) || 0)),
          distance: Math.max(0, Number(r.distance) || 0), overtakes: Math.max(0, Math.floor(Number(r.overtakes) || 0)),
          nearMisses: Math.max(0, Math.floor(Number(r.nearMisses) || 0)), oncomingDodges: Math.max(0, Math.floor(Number(r.oncomingDodges) || 0)),
          topSpeed: Math.max(0, Number(r.topSpeed) || 0), contractsDone: Math.max(0, Math.floor(Number(r.contractsDone) || 0)),
          elapsed: Math.max(0, Number(r.elapsed) || 0), medal: medalFor(m, Number(r.score) || 0),
          reason: typeof r.reason === 'string' ? r.reason : null, date: Number(r.date) || 0,
        }));
    }
  }
  return out;
}

export function recordRun(records, summary) {
  const rec = sanitizeRecords(records);
  const mode = MODES.includes(summary.mode) ? summary.mode : 'endless';
  const bucket = rec.modes[mode];
  if ((mode === 'daily' || mode === 'weekly' || mode === 'seasonal') && Number.isInteger(summary.eventPeriod) && bucket.period !== summary.eventPeriod) { bucket.bestScore = 0; bucket.bestDistance = 0; bucket.period = summary.eventPeriod; }
  const newBest = (mode === 'trial' || mode === 'ghost') ? summary.reason === 'distance' && summary.elapsed > 0 && (bucket.bestTime === null || summary.elapsed < bucket.bestTime) : summary.score > bucket.bestScore;
  if ((mode === 'trial' || mode === 'ghost') && newBest) bucket.bestTime = summary.elapsed;
  bucket.bestScore = Math.max(bucket.bestScore, summary.score);
  bucket.bestDistance = Math.max(bucket.bestDistance, summary.distance);
  bucket.runs++;
  const entry = { ...summary, mode, medal: medalFor(mode, summary.score) };
  bucket.recent = [entry, ...bucket.recent].slice(0, 8);
  return { records: rec, entry, newBest, medal: entry.medal };
}

export function bestFor(records, mode, now = Date.now()) {
  const rec = sanitizeRecords(records);
  if ((mode === 'daily' || mode === 'weekly' || mode === 'seasonal') && rec.modes[mode].period !== eventFor(mode, now).period) return 0;
  return rec.modes[mode]?.bestScore ?? 0;
}
