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

test('curvature feed-forward tracks the road tangent without steering input', () => {
  const st = createVehicleState(); st.speed = 25;
  run(st, base, input(), 2, 1 / 120, 0.004);
  assert.ok(Math.abs(st.yawRate - 0.004 * 25) < 0.03);
  assert.ok(Math.abs(st.offset) < 0.5);
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
