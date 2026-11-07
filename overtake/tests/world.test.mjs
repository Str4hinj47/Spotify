import test from 'node:test';
import assert from 'node:assert/strict';
import { biomeWeights, biomeParams, biomeContinuity, BIOME_IDS } from '../src/world/biomes.mjs';
import { createWeatherState, stepWeather, weatherGrip, weatherLabel } from '../src/world/weather.mjs';
import { createClock, stepClock, dayFactor, formatHour } from '../src/world/clock.mjs';

test('biome weights always sum to one and stay non-negative', () => {
  for (let s = -5000; s < 20000; s += 137) {
    const w = biomeWeights(s);
    const sum = BIOME_IDS.reduce((a, id) => a + w[id], 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    for (const id of BIOME_IDS) assert.ok(w[id] >= 0 && w[id] <= 1);
  }
});

test('biome parameters change gradually, never snap', () => {
  let max = 0;
  for (let s = 0; s < 20000; s += 25) max = Math.max(max, biomeContinuity(s, 1));
  assert.ok(max < 0.01, `max per-metre change ${max}`);
});

test('biome colours are valid packed RGB', () => {
  for (let s = 0; s < 12000; s += 400) {
    const p = biomeParams(s);
    for (const key of ['ground', 'shoulder', 'fog', 'tree', 'conifer', 'rock', 'building', 'mountain']) {
      assert.ok(Number.isInteger(p[key]) && p[key] >= 0 && p[key] <= 0xffffff);
    }
  }
});

test('forced weather damps in and out instead of switching instantly', () => {
  const w = createWeatherState('rain');
  stepWeather(w, 0.1);
  assert.ok(w.rain > 0 && w.rain < 0.1);
  for (let i = 0; i < 200; i++) stepWeather(w, 0.1);
  assert.ok(w.rain > 0.95);
  w.mode = 'clear';
  stepWeather(w, 0.1);
  assert.ok(w.rain < 0.99 && w.rain > 0.5);
});

test('snow and rain reduce grip, clear weather restores it', () => {
  const clear = createWeatherState('clear');
  const rain = createWeatherState('rain');
  const snow = createWeatherState('snow');
  for (let i = 0; i < 400; i++) { stepWeather(rain, 0.1); stepWeather(snow, 0.1); }
  assert.equal(weatherGrip(clear), 1);
  assert.ok(weatherGrip(rain) < 0.95);
  assert.ok(weatherGrip(snow) < weatherGrip(rain));
  assert.ok(weatherGrip(snow) >= 0.55);
});

test('weather labels reflect intensity', () => {
  const w = createWeatherState('snow');
  assert.equal(weatherLabel(w), 'Clear');
  for (let i = 0; i < 300; i++) stepWeather(w, 0.1);
  assert.equal(weatherLabel(w), 'Snow');
});

test('day-night clock wraps and day factor peaks at noon', () => {
  const c = createClock(23.9, 8, true);
  stepClock(c, 10);
  assert.ok(c.hour >= 0 && c.hour < 24);
  assert.ok(dayFactor(12) > 0.99);
  assert.ok(dayFactor(0) < 0.01);
  assert.equal(formatHour(9.5), '09:30');
});
