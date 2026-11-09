import test from 'node:test';import assert from 'node:assert/strict';
import { SCENARIOS,rankFor,rankedOutcome,applyRankedResult,emptyRanked,sanitizeRanked } from '../src/ranked.mjs';
import {createRun,tickRun} from '../src/run.mjs';
test('ranked races cover five circuits including two drift tracks',()=>{assert.equal(SCENARIOS.length,5);assert.equal(SCENARIOS.filter(s=>s.kind==='drift').length,2);assert.equal(new Set(SCENARIOS.map(s=>s.trackId)).size,5);});
test('ranked placements give podium RP; lower places and quitting lose RP',()=>{
 const run={rankedScenario:'stadium',reason:'distance',elapsed:100,racePosition:1};
 for(const [pos,delta,medal] of [[1,40,'gold'],[2,28,'silver'],[3,18,'bronze'],[4,-12,null],[6,-12,null]]){const o=rankedOutcome({...run,racePosition:pos});assert.equal(o.delta,delta);assert.equal(o.medal,medal);}
 let a=applyRankedResult(emptyRanked(),run);assert.equal(a.delta,40);assert.equal(a.state.scenarios.stadium.bestMedal,'gold');
 a=applyRankedResult(a.state,{...run,reason:'quit'});assert.equal(a.delta,-12);assert.equal(applyRankedResult(emptyRanked(),{...run,reason:'quit'}).delta,0);
});
test('Dev runs never alter rank',()=>{const state={...emptyRanked(),points:100};const r=applyRankedResult(state,{rankedScenario:'stadium',reason:'distance',elapsed:100,racePosition:1},true);assert.equal(r.delta,0);assert.deepEqual(r.state,state)});
test('old highway scenario history and rank survive migration',()=>{
 const old={version:1,points:250,attempts:9,scenarios:{needle:{completions:3,bestTime:70,bestMedal:'silver'}}};const p=sanitizeRanked(old);assert.equal(p.points,250);assert.deepEqual(p.scenarios.needle,old.scenarios.needle);assert.equal(rankFor(120).rank.id,'street');
});
test('ranked race no longer triggers timed highway objectives',()=>{const r=createRun('ranked',1,0,'summit');assert.equal(r.timeLeft,null);assert.equal(r.contracts.length,0);r.distance=3000;tickRun(r,.1,20);assert.equal(r.finished,false);});

test('new circuit layouts preserve old history without comparing old times',()=>{
 const old={version:1,points:250,attempts:9,scenarios:{stadium:{completions:3,bestTime:70,bestMedal:'silver'}}};
 const migrated=sanitizeRanked(old),stats=migrated.scenarios.stadium;
 assert.equal(migrated.points,250);assert.equal(stats.completions,3);assert.equal(stats.bestMedal,'silver');
 assert.equal(stats.bestTime,null);assert.equal(stats.legacyBestTime,70);assert.equal(stats.layoutRevision,2);
 assert.deepEqual(sanitizeRanked(migrated),migrated,'migration and backup sanitizing must be idempotent');
 const result=applyRankedResult(migrated,{rankedScenario:'stadium',reason:'distance',elapsed:125,racePosition:1});
 assert.equal(result.state.scenarios.stadium.bestTime,125);assert.equal(result.state.scenarios.stadium.legacyBestTime,70);
 assert.deepEqual(sanitizeRanked(result.state),result.state);
});
