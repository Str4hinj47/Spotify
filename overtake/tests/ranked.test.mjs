import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, rankFor, rankedOutcome, applyRankedResult, emptyRanked, sanitizeRanked } from '../src/ranked.mjs';
const runFor=s=>({rankedScenario:s.id,reason:'distance',elapsed:s.gold,distance:s.distance,[s.metric]:s.target});
test('each scenario has a hard, ordered finish and objective',()=>{
 for(const s of SCENARIOS){assert.ok(s.gold<s.silver&&s.silver<s.limit);const r=runFor(s);assert.equal(rankedOutcome(r).medal,'gold');r.elapsed=s.silver;assert.equal(rankedOutcome(r).medal,'silver');r.elapsed=s.limit;assert.equal(rankedOutcome(r).medal,'bronze');r.elapsed=s.limit+1;assert.equal(rankedOutcome(r).success,false);r.elapsed=s.gold;r[s.metric]=s.target-1;assert.equal(rankedOutcome(r).success,false);}
});
test('wins award points and losses/quit deduct without dropping below zero',()=>{
 const r=runFor(SCENARIOS[0]);let result=applyRankedResult(emptyRanked(),r);assert.equal(result.delta,40);assert.equal(result.state.scenarios.slipstream.bestMedal,'gold');
 result=applyRankedResult(result.state,{...r,reason:'quit'});assert.equal(result.delta,-12);result=applyRankedResult(emptyRanked(),{...r,reason:'crash'});assert.equal(result.delta,0);assert.equal(result.state.points,0);
});
test('dev runs never affect rank or attempts',()=>{const state={...emptyRanked(),points:100};const result=applyRankedResult(state,runFor(SCENARIOS[0]),true);assert.equal(result.delta,0);assert.deepEqual(result.state,state);});
test('promotions and demotions calculate from thresholds and invalid state is bounded',()=>{
 const state={...emptyRanked(),points:110};const promotion=applyRankedResult(state,runFor(SCENARIOS[0]));assert.equal(promotion.before.rank.id,'rookie');assert.equal(promotion.after.rank.id,'street');
 assert.equal(rankFor(120).rank.id,'street');assert.equal(rankFor(119).rank.id,'rookie');assert.equal(rankFor(99999).rank.id,'legend');assert.equal(sanitizeRanked({version:1,points:Infinity}).points,0);
});

test('ranked timer and finish line enforce objectives at exact crossing', async()=>{
 const {createRun,tickRun}=await import('../src/run.mjs');const scenario=SCENARIOS[0];
 const r=createRun('ranked',1,0,scenario.id);r.distance=scenario.distance-1;r.overtakes=scenario.target;r.elapsed=30;r.timeLeft=.1;
 const events=tickRun(r,.1,20);assert.equal(r.reason,'distance');assert.equal(r.distance,scenario.distance);assert.ok(Math.abs(r.elapsed-30.05)<1e-8);assert.equal(events.length,1);
 const missed=createRun('ranked',1,0,scenario.id);missed.distance=scenario.distance-1;tickRun(missed,.1,20);assert.equal(missed.reason,'objective_failed');
 const timeout=createRun('ranked',1,0,scenario.id);timeout.distance=scenario.distance-2;timeout.timeLeft=.05;tickRun(timeout,.1,20);assert.equal(timeout.reason,'time');assert.equal(timeout.distance,scenario.distance-1);
 const edge=createRun('ranked',1,0,scenario.id);edge.distance=scenario.distance-1;edge.overtakes=scenario.target;edge.timeLeft=.05;tickRun(edge,.1,20);assert.equal(edge.reason,'distance');
});
