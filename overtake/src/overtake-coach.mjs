// Advisory overtaking coach. It never steers or brakes for the player; it only
// estimates whether the current gap is long enough to complete a pass.
import { PLAYER_LANE, ONCOMING_LANE } from './rules.mjs';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function assessOvertake(player, traffic, opts = {}) {
  const margin = opts.margin ?? 2.0;
  const lookAhead = opts.lookAhead ?? 180;
  const inPassLane = player.offset < 0.7;
  const halfSum = (player.length ?? 4.5) * 0.5;

  let target = null;
  for (const t of traffic) {
    if (t.dir !== 1 || t.offset < 0.6) continue;
    const ds = t.s - player.s;
    if (ds < -halfSum - (t.length ?? 4.5) * 0.5 - 2 || ds > lookAhead) continue;
    if (player.speed <= t.speed + 1.5) continue;
    if (!target || ds < target.s - player.s) target = t;
  }

  let oncoming = null;
  for (const t of traffic) {
    if (t.dir !== -1) continue;
    const ds = t.s - player.s;
    if (ds <= 0 || ds > lookAhead * 2) continue;
    if (!oncoming || ds < oncoming.s - player.s) oncoming = t;
  }
  const oncomingTime = oncoming ? (oncoming.s - player.s) / Math.max(1, player.speed + oncoming.speed) : null;

  if (inPassLane) {
    if (oncomingTime !== null && oncomingTime < 4.0) {
      return { state: 'danger', label: 'RETURN NOW', seconds: oncomingTime };
    }
    if (target && target.s - player.s > 0) {
      return { state: 'passing', label: 'PASSING', seconds: null };
    }
    return { state: 'return', label: 'RETURN RIGHT', seconds: null };
  }

  if (!target) return { state: 'clear', label: '', seconds: null };
  const gap = Math.max(0, target.s - player.s - halfSum - (target.length ?? 4.5) * 0.5);
  const closing = Math.max(1, player.speed - target.speed);
  const passTime = (gap + (target.length ?? 4.5) + (player.length ?? 4.5) + 16) / closing;
  if (oncomingTime === null) {
    return { state: 'go', label: 'PASS WINDOW', seconds: passTime };
  }
  const window = oncomingTime - passTime;
  if (window >= margin) return { state: 'go', label: 'PASS WINDOW', seconds: window };
  return { state: 'wait', label: 'WAIT FOR GAP', seconds: oncomingTime };
}
