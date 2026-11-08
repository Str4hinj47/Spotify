// Circuit-only AI. Opponents use a shared track coordinate system, but each
// driver has their own pace, braking, line and passing preference. Highway
// traffic uses its separate traffic AI and never calls this module.
import { getTrack, trackSample } from './circuit.mjs';
import { resolveCircuitCarContact } from './circuit-contact.mjs';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const profiles=[
 {pace:.84,grip:4.5,braking:8.0,line:-.55,side:-1},
 {pace:.76,grip:4.2,braking:7.4,line:.65,side:1},
 {pace:.94,grip:5.1,braking:8.6,line:.15,side:1},
 {pace:.89,grip:4.7,braking:7.8,line:-.2,side:-1},
 {pace:.93,grip:5.0,braking:8.3,line:.45,side:1},
];
export function raceDriverProfile(index) { return {...profiles[((index%profiles.length)+profiles.length)%profiles.length]}; }

// Physical proximity wraps at the start line; standings use unwrapped progress.
export function raceGap(from,to,length) {
  return ((to-from+length/2)%length+length)%length-length/2;
}

// Look through a series of bends and compute a safe entry speed at each point,
// including the braking distance needed to arrive at that point at corner speed.
export function cornerSpeedLimit(driver,trackId,surface=1) {
  const grip=driver.profile.grip*clamp(surface,.6,1.05);
  const braking=driver.profile.braking*clamp(surface,.6,1.05);
  let limit=driver.targetSpeed*driver.profile.pace;
  for(const distance of [0,12,25,40,60,85,115,150]) {
    const curvature=Math.abs(trackSample(driver.progress+distance,trackId).curvature);
    if(curvature<.0001) continue;
    const bendSpeed=Math.sqrt(grip/curvature);
    limit=Math.min(limit,Math.sqrt(bendSpeed*bendSpeed+2*braking*distance));
  }
  return limit;
}

/** Plan from an immutable frame snapshot. `others` includes rivals and player.
 * No teleports or speed boosts: positions evolve continuously in stepRival. */
export function planRaceDriver(driver,others,trackId,surface=1) {
  const track=getTrack(trackId), maxOffset=Math.max(1,track.halfWidth-driver.width/2-1);
  const curve=trackSample(driver.progress+35,trackId).curvature;
  const apex=clamp(-curve*240,-2.2,2.2);
  const line=clamp(apex+driver.profile.line,-maxOffset,maxOffset);
  const near=others.map(o=>({...o,gap:raceGap(driver.progress,o.progress,track.length)}));
  const clearance=(other)=> (driver.width+other.width)*.5+.7;
  const lookAhead=clamp(20+driver.speed*1.2,25,80);
  const ahead=near.filter(o=>o.gap>0 && o.gap<lookAhead && Math.abs(o.offset-driver.offset)<clearance(o)).sort((a,b)=>a.gap-b.gap)[0];
  const desiredBase=cornerSpeedLimit(driver,trackId,surface);
  let targetOffset=line, passTarget=null, passOffset=null;
  const tracked=driver.passTarget == null ? null : near.find(o=>o.key===driver.passTarget);
  if(tracked && tracked.gap>-(driver.length+tracked.length)*.5-8 && tracked.gap<lookAhead+20 && driver.passOffset != null) {
    targetOffset=clamp(driver.passOffset,-maxOffset,maxOffset);
    passTarget=driver.passTarget;passOffset=targetOffset;
  }
  // Consider an overtake only when approaching a slower car. A candidate is
  // rejected if a car alongside or close behind occupies the lane or the path
  // to it. Prefer lanes with a clear forward gap, not random lane weaving.
  if(passTarget===null && ahead && (ahead.speed < desiredBase-1 || ahead.gap<10)) {
    const lanes=[-maxOffset*.78,-maxOffset*.39,0,maxOffset*.39,maxOffset*.78];
    let best=-Infinity;
    for(const lane of lanes) {
      const blocked=near.some(o=> {
        if(o===ahead) return false;
        const safe=(driver.length+o.length)*.5+3;
        if(o.gap < -safe-5 || o.gap > safe+8) return false;
        const between=o.offset>=Math.min(driver.offset,lane)-clearance(o) && o.offset<=Math.max(driver.offset,lane)+clearance(o);
        return Math.abs(o.offset-lane)<clearance(o) || (Math.abs(o.gap)<safe && between);
      });
      if(blocked)continue;
      const front=near.filter(o=>o.gap>0 && Math.abs(o.offset-lane)<clearance(o)).sort((a,b)=>a.gap-b.gap)[0];
      const room=front?Math.min(front.gap,lookAhead):lookAhead;
      const score=room - Math.abs(lane-driver.offset)*.65 - Math.abs(lane-line)*.3 + Math.sign(lane-driver.offset)*driver.profile.side*.25;
      if(score>best){best=score;targetOffset=lane;}
    }
    if(Math.abs(targetOffset-ahead.offset)>=clearance(ahead) && Math.abs(targetOffset-driver.offset)>.5) {
      passTarget=ahead.key;passOffset=targetOffset;
    }
  }
  let desired=desiredBase;
  // Still respect the car directly in front while changing lanes. Gradually
  // close the gap instead of stopping dead or driving through the opponent.
  for(const other of near) {
    if(other.gap<=0 || other.gap>lookAhead || Math.abs(other.offset-driver.offset)>=clearance(other))continue;
    const safe=(driver.length+other.length)*.5+2.5;
    desired=Math.min(desired,Math.max(0,other.speed+(other.gap-safe)*.55));
  }
  return {targetOffset,desiredSpeed:Math.max(0,desired),line,cornerSpeed:desiredBase,passTarget,passOffset};
}

