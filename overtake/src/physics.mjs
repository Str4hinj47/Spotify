// Road-relative vehicle model: grip-limited bicycle steering, friction-circle
// longitudinal/lateral coupling, weight transfer and speed-sensitive rack.
// Pure module so handling can be unit-tested without WebGL.

const G = 9.81;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createVehicleState() {
  return {
    s: 0, offset: 0, speed: 0, heading: 0, yawRate: 0, steer: 0,
    accel: 0, latAccel: 0, slip: 0,
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
  // Feed-forward road curvature: with no steering input the car tracks the
  // road tangent instead of drifting wide, but it never changes lane for you.
  const feed = curvature * st.speed;
  let desiredYaw = st.speed * Math.tan(steerAngle) / (p.wheelbase ?? 2.7) / understeer + feed;

  // Lateral load transfer costs a little total grip; handbrake unlocks the rear.
  const latUse = Math.min(1, Math.abs(st.latAccel) / G);
  const transfer = 1 - 0.10 * latUse;
  const handbrake = input.handbrake ? 0.55 : 1;
  const maxLat = (p.grip ?? 1.0) * G * 0.85 * transfer * handbrake;
  const maxYaw = maxLat / Math.max(st.speed, 2);
  const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);
  st.slip = clamp(Math.abs(desiredYaw) / Math.max(maxYaw, 1e-3) - 1, 0, 1);
  st.yawRate += (targetYaw - st.yawRate) * Math.min(1, dt * (p.yawResponse ?? 6.5));
  st.latAccel = st.speed * st.yawRate;

  // Friction circle: cornering hard leaves less grip for throttle/brakes.
  const circle = Math.sqrt(Math.max(0.18, 1 - 0.7 * Math.pow(st.latAccel / Math.max(maxLat, 1e-3), 2)));
  const baseMax = p.maxSpeed ?? 60;
  const cap = Math.max(baseMax, st.speed);
  const accelRate = p.accel ?? 8;
  const surfaceGrip = clamp(p.surfaceGrip ?? 1, 0.35, 1);
  const power = input.throttle ? accelRate * circle * surfaceGrip * (1 - 0.45 * Math.pow(st.speed / cap, 2)) : 0;
  const brake = (input.brake ? (p.brake ?? 11) : 0) + (input.handbrake ? (p.brake ?? 11) * 0.75 : 0);
  const drag = (p.drag ?? 0.0008) * st.speed * st.speed + 0.35 + (input.throttle ? 0 : 1.1);
  st.accel = power - brake * circle * surfaceGrip - drag;
  if (st.speed <= 0 && st.accel < 0) st.accel = 0;
  st.speed = clamp(st.speed + st.accel * dt, 0, cap);
  if (st.speed > baseMax) st.speed = Math.max(baseMax, st.speed - 7 * dt);

  // Heading is relative to the road tangent. Curvature rotates the tangent.
  st.heading += (st.yawRate - feed) * dt;
  if (Math.abs(raw) < 0.05) {
    // Self-centring stability: the car straightens when you release the wheel,
    // but it does not steer back into a lane or change offset for you.
    st.yawRate += (feed - st.yawRate) * Math.min(1, dt * 3.0);
    st.heading *= Math.exp(-dt * 2.2);
  }
  st.heading = clamp(st.heading, -0.9, 0.9);
  st.offset -= st.speed * Math.sin(st.heading) * dt;
  st.s += st.speed * Math.cos(st.heading) * dt;
  return st;
}
