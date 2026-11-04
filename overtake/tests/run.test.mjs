import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tickRun, registerPass, contractProgress, medalFor, runSummary, BOOST, RUN_MODES } from '../src/run.mjs';
import { createVehicleState, stepVehicle } from '../src/physics.mjs';

const pedals = { throttle: true, brake: false, left: false, right: false, handbrake: false };
const params = { accel: 9, maxSpeed: 54, grip: 1, brake: 10, wheelbase: 2.6, maxSteer: 0.5, understeer: 0.003, yawResponse: 7, steerResponse: 7, drag: 0.0008 };

test('rush mode finishes after its duration and endless does not', () => {
  const rush = createRun('rush', 7);
  for (let i = 0; i < 1201; i++) tickRun(rush, 0.1, 30, pedals);
  assert.equal(rush.finished, true);
  assert.equal(rush.reason, 'time');
  const endless = createRun('endless', 7);
  for (let i = 0; i < 100; i++) tickRun(endless, 0.1, 30, pedals);
  assert.equal(endless.finished, false);
  assert.equal(endless.timeLeft, null);
});

test('passes score, build combo and charge boost', () => {
  const run = createRun('endless', 3);
  const before = run.boostCharge;
  const { points } = registerPass(run, 'same', true, 1);
  assert.equal(points, 150);
  assert.equal(run.overtakes, 1);
  assert.equal(run.nearMisses, 1);
  assert.ok(run.boostCharge > before);
  assert.ok(run.boostCharge <= 1);
});

test('contracts complete sequentially and pay rewards', () => {
  const run = createRun('endless', 11);
  assert.equal(run.contracts.length, 3);
  assert.equal(run.contracts[0].metric, 'overtakes');
  for (let i = 0; i < 5; i++) registerPass(run, 'same', false, 1);
  assert.equal(run.contractsDone, 1);
  assert.equal(run.contractIndex, 1);
  assert.ok(run.score >= 500 + run.contracts[0].reward);
  const prog = contractProgress(run);
  assert.ok(prog.contract);
  assert.ok(prog.ratio >= 0 && prog.ratio <= 1);
});

test('boost only fires with charge, throttle and speed, then drains', () => {
  const run = createRun('rush', 5);
  run.boostHeld = true;
  tickRun(run, 0.1, 2, pedals);
  assert.equal(run.boostActive, false);
  tickRun(run, 0.1, 25, pedals);
  assert.equal(run.boostActive, true);
  const charge = run.boostCharge;
  tickRun(run, 0.1, 25, pedals);
  assert.ok(run.boostCharge < charge);
  run.boostCharge = 0;
  tickRun(run, 0.1, 25, pedals);
  assert.equal(run.boostActive, false);
});

test('boost raises acceleration and overspeed decays smoothly after release', () => {
  const normal = createVehicleState(); normal.speed = 30;
  const boosted = createVehicleState(); boosted.speed = 30;
  stepVehicle(normal, pedals, params, 0.1, 0);
  stepVehicle(boosted, pedals, { ...params, boost: true, boostAccel: BOOST.accel, boostSpeed: BOOST.extraSpeed }, 0.1, 0);
  assert.ok(boosted.speed > normal.speed);
  boosted.speed = params.maxSpeed + 10;
  const over = boosted.speed;
  stepVehicle(boosted, { ...pedals, throttle: false }, params, 0.1, 0);
  assert.ok(boosted.speed < over);
  assert.ok(boosted.speed > params.maxSpeed);
});

test('medals and summaries are mode-aware', () => {
  assert.equal(medalFor('rush', RUN_MODES.rush.medals.gold), 'gold');
  assert.equal(medalFor('endless', 10), null);
  const run = createRun('rush', 9);
  registerPass(run, 'same', false, 1);
  const s = runSummary(run, 'golf');
  assert.equal(s.mode, 'rush');
  assert.equal(s.car, 'golf');
  assert.equal(s.overtakes, 1);
});
