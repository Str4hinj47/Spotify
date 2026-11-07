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

/** Denser opposing traffic, but never an unavoidable wall. */
export function canSpawnOncoming(s, existing, sameDir) {
  // ~1.3 s at a 60 m/s closing speed: enough to see and react, still busy.
  if (existing.some((c) => Math.abs(c.s - s) < 78)) return false;
  // Keep some separation from cars at the same road position, not a fixed
  // offset hundreds of metres away (which eventually blocks every candidate).
  if (sameDir.some((c) => Math.abs(c.s - s) < 20)) return false;
  return true;
}

export function sameSpawnInterval(speed) {
  return Math.max(0.65, 1.5 - speed * 0.012);
}

export function oncomingSpawnInterval(speed) {
  return Math.max(0.45, 1.05 - speed * 0.01);
}

/** Find the nearest available spawn point ahead. Returns null if the window is full. */
export function findOncomingSpawn(playerS, existing, sameDir) {
  for (let distance = 230; distance <= 550; distance += 20) {
    const s = playerS + distance;
    if (canSpawnOncoming(s, existing, sameDir)) return s;
  }
  return null;
}

/** Rounded, slightly inset road-relative vehicle footprints. Mirrors and trim
 * are included in visual bounds but should not cause an early collision. */
export function vehiclesOverlap(distance, lateral, playerLength, playerWidth, otherLength, otherWidth) {
  const length = (playerLength + otherLength) * 0.5 * 0.84;
  const width = (playerWidth + otherWidth) * 0.5 * 0.78;
  const radius = Math.min(0.36, width * 0.22, length * 0.1);
  const x = Math.max(0, Math.abs(lateral) - (width - radius));
  const y = Math.max(0, Math.abs(distance) - (length - radius));
  return x * x + y * y < radius * radius;
}

/** Check the car's road-relative footprint against the continuous guardrails. */
export function hitsRoadBarrier(offset, width, length, heading, barrier = BARRIER_OFFSET) {
  const halfWidth = width * 0.39;
  const halfLength = length * 0.42;
  const projectedHalfWidth = Math.abs(Math.cos(heading)) * halfWidth + Math.abs(Math.sin(heading)) * halfLength;
  return Math.abs(offset) + projectedHalfWidth >= barrier;
}

/** A two-wide traffic formation is not a safe overtaking lane. Check the
 * actual opening between car bodies plus clearance on either side, only when
 * both vehicles overlap the player's longitudinal footprint. */
export function blockedTrafficGap(player, traffic) {
  const adjacent = traffic.filter(t => Math.abs(t.s - player.s) < (t.length + player.length) * 0.42);
  for (const left of adjacent) for (const right of adjacent) {
    if (left.offset >= player.offset || right.offset <= player.offset) continue;
    const gap = (right.offset - right.width * 0.46) - (left.offset + left.width * 0.46);
    const required = player.width * 0.9 + 0.85;
    if (gap < required) return true;
  }
  return false;
}
