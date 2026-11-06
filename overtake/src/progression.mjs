// Local, reset-once economy. Dev access never purchases a car or an upgrade.
export const CAR_PRICES = Object.freeze({ golf: 0, mustang: 3000, challenger: 6000, mercedes: 9500, audi: 14000, r8: 23000, ferrari: 35000 });
export const UPGRADE_PRICES = Object.freeze({ engine: [700, 1800, 4000], tires: [600, 1600, 3500], brakes: [500, 1300, 3000] });
export const TUNE_PRICES = Object.freeze({ street: 250, touring: 500, sport: 800, track: 1200, flame: 1500, carbon: 400, upper: 350, lower: 350, stripe: 350, race: 700, underglow: 500, paint: 250 });
const MAX = 1_000_000_000;
const amount = n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(MAX, Math.floor(n))) : 0;
const cars = Object.keys(CAR_PRICES);
const upgradeKeys = Object.keys(UPGRADE_PRICES);
export function emptyProgression() { return { version: 2, money: 0, dev: false, owned: ['golf'], upgrades: {}, tunes: {} }; }
export function sanitizeProgression(raw) {
  const p = emptyProgression();
  if (!raw || typeof raw !== 'object' || raw.version !== 2) return p;
  p.money = amount(raw.money); p.dev = raw.dev === true;
  if (Array.isArray(raw.owned)) p.owned = ['golf', ...cars.filter(id => id !== 'golf' && raw.owned.includes(id))];
  for (const id of cars) {
    const upgrades = raw.upgrades?.[id];
    if (upgrades && typeof upgrades === 'object') {
      const levels = {};
      for (const key of upgradeKeys) levels[key] = Math.min(3, amount(upgrades[key]));
      p.upgrades[id] = levels;
    }
    const tunes = raw.tunes?.[id];
    if (Array.isArray(tunes)) p.tunes[id] = [...new Set(tunes.filter(key => typeof key === 'string' && /^[a-zA-Z]+:[a-zA-Z]+$/.test(key)))].slice(0,100);
  }
  return p;
}
// A run's entire score earns more per point as its final score rises.
export function payoutForScore(score) { const n = amount(score); return Math.min(MAX, Math.floor(n * (1 + Math.min(2, Math.floor(n / 1000) * .25)))); }
export function earnedCar(p, car) { return Object.hasOwn(CAR_PRICES, car) && p.owned.includes(car); }
export function canDriveCar(p, car) { return Object.hasOwn(CAR_PRICES, car) && (p.dev || earnedCar(p, car)); }
export function awardProgress(p, run) { const before = sanitizeProgression(p); const gain = Math.min(MAX-before.money, payoutForScore(run?.score)); return { progress: { ...before, money: before.money + gain }, gain }; }
export function buyCar(p, car) {
  const next = sanitizeProgression(p);
  if (!Object.hasOwn(CAR_PRICES, car) || earnedCar(next, car) || next.money < CAR_PRICES[car]) return { progress: next, ok: false };
  next.money -= CAR_PRICES[car]; next.owned.push(car); return { progress: next, ok: true };
}
export function buyUpgrade(p, car, key) {
  const next = sanitizeProgression(p);
  if (!earnedCar(next, car) || !Object.hasOwn(UPGRADE_PRICES, key)) return { progress: next, ok: false };
  const levels = next.upgrades[car] ?? { engine: 0, tires: 0, brakes: 0 }, level = levels[key], price = UPGRADE_PRICES[key][level];
  if (price === undefined || next.money < price) return { progress: next, ok: false };
  next.money -= price; levels[key]++; next.upgrades[car] = levels; return { progress: next, ok: true };
}
export function tunePrice(key, value) {
  if (key === 'paint') return TUNE_PRICES.paint;
  if (key === 'underglow') return value === 'on' ? TUNE_PRICES.underglow : 0;
  if (['front','rear','skirts','spoiler','exhaust','frontFinish','rearFinish','skirtsFinish','spoilerFinish','exhaustFinish','paintScheme','secondaryFinish','livery'].includes(key)) return TUNE_PRICES[value] ?? 0;
  return 0; // Colors are included once their feature is bought.
}
export function buyTune(p, car, key, value) {
  const next = sanitizeProgression(p), price = tunePrice(key, value), token = `${key}:${value}`;
  if (!Object.hasOwn(CAR_PRICES, car)) return { progress: next, ok: false };
  if (!price || next.tunes[car]?.includes(token) || next.dev) return { progress: next, ok: true };
  if (!earnedCar(next, car) || next.money < price) return { progress: next, ok: false };
  next.money -= price; (next.tunes[car] ??= []).push(token); return { progress: next, ok: true };
}
export function upgradeLevels(p, car) { return p.upgrades[car] ?? { engine: 0, tires: 0, brakes: 0 }; }
export function effectiveUpgrades(p, car) { return p.dev ? { engine: 3, tires: 3, brakes: 3 } : upgradeLevels(p, car); }
