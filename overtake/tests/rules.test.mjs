import test from 'node:test';
import assert from 'node:assert/strict';
import {
  multiplierFor, passScore, coastSpeed, steerRate,
  canSpawnSame, canSpawnOncoming, sameSpawnInterval, oncomingSpawnInterval,
  createOncomingScheduler, planOncomingSpawn, ONCOMING_MIN_GAP,
  ROAD_HALF, PLAYER_LANE, ONCOMING_LANE, BARRIER_OFFSET,
} from '../src/rules.mjs';

test('multiplier grows every 5 passes and caps at 5', () => {
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(4), 1);
  assert.equal(multiplierFor(5), 2);
  assert.equal(multiplierFor(24), 5);
  assert.equal(multiplierFor(100), 5);
});

test('pass scoring rewards overtakes, near misses and oncoming dodges', () => {
  assert.equal(passScore(1, 'same', false, 1), 100);
  assert.equal(passScore(1, 'same', true, 1), 150);
  assert.equal(passScore(5, 'same', false, 1), 200);
  assert.equal(passScore(1, 'oncoming', true, 1), 125);
  assert.equal(passScore(5, 'oncoming', true, 1.2), 300);
});

test('coasting slows the car without an instant stop', () => {
  assert.ok(coastSpeed(40, 0.1) < 40);
  assert.ok(coastSpeed(40, 0.1) > 38);
  assert.equal(coastSpeed(0, 1), 0);
});

test('steering needs speed and tapers near top speed', () => {
  assert.equal(steerRate(0, 60, 2), 0);
  assert.ok(steerRate(20, 60, 2) > 0);
  assert.ok(steerRate(60, 60, 2) < steerRate(25, 60, 2));
});

test('same-direction traffic keeps a passable gap', () => {
  assert.equal(canSpawnSame(200, []), true);
  assert.equal(canSpawnSame(200, [{ s: 220 }]), false);
  assert.equal(canSpawnSame(200, [{ s: 250 }]), true);
});

test('oncoming traffic is spaced and not paired into an unavoidable wall', () => {
  assert.equal(canSpawnOncoming(500, []), true);
  assert.equal(canSpawnOncoming(500, [{ s: 550 }]), false);
  assert.equal(canSpawnOncoming(500, [{ s: 500 + ONCOMING_MIN_GAP }]), true);
});

test('spawn intervals tighten with speed but keep a floor', () => {
  assert.ok(sameSpawnInterval(20) > sameSpawnInterval(60));
  assert.ok(sameSpawnInterval(200) >= 0.65);
  assert.ok(oncomingSpawnInterval(20) > oncomingSpawnInterval(60));
  assert.ok(oncomingSpawnInterval(200) >= 0.45);
});

test('oncoming traffic is denser but leaves overtaking windows', () => {
  assert.equal(canSpawnOncoming(500, [{ s: 620 }]), true);
  assert.equal(canSpawnOncoming(500, [{ s: 560 }]), false);
  const state = createOncomingScheduler();
  const cars = [];
  for (let i = 0; i < 4; i++) {
    const s = planOncomingSpawn(state, 0, cars, () => 0.5);
    assert.ok(s !== null);
    cars.push({ s });
  }
  cars.sort((a, b) => a.s - b.s);
  const gaps = cars.slice(1).map((c, i) => c.s - cars[i].s);
  // Every spawned car keeps a reactable gap; after a short platoon the
  // scheduler marks a breather window for overtaking.
  assert.ok(gaps.every((g) => g >= ONCOMING_MIN_GAP));
  assert.equal(cars.length, 4);
  assert.equal(state.lastBreather, true);
});

test('oncoming scheduler keeps a steady stream past same-direction traffic', () => {
  const state = createOncomingScheduler();
  const sameDir = [{ s: 1120 }, { s: 1180 }, { s: 1240 }];
  const s = planOncomingSpawn(state, 800, [], () => 0.25);
  assert.ok(s !== null && s >= 1140);
  // Same-direction cars no longer veto the spawn.
  assert.ok(sameDir.length === 3);
  assert.ok(state.platoon >= 1);
});

test('road layout has two opposing lanes and a barrier', () => {
  assert.equal(PLAYER_LANE, -ONCOMING_LANE);
  assert.ok(PLAYER_LANE > 0);
  assert.ok(BARRIER_OFFSET > ROAD_HALF);
  assert.ok(ROAD_HALF > PLAYER_LANE + 0.9);
});
