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

/** Velocity in a road's curvilinear frame. Positive offset is to the
 * right of the road; curvature is d(road yaw)/d(centerline distance).
 * The bounded denominator avoids the coordinate singularity off the road. */
export function roadFrameRates(speed, heading, offset, curvature) {
  const progress=speed*Math.cos(heading)/Math.max(.65,1+curvature*offset);
  return {progress,offset:-speed*Math.sin(heading)};
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
  const feed = curvature * roadFrameRates(st.speed,st.heading,st.offset,curvature).progress;
  const assist = p.roadAssist !== false;
  let desiredYaw = st.speed * Math.tan(steerAngle) / (p.wheelbase ?? 2.7) / understeer + (assist ? feed : 0);

  // Lateral load transfer costs a little total grip; handbrake unlocks the rear.
  const latUse = Math.min(1, Math.abs(st.latAccel) / G);
  const transfer = 1 - 0.10 * latUse;
  const handbrake = input.handbrake ? 0.55 : 1;
  const tireLimit = (p.grip ?? clamp(p.surfaceGrip ?? 1, 0.35, 1)) * G * transfer * handbrake;
  const maxLat = tireLimit * .85;
  const maxYaw = maxLat / Math.max(Math.abs(st.speed), 2);
  const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);
  st.slip = clamp(Math.abs(desiredYaw) / Math.max(maxYaw, 1e-3) - 1, 0, 1);
  st.yawRate += (targetYaw - st.yawRate) * Math.min(1, dt * (p.yawResponse ?? 6.5));
  st.latAccel = st.speed * st.yawRate;

  // Share a finite tire-force budget between lateral and longitudinal
  // acceleration. Engine/brake requests can be smaller than that budget;
  // surface loss is already included in p.grip by vehicleParameters.
  const availableLong = longitudinalGrip(tireLimit, st.latAccel);
  const baseMax = p.maxSpeed ?? 60;
  const cap = Math.max(baseMax, st.speed), reverseCap = p.reverseSpeed ?? 8;
  const accelRate = p.accel ?? 8, oldSpeed = st.speed;
  // Down/S brakes while moving forward, then engages reverse after a stop.
  // Up/W similarly brakes in reverse before propelling the car forwards.
  const braking=(p.brake ?? 11)*.80;
  let request=0;
  if(oldSpeed>=0) {
    const power=input.throttle ? accelRate*(1-.45*Math.pow(oldSpeed/cap,2)) : 0;
    if(oldSpeed===0 && input.brake && !input.throttle && !input.handbrake) request=-(p.reverseAccel ?? 3.5);
    else request=power-(input.brake?braking:0)-(input.handbrake?braking*.75:0);
  } else if(input.handbrake || input.throttle) {
    request=braking*((input.throttle?1:0)+(input.handbrake?.75:0));
  } else if(input.brake) request=-(p.reverseAccel ?? 3.5);
  const tireAcceleration=clamp(request,-availableLong,availableLong);
  const drivingReverse=input.brake && oldSpeed<=0 && !input.throttle && !input.handbrake;
  const powered=(input.throttle && oldSpeed>=0) || drivingReverse;
  const drag=(p.drag ?? .0008)*oldSpeed*oldSpeed+.35+(powered?0:1.1);
  st.accel=tireAcceleration-(Math.sign(oldSpeed)||Math.sign(tireAcceleration))*drag;
  if(oldSpeed===0 && (!powered || (input.throttle && input.brake) || (st.accel<0 && !drivingReverse)))st.accel=0;
  let next=clamp(oldSpeed+st.accel*dt,-reverseCap,cap);
  // Never cross through rest in one step: braking transitions into the other
  // direction on the next substep and rolling resistance cannot reverse it.
  if(oldSpeed>0 && next<0 || oldSpeed<0 && next>0)next=0;
  st.speed=next;
  if (st.speed > baseMax) st.speed = Math.max(baseMax, st.speed - 7 * dt);

  // Heading is relative to the road tangent. Curvature rotates the tangent.
  st.heading += (st.yawRate - feed) * dt;
  if (Math.abs(raw) < 0.05) {
    // Self-centring stability: the car straightens when you release the wheel,
    // but it does not steer back into a lane or change offset for you.
    st.yawRate += ((assist ? feed : 0) - st.yawRate) * Math.min(1, dt * 3.0);
    if (assist) st.heading *= Math.exp(-dt * 2.2);
  }
  // Circuit headings must not snap to a 51-degree limit: that forces the
  // car to turn with the road and makes recovery at a wall feel unnatural.
  st.heading = assist ? clamp(st.heading,-.9,.9) : Math.atan2(Math.sin(st.heading),Math.cos(st.heading));
  // Trapezoidal distance integration, including the fraction of a step
  // actually spent moving if braking brings the car to rest mid-step.
  const movingTime=st.speed===0 && oldSpeed!==0 && st.accel*oldSpeed<0 ? Math.min(dt,Math.abs(oldSpeed/st.accel)) : dt;
  const distance=(oldSpeed+st.speed)*.5*movingTime;
  const rates=roadFrameRates(distance/dt,st.heading,st.offset,curvature);
  st.offset += rates.offset*dt;
  st.s += rates.progress*dt;
  return st;
}
