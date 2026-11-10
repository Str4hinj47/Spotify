// Dedicated drift cars retain their identity in every mode, not just a visual
// animation. The saved car IDs remain unchanged.
import { stepVehicle } from './physics.mjs';
export const DRIFT_CARS = Object.freeze(['challenger','skyline','mustang','bmw-m3']);
export function isDriftCar(id) { return DRIFT_CARS.includes(id); }
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
/** Drift handling: rear slip builds from a steering/load demand or the
 * handbrake, not merely from driving straight. Releasing/countersteering
 * dissipates it progressively. The grip vehicle state remains the trajectory;
 * driftAngle is the body/velocity difference and also adds limited side travel. */
export function stepDriftVehicle(state,input,params,dt,curvature=0) {
 const h=clamp(dt,.0001,.05), steer=(input.left?1:0)-(input.right?1:0);
 const speed=clamp((state.speed-7)/16,0,1);
 const demand=steer*speed*((input.throttle?.10:.035)+(input.handbrake?.21:0));
 const old=state.driftAngle||0;
 const response=steer && Math.sign(steer)!==Math.sign(old) ? 3.4 : input.handbrake?2.0:1.1;
 state.driftAngle=clamp(old+(demand-old)*Math.min(1,h*response),-.34,.34);
 stepVehicle(state,input,{...params,grip:params.grip*(input.handbrake?.83:.96)},h,curvature);
 // Side travel only comes from a slide the driver is still feeding (steering
 // or handbrake). Coasting must not move the car laterally by itself.
 if(input.handbrake || steer!==0) state.offset-=state.speed*Math.sin(state.driftAngle)*.12*h;
 state.speed=Math.sign(state.speed)*Math.max(0,Math.abs(state.speed)-Math.abs(state.driftAngle)*.45*h);
 return state;
}

// Named alias keeps circuit-specific callers explicit without diverging physics.
export const stepCircuitDriftVehicle = stepDriftVehicle;
