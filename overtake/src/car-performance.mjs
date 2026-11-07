// One source of truth for both the driven car and the garage readout.
import { tireWidthHandling } from './tire-width.mjs';
import { createVehicleState, stepVehicle } from './physics.mjs';

export function vehicleParameters(spec, upgrades, width, surface = 1) {
  const tire = tireWidthHandling(width);
  return {
    ...spec.physics,
    brake: spec.physics.brake * (1 + upgrades.brakes * .10),
    accel: spec.accel * (1 + upgrades.engine * .08) * tire.accel,
    steerResponse: (spec.physics.steerResponse ?? 7.5) * tire.steer,
    maxSpeed: spec.maxSpeed * (1 + upgrades.engine * .04),
    grip: spec.physics.grip * (1 + upgrades.tires * .06) * surface * tire.grip,
    surfaceGrip: surface,
  };
}

// Dry, straight road and full throttle/braking using the actual driving model.
// This is deliberately game-scaled; it is not a manufacturer's road test.
export function performanceStats(spec, upgrades, width) {
  const p = vehicleParameters(spec, upgrades, width);
  const target = 100 / 3.6, dt = 1 / 120;
  const accelerating = { throttle:true, brake:false, left:false, right:false, handbrake:false };
  const braking = { ...accelerating, throttle:false, brake:true };
  // Drag may prevent a car from reaching its configured speed cap.
  const terminal = Math.sqrt(Math.max(0, p.accel - .35) / (.45 * p.accel / (p.maxSpeed * p.maxSpeed) + (p.drag ?? .0008)));
  const topSpeed = Math.min(p.maxSpeed, terminal);
  let sprint = null;
  if (topSpeed > target) {
    const car = createVehicleState();
    for (let i = 0; i < 120 / dt; i++) {
      const previous = car.speed;
      stepVehicle(car, accelerating, p, dt);
      if (car.speed >= target) { sprint = (i + (target - previous) / (car.speed - previous)) * dt; break; }
    }
  }
  const car = createVehicleState(); car.speed = target;
  for (let i = 0; i < 120 / dt && car.speed > 0; i++) stepVehicle(car, braking, p, dt);
  return { topSpeed, sprint, brakingDistance:car.s, grip:p.grip, bonus:spec.bonus };
}
