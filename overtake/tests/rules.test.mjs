import test from 'node:test';
import assert from 'node:assert/strict';
import {
  multiplierFor, passScore, coastSpeed, steerRate, vehiclesOverlap, hitsRoadBarrier, blockedTrafficGap,
  canSpawnSame, canSpawnOncoming, findOncomingSpawn, sameSpawnInterval, oncomingSpawnInterval,
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
  assert.equal(canSpawnOncoming(500, [], []), true);
  assert.equal(canSpawnOncoming(500, [{ s: 550 }], []), false);
  assert.equal(canSpawnOncoming(500, [], [{ s: 490 }]), false);
});

test('spawn intervals tighten with speed but keep a floor', () => {
  assert.ok(sameSpawnInterval(20) > sameSpawnInterval(60));
  assert.ok(sameSpawnInterval(200) >= 0.65);
  assert.ok(oncomingSpawnInterval(20) > oncomingSpawnInterval(60));
  assert.ok(oncomingSpawnInterval(200) >= 0.45);
});

test('oncoming traffic is denser but leaves overtaking windows', () => {
  assert.equal(canSpawnOncoming(500, [{ s: 580 }], []), true);
  assert.equal(canSpawnOncoming(500, [{ s: 560 }], []), false);
  assert.equal(canSpawnOncoming(500, [], [{ s: 510 }]), false);
  assert.equal(canSpawnOncoming(500, [], [{ s: 100 }]), true);
});

test('road layout has two opposing lanes and a barrier', () => {
  assert.equal(PLAYER_LANE, -ONCOMING_LANE);
  assert.ok(PLAYER_LANE > 0);
  assert.ok(BARRIER_OFFSET > ROAD_HALF);
  assert.ok(ROAD_HALF > PLAYER_LANE + 0.9);
});

// Keep a stream of traffic even in dense, slow-moving same-direction traffic.
test('oncoming spawn searches all safe gaps and retries as traffic moves', () => {
  const same = Array.from({length: 12}, (_, i) => ({s: 60 + i * 40}));
  let traffic = [{s: 230}, {s: 390}, {s: 550}];
  for (let time = 0; time < 40; time += 0.5) {
    traffic = traffic.map(c => ({s: c.s - 14})).filter(c => c.s > -40);
    const s = findOncomingSpawn(0, traffic, same);
    if (s !== null) {
      assert.ok(s >= 230 && s <= 550);
      assert.ok(canSpawnOncoming(s, traffic, same));
      traffic.push({s});
    }
    assert.ok(traffic.some(c => c.s > 0 && c.s < 550));
  }
});

test('car hitboxes exclude mirrors and round off corner near misses', () => {
  assert.equal(vehiclesOverlap(0, 0, 4.8, 2.1, 4.8, 2.1), true);
  assert.equal(vehiclesOverlap(0, 1.8, 4.8, 2.1, 4.8, 2.1), false);
  assert.equal(vehiclesOverlap(4.2, 0, 4.8, 2.1, 4.8, 2.1), false);
  assert.equal(vehiclesOverlap(3.95, 1.58, 4.8, 2.1, 4.8, 2.1), false);
  assert.equal(vehiclesOverlap(3.0, 1.3, 4.8, 2.1, 4.8, 2.1), true);
});

test('guardrails stop the car body before it can drive outside the road', () => {
  assert.equal(hitsRoadBarrier(2.1, 2, 4.8, 0), false);
  assert.equal(hitsRoadBarrier(4.0, 2, 4.8, 0), true);
  assert.equal(hitsRoadBarrier(-4.0, 2, 4.8, 0), true);
  assert.equal(hitsRoadBarrier(3.4, 2, 4.8, 0.4), true);
});

test('two abreast cars do not form an unrealistically usable center lane', () => {
  const player = { s: 100, offset: 0, length: 4.2, width: 1.83 };
  const left = { s: 100, offset: -2.1, length: 4.5, width: 1.9 };
  const right = { s: 100, offset: 2.1, length: 4.8, width: 1.9 };
  assert.equal(blockedTrafficGap(player, [left, right]), true);
  assert.equal(blockedTrafficGap(player, [left]), false);
  assert.equal(blockedTrafficGap(player, [left, { ...right, s: 115 }]), false);
  assert.equal(blockedTrafficGap(player, [{ ...left, offset: -4 }, { ...right, offset: 4 }]), false);
  assert.equal(blockedTrafficGap({ ...player, offset: 3 }, [left, right]), false);
});
