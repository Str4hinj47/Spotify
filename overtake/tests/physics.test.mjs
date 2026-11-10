import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleState, stepVehicle } from '../src/physics.mjs';

const base = {
  accel: 9, maxSpeed: 60, grip: 1.05, brake: 11, wheelbase: 2.7,
  maxSteer: 0.5, understeer: 0.007, yawResponse: 7, steerResponse: 8, drag: 0.0008,
};
const input = (o = {}) => ({ throttle: false, brake: false, left: false, right: false, handbrake: false, ...o });

function run(st, p, inp, seconds, dt = 1 / 120, curvature = 0) {
  for (let t = 0; t < seconds; t += dt) stepVehicle(st, inp, p, dt, curvature);
  return st;
}

test('throttle accelerates and drag limits top speed', () => {
  const st = createVehicleState();
  run(st, base, input({ throttle: true }), 20);
  assert.ok(st.speed > 40);
  assert.ok(st.speed <= base.maxSpeed);
});

test('brakes slow the car much faster than coasting', () => {
  const a = createVehicleState(); a.speed = 40;
  const b = createVehicleState(); b.speed = 40;
  run(a, base, input({ brake: true }), 2);
  run(b, base, input(), 2);
  assert.ok(a.speed < b.speed);
  assert.ok(a.speed < 20);
});

test('steering is continuous and moves the car laterally', () => {
  const st = createVehicleState(); st.speed = 25;
  run(st, base, input({ left: true }), 0.6);
  assert.ok(st.offset < -0.2);
  assert.ok(Math.abs(st.heading) > 0.02);
  run(st, base, input({ right: true }), 0.5);
  assert.ok(st.yawRate < 0, 'opposite steering input reverses yaw rate');
});

test('lateral acceleration is grip-limited', () => {
  const st = createVehicleState(); st.speed = 40;
  run(st, base, input({ left: true, throttle: true }), 3);
  assert.ok(Math.abs(st.latAccel) <= base.grip * 9.81 * 0.9);
});

test('handbrake reduces lateral grip', () => {
  const a = createVehicleState(); a.speed = 30;
  const b = createVehicleState(); b.speed = 30;
  run(a, base, input({ left: true }), 1);
  run(b, base, input({ left: true, handbrake: true }), 1);
  assert.ok(Math.abs(b.latAccel) < Math.abs(a.latAccel));
});

test('no steering input holds a straight world heading with no lane assist', () => {
  const st = createVehicleState(); st.speed = 25;
  run(st, base, input(), 2, 1 / 120, 0.004);
  assert.ok(Math.abs(st.yawRate) < 1e-9, 'the road curvature must not drive the wheel');
  // Heading is road-relative: a car going straight in the world loses the
  // road's own rotation, and nothing adds a steering correction back.
  assert.ok(Math.abs(st.heading + 0.004 * st.s) < .02);
  assert.ok(Math.abs(st.offset) > 1, 'driving straight through a bend leaves the lane');
});

test('wet and snowy surfaces increase braking distance and reduce acceleration', () => {
  const dry = createVehicleState(), wet = createVehicleState(), snow = createVehicleState();
  for (const s of [dry, wet, snow]) s.speed = 30;
  const input = { throttle: false, brake: true, left: false, right: false, handbrake: false };
  for (let i = 0; i < 100; i++) {
    stepVehicle(dry, input, {brake: 11, surfaceGrip: 1}, .01);
    stepVehicle(wet, input, {brake: 11, surfaceGrip: .82}, .01);
    stepVehicle(snow, input, {brake: 11, surfaceGrip: .65}, .01);
  }
  assert.ok(dry.speed < wet.speed && wet.speed < snow.speed);
  const throttle = {...input, brake: false, throttle: true};
  const a = createVehicleState(), b = createVehicleState();
  for (let i = 0; i < 100; i++) {
    stepVehicle(a, throttle, {accel: 9, surfaceGrip: 1}, .01);
    stepVehicle(b, throttle, {accel: 9, surfaceGrip: .65}, .01);
  }
  assert.ok(a.speed > b.speed);
});

test('the longitudinal and lateral tire forces share a finite grip circle', async () => {
  const {longitudinalGrip} = await import('../src/physics.mjs');
  const limit=10;
  assert.equal(longitudinalGrip(limit,0),limit);
  assert.equal(longitudinalGrip(limit,6),8);
  assert.equal(longitudinalGrip(limit,10),0);
  assert.equal(longitudinalGrip(limit,12),0);
  assert.equal(longitudinalGrip(limit,-6),8);
  for(let lat=-10;lat<=10;lat+=.5)assert.ok(Math.hypot(lat,longitudinalGrip(limit,lat))<=limit+1e-10);
});

