// Pure gameplay rules for the two-way, free-steering highway.
export const ROAD_HALF = 4.2; // metres, half of the paved width
export const LANE_OFFSET = 2.1; // lane centre offset from road centreline
export const PLAYER_LANE = LANE_OFFSET; // right-hand lane, direction of travel
export const ONCOMING_LANE = -LANE_OFFSET; // left-hand lane, opposing traffic
export const BARRIER_OFFSET = ROAD_HALF + 0.55;
export const MIN_SPEED = 0;

/** Combo multiplier: +1 every 5 clean passes, capped at x5. */
export function multiplierFor(combo) {
  return Math.min(5, 1 + Math.floor(combo / 5));
}

/**
 * @param {number} combo
 * @param {'same'|'oncoming'} kind
 * @param {boolean} near
 * @param {number} carBonus
 */
export function passScore(combo, kind, near, carBonus = 1) {
  const mult = multiplierFor(combo);
  const base = kind === 'oncoming' ? 75 : 100;
  const bonus = near ? 50 : 0;
  return Math.round((base + bonus) * mult * carBonus);
}

/** Gentle drag so lifting off the throttle coasts instead of stopping instantly. */
export function coastSpeed(speed, dt) {
  return Math.max(0, speed - (1.6 + speed * 0.035) * dt);
}

/** Steering authority grows with speed but tapers near top speed. */
export function steerRate(speed, maxSpeed, handling) {
  const low = Math.min(1, speed / 9);
  const high = 1 - 0.35 * Math.min(1, speed / maxSpeed);
  return handling * low * high;
}

/** Same-direction traffic must leave a usable gap. */
export function canSpawnSame(s, existing) {
  return !existing.some((c) => Math.abs(c.s - s) < 32);
}

/** Minimum longitudinal gap between opposing cars. */
export const ONCOMING_MIN_GAP = 100;

/** Denser opposing traffic, but never an unavoidable wall. */
export function canSpawnOncoming(s, existing) {
  // ~1.6 s at a 60 m/s closing speed: enough to see and react, still busy.
  return !existing.some((c) => Math.abs(c.s - s) < ONCOMING_MIN_GAP);
}

/**
 * Scheduled oncoming flow. The old spawner vetoed a candidate whenever a
 * same-direction car was anywhere near a fixed 220 m offset; at speed that
 * could suppress *all* oncoming spawns for kilometres. This cursor instead
 * guarantees a steady stream, with short platoons separated by a breather gap
 * long enough to complete an overtake.
 */
export function createOncomingScheduler(_nextS = 0) {
  return { platoon: 0, lastBreather: false };
}

export function planOncomingSpawn(state, playerS, existing, random = Math.random) {
  const lo = playerS + 340;
  const hi = playerS + 620;
  let s = null;
  for (let i = 0; i < 16; i++) {
    const candidate = lo + random() * (hi - lo);
    if (canSpawnOncoming(candidate, existing)) { s = candidate; break; }
  }
  if (s === null) {
    let far = lo;
    for (const c of existing) far = Math.max(far, c.s + ONCOMING_MIN_GAP);
    if (far <= playerS + 900 && canSpawnOncoming(far, existing)) s = far;
  }
  if (s === null) return null;
  const breather = state.platoon >= 3;
  state.platoon = breather ? 0 : state.platoon + 1;
  state.lastBreather = breather;
  return s;
}

export function sameSpawnInterval(speed) {
  return Math.max(0.65, 1.5 - speed * 0.012);
}

export function oncomingSpawnInterval(speed) {
  return Math.max(0.45, 1.05 - speed * 0.01);
}
