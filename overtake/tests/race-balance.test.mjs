// Deterministic handling and race-pace regression; not a substitute for human playtesting.
import test from 'node:test';import assert from 'node:assert/strict';
import {TRACKS,trackSample,trackRacePosition} from '../src/circuit.mjs';
import {createVehicleState,stepVehicle} from '../src/physics.mjs';
import {stepCircuitDriftVehicle} from '../src/drift.mjs';
import {resolveCircuitWall,resolveCircuitCarContact} from '../src/circuit-contact.mjs';
import {vehicleParameters} from '../src/car-performance.mjs';
import {ACTIVE_CAR_CONTENT as cars} from '../src/content/cars.mjs';
import {raceRivalPerformance,raceDriverProfile,planRaceDriver,stepRaceDriver,resolveRaceContacts} from '../src/race-ai.mjs';

// Fastest rival's three-lap time. Ranked must punish a scruffy lap, so these
// are close to a clean player's pace rather than a leisurely traffic cruise.
const paceCeiling={stadium:172,summit:164,coast:161,dockside:176,neon:150};

test('ranked rivals run a fast, spread-out three-lap race',()=>{
 for(const t of TRACKS){
  const kind=t.kind==='drift'?'drift':'race',spec=cars.find(c=>c.id===t.kind==='drift'?'challenger':'golf');
  const perf=raceRivalPerformance({maxSpeed:kind==='drift'?52:56,accel:kind==='drift'?9:9.3},spec,0,kind);
  const finish=t.length*3,times=new Array(5).fill(null);
  const field=Array.from({length:5},(_,i)=>({key:i,progress:-30+i*5,offset:i%2?3:-3,speed:0,...perf,length:4.5,width:1.9,finished:false,profile:raceDriverProfile(i,kind),lateralSpeed:0,braking:false,passTarget:null,passOffset:null}));
  let time=0,steps=0;
  while(times.some(v=>v===null) && time<300 && steps++<12000){
   const snapshot=field.map(r=>({...r}));
   const plans=field.map((r,i)=>planRaceDriver(r,snapshot.filter((_,j)=>i!==j),t.id,1));
   field.forEach((r,i)=>{stepRaceDriver(r,plans[i],.05,t.id,1);if(times[i]===null&&r.progress>=finish)times[i]=time;});
   resolveRaceContacts(field,snapshot,t.id);
   time+=.05;
  }
  assert.ok(times.every(v=>v!==null),`${t.id}: rivals did not finish`);
  const fastest=Math.min(...times),slowest=Math.max(...times);
  assert.ok(fastest<paceCeiling[t.id],`${t.id}: fastest rival ${fastest.toFixed(1)}s is too slow`);
  assert.ok(slowest-fastest>2,`${t.id}: the field is too uniform (${(slowest-fastest).toFixed(1)}s)`);
  assert.ok(slowest-fastest<20,`${t.id}: the field is too spread out (${(slowest-fastest).toFixed(1)}s)`);
 }
});

test('a stock car can complete every circuit without striking barriers',()=>{
 for(const t of TRACKS){
  const id=t.kind==='drift'?'challenger':'golf',spec=cars.find(c=>c.id===id);
  const params={...vehicleParameters(spec,{engine:0,tires:0,brakes:0},'standard',1),roadAssist:false};
  const p=createVehicleState();p.s=-36;p.offset=-3;
  const rivals=cars.filter(c=>c.id!==id&&(t.kind!=='drift'||['challenger','skyline','mustang','bmw-m3'].includes(c.id))).slice().sort((a,b)=>Math.abs(a.maxSpeed-spec.maxSpeed)-Math.abs(b.maxSpeed-spec.maxSpeed)).slice(0,5);
  const field=Array.from({length:5},(_,i)=>{const c=rivals[i%rivals.length];return {key:i,progress:-30+i*5,offset:i%2?3:-3,speed:0,...raceRivalPerformance(c,spec,0,t.kind),length:4.5,width:2,finished:false,profile:raceDriverProfile(i,t.kind),lateralSpeed:0,braking:false,passTarget:null,passOffset:null}});
  let n=0,hits=0;
  while(p.s<t.length*3&&n++<20000){
   const h=.025,c=trackSample(p.s,t.id).curvature,next=trackSample(p.s+30,t.id).curvature;
   const target=Math.min(t.kind==='drift'?35:44,Math.sqrt(5.6/Math.max(.001,Math.abs(c),Math.abs(next))));
   const desired=Math.max(-.25,Math.min(.25,p.offset*.025)),error=desired-p.heading;
   const ctrl={throttle:p.speed<target,brake:p.speed>target+1,left:error>.025,right:error<-.025,handbrake:false};
   (t.kind==='drift'?stepCircuitDriftVehicle:stepVehicle)(p,ctrl,params,h,c);
   if(resolveCircuitWall(p,t,2,4.5))hits++;
   const snapshot=field.map(x=>({...x}));
   const player={key:-1,progress:p.s,offset:p.offset,speed:p.speed,heading:p.heading,driftAngle:p.driftAngle,length:4.5,width:2};
   const plans=field.map((x,i)=>planRaceDriver(x,[...snapshot.filter((_,j)=>i!==j),player],t.id,1));
   field.forEach((x,i)=>stepRaceDriver(x,plans[i],h,t.id,1));
   resolveRaceContacts(field,snapshot,t.id);
   for(let pass=0;pass<3;pass++)field.forEach(x=>resolveCircuitCarContact(player,x,t.length));
   p.s=player.progress;p.speed=player.speed;p.offset=player.offset;p.heading=player.heading;
  }
  assert.ok(p.s>=t.length*3,`${t.id}: player did not finish`);
  assert.ok(hits<10,`${t.id}: steering test struck barriers ${hits} times`);
  assert.ok(trackRacePosition(p.s,field,t.id)>=1);
 }
});
