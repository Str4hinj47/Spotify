// Lightweight traffic behaviour: cooperative car-following in the driving
// lane, predictable oncoming flow, and a time-to-collision hazard radar.
// Traffic never swerves into the player; slower leaders simply cause braking.

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

/** Slipstream: close behind a slower same-direction car, but not touching. */
export function slipstreamGain(player, traffic) {
  for (const t of traffic) {
    if (t.dir !== 1) continue;
    const ds = t.s - player.s;
    if (ds < 5 || ds > 28) continue;
    if (Math.abs(t.offset - player.offset) > 1.5) continue;
    if (player.speed < 14 || player.speed <= t.speed) continue;
    return 1 - (ds - 5) / 23;
  }
  return 0;
}
