import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tickRun, registerPass, contractProgress, medalFor, runSummary, RUN_MODES } from '../src/run.mjs';
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

test('passes score and build combo', () => {
  const run = createRun('endless', 3);
  const { points } = registerPass(run, 'same', true, 1);
  assert.equal(points, 150);
  assert.equal(run.overtakes, 1);
  assert.equal(run.nearMisses, 1);
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

test('run and driving contain no nitro acceleration', () => {
  const run = createRun('rush', 5);
  assert.equal('boostCharge' in run, false);
  const a = createVehicleState(), b = createVehicleState(); a.speed = b.speed = 30;
  stepVehicle(a, pedals, params, 0.05, 0);
  stepVehicle(b, pedals, { ...params, boost: true, boostAccel: 50 }, 0.05, 0);
  assert.equal(a.speed, b.speed);
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

 test('signal bonus is flat and applies only to completed same-direction passes', () => {
  const normal = createRun('endless', 3), signaled = createRun('endless', 3);
  assert.equal(registerPass(signaled, 'same', true, 1, true).points - registerPass(normal, 'same', true, 1).points, 50);
  assert.equal(registerPass(signaled, 'oncoming', true, 1, true).points, registerPass(normal, 'oncoming', true, 1).points);
  signaled.finished = true;
  assert.equal(registerPass(signaled, 'same', false, 1, true).points, 0);
});

test('records retain Challenger and R8 runs on reload', async () => {
  const { emptyRecords, recordRun, sanitizeRecords } = await import('../src/records.mjs');
  let records = emptyRecords();
  for (const car of ['r8', 'challenger']) {
    records = recordRun(records, { mode: 'endless', car, score: 100, distance: 200, overtakes: 0, nearMisses: 0, oncomingDodges: 0, topSpeed: 0, contractsDone: 0, elapsed: 1, reason: null, date: 1 }).records;
  }
  assert.deepEqual(sanitizeRecords(JSON.parse(JSON.stringify(records))).modes.endless.recent.map(run => run.car), ['challenger', 'r8']);
});

test('time trial finishes at 3 km and records only completed fastest times', async () => {
  const { emptyRecords, recordRun, sanitizeRecords } = await import('../src/records.mjs');
  const run=createRun('trial',1); run.distance=2999; run.elapsed=100;
  const events=tickRun(run,.1,20); assert.equal(run.reason,'distance');assert.equal(run.distance,3000);assert.ok(Math.abs(run.elapsed-100.05)<1e-9);assert.equal(events[0].reason,'distance');
  let records=recordRun(emptyRecords(),runSummary(run,'golf')).records;
  assert.equal(records.modes.trial.bestTime,run.elapsed);
  const crash={...runSummary(run,'golf'),elapsed:20,reason:'crash'};
  assert.equal(recordRun(records,crash).newBest,false);
  assert.equal(sanitizeRecords(records).modes.trial.bestTime,run.elapsed);
});
test('daily and weekly challenges rotate on UTC boundaries and finish on completion', async () => {
  const {eventFor}=await import('../src/run.mjs');const t=Date.UTC(2026,0,5,12);
  assert.equal(eventFor('daily',t).period,eventFor('daily',t+1000).period);
  assert.notEqual(eventFor('daily',t).period,eventFor('daily',t+86400000).period);
  assert.equal(eventFor('weekly',t).period,eventFor('weekly',t+6*86400000).period);
  assert.notEqual(eventFor('weekly',t).period,eventFor('weekly',t+7*86400000).period);
  const run=createRun('daily',4,t);const c=run.contracts[0];run[c.metric]=c.target;
  const events=tickRun(run,0,0);assert.equal(run.reason,'objective');assert.equal(run.score,c.reward);assert.ok(events.some(e=>e.type==='finish'&&e.reason==='objective'));
});
test('near-miss challenge rewards close passes more than clean passes',()=>{
  const close=createRun('near',1),wide=createRun('near',1);
  assert.ok(registerPass(close,'same',true).points>registerPass(wide,'same',false).points*2);
});
