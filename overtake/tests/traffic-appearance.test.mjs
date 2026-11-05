import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTrafficModel, chooseTrafficPaint } from '../src/traffic-appearance.mjs';

test('nearby traffic across both directions gets different available models', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const cars = [{ id: 'a', s: 100 }, { id: 'b', s: 180 }, { id: 'c', s: 260 }];
  assert.equal(chooseTrafficModel(ids, cars, 210, () => 0), 'd');
  assert.equal(chooseTrafficModel(ids, [], 0, () => 0), 'a');
});

test('when all models are nearby the least used model wins', () => {
  const cars = [{ id: 'a', s: 0 }, { id: 'a', s: 40 }, { id: 'b', s: 10 }, { id: 'c', s: 20 }];
  assert.equal(chooseTrafficModel(['a', 'b', 'c'], cars, 0, () => 0), 'b');
});

test('neighboring paints contrast and a safe saved color remains respected', () => {
  const palette = [0xff0000, 0x0000ff, 0xffffff, 0x151515];
  const cars = [{ s: 20, paint: 0xff0000 }];
  const selected = chooseTrafficPaint(palette, cars, 40, 0xff0000, () => 0);
  assert.notEqual(selected, 0xff0000);
  assert.equal(chooseTrafficPaint(palette, cars, 40, 0x0000ff, () => 0), 0x0000ff);
});
