import test from 'node:test';
import assert from 'node:assert/strict';
import {
  multiplierFor, passScore, coastSpeed, steerRate,
  canSpawnSame, canSpawnOncoming, sameSpawnInterval, oncomingSpawnInterval,
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
  assert.equal(canSpawnOncoming(500, [], [{ s: 240 }]), false);
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
  assert.equal(canSpawnOncoming(500, [], [{ s: 250 }]), false);
  assert.equal(canSpawnOncoming(500, [], [{ s: 100 }]), true);
});

test('road layout has two opposing lanes and a barrier', () => {
  assert.equal(PLAYER_LANE, -ONCOMING_LANE);
  assert.ok(PLAYER_LANE > 0);
  assert.ok(BARRIER_OFFSET > ROAD_HALF);
  assert.ok(ROAD_HALF > PLAYER_LANE + 0.9);
});
