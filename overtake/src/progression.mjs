// Local, reset-once economy. Dev access never purchases a car or an upgrade.
import { CAR_CONTENT, ACTIVE_CAR_CONTENT } from './content/cars.mjs';
import { LIVERY_OPTIONS } from './content/cosmetics.mjs';
import { SEASON_TIERS, PREMIUM_TIERS, PREMIUM_PASS_PRICE, sanitizeSeasonPass, currentSeasonPass } from './season-pass.mjs';
export const CAR_PRICES = Object.freeze(Object.fromEntries(ACTIVE_CAR_CONTENT.map(car => [car.id, car.price])));
export const UPGRADE_PRICES = Object.freeze({ engine: [700, 1800, 4000], tires: [600, 1600, 3500], brakes: [500, 1300, 3000] });
export const TUNE_PRICES = Object.freeze({ street: 5, touring: 10, sport: 16, track: 24, 'golf-r32': 30, 'golf-clean': 26, 'golf-diffuser': 30, 'golf-wide': 26, 'golf-wing': 30, 'golf-quad-flame': 35, 'golf-vented': 14, 'golf-rally': 20, 'golf-roof-scoop': 18, 'golf-roof-vents': 16, smoked: 8, halo: 14, flame: 30, carbon: 8, upper: 7, lower: 7, 'roof-only': 7, underglow: 10, paint: 5 });
const MAX = 1_000_000_000;
const amount = n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(MAX, Math.floor(n))) : 0;
const cars = CAR_CONTENT.map(car => car.id);
const upgradeKeys = Object.keys(UPGRADE_PRICES);
export function emptyProgression() { return { version: 2, walletVersion: 1, coins: 0, credits: 0, gems: 0, dev: false, owned: ['golf'], upgrades: {}, tunes: {}, seasonPass: null, retiredChironRefunded: false }; }
export function sanitizeProgression(raw) {
  const p = emptyProgression();
  if (!raw || typeof raw !== 'object' || raw.version !== 2) return p;
  // One-time generous migration: keep legacy purchasing power in each lane.
  if (raw.walletVersion === 1) { p.coins=amount(raw.coins); p.credits=amount(raw.credits); p.gems=amount(raw.gems); }
  else { const legacy=amount(raw.money); p.coins=legacy; p.credits=legacy; p.gems=Math.ceil(legacy/50); }
  p.dev = raw.dev === true;
  p.retiredChironRefunded = raw.retiredChironRefunded === true;
  p.seasonPass = sanitizeSeasonPass(raw.seasonPass);
  if (Array.isArray(raw.owned)) p.owned = ['golf', ...cars.filter(id => id !== 'golf' && raw.owned.includes(id))];
  for (const id of cars) {
    const upgrades = raw.upgrades?.[id];
    if (upgrades && typeof upgrades === 'object') {
      const levels = {};
      for (const key of upgradeKeys) levels[key] = Math.min(3, amount(upgrades[key]));
      p.upgrades[id] = levels;
    }
    const tunes = raw.tunes?.[id];
    if (Array.isArray(tunes)) p.tunes[id] = [...new Set(tunes.filter(key => typeof key === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}:[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)))].slice(0,256);
  }
  // Preserve retired ownership and historic upgrades in saves. Owners of the
  // detailed Aventador receive the surviving version and its earned upgrades.
  if (p.owned.includes('aventador') && !p.owned.includes('aventador-game')) p.owned = cars.filter(id => id === 'aventador-game' || p.owned.includes(id));
  if (p.upgrades.aventador) {
    const old=p.upgrades.aventador, current=p.upgrades['aventador-game'] ?? {engine:0,tires:0,brakes:0};
    p.upgrades['aventador-game']=Object.fromEntries(upgradeKeys.map(key=>[key,Math.max(old[key],current[key])]));
  }
  if (p.tunes.aventador) p.tunes['aventador-game']=[...new Set([...(p.tunes['aventador-game'] ?? []),...p.tunes.aventador])].slice(0,256);
  // Refund the removed car's purchase once, preserving its history.
  if (p.owned.includes('bugatti') && !p.retiredChironRefunded) {
    p.credits=Math.min(MAX,p.credits+55000);p.retiredChironRefunded=true;
  }
  return p;
}
// A run's entire score earns more per point as its final score rises.
export function payoutForScore(score) { const n = amount(score); return Math.min(MAX, Math.floor(n * (1 + Math.min(2, Math.floor(n / 1000) * .25)))); }
export function earnedCar(p, car) { return Object.hasOwn(CAR_PRICES, car) && p.owned.includes(car); }
export function canDriveCar(p, car) { return Object.hasOwn(CAR_PRICES, car) && (p.dev || earnedCar(p, car)); }
// A modest distance reward ensures a clean drive still pays even with no passes.
export function awardProgress(p, run) { const before = sanitizeProgression(p); const gain = Math.min(MAX, payoutForScore(run?.score) + Math.floor(amount(run?.distance) / 10)), coinsGained=Math.min(MAX-before.coins,gain), creditsGained=Math.min(MAX-before.credits,gain); return { progress: { ...before, coins: before.coins+coinsGained, credits: before.credits+creditsGained }, gain, coinsGained, creditsGained }; }
// The first missing lower tier blocks a purchase, including for legacy saves
// with gaps. Already owned higher-tier cars remain usable; same-tier variants
// are alternatives and do not gate one another.
export function missingCarPrerequisite(p, car) {
  const target=ACTIVE_CAR_CONTENT.find(c=>c.id===car);
  if (!target) return null;
  const lowerTiers=[...new Set(ACTIVE_CAR_CONTENT.filter(c=>c.unlockTier<target.unlockTier).map(c=>c.unlockTier))].sort((a,b)=>a-b);
  for (const tier of lowerTiers) {
    const choices=ACTIVE_CAR_CONTENT.filter(c=>c.unlockTier===tier);
    if (!choices.some(c=>earnedCar(p,c.id))) return choices[0].id;
  }
  return null;
}
export function buyCar(p, car) {
  const next = sanitizeProgression(p);
  if (!Object.hasOwn(CAR_PRICES, car) || earnedCar(next, car) || missingCarPrerequisite(next, car) !== null || next.credits < CAR_PRICES[car]) return { progress: next, ok: false };
  next.credits -= CAR_PRICES[car]; next.owned = cars.filter(id => id === car || next.owned.includes(id)); return { progress: next, ok: true };
}
export function buyUpgrade(p, car, key) {
  const next = sanitizeProgression(p);
  if (!earnedCar(next, car) || !Object.hasOwn(UPGRADE_PRICES, key)) return { progress: next, ok: false };
  const levels = next.upgrades[car] ?? { engine: 0, tires: 0, brakes: 0 }, level = levels[key], price = UPGRADE_PRICES[key][level];
  if (price === undefined || next.coins < price) return { progress: next, ok: false };
  next.coins -= price; levels[key]++; next.upgrades[car] = levels; return { progress: next, ok: true };
}
export function tunePrice(key, value) {
  if (key === 'paint') return TUNE_PRICES.paint;
  if (key === 'livery') return LIVERY_OPTIONS.find(option => option.id === value)?.price ?? 0;
  if (key === 'underglow') return value === 'on' ? TUNE_PRICES.underglow : 0;
  if (['front','rear','skirts','spoiler','exhaust','frontFinish','rearFinish','skirtsFinish','spoilerFinish','exhaustFinish','hood','roof','hoodFinish','roofFinish','paintScheme','secondaryFinish','headlights','mirrors'].includes(key)) return TUNE_PRICES[value] ?? 0;
  return 0; // Colors are included once their feature is bought.
}
export function buyTune(p, car, key, value) {
  const next = sanitizeProgression(p), price = tunePrice(key, value), token = `${key}:${value}`;
  if (!Object.hasOwn(CAR_PRICES, car)) return { progress: next, ok: false };
  if (!price || next.tunes[car]?.includes(token) || next.dev) return { progress: next, ok: true };
  if (!earnedCar(next, car) || next.gems < price) return { progress: next, ok: false };
  next.gems -= price; (next.tunes[car] ??= []).push(token); return { progress: next, ok: true };
}
export function upgradeLevels(p, car) { return p.upgrades[car] ?? { engine: 0, tires: 0, brakes: 0 }; }
export function effectiveUpgrades(p, car) { return p.dev ? { engine: 3, tires: 3, brakes: 3 } : upgradeLevels(p, car); }

