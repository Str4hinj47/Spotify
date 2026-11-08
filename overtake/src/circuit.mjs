// Distances are metres along the centreline; road geometry and all race
// simulation use the same sampled curves. The radius/straight constants are
// retained for old integrations but no longer describe the rebuilt stadium.
export const TRACK_RADIUS = 150;
export const TRACK_STRAIGHT = 360;
export const TRACK_HALF_WIDTH = 10;
export const RACE_LAPS = 3;
export function trackAt(distance) { return trackSample(distance,'stadium'); }
export function trackPosition(s,offset=0) { return trackPoint(s,offset,'stadium'); }
/** Position is based on absolute progress, not wrapped lap distance. */
export function racePosition(playerProgress, opponents) {
  return 1 + opponents.filter(r => playerProgress >= RACE_DISTANCE ? r.progress >= RACE_DISTANCE : r.progress > playerProgress).length;
}
export function raceLap(progress) { return Math.max(1,Math.min(RACE_LAPS,Math.floor(Math.max(0,progress)/TRACK_LENGTH)+1)); }

// Five distinct closed layouts, sampled by arc length so simulation, mesh,
// AI and lap counting share exactly the same path. Points are unbranded,
// original circuit designs in clockwise driving order.
const definitions = [
 {id:'stadium', name:'Stadium Circuit', kind:'race', halfWidth:10, theme:'stadium', points:[[150,120],[150,25],[150,-150],[110,-240],[20,-225],[-55,-155],[-125,-195],[-190,-110],[-165,-10],[-110,60],[-130,165],[-50,235],[70,230]]},
 {id:'summit', name:'Summit Ring', kind:'race', halfWidth:10, theme:'mountain', points:[[160,170],[185,20],[140,-150],[45,-235],[-80,-220],[-170,-120],[-155,10],[-105,120],[-80,230],[45,250]]},
 {id:'coast', name:'Coast Run', kind:'race', halfWidth:10, theme:'coast', points:[[150,180],[175,25],[135,-125],[20,-220],[-130,-190],[-105,-80],[-175,35],[-140,175],[-20,245],[90,240]]},
 {id:'dockside', name:'Dockside Drift', kind:'drift', halfWidth:13, theme:'industrial', points:[[125,145],[150,15],[110,-120],[25,-175],[-85,-150],[-130,-40],[-95,70],[-60,160],[25,190]]},
 {id:'neon', name:'Neon Slide', kind:'drift', halfWidth:13, theme:'neon', points:[[135,155],[155,25],[110,-120],[10,-190],[-115,-150],[-145,-25],[-90,55],[-120,145],[-20,210],[65,215]]},
];
function catmull(a,b,c,d,t) {
 const t2=t*t,t3=t2*t;
 return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
}
function makeTrack(def) {
 const pts=def.points, count=pts.length, samples=[], N=count*160;let distance=0;
 for(let i=0;i<=N;i++) {
  const u=i/N*count, index=Math.floor(u)%count,t=u-Math.floor(u);
  const a=pts[(index+count-1)%count],b=pts[index],c=pts[(index+1)%count],d=pts[(index+2)%count];
  const x=catmull(a[0],b[0],c[0],d[0],t),z=catmull(a[1],b[1],c[1],d[1],t);
  if(i) distance+=Math.hypot(x-samples[i-1].x,z-samples[i-1].z);
  samples.push({x,z,s:distance});
 }
 return {...def,length:distance,laps:3,samples};
}
const customTracks=definitions.map(makeTrack);
export const TRACK_LENGTH=customTracks[0].length;
export const RACE_DISTANCE=TRACK_LENGTH*RACE_LAPS;
export const TRACKS=Object.freeze(customTracks.map(({samples,points,...track})=>track));
export function getTrack(id) {return TRACKS.find(t=>t.id===id)??TRACKS[0];}
export function trackSample(distance,id='stadium') {
 const track=customTracks.find(t=>t.id===id) ?? customTracks[0];
 const s=((distance%track.length)+track.length)%track.length, samples=track.samples;
 let lo=0,hi=samples.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].s<=s)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],u=(s-a.s)/(b.s-a.s||1);
 const heading=(p,q)=>Math.atan2(-(q.x-p.x),-(q.z-p.z));
 const yaw=heading(a,b);
 const prev=samples[(lo-1+samples.length-1)%(samples.length-1)],next=samples[(hi+1)%(samples.length-1)];
 const h0=heading(prev,a),h1=heading(b,next),delta=Math.atan2(Math.sin(h1-h0),Math.cos(h1-h0));
 const curvature=delta/Math.max(.001,Math.hypot(a.x-prev.x,a.z-prev.z)+Math.hypot(b.x-a.x,b.z-a.z)+Math.hypot(next.x-b.x,next.z-b.z));
 return {x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,yaw,curvature};
}
export function trackPoint(distance,offset=0,id='stadium') {
 const p=trackSample(distance,id);return {x:p.x+Math.cos(p.yaw)*offset,z:p.z-Math.sin(p.yaw)*offset,yaw:p.yaw,curvature:p.curvature};
}
export function trackRacePosition(playerProgress,opponents,id='stadium') {
 const track=getTrack(id), finish=track.length*track.laps;
 return 1+opponents.filter(r=>playerProgress>=finish?r.progress>=finish:r.progress>playerProgress).length;
}
export function trackLap(progress,id='stadium') {const t=getTrack(id);return Math.max(1,Math.min(t.laps,Math.floor(Math.max(0,progress)/t.length)+1));}
