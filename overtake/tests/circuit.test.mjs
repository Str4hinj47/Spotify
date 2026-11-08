import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACK_LENGTH,TRACK_STRAIGHT,TRACK_RADIUS,RACE_DISTANCE,RACE_LAPS,trackAt,trackPosition,racePosition,raceLap} from '../src/circuit.mjs';
import {emptyRecords,recordRun,sanitizeRecords} from '../src/records.mjs';
import {createRun,tickRun} from '../src/run.mjs';
import {createVehicleState,stepVehicle} from '../src/physics.mjs';
import {vehicleParameters} from '../src/car-performance.mjs';
import {ACTIVE_CAR_CONTENT} from '../src/content/cars.mjs';

test('stadium is a closed, continuous multi-corner circuit with consistent tangent',()=>{
 assert.deepEqual(trackAt(0),trackAt(TRACK_LENGTH));
 const bends=[];
 for(let d=0;d<TRACK_LENGTH;d+=5) {
  const a=trackAt(d),b=trackAt(d+.01);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.011);assert.ok(Math.abs(Math.sin((a.yaw-b.yaw)/2))<.01);
  if(Math.abs(a.curvature)>.003)bends.push(Math.sign(a.curvature));
 }
 assert.ok(bends.includes(1)&&bends.includes(-1),'must include turns in both directions');
 const p=trackPosition(22,5),c=trackAt(22);assert.ok(Math.abs(Math.hypot(p.x-c.x,p.z-c.z)-5)<1e-8);
});
test('race standings use unwrapped progress and count already finished opponents',()=>{
 const opponents=[{progress:100},{progress:500},{progress:RACE_DISTANCE},{progress:RACE_DISTANCE}];
 assert.equal(racePosition(200,opponents),4);
 assert.equal(racePosition(RACE_DISTANCE+1,opponents),3);
 assert.equal(raceLap(-36),1);assert.equal(raceLap(TRACK_LENGTH),2);assert.equal(raceLap(RACE_DISTANCE),RACE_LAPS);
});
test('circuit is an independent, untimed run and retains score records',()=>{
 const run=createRun('circuit',42);assert.equal(run.contracts.length,0);
 tickRun(run,1,20);assert.equal(run.finished,false);assert.equal(run.mode,'circuit');
 const result=recordRun(emptyRecords(),{mode:'circuit',car:'golf',score:800,distance:100,elapsed:5,reason:'distance'});
 assert.equal(sanitizeRecords(result.records).modes.circuit.bestScore,800);
});

test('circuit driving does not steer the car around a corner for the player',()=>{
 const vehicle=createVehicleState(),params={...vehicleParameters(ACTIVE_CAR_CONTENT[0],{engine:0,tires:0,brakes:0},'standard',1),roadAssist:false};
 vehicle.s=350;vehicle.speed=20;const initial=vehicle.offset;
 for(let i=0;i<100;i++)stepVehicle(vehicle,{throttle:false,brake:false,left:false,right:false,handbrake:false},params,.025,trackAt(vehicle.s).curvature);
 assert.ok(Math.abs(vehicle.offset-initial)>1,'the car should drift outward without steering');
});

test('five independent closed layouts are continuous and two are drift tracks',async()=>{
 const {TRACKS,trackSample,trackPoint}=await import('../src/circuit.mjs');assert.equal(TRACKS.length,5);assert.equal(TRACKS.filter(t=>t.kind==='drift').length,2);
 for(const track of TRACKS) {
  const a=trackSample(0,track.id),b=trackSample(track.length,track.id);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-6,track.id);
  assert.ok(track.length>500);for(let s=0;s<track.length;s+=5){const p=trackPoint(s,track.halfWidth,track.id);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.curvature),track.id);}
 }
});

test('all five tracks can be completed with appropriate steering and drift handling',async()=>{
 const {TRACKS,trackSample}=await import('../src/circuit.mjs'),{stepCircuitDriftVehicle}=await import('../src/drift.mjs');
 for(const track of TRACKS) {
  const spec=ACTIVE_CAR_CONTENT.find(c=>c.id===(track.kind==='drift'?'challenger':'golf'));
  const v=createVehicleState(),p={...vehicleParameters(spec,{engine:0,tires:0,brakes:0},'standard',1),roadAssist:false};v.s=-36;v.offset=-3;
  let steps=0,hits=0;while(v.s<track.length*track.laps && steps++<15000) {
   const c=trackSample(v.s,track.id).curvature,next=trackSample(v.s+30,track.id).curvature;
   const target=Math.min(33,Math.sqrt(5/Math.max(.001,Math.abs(c),Math.abs(next))));
   const desired=Math.max(-.25,Math.min(.25,v.offset*.025)),error=desired-v.heading;
   const controls={throttle:v.speed<target,brake:v.speed>target+1,left:error>.025,right:error<-.025,handbrake:false};
   (track.kind==='drift'?stepCircuitDriftVehicle:stepVehicle)(v,controls,p,.025,c);
   const limit=track.halfWidth-1;if(Math.abs(v.offset)>limit){v.offset=Math.max(-limit,Math.min(limit,v.offset));v.speed=Math.max(0,v.speed-16*.025);v.heading*=.8;hits++;}
  }
  assert.ok(v.s>=track.length*track.laps,`${track.id} unfinished`);assert.ok(hits<50,`${track.id} too difficult`);
 }
});
