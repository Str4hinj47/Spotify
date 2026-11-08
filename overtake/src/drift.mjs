// Dedicated drift cars retain their identity in every mode, not just a visual
// animation. The saved car IDs remain unchanged.
import { stepVehicle } from './physics.mjs';
export const DRIFT_CARS = Object.freeze(['challenger','skyline','mustang','bmw-m3']);
export function isDriftCar(id) { return DRIFT_CARS.includes(id); }
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** Arcade rear-slip model: speed and throttle sustain oversteer; countersteer
 * swaps the slide, and the slide changes the actual lateral trajectory and
 * acceleration. Stopped cars settle, and the original grip model is untouched. */
export function stepDriftVehicle(state,input,params,dt,curvature=0) {
  const h=clamp(dt,0.0001,.05), steer=(input.left?1:0)-(input.right?1:0);
  const moving=clamp((state.speed-3)/9,0,1);
  if (steer) state.driftSide=steer;
  else if (!state.driftSide) state.driftSide=curvature<0?-1:1;
  const throttle=input.throttle?1:.7;
  const magnitude=moving*(.16 + .12*throttle + (input.handbrake?.20:0));
  const target=state.driftSide*magnitude;
  state.driftAngle=(state.driftAngle??0)+(target-(state.driftAngle??0))*Math.min(1,h*(steer?2.5:1.4));
  stepVehicle(state,input,{...params,grip:params.grip*.82,accel:params.accel*.93},h,curvature);
  // Velocity drifts sideways independently of where the body is pointed.
  state.offset-=state.speed*Math.sin(state.driftAngle)*.19*h;
  state.speed=Math.max(0,state.speed-Math.abs(state.driftAngle)*.35*h);
  return state;
}