test('tire grip limits powerful brakes and upgrades increase available stopping force', () => {
  const stop=(grip,brake)=>{
    const v=createVehicleState();v.speed=30;let t=0;
    while(v.speed>0 && t<30){stepVehicle(v,input({brake:true}),{...base,grip,brake,roadAssist:false},1/120);t+=1/120;}
    return v.s;
  };
  assert.ok(stop(.65,30)>stop(1,30),'low grip should require more distance');
  assert.ok(stop(1,30)>stop(1.2,30),'tire upgrades improve braking at the traction limit');
  assert.ok(stop(1,7)>stop(1,10),'brake hardware improves braking before tire saturation');
  assert.ok(Math.abs(stop(1,30)-stop(1,60))<1e-8,'brake force cannot exceed the tire limit');
});

test('braking while cornering uses less longitudinal tire force than braking straight', () => {
  const params={...base,brake:30,roadAssist:false};
  const straight=createVehicleState(),corner=createVehicleState();straight.speed=corner.speed=25;
  // Start from a sustained, high-yaw corner to avoid comparing steering lag.
  corner.yawRate=.3;corner.latAccel=7.5;corner.steer=1;
  stepVehicle(straight,input({brake:true}),params,.01);
  stepVehicle(corner,input({brake:true,left:true}),params,.01);
  assert.ok(corner.accel>straight.accel,'cornering must leave less tire force for braking');
});

test('curved road coordinates advance according to offset path length',async()=>{
  const {roadFrameRates}=await import('../src/physics.mjs');
  const middle=roadFrameRates(30,0,0,.01),outside=roadFrameRates(30,0,10,.01),inside=roadFrameRates(30,0,-10,.01);
  assert.equal(middle.progress,30);assert.ok(Math.abs(outside.progress-30/1.1)<1e-10);assert.ok(Math.abs(inside.progress-30/.9)<1e-10);
  const angled=roadFrameRates(20,.2,5,-.01);
  assert.ok(Math.abs(angled.progress*(1-.05)-20*Math.cos(.2))<1e-10);
  assert.ok(Math.abs(angled.offset+20*Math.sin(.2))<1e-10);
});

test('stopping partway through a timestep still travels the correct distance',()=>{
  const car=createVehicleState();car.speed=.08;
  // Brake hardware .8*2 plus fixed rolling .35 and engine braking 1.1.
  const deceleration=3.05,expected=car.speed**2/(2*deceleration);
  stepVehicle(car,input({brake:true}),{grip:2,brake:2,drag:0,roadAssist:false},.05);
  assert.equal(car.speed,0);assert.ok(Math.abs(car.s-expected)<1e-10,`${car.s} vs ${expected}`);
});

test('straight-line stopping distance matches constant-deceleration kinematics',()=>{
  const p={grip:1.25,brake:100,drag:0,roadAssist:false};
  const deceleration=1.25*9.81+.35+1.1,initial=28,expected=initial**2/(2*deceleration);
  for(const dt of [.05,.01,1/120]){
    const v=createVehicleState();v.speed=initial;
    while(v.speed>0)stepVehicle(v,input({brake:true}),p,dt);
    assert.ok(Math.abs(v.s-expected)<1e-8,`dt ${dt}: ${v.s} vs ${expected}`);
  }
});

test('brake brings the car to rest before engaging bounded reverse; throttle returns to forward',()=>{
  const car=createVehicleState();car.speed=4;
  let wentBackWhileMoving=false;
  for(let i=0;i<600;i++){
    const previous=car.speed;stepVehicle(car,input({brake:true}),{...base,roadAssist:false},1/120);
    if(previous>0 && car.speed<0)wentBackWhileMoving=true;
  }
  assert.equal(wentBackWhileMoving,false);assert.ok(car.speed< -5 && car.speed>=-8);assert.ok(car.s<0);
  const backwards=car.s;run(car,{...base,roadAssist:false},input({throttle:true}),3);
  assert.ok(car.speed>0);assert.ok(car.s>backwards);
});

test('reverse steering rotates opposite to forward steering and release coasts to rest',()=>{
  const forward=createVehicleState(),reverse=createVehicleState();forward.speed=reverse.speed=4;reverse.speed=-4;
  run(forward,{...base,roadAssist:false},input({left:true}),.5);
  run(reverse,{...base,roadAssist:false},input({left:true}),.5);
  assert.ok(forward.heading>0 && reverse.heading<0);assert.ok(reverse.s<0);
  run(reverse,{...base,roadAssist:false},input(),10);assert.equal(reverse.speed,0);
});

test('circuit steering can turn past the old heading clamp without road-following snaps',()=>{
 const car=createVehicleState();car.heading=.88;car.speed=12;
 run(car,{...base,roadAssist:false},input({left:true}),1);
 assert.ok(car.heading>.95,'steering must not pin the car at the old 0.9-radian limit');
});
