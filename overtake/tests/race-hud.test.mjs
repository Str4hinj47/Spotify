import test from 'node:test';import assert from 'node:assert/strict';
import {TRACKS} from '../src/circuit.mjs';import {createRaceMap,createLapTiming,recordLapCrossings,raceGaps,lapComparison,rearProximity} from '../src/race-hud.mjs';

test('each minimap shows the real closed track and wraps racer positions',()=>{
 for(const track of TRACKS){const map=createRaceMap(track.id);assert.match(map.path,/^M/);assert.match(map.path,/ Z$/);const start=map.marker(0),lap=map.marker(track.length),near=map.marker(-1),other=map.marker(track.length-1);assert.ok(Math.hypot(start.x-lap.x,start.y-lap.y)<1e-5,track.id);assert.ok(Math.hypot(near.x-other.x,near.y-other.y)<1e-5,track.id);for(let s=0;s<track.length;s+=10){const p=map.marker(s);assert.ok(p.x>=8&&p.x<=142&&p.y>=8&&p.y<=92,track.id)}}
});
test('lap split times interpolate crossings and ignore backtracking and repeats',()=>{
 const timing=createLapTiming();assert.deepEqual(recordLapCrossings(timing,10,99,0,10,100,3),[]);
 assert.deepEqual(recordLapCrossings(timing,99,101,10,12,100,3),[11]);
 assert.deepEqual(recordLapCrossings(timing,101,99,12,13,100,3),[]);assert.deepEqual(recordLapCrossings(timing,99,101,13,14,100,3),[]);
 const next=recordLapCrossings(timing,199,201,30,32,100,3);assert.equal(next[0],20);
 const last=recordLapCrossings(timing,299,301,48,50,100,3);assert.equal(last[0],18);assert.deepEqual(timing.lapTimes,[11,20,18]);
});
test('a single physics step crossing several boundaries records each only once',()=>{
 const timing=createLapTiming();const result=recordLapCrossings(timing,0,350,0,35,100,3);assert.deepEqual(result,[10,10,10]);assert.deepEqual(recordLapCrossings(timing,350,450,35,45,100,3),[]);
});

test('race gaps use unwrapped standings and cap finished cars at the line',()=>{
 const {ahead,behind}=raceGaps(990,[{progress:1005},{progress:980},{progress:1001},{progress:970}],3000);
 assert.deepEqual(ahead,{distance:11,finished:false});assert.deepEqual(behind,{distance:10,finished:false});
 assert.deepEqual(raceGaps(2990,[{progress:3500},{progress:2900}],3000),{ahead:{distance:10,finished:true},behind:{distance:90,finished:false}});
 assert.deepEqual(raceGaps(5,[],3000),{ahead:null,behind:null});
 assert.equal(raceGaps(100,[{progress:100}],3000).behind.distance,0);
});
test('lap comparison uses the best previous lap, including ties',()=>{
 assert.equal(lapComparison([]),null);
 assert.deepEqual(lapComparison([60]),{lap:1,time:60,delta:null,best:true});
 assert.deepEqual(lapComparison([60,58]),{lap:2,time:58,delta:-2,best:true});
 assert.deepEqual(lapComparison([60,58,59]),{lap:3,time:59,delta:1,best:false});
 assert.deepEqual(lapComparison([60,60]),{lap:2,time:60,delta:0,best:false});
});

test('rear proximity detects cars across the seam, irrespective of their race lap',()=>{
 assert.equal(rearProximity(5,[{progress:995}],1000),10);
 assert.equal(rearProximity(1005,[{progress:995}],1000),10);
 assert.equal(rearProximity(20,[{progress:21}],1000),null);
 assert.equal(rearProximity(20,[{progress:19},{progress:10}],1000),1);
 assert.equal(rearProximity(20,[{progress:19}],0),null);
});
