import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tickRun, registerPass, runSummary, eventFor } from '../src/run.mjs';
import { emptyRecords, recordRun, bestFor } from '../src/records.mjs';
import { sanitizeGhost, saveGhost, loadGhost, ghostAt, GHOST_PREFIX } from '../src/ghost.mjs';
import { CAR_CONTENT } from '../src/content/cars.mjs';

test('seasonal challenge rotates and its local best resets by UTC quarter', () => {
  const q1 = Date.UTC(2026, 2, 31, 23, 59), q2 = Date.UTC(2026, 3, 1);
  assert.notEqual(eventFor('seasonal', q1).period, eventFor('seasonal', q2).period);
  const r = createRun('seasonal', 1, q1); assert.equal(r.timeLeft, 180);
  const metric = r.contracts[0].metric; r[metric] = r.contracts[0].target; tickRun(r, .01, 0);
  assert.equal(r.reason, 'objective');
  const { records } = recordRun(emptyRecords(), runSummary(r, 'golf', q1));
  assert.ok(bestFor(records, 'seasonal', q1) > 0); assert.equal(bestFor(records, 'seasonal', q2), 0);
});
test('convoy ends after six passes and ghost ends at 3 km', () => {
  const r = createRun('convoy'); assert.equal(r.timeLeft, 150);
  for (let i=0;i<6;i++) registerPass(r, 'same', false);
  assert.equal(r.reason, 'objective'); assert.equal(r.overtakes, 6);
  const g = createRun('ghost'); g.distance = 2999; tickRun(g, .1, 30);
  assert.equal(g.reason, 'distance'); assert.equal(g.distance, 3000); assert.equal(g.contracts.length,0);
});
test('local ghost storage is per-car, validated, interpolated and only replaced by a faster completed replay', () => {
  const map = new Map(), storage = { getItem:k=>map.get(k) ?? null, setItem:(k,v)=>map.set(k,v) };
  const replay = {version:1,time:100,samples:[[0,0,2,0],[50,1480,1,1500],[100,2970,-1,3000]]};
  assert.equal(saveGhost(storage,'golf',replay),true); assert.deepEqual(ghostAt(loadGhost(storage,'golf'),25), [25,740,1.5,750]);
  assert.equal(loadGhost(storage,'skyline'),null); assert.equal(saveGhost(storage,'golf',{...replay,time:101,samples:[[0,0,2,0],[101,3000,0,3000]]}),false);
  assert.equal(saveGhost(storage,'golf',{...replay,time:99,samples:[[0,0,2,0],[99,3000,0,3000]]}),true);
  assert.equal(sanitizeGhost({...replay,samples:[[0,0,2,0],[50,3001,1,3001],[100,3000,0,3000]]}),null);
  map.set(GHOST_PREFIX+'broken','{'); assert.equal(loadGhost(storage,'broken'),null);
});
test('uploaded player cars exist but Toyota cannot be purchased', () => {
  const ids=CAR_CONTENT.map(c=>c.id); for(const id of ['bmw-m3','skyline','aventador','aventador-game']) assert.ok(ids.includes(id));
  assert.ok(!ids.includes('camry')); for (const c of CAR_CONTENT.filter(c=>['bmw-m3','skyline','aventador','aventador-game'].includes(c.id))) assert.equal(c.bodywork,true);
});

test('checkpoint bonuses are awarded in order, including a deadline crossing but not after expiry', () => {
  const r=createRun('checkpoint'); assert.equal(r.timeLeft,35); assert.equal(r.contracts.length,0);
  r.distance=499; r.timeLeft=.05; let events=tickRun(r,.1,20);
  assert.equal(r.distance,501); assert.ok(Math.abs(r.timeLeft-14.95)<1e-8); assert.equal(r.score,250);
  assert.ok(events.some(e=>e.type==='checkpoint')); assert.equal(r.finished,false);
  const late=createRun('checkpoint');late.distance=499;late.timeLeft=.04;events=tickRun(late,.1,20);
  assert.equal(late.reason,'time');assert.equal(late.score,0);assert.ok(late.distance<500);assert.equal(events.at(-1).reason,'time');
  assert.deepEqual(tickRun(late,.1,20),[]);
});
test('precision counts close overtakes, doubles their points and ends once', () => {
  const r=createRun('precision'), normal=createRun('endless');
  assert.equal(r.timeLeft,120);assert.equal(registerPass(r,'same',true).points,2*registerPass(normal,'same',true).points);
  for(let i=0;i<6;i++)registerPass(r,'same',true);
  const result=registerPass(r,'same',true);assert.equal(r.nearMisses,8);assert.equal(r.reason,'objective');
  assert.equal(r.contractsDone,1);assert.equal(result.events.filter(e=>e.type==='finish').length,1);
  assert.equal(registerPass(r,'same',true).points,0);
});
test('speed run awards only completed seconds above threshold and stops at timeout', () => {
  const r=createRun('speed');assert.equal(r.timeLeft,90);r.timeLeft=1.5;
  for(let i=0;i<10;i++)tickRun(r,.1,139/3.6);assert.equal(r.score,0);
  for(let i=0;i<5;i++)tickRun(r,.1,140/3.6);assert.equal(r.reason,'time');assert.equal(r.score,0);
  const fast=createRun('speed');fast.timeLeft=2.05;
  for(let i=0;i<22;i++)tickRun(fast,.1,40);
  assert.equal(fast.score,100);assert.equal(fast.reason,'time');assert.ok(Math.abs(fast.elapsed-2.05)<1e-6);
});
test('new mode records and old saves survive round trips and backup normalization', async () => {
  const {sanitizeRecords}=await import('../src/records.mjs'); const {normalizeSnapshot}=await import('../src/cloud-save.mjs');
  const {emptyProgression}=await import('../src/progression.mjs');
  let records=sanitizeRecords({version:2,modes:{endless:{bestScore:123}}});
  for(const mode of ['checkpoint','precision','speed']) {const r=createRun(mode);r.score=1500;records=recordRun(records,runSummary(r,'golf')).records;}
  const snapshot=normalizeSnapshot({schema:1,contentRevision:7,progression:emptyProgression(),paints:{},customizations:{golf:{livery:'flames',liveryColor:'#123456'}},records});
  assert.equal(snapshot.records.modes.endless.bestScore,123);
  for(const mode of ['checkpoint','precision','speed'])assert.equal(snapshot.records.modes[mode].bestScore,1500);
  assert.equal(snapshot.customizations.golf.livery,'flames');assert.equal(snapshot.customizations.golf.liveryColor,'#123456');
});
