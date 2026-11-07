// Cooperative car-following, conservative truck passing, predictable
// oncoming flow, and a time-to-collision hazard radar.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createTrafficAI(cruise) {
  return { cruise, braking: false, accel: 0 };
}

/** Find the nearest same-lane leader ahead of `car`. */
export function findLeader(car, traffic, laneTolerance = 1.4) {
  let best = null, bestGap = Infinity;
  for (const other of traffic) {
    if (other === car || other.dir !== car.dir) continue;
    if (Math.abs(other.offset - car.offset) > laneTolerance) continue;
    const gap = other.s - car.s;
    if (gap > 0 && gap < bestGap) { best = other; bestGap = gap; }
  }
  return best;
}

/** IDM-lite follow speed. Mutates car.speed and car.ai; returns braking flag. */
export function stepTraffic(car, leader, dt, grip = 1) {
  const ai = car.ai ?? (car.ai = createTrafficAI(car.speed));
  const maxAccel = 1.9 * grip;
  const maxBrake = 4.6 * grip;
  let target = ai.cruise;
  if (leader) {
    const bumperGap = leader.s - car.s - (leader.length + car.length) * 0.5;
    const safeGap = 9 + car.speed * 1.15;
    const closing = car.speed - leader.speed;
    if (bumperGap < safeGap || (closing > 0 && bumperGap < safeGap * 1.7)) {
      const gapTerm = clamp((bumperGap - safeGap) * 0.28, -maxBrake, 2.5);
      target = clamp(leader.speed + gapTerm, 4, ai.cruise);
    }
  }
  const delta = target - car.speed;
  const rate = delta < 0 ? maxBrake : maxAccel;
  const change = clamp(delta, -rate * dt, rate * dt);
  car.speed = Math.max(0, car.speed + change);
  ai.accel = change / Math.max(dt, 1e-4);
  ai.braking = ai.accel < -0.6;
  car.braking = ai.braking;
  return ai.braking;
}

/**
 * Nearest relevant hazard for the player. Returns null when the path is clear.
 * `player`: { s, offset, speed, width, length }
 */
export function hazardAhead(player, traffic) {
  let best = null;
  for (const t of traffic) {
    const ds = t.s - player.s;
    if (ds <= 0 || ds > 260) continue;
    const lateral = Math.abs(t.offset - player.offset);
    const overlap = lateral < (player.width + t.width) * 0.5 + 0.35;
    let kind = null, closing = 0;
    if (t.dir === 1 && overlap && player.speed > t.speed) { kind = 'traffic'; closing = player.speed - t.speed; }
    else if (t.dir === -1 && player.offset < 0.9) { kind = 'oncoming'; closing = player.speed + t.speed; }
    if (!kind || closing <= 0.5) continue;
    const gap = Math.max(1, ds - (player.length + t.length) * 0.5);
    const ttc = gap / closing;
    if (ttc > 6) continue;
    if (!best || ttc < best.ttc) best = { kind, distance: gap, ttc, speed: t.speed };
  }
  return best;
}

// Target cruising speeds in metres per second. The variation between models is
// deliberate; trucks are considerably slower and produce natural queues.
export const TRAFFIC_CRUISE = Object.freeze({
  golf: 18, mercedes: 22.5, audi: 23, mustang: 21.5,
  ferrari: 26, r8: 25, challenger: 21, semi: 11.5, kraz: 13,
});
export function isTruck(id) { return id === 'semi' || id === 'kraz'; }
export function trafficCruise(id, random = Math.random) {
  return TRAFFIC_CRUISE[id] * (0.96 + random() * 0.08);
}
export function chooseTruck(score, traffic, s, random = Math.random) {
  // Trucks are a core traffic feature, not a late-game rarity: they appear
  // from the opening minute, roughly 1 in 3 same-direction spawns, spaced so
  // the road can hold two truck queues at once without walling the player in.
  if (score < 250 || traffic.some(t => isTruck(t.id) && Math.abs(t.s - s) < 300)) return null;
  if (random() >= 0.32) return null;
  return random() < 0.5 ? 'semi' : 'kraz';
}

/** Conservative projected entire maneuver, including two lane changes,
 * acceleration and a clearance buffer. Oncoming traffic follows fixed speeds;
 * the game reserves the opposing lane against newly spawned oncoming traffic
 * while a maneuver is active. The player remains an uncontrolled actor. */
export function canOvertakeTruck(car, truck, traffic, player) {
  if (car.dir !== 1 || isTruck(car.id) || !truck || !isTruck(truck.id) || truck.dir !== 1) return false;
  if (car.ai.pass || traffic.some(t => t.ai?.pass)) return false;
  const gap = truck.s - car.s - (truck.length + car.length) / 2;
  const truckMax = Math.max(truck.speed, truck.ai.cruise);
  const advantage = car.ai.cruise - truckMax;
  if (gap < 5 || gap > 48 || advantage < 4) return false;
  // Worst-case acceleration uses minimum weather grip, plus both lane
  // changes. A truck can accelerate back to its cruise during the maneuver.
  const accelerationTime = Math.max(0, car.ai.cruise - car.speed) / (1.9 * 0.55);
  const duration = 10 + accelerationTime + (gap + truck.length + car.length + 24) / advantage;
  const forward = car.ai.cruise * duration + 40;
  // No second car can occupy the return lane during the projected maneuver.
  if (traffic.some(t => t !== car && t !== truck && t.dir === 1 &&
    t.s > truck.s && t.s - car.s < forward)) return false;
  // A car cannot safely merge out past any nearby vehicle in that lane.
  for (const t of traffic) {
    if (t === car || t === truck) continue;
    const ds = t.s - car.s;
    if (t.dir === -1 && ds > -15 && ds < (car.ai.cruise + t.speed) * (duration + 3) + 45) return false;
    if (t.dir === 1 && t.ai?.pass && Math.abs(ds) < forward) return false;
  }
  if (player) {
    const ds = player.s - car.s;
    if (ds >= 0 && ds < forward + 40) return false;
    // The player may accelerate to maximum speed while the NPC is passing.
    if (ds < 0 && -ds < Math.max(0, player.maxSpeed - Math.min(car.speed, truck.speed)) * (duration + 3) + 60) return false;
  }
  return true;
}

export function startOvertake(car, truck) {
  car.ai.pass = { truck, phase: 'out' };
}

/** Advance a smooth lane change, returning true while occupying/reserving the
 * opposite lane. Caller updates longitudinal following/position separately. */
export function stepOvertake(car, dt, ownLane = 2.1, oppositeLane = -2.1) {
  const pass = car.ai.pass;
  if (!pass) return false;
  const laneRate = 1.2; // metres per second, ~3.5 seconds per lane change
  const target = pass.phase === 'back' ? ownLane : oppositeLane;
  car.offset += clamp(target - car.offset, -laneRate * dt, laneRate * dt);
  if (pass.phase === 'out' && Math.abs(car.offset - oppositeLane) < 0.02) pass.phase = 'passing';
  const clear = car.s - pass.truck.s > (car.length + pass.truck.length) * 0.5 + 12;
  if (pass.phase === 'passing' && clear) pass.phase = 'back';
  if (pass.phase === 'back' && Math.abs(car.offset - ownLane) < 0.02) {
    car.offset = ownLane; car.ai.pass = null; return false;
  }
  return true;
}
