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
