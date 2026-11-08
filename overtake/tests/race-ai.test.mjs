import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS, TRACK_LENGTH, trackSample} from '../src/circuit.mjs';
import {raceDriverProfile,raceGap,cornerSpeedLimit,planRaceDriver,stepRaceDriver,resolveRaceContacts,resolvePlayerContact} from '../src/race-ai.mjs';
const actor=(key,progress,offset,speed)=>({key,progress,offset,speed,width:2,length:4.5});
const driver=(key=0,progress=0,offset=0,speed=0)=>({...actor(key,progress,offset,speed),profile:raceDriverProfile(key),targetSpeed:50,acceleration:7,lateralSpeed:0,braking:false,passTarget:null,passOffset:null});

test('race AI wraps physical gaps at the lap seam without changing standings',()=>{
 assert.equal(raceGap(TRACK_LENGTH-5,3,TRACK_LENGTH),8);assert.equal(raceGap(3,TRACK_LENGTH-5,TRACK_LENGTH),-8);
 assert.equal(raceGap(TRACK_LENGTH*2+7,6,TRACK_LENGTH),-1);
});
test('race drivers anticipate bends and reduce speed in poor grip',()=>{
 const approaching=driver(0,230,0,50),straight=driver(0,20,0,50);
 assert.ok(cornerSpeedLimit(approaching,'stadium')<cornerSpeedLimit(straight,'stadium'));
 assert.ok(cornerSpeedLimit(approaching,'stadium',.65)<cornerSpeedLimit(approaching,'stadium',1));
 const plan=planRaceDriver(approaching,[],'stadium');stepRaceDriver(approaching,plan,.05,'stadium');assert.ok(approaching.braking);assert.ok(approaching.speed<50);
});
test('racer overtakes a slower player, holds its lane and avoids a car alongside',()=>{
 const d=driver(0,40,0,32),player=actor(-1,65,0,18),adjacent=actor(1,48,-3.5,24);
 let plan=planRaceDriver(d,[player,adjacent],'stadium');assert.ok(plan.targetOffset>2,'should pass on the open side');assert.equal(plan.passTarget,-1);
 for(let i=0;i<160;i++){plan=planRaceDriver(d,[player,adjacent],'stadium');stepRaceDriver(d,plan,.05,'stadium');player.progress+=player.speed*.05;adjacent.progress+=adjacent.speed*.05;}
 assert.ok(d.progress>player.progress+8,'should complete the pass');assert.equal(d.passTarget,null,'can return to the racing line after clearing');
});
test('simultaneous lane changes cannot cause rivals to drive through each other',()=>{
 const a=driver(0,100,-2,25),b=driver(1,100,2,25),previous=[{...a},{...b}];
 a.offset=-.8;b.offset=.8;a.lateralSpeed=2;b.lateralSpeed=-2;
 resolveRaceContacts([a,b],previous,'stadium');assert.equal(a.offset,-2);assert.equal(b.offset,2);assert.equal(a.lateralSpeed,0);
 const front=driver(1,106,0,10),back=driver(0,100,0,30),old=[{...back},{...front}];back.progress=102.5;front.progress=106.5;resolveRaceContacts([back,front],old,'stadium');assert.ok(front.progress-back.progress>=4.75-1e-9);assert.equal(back.speed,10);assert.ok(back.braking);
});
test('player contact slows and constrains the trailing car rather than ending the race',()=>{
 const d=driver(0,104,0,10),p=actor(-1,100,0,30),old={...d};
 assert.ok(resolvePlayerContact(d,p,old,99,'stadium'));assert.equal(p.progress,99.5);assert.equal(p.speed,10);
 const follower=driver(0,100,0,30),leader=actor(-1,104,0,10);assert.ok(resolvePlayerContact(follower,leader,{...follower,progress:99},104,'stadium'));assert.equal(follower.progress,99.5);assert.equal(follower.speed,10);assert.ok(follower.braking);
});
test('five distinct drivers complete every circuit without rival overlap or leaving the road',()=>{
 for(const track of TRACKS){
  const racers=Array.from({length:5},(_,i)=>driver(i,-30+i*5,i%2?3:-3,0));let time=0,braking=0,swaps=0;
  let previousOrder=racers.map((_,i)=>i).sort((a,b)=>racers[b].progress-racers[a].progress).join(',');
  while(time<240 && racers.some(r=>r.progress<track.length*track.laps)) {
   const snapshot=racers.map(r=>({...r})),plans=racers.map((r,i)=>planRaceDriver(r,snapshot.filter((_,j)=>i!==j),track.id));
   racers.forEach((r,i)=>stepRaceDriver(r,plans[i],.05,track.id));resolveRaceContacts(racers,snapshot,track.id);
   for(let i=0;i<racers.length;i++) {const a=racers[i];braking+=Number(a.braking);assert.ok(Number.isFinite(a.progress)&&a.speed>=0 && Math.abs(a.offset)<=track.halfWidth-a.width/2,track.id);for(let j=i+1;j<racers.length;j++){const b=racers[j],gap=Math.abs(raceGap(a.progress,b.progress,track.length));assert.ok(gap>=(a.length+b.length)*.5 || Math.abs(a.offset-b.offset)>=(a.width+b.width)*.5,`${track.id} overlapping`);}}
   const order=racers.map((_,i)=>i).sort((a,b)=>racers[b].progress-racers[a].progress).join(',');if(order!==previousOrder)swaps++;previousOrder=order;time+=.05;
  }
  assert.ok(time<240,`${track.id} racers finish`);assert.ok(braking>0,`${track.id} drivers brake`);assert.ok(swaps>0,`${track.id} positions change`);
 }
});
