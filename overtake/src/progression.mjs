// Lifetime progression is local to this browser. Developer mode bypasses
// requirements without granting ownership or changing earned XP.
export const CAR_XP = Object.freeze({ golf: 0, mustang: 150, challenger: 300, mercedes: 500, audi: 750, r8: 1200, ferrari: 1700 });
const MAX_XP = 1_000_000_000;
const finite = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export function emptyProgression() { return { version: 1, xp: 0, dev: false, legacyCar: null }; }
export function sanitizeProgression(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return { version: 1, xp: Math.min(MAX_XP, Math.floor(finite(value.xp))), dev: value.dev === true,
    legacyCar: typeof value.legacyCar === 'string' && Object.hasOwn(CAR_XP, value.legacyCar) ? value.legacyCar : null };
}
/** Credit prior personal bests once and keep the car previously selected. */
export function migrateProgression(records, savedCar) {
  const progress = emptyProgression();
  for (const mode of ['endless', 'rush']) {
    const bucket = records?.modes?.[mode];
    if (bucket) progress.xp += xpForRun({ score: bucket.bestScore, distance: bucket.bestDistance });
  }
  progress.legacyCar = typeof savedCar === 'string' && Object.hasOwn(CAR_XP, savedCar) ? savedCar : null;
  return sanitizeProgression(progress);
}
export function xpForRun(run) {
  return Math.min(MAX_XP, Math.floor(finite(run?.score) / 10) + Math.floor(finite(run?.distance) / 50));
}
export function earnedCar(progress, car) {
  return Object.hasOwn(CAR_XP, car) && (progress.legacyCar === car || progress.xp >= CAR_XP[car]);
}
export function canDriveCar(progress, car) {
  return Object.hasOwn(CAR_XP, car) && (progress.dev || earnedCar(progress, car));
}
export function awardProgress(progress, run) {
  const before = sanitizeProgression(progress), gain = xpForRun(run);
  const after = sanitizeProgression({ ...before, xp: before.xp + gain });
  const unlocked = Object.keys(CAR_XP).filter(car => !earnedCar(before, car) && earnedCar(after, car));
  return { progress: after, gain: after.xp - before.xp, unlocked };
}
export function nextUnlock(progress) {
  return Object.entries(CAR_XP).sort((a,b) => a[1] - b[1]).find(([car]) => !earnedCar(progress, car)) ?? null;
}
