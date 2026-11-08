import test from 'node:test';import assert from 'node:assert/strict';
import {resolveCircuitWall,resolveCircuitCarContact,circuitCarOverlap} from '../src/circuit-contact.mjs';
import {createVehicleState} from '../src/physics.mjs';
import {stepCircuitDriftVehicle} from '../src/drift.mjs';
const car=(offset=0,heading=0)=>({...createVehicleState(),offset,heading,speed:20});
test('kerb and runoff are traversable; impact occurs at the visible wall and deflects the car',()=>{
 let v=car(10.5,-.1);assert.equal(resolveCircuitWall(v,{halfWidth:10},2,4.5),false);assert.equal(v.offset,10.5);
 v=car(12.3,-.3);assert.equal(resolveCircuitWall(v,{halfWidth:10},2,4.5),true);assert.ok(v.offset>10);assert.ok(v.heading>0);assert.ok(v.speed<20);
 v=car(-12.3,.3);assert.equal(resolveCircuitWall(v,{halfWidth:10},2,4.5),true);assert.ok(v.offset< -10);assert.ok(v.heading<0);
});
test('car impacts transfer speed and push both participants apart',()=>{
 let a={progress:100,offset:0,speed:30,length:4.5,width:2},b={progress:104,offset:0,speed:10,length:4.5,width:2};assert.equal(resolveCircuitCarContact(a,b,1000),true);assert.ok(a.speed<30&&a.speed>10);assert.ok(b.speed>10);assert.ok(b.progress-a.progress>=4.5);
 a={progress:100,offset:0,speed:25,length:4.5,width:2,heading:-.1};b={progress:100,offset:1.5,speed:24,length:4.5,width:2,heading:.1};const ah=a.heading,bh=b.heading;assert.equal(resolveCircuitCarContact(a,b,1000),true);assert.equal(circuitCarOverlap(a,b,1000),null);assert.ok(a.heading>ah);assert.ok(b.heading<bh);
});
test('circuit drift does not invent a slide on a straight and countersteer recovers progressively',()=>{
 const p={grip:1,accel:9,brake:11,maxSpeed:55,wheelbase:2.7,maxSteer:.5,roadAssist:false},base={throttle:true,brake:false,left:false,right:false,handbrake:false};let v=car();
 for(let i=0;i<120;i++)stepCircuitDriftVehicle(v,base,p,1/120);assert.equal(v.driftAngle,0);assert.ok(Math.abs(v.offset)<1e-9);
 for(let i=0;i<150;i++)stepCircuitDriftVehicle(v,{...base,left:true,handbrake:true},p,1/120);const slide=v.driftAngle;assert.ok(slide>.1);
 stepCircuitDriftVehicle(v,{...base,right:true},p,1/120);assert.ok(v.driftAngle>0&&v.driftAngle<slide);
 for(let i=0;i<150;i++)stepCircuitDriftVehicle(v,{...base,right:true},p,1/120);assert.ok(v.driftAngle<0);
});

test('angled cars use oriented footprints and separating cars do not gain a bounce',()=>{
 const a={progress:100,offset:0,speed:20,length:4.5,width:2,heading:.6},b={progress:103.9,offset:1.5,speed:20,length:4.5,width:2,heading:.6};
 assert.equal(circuitCarOverlap(a,b,1000),null,'parallel diagonal cars with clear corners do not collide just because AABBs overlap');
 const c={progress:100,offset:0,speed:20,length:4.5,width:2,heading:0},d={progress:100,offset:1.8,speed:20,length:4.5,width:2,heading:0};
 resolveCircuitCarContact(c,d,1000);assert.equal(c.speed,20);assert.equal(d.speed,20);assert.equal(c.heading,0);assert.equal(d.heading,0);assert.equal(circuitCarOverlap(c,d,1000),null);
});

test('angled, grazing and lap-seam contacts remain stable and dissipate energy',()=>{
 let seed=87431;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 for(let i=0;i<600;i++) {
   const a={progress:998+random()*2,offset:(random()-.5)*2,speed:5+random()*40,length:4.5,width:2,heading:(random()-.5)*1.2,driftAngle:(random()-.5)*.2};
   const b={progress:1000+random()*2,offset:(random()-.5)*2,speed:5+random()*40,length:4.2,width:1.9,heading:(random()-.5)*1.2,driftYaw:(random()-.5)*.2};
   const energy=a.speed**2+b.speed**2;
   for(let pass=0;pass<8;pass++)resolveCircuitCarContact(a,b,1000);
   assert.ok(Number.isFinite(a.speed+a.heading+a.progress+b.speed+b.heading+b.progress));
   assert.ok(a.speed**2+b.speed**2<=energy+1e-8,'contact should not inject kinetic energy');
   assert.equal(circuitCarOverlap(a,b,1000),null,'iterative solver should separate rotated footprints at the seam');
 }
});
