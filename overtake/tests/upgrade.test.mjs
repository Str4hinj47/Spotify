import test from 'node:test';
import assert from 'node:assert/strict';
import { stepTraffic, findLeader, hazardAhead, createTrafficAI } from '../src/traffic-ai.mjs';
import { emptyRecords, sanitizeRecords, recordRun, bestFor } from '../src/records.mjs';
import { runSummary, createRun, registerPass } from '../src/run.mjs';

function car(s, speed, dir = 1, offset = 2.1) {
  return { s, speed, dir, offset, length: 4.5, width: 1.9, ai: createTrafficAI(speed) };
}

test('traffic brakes behind a slower leader instead of overlapping', () => {
  const follower = car(100, 24);
  const leader = car(118, 12);
  for (let i = 0; i < 40; i++) {
    stepTraffic(follower, leader, 0.1);
    leader.s += leader.speed * 0.1;
    follower.s += follower.speed * 0.1;
  }
  assert.ok(follower.speed < 18);
  assert.ok(follower.s < leader.s);
  assert.ok(leader.s - follower.s > 4);
});

test('findLeader ignores other lanes and opposing traffic', () => {
  const me = car(0, 20);
  const ahead = car(40, 15);
  const otherLane = car(30, 10, 1, -2.1);
  const oncoming = car(20, 25, -1, -2.1);
  assert.equal(findLeader(me, [otherLane, oncoming, ahead]), ahead);
});

test('hazard radar reports time-to-collision for overlapping traffic', () => {
  const player = { s: 0, offset: 2.1, speed: 30, width: 1.9, length: 4.5 };
  const h = hazardAhead(player, [car(80, 15)]);
  assert.ok(h);
  assert.equal(h.kind, 'traffic');
  assert.ok(h.ttc > 0 && h.ttc < 6);
  assert.equal(hazardAhead(player, [car(80, 15, 1, -2.1)]), null);
});

test('records keep per-mode bests and recent runs', () => {
  let rec = emptyRecords();
  const run = createRun('rush', 1);
  registerPass(run, 'same', false, 1);
  const a = recordRun(rec, runSummary(run, 'golf'));
  assert.equal(a.newBest, true);
  rec = a.records;
  assert.equal(bestFor(rec, 'rush'), 100);
  assert.equal(bestFor(rec, 'endless'), 0);
  const b = recordRun(rec, { ...runSummary(run, 'audi'), score: 50 });
  assert.equal(b.newBest, false);
  assert.equal(b.records.modes.rush.recent.length, 2);
  assert.equal(bestFor(b.records, 'rush'), 100);
});

test('sanitizeRecords rejects malformed data', () => {
  const rec = sanitizeRecords({ modes: { rush: { bestScore: -5, recent: [{ car: 'fake', score: 1 }, null] } } });
  assert.equal(rec.modes.rush.bestScore, 0);
  assert.equal(rec.modes.rush.recent.length, 0);
  assert.equal(sanitizeRecords(null).version, 2);
});
