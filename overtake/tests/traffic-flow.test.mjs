import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSpawnSame, sameSpawnInterval, oncomingSpawnInterval,
  createOncomingScheduler, planOncomingSpawn,
} from '../src/rules.mjs';

// Regression for the multi-kilometre oncoming drought: the old spawner could
// veto every candidate because a same-direction car sat near a fixed offset.
// The scheduled flow must keep passing the player even on a long high-speed run.
test('long run never loses oncoming traffic for kilometres', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const playerSpeed = 55;
  const dt = 0.05;
  let p = 0;
  let same = [];
  let oncoming = [];
  let sameTimer = 0.5;
  let oncomingTimer = 0.8;
  const schedule = createOncomingScheduler(1600);
  let lastPass = 0;
  let maxGap = 0;
  let passes = 0;

  while (p < 20000) {
    p += playerSpeed * dt;
    sameTimer -= dt;
    oncomingTimer -= dt;
    if (sameTimer <= 0 && same.length < 12) {
      for (let a = 0; a < 6; a++) {
        const s = p + 200 + rand() * 160;
        if (canSpawnSame(s, same)) { same.push({ s, speed: 14 + rand() * 10 }); break; }
      }
      sameTimer = sameSpawnInterval(playerSpeed) * (0.8 + rand() * 0.5);
    }
    if (oncomingTimer <= 0 && oncoming.length < 16) {
      const s = planOncomingSpawn(schedule, p, oncoming, rand);
      if (s !== null) oncoming.push({ s, speed: 24 + rand() * 10 });
      const breather = schedule.lastBreather ? 2.6 : 1;
      oncomingTimer = oncomingSpawnInterval(playerSpeed) * (0.75 + rand() * 0.5) * breather;
    }
    for (const c of same) c.s += c.speed * dt;
    for (const c of oncoming) c.s -= c.speed * dt;
    same = same.filter((c) => c.s > p - 70);
    const keep = [];
    for (const c of oncoming) {
      if (c.s < p - 90) {
        passes++;
        maxGap = Math.max(maxGap, p - lastPass);
        lastPass = p;
      } else keep.push(c);
    }
    oncoming = keep;
  }

  assert.ok(passes > 40, `expected a busy road, got ${passes} oncoming passes`);
  assert.ok(maxGap < 900, `oncoming drought of ${Math.round(maxGap)} m`);
});
