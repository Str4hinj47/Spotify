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
 // Fast grand-prix rhythm: opening straight, alternating esses, a heavy
 // braking zone and a long return straight (Silverstone-inspired, not a replica).
 {id:'stadium', name:'Stadium Circuit', kind:'race', halfWidth:10, theme:'stadium', feature:'Fast esses and heavy braking', points:[
  [180,90],[180,0],[180,-80],[155,-125],[110,-130],
  [65,-155],[35,-195],[-10,-190],[-40,-230],[-105,-225],[-165,-190],
  [-185,-140],[-155,-100],[-105,-110],[-75,-80],[-100,-45],[-160,-35],
  [-200,10],[-190,75],[-150,110],[-115,150],[-120,205],[-65,240],[30,240],[120,220],[180,170]]},
 // Compact club circuit with two distinct hairpins and a fast final sweeper,
 // inspired by Tsukuba's rhythm rather than a surveyed reproduction.
 {id:'summit', name:'Summit Ring', kind:'race', halfWidth:10, theme:'mountain', feature:'Hairpins and a fast sweeper', points:[
  [175,85],[175,-25],[170,-110],[135,-165],[80,-185],
  [25,-170],[-5,-130],[-50,-120],[-95,-155],[-150,-145],[-180,-100],
  [-170,-55],[-125,-35],[-75,-50],[-35,-20],[-40,25],[-85,45],
  [-145,40],[-175,75],[-170,125],[-125,155],[-65,150],[-20,180],[45,230],[120,225],[175,175]]},
 // Road-course braking zones, a compact left-right crest sequence and a
 // flowing return, informed by Laguna Seca. This game uses a flat surface.
 {id:'coast', name:'Coast Run', kind:'race', halfWidth:10, theme:'coast', feature:'Technical bends and flowing exits', points:[
  [75,100],[75,0],[75,-90],[50,-155],[0,-190],[-70,-195],
  [-130,-175],[-160,-130],[-150,-90],[-105,-70],[-65,-85],[-35,-60],
  [-45,-15],[-95,0],[-155,-15],[-200,15],[-195,65],[-155,95],
  [-105,90],[-65,115],[-75,160],[-120,185],[-110,225],[-55,245],[15,235],[75,180]]},
 // Linking long sweepers to slower transitions gives the drift layouts more
 // than an oval while preserving recovery room and closed-lap racing.
 {id:'dockside', name:'Dockside Drift', kind:'drift', halfWidth:13, theme:'industrial', feature:'Linked drift turns and sweepers', points:[
  [170,80],[170,-15],[155,-90],[115,-135],[55,-135],[10,-165],
  [-50,-180],[-115,-155],[-155,-110],[-150,-65],[-105,-45],[-55,-55],
  [-15,-20],[-30,25],[-85,40],[-145,35],[-185,75],[-175,125],
  [-130,155],[-80,150],[-35,180],[30,215],[110,210],[170,160]]},
 // Outer sweep followed by an infield switchback: a flat interpretation of
 // the outer-to-inner transition used in stadium drifting.
 {id:'neon', name:'Neon Slide', kind:'drift', halfWidth:13, theme:'neon', feature:'Long sweep into infield transitions', points:[
  [175,85],[175,-15],[165,-100],[125,-165],[55,-190],[-25,-185],[-110,-150],
  [-175,-95],[-185,-35],[-155,10],[-105,35],[-65,80],[-80,125],
  [-140,145],[-170,180],[-155,225],[-95,245],[-40,225],[5,185],
  [50,175],[105,200],[175,165]]},
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
