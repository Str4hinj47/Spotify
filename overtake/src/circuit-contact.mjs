// Circuit-only contacts, expressed in track coordinates. The kerb is part of
// the runoff; the actual wall is 3m outside the asphalt edge.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const WALL_RUNOFF=3;
export function resolveCircuitWall(state,track,width,length) {
 const heading=state.heading+(state.driftAngle||0);
 const extent=.5*(width*Math.abs(Math.cos(heading))+length*Math.abs(Math.sin(heading)));
 const limit=track.halfWidth+WALL_RUNOFF-extent;
 if(Math.abs(state.offset)<=limit)return false;
 const side=Math.sign(state.offset),normalSpeed=-state.speed*Math.sin(state.heading)*side;
 state.offset=side*limit;
 // Only an outward-moving car receives an impulse. Tangential travel continues
 // with friction; an oblique hit does not glue the car to the kerb.
 if(normalSpeed>0){
  // A wall removes speed but does not steer or teleport the car into the lane.
  // Keep its heading and steering so the driver must recover deliberately.
  const incidence=Math.abs(Math.sin(state.heading));
  state.speed*=Math.max(.08,1-incidence*incidence*.92);
  state.yawRate*=.65;
 }
 return normalSpeed>0;
}
// An oriented footprint for each car. Angles and velocities are expressed in
// the local track frame: +progress is forwards, +offset is to the right.
function frame(car) {
 const angle=(car.heading||0)+(car.driftAngle||car.driftYaw||0), c=Math.cos(angle), s=Math.sin(angle);
 return {forward:[c,-s],right:[s,c]};
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function radius(car,f,axis) {
 return car.length*.5*Math.abs(dot(f.forward,axis))+car.width*.5*Math.abs(dot(f.right,axis));
}
/** Oriented-rectangle SAT in the local road frame, including the lap seam.
 * Returns the minimum translation normal and depth, or null when separated. */
export function circuitCarOverlap(a,b,length) {
 const gap=((b.progress-a.progress+length/2)%length+length)%length-length/2;
 const delta=[gap,b.offset-a.offset],fa=frame(a),fb=frame(b);
 let depth=Infinity,normal=null;
 for(const axis of [fa.forward,fa.right,fb.forward,fb.right]) {
  const projected=dot(delta,axis),overlap=radius(a,fa,axis)+radius(b,fb,axis)-Math.abs(projected);
  if(overlap<=0)return null;
  if(overlap<depth){depth=overlap;const sign=projected<0?-1:1;normal=[axis[0]*sign,axis[1]*sign];}
 }
 return {depth,normal};
}
function velocity(car) {
 const heading=car.heading||0;
 return [car.speed*Math.cos(heading),-car.speed*Math.sin(heading)];
}
function setVelocity(car,v,preserveHeading=false) {
 if(preserveHeading) {
  const heading=car.heading||0;
  car.speed=Math.max(0,v[0]*Math.cos(heading)-v[1]*Math.sin(heading));
  return;
 }
 // Vehicles cannot drive backwards in this arcade model. Constrain reverse
 // impulse rather than incorrectly turning it into forward acceleration.
 const forward=Math.max(0,v[0]), lateral=v[1];
 car.speed=Math.hypot(forward,lateral);
 car.heading=clamp(Math.atan2(-lateral,Math.max(.001,forward)),-.9,.9);
}
/** Equal-mass, low-restitution arcade impulse. Only approaching cars receive
 * a velocity impulse; resting/separating contacts get positional correction
 * without an artificial bounce. This is not damage or rigid-body simulation. */
export function resolveCircuitCarContact(a,b,length,preservePlayerHeading=false) {
 const contact=circuitCarOverlap(a,b,length);if(!contact)return false;
 const n=contact.normal, correction=(contact.depth+.01)*.5;
 a.progress-=n[0]*correction;a.offset-=n[1]*correction;
 b.progress+=n[0]*correction;b.offset+=n[1]*correction;
 const va=velocity(a),vb=velocity(b),relative=[va[0]-vb[0],va[1]-vb[1]],closing=dot(relative,n);
 if(closing>0) {
  const impulse=closing*.55; // equal masses, restitution 0.1
  const tangent=[-n[1],n[0]],friction=clamp(dot(relative,tangent)*.15,-impulse*.25,impulse*.25);
  for(let i=0;i<2;i++){const change=impulse*n[i]+friction*tangent[i];va[i]-=change;vb[i]+=change;}
  setVelocity(a,va,preservePlayerHeading);setVelocity(b,vb);
 }
 return true;
}
