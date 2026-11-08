// Circuit-only AI. Opponents use a shared track coordinate system, but each
// driver has their own pace, braking, line and passing preference. Highway
// traffic uses its separate traffic AI and never calls this module.
import { getTrack, trackSample } from './circuit.mjs';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const profiles=[
 {pace:.88,grip:4.7,braking:8.0,line:-.55,side:-1},
 {pace:.82,grip:4.3,braking:7.4,line:.65,side:1},
 {pace:.98,grip:5.4,braking:8.6,line:.15,side:1},
 {pace:.90,grip:4.8,braking:7.8,line:-.2,side:-1},
 {pace:.95,grip:5.2,braking:8.3,line:.45,side:1},
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
  // A controlled lane change, slowed at very low speed and never outside the road.
  const maxOffset=getTrack(trackId).halfWidth-driver.width/2-1;
  const lateralRate=Math.min(2.8,Math.max(.5,driver.speed*.12));
  driver.offset=clamp(driver.offset+clamp(plan.targetOffset-driver.offset,-lateralRate*h,lateralRate*h),-maxOffset,maxOffset);
  driver.progress+=(oldSpeed+driver.speed)*.5*h;
  driver.lateralSpeed=h?(driver.offset-oldOffset)/h:0;
  driver.braking=oldSpeed-driver.speed>h*.65;
  return driver;
}

// Prevent two simultaneously planned rivals from occupying the same space.
// If they converge side-by-side, cancel their lateral motion first; if one
// catches the other, constrain the trailing car instead of letting it ghost
// through. The snapshot is from before this simulation step.
export function resolveRaceContacts(drivers,previous,trackId) {
  const length=getTrack(trackId).length;
  for(let pass=0;pass<3;pass++) for(let i=0;i<drivers.length;i++) for(let j=i+1;j<drivers.length;j++) {
    const a=drivers[i],b=drivers[j],gap=raceGap(a.progress,b.progress,length);
    const longitudinal=(a.length+b.length)*.5+.25, lateral=(a.width+b.width)*.5+.15;
    if(Math.abs(gap)>=longitudinal || Math.abs(a.offset-b.offset)>=lateral) continue;
    if(Math.abs(previous[i].offset-previous[j].offset)>Math.abs(a.offset-b.offset)) {
      a.offset=previous[i].offset;b.offset=previous[j].offset;
      a.lateralSpeed=0;b.lateralSpeed=0;
    }
    if(Math.abs(a.offset-b.offset)>=lateral) continue;
    const oldGap=raceGap(previous[i].progress,previous[j].progress,length);
    const bAhead=gap>0 || (gap===0 && oldGap>=0);
    const follower=bAhead?a:b, leader=bAhead?b:a, before=previous[bAhead?i:j];
    follower.progress=Math.max(before.progress,follower.progress-(longitudinal-Math.abs(gap)));
    follower.speed=Math.min(follower.speed,leader.speed);follower.braking=true;
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