export function stepRaceDriver(driver,plan,dt,trackId,surface=1) {
  const h=clamp(dt,0,.1), oldSpeed=driver.speed, oldOffset=driver.offset;
  driver.passTarget=plan.passTarget;driver.passOffset=plan.passOffset;
  const brake=driver.profile.braking*clamp(surface,.6,1.05);
  driver.speed=Math.max(0,driver.speed+clamp(plan.desiredSpeed-driver.speed,-brake*h,driver.acceleration*h));
  // Bicycle-like path following: the body turns with a finite yaw response,
  // and its forward velocity advances both track progress and lateral offset.
  // The track tangent is only the coordinate frame, not a teleport or yaw set.
  const maxOffset=getTrack(trackId).halfWidth-driver.width/2-1;
  const lateralRate=Math.min(2.8,Math.max(.5,driver.speed*.12));
  const desiredLateral=clamp((plan.targetOffset-driver.offset)*.7,-lateralRate,lateralRate);
  const curvature=trackSample(driver.progress,trackId).curvature;
  const speed=Math.max(driver.speed,2);
  const desiredHeading=-Math.atan2(desiredLateral,speed);
  driver.heading=driver.heading ?? 0;driver.yawRate=driver.yawRate ?? 0;
  const desiredYaw=curvature*driver.speed+(desiredHeading-driver.heading)*2.8;
  const maxYaw=driver.profile.grip*clamp(surface,.6,1.05)/speed;
  const targetYaw=clamp(desiredYaw,-maxYaw,maxYaw);
  driver.yawRate+=(targetYaw-driver.yawRate)*Math.min(1,h*5);
  driver.heading=clamp(driver.heading+(driver.yawRate-curvature*driver.speed)*h,-.7,.7);
  driver.offset=clamp(driver.offset-driver.speed*Math.sin(driver.heading)*h,-maxOffset,maxOffset);
  driver.progress+=Math.max(0,driver.speed*Math.cos(driver.heading)*h/Math.max(.65,1+curvature*driver.offset));
  driver.lateralSpeed=h?(driver.offset-oldOffset)/h:0;
  driver.braking=oldSpeed-driver.speed>h*.65;
  return driver;
}

// Resolve simultaneous rival contacts using the same impulse and separation
// as the player. Multiple passes handle three-car bunches at the start line.
export function resolveRaceContacts(drivers,_previous,trackId) {
  const track=getTrack(trackId);
  for(let pass=0;pass<4;pass++) for(let i=0;i<drivers.length;i++) for(let j=i+1;j<drivers.length;j++) {
    const a=drivers[i],b=drivers[j],speedA=a.speed,speedB=b.speed;
    if(!resolveCircuitCarContact(a,b,track.length))continue;
    a.braking ||= a.speed<speedA-.01;b.braking ||= b.speed<speedB-.01;
    for(const car of [a,b]) {
      const max=track.halfWidth-car.width/2-1;
      car.offset=clamp(car.offset,-max,max);
    }
  }
}

// The player and the AI share solid space on a circuit. Resolve only the
// trailing vehicle's forward movement, preserving the driver's steering input.
export function resolvePlayerContact(driver,player,previousDriver,previousPlayerProgress,trackId) {
  const gap=raceGap(player.progress,driver.progress,getTrack(trackId).length);
  const distance=(driver.length+player.length)*.5, width=(driver.width+player.width)*.5;
  if(Math.abs(gap)>=distance || Math.abs(driver.offset-player.offset)>=width)return false;
  if(gap>=0) {
    player.progress=Math.max(previousPlayerProgress,player.progress-(distance-gap));
    player.speed=Math.min(player.speed,driver.speed);
  } else {
    driver.progress=Math.max(previousDriver.progress,driver.progress-(distance+gap));
    driver.speed=Math.min(driver.speed,player.speed);driver.braking=true;
  }
  return true;
}
