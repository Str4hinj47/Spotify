import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { snowDriftHeight } from '../src/world/road-snow.mjs';

const half = 4.2;
test('snow geometry accumulates gradually and forms raised banks', () => {
  for (const s of [0, 23, 780, 10400]) {
    assert.equal(snowDriftHeight(0, s, 0, half), 0);
    const middle = snowDriftHeight(0, s, 1, half);
    const shoulder = snowDriftHeight(4.7, s, 1, half);
    assert.ok(shoulder > middle && shoulder < 0.23);
    assert.equal(snowDriftHeight(4.7, s, 0.5, half), shoulder * 0.5);
    assert.equal(snowDriftHeight(4.7, s, 1, half), snowDriftHeight(4.7, s, 1, half));
  }
});

test('the local CC0 road texture set contains valid image data', async () => {
  for (const material of ['asphalt', 'gravel', 'snow']) for (const map of ['albedo', 'normal']) {
    const path = new URL(`../public/textures/road/${material}-${map}.jpg`, import.meta.url);
    const bytes = await readFile(path);
    assert.ok(bytes.length > 10000, `${material}-${map} is missing or not an image`);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  }
});

test('snow ruts and drifting remain bounded and continuous across road distances', () => {
  for (let s = -100; s < 1500; s += 7.2) {
    const center = snowDriftHeight(0, s, 1, half);
    const rut = snowDriftHeight(1.25, s, 1, half);
    assert.ok(rut >= 0 && rut < 0.08);
    assert.ok(center >= 0 && center < 0.08);
    assert.ok(Math.abs(snowDriftHeight(4.6, s + 0.01, 1, half) - snowDriftHeight(4.6, s, 1, half)) < 0.001);
    assert.equal(snowDriftHeight(1.25, s, -5, half), 0);
    assert.equal(snowDriftHeight(1.25, s, 5, half), rut);
  }
});
