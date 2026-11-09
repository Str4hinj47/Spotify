// Road-relative vehicle model: grip-limited bicycle steering, friction-circle
// longitudinal/lateral coupling, weight transfer and speed-sensitive rack.
// Pure module so handling can be unit-tested without WebGL.

export const GRAVITY = 9.81;
const G = GRAVITY;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Remaining longitudinal tire acceleration under a shared friction circle.
 * Values are accelerations (m/s²), so mass cancels on a level surface. */
export function longitudinalGrip(limit, lateralAcceleration) {
  const available=Math.max(0,limit), lateral=Math.min(available,Math.abs(lateralAcceleration));
  return Math.sqrt(Math.max(0,available*available-lateral*lateral));
}

export function createVehicleState() {
  return {
    s: 0, offset: 0, speed: 0, heading: 0, yawRate: 0, steer: 0,
    accel: 0, latAccel: 0, slip: 0, driftAngle:0, driftSide:0,
  };
}

/**
 * @param {ReturnType<typeof createVehicleState>} st
 * @param {{throttle:boolean,brake:boolean,left:boolean,right:boolean,handbrake:boolean}} input
 * @param {object} p
 * @param {number} dt
 * @param {number} curvature d(roadYaw)/ds
 */
export function stepVehicle(st, input, p, dt, curvature = 0) {
  dt = clamp(dt, 0.0001, 0.05);
  const raw = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  // Progressive rack: small inputs are fine, full lock is not binary.
  const shaped = Math.sign(raw) * Math.pow(Math.abs(raw), 2.1);
  st.steer += (shaped - st.steer) * Math.min(1, dt * (p.steerResponse ?? 7.5));

  const maxSteer = (p.maxSteer ?? 0.5) / (1 + Math.pow(st.speed / 20, 2));
  const steerAngle = st.steer * maxSteer;
  const understeer = 1 + (p.understeer ?? 0.003) * st.speed * st.speed;
  // Highway driving retains its gentle road-following assist. On a circuit,
  // the driver must steer through the bend; road-relative heading still
  // subtracts the rotation of the track in both modes.
  const feed = curvature * st.speed;
  const assist = p.roadAssist !== false;
  let desiredYaw = st.speed * Math.tan(steerAngle) / (p.wheelbase ?? 2.7) / understeer + (assist ? feed : 0);

  // Lateral load transfer costs a little total grip; handbrake unlocks the rear.
  const latUse = Math.min(1, Math.abs(st.latAccel) / G);
  const transfer = 1 - 0.10 * latUse;
  const handbrake = input.handbrake ? 0.55 : 1;
  const tireLimit = (p.grip ?? clamp(p.surfaceGrip ?? 1, 0.35, 1)) * G * transfer * handbrake;
  const maxLat = tireLimit * .85;
  const maxYaw = maxLat / Math.max(st.speed, 2);
  const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);
  st.slip = clamp(Math.abs(desiredYaw) / Math.max(maxYaw, 1e-3) - 1, 0, 1);
  st.yawRate += (targetYaw - st.yawRate) * Math.min(1, dt * (p.yawResponse ?? 6.5));
  st.latAccel = st.speed * st.yawRate;

  // Share a finite tire-force budget between lateral and longitudinal
  // acceleration. Engine/brake requests can be smaller than that budget;
  // surface loss is already included in p.grip by vehicleParameters.
  const availableLong = longitudinalGrip(tireLimit, st.latAccel);
  const baseMax = p.maxSpeed ?? 60;
  const cap = Math.max(baseMax, st.speed);
  const accelRate = p.accel ?? 8;
  const power = input.throttle ? accelRate * (1 - 0.45 * Math.pow(st.speed / cap, 2)) : 0;
  // Brake specs are game-tuned; 80% represents usable brake hardware force,
  // with the tire limit preventing unrealistically large brake upgrades.
  const brake = ((input.brake ? (p.brake ?? 11) : 0) + (input.handbrake ? (p.brake ?? 11) * 0.75 : 0)) * .80;
  const tireAcceleration = clamp(power-brake,-availableLong,availableLong);
  // Quadratic aerodynamic load plus rolling and off-throttle engine braking.
  const drag = (p.drag ?? 0.0008) * st.speed * st.speed + 0.35 + (input.throttle ? 0 : 1.1);
  st.accel = tireAcceleration - drag;
  if (st.speed <= 0 && st.accel < 0) st.accel = 0;
  st.speed = clamp(st.speed + st.accel * dt, 0, cap);
  if (st.speed > baseMax) st.speed = Math.max(baseMax, st.speed - 7 * dt);

  // Heading is relative to the road tangent. Curvature rotates the tangent.
  st.heading += (st.yawRate - feed) * dt;
  if (Math.abs(raw) < 0.05) {
    // Self-centring stability: the car straightens when you release the wheel,
    // but it does not steer back into a lane or change offset for you.
    st.yawRate += ((assist ? feed : 0) - st.yawRate) * Math.min(1, dt * 3.0);
    if (assist) st.heading *= Math.exp(-dt * 2.2);
  }
  st.heading = clamp(st.heading, -0.9, 0.9);
  st.offset -= st.speed * Math.sin(st.heading) * dt;
  st.s += st.speed * Math.cos(st.heading) * dt;
  return st;
}