function grantReward(next,r) {
  if(r.type==='upgrade') {
    const u=next.upgrades[r.car] ?? {engine:0,tires:0,brakes:0};
    u[r.key]=Math.max(u[r.key],r.level);next.upgrades[r.car]=u;
  } else {
    const tunes=next.tunes[r.car] ?? [];const token=`${r.key}:${r.value}`;
    if(!tunes.includes(token))tunes.push(token);next.tunes[r.car]=tunes;
  }
}
// One seasonal purchase, retroactive cosmetics through current XP. No power.
export function buyPremiumPass(progress, now=Date.now()) {
  const next=sanitizeProgression(progress), pass=currentSeasonPass(next.seasonPass,now);
  if(pass.premium || next.gems<PREMIUM_PASS_PRICE) return {progress:next,ok:false,rewards:[]};
  next.gems-=PREMIUM_PASS_PRICE;pass.premium=true;next.seasonPass=pass;
  const rewards=PREMIUM_TIERS.filter(t=>t.xp<=pass.xp);
  for(const r of rewards)grantReward(next,r);
  return {progress:next,ok:true,rewards};
}
/** Quest XP and gems are earned by playing, including after finishing the track. */
export function awardQuestXp(progress, mode, devRun=false, now=Date.now()) {
  const next=sanitizeProgression(progress);
  if (mode === 'ranked' || mode === 'ghost') return {progress:next, gained:0, gemsGained:0, rewards:[]};
  const pass=currentSeasonPass(next.seasonPass,now), old=pass.xp;
  const gained=Math.min(mode==='seasonal'?200:100, SEASON_TIERS.at(-1).xp-old);
  const gemsGained=Math.min(MAX-next.gems,mode==='seasonal'?10:5);
  next.gems+=gemsGained;pass.xp+=gained;next.seasonPass=pass;
  const rewards=[...SEASON_TIERS,...(pass.premium?PREMIUM_TIERS:[])].filter(t=>t.xp>old && t.xp<=pass.xp);
  for(const r of rewards)grantReward(next,r);
  return {progress:next,gained,gemsGained,rewards};
}
