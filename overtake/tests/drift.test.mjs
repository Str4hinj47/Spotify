import test from 'node:test';import assert from 'node:assert/strict';
import {createVehicleState,stepVehicle} from '../src/physics.mjs';import {stepDriftVehicle,isDriftCar,DRIFT_CARS} from '../src/drift.mjs';
const p={grip:1,accel:9,brake:11,maxSpeed:55,wheelbase:2.7,maxSteer:.5};
const input={throttle:true,brake:false,left:false,right:false,handbrake:false};
test('only selected playable cars have dedicated drift handling',()=>{assert.deepEqual(DRIFT_CARS,['challenger','skyline','mustang','bmw-m3']);assert.equal(isDriftCar('golf'),false);assert.equal(isDriftCar('skyline'),true)});
test('drifting builds from steering and handbrake, then responds gradually to countersteer',()=>{
 const drift=createVehicleState(),grip=createVehicleState();drift.speed=grip.speed=20;
 for(let i=0;i<120;i++){stepDriftVehicle(drift,input,p,1/120);stepVehicle(grip,input,p,1/120)}
 assert.equal(drift.driftAngle,0);assert.ok(Math.abs(drift.offset-grip.offset)<1e-9);
 const turn={...input,left:true,handbrake:true};
 for(let i=0;i<150;i++){stepDriftVehicle(drift,turn,p,1/120);stepVehicle(grip,turn,p,1/120)}
 assert.ok(drift.driftAngle>.08);assert.ok(Math.abs(drift.offset-grip.offset)>.2);
 const old=drift.driftAngle;stepDriftVehicle(drift,{...input,right:true},p,1/120);assert.ok(drift.driftAngle>0&&drift.driftAngle<old);
 for(let i=0;i<180;i++)stepDriftVehicle(drift,{...input,right:true},p,1/120);
 assert.ok(drift.driftAngle<0);assert.ok(Number.isFinite(drift.s)&&Number.isFinite(drift.offset));
});
test('stationary drift car settles rather than sliding at rest',()=>{const s=createVehicleState();for(let i=0;i<120;i++)stepDriftVehicle(s,{...input,throttle:false},p,1/120);assert.equal(s.speed,0);assert.equal(s.offset,0);assert.equal(s.driftAngle,0)});
test('a coasting drift car never slides sideways on its own',()=>{
 const s=createVehicleState();s.speed=30;s.offset=0;s.heading=0;s.driftAngle=.3;
 for(let i=0;i<90;i++)stepDriftVehicle(s,{...input,throttle:false},p,1/120);
 assert.ok(Math.abs(s.offset)<1e-9,'no lateral travel without steering or handbrake');
 assert.ok(Math.abs(s.heading)<1e-9,'the slide must not steer the car');
 assert.ok(s.driftAngle<s.speed&&Math.abs(s.driftAngle)<.3);
});
