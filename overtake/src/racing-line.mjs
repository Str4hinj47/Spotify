// A reference racing line for circuit maps. This is a minimum-curvature line
// within the asphalt: the offset o(s) is solved from o'' = -curvature, which
// straightens the path as much as the track width allows. It is a geometric
// guide, not a lap-time-optimal solution (no braking or traction model), so
// the UI labels it the reference line rather than the perfect lap.
import {getTrack, trackSample} from './circuit.mjs';

const SAMPLES=192;
/** A smooth reference line: follow the broad direction of each bend, easing
 * to the inside and back toward the centre. It is a geometric guide within
 * the asphalt, not a traction-limited lap-time optimiser. */
export function referenceLine(trackId) {
 const track=getTrack(trackId),length=track.length,ds=length/SAMPLES,limit=Math.max(1,track.halfWidth-1.4);
 let curvature=new Float64Array(SAMPLES);
 for(let i=0;i<SAMPLES;i++)curvature[i]=trackSample(i*ds,trackId).curvature;
 // Wide smoothing keeps the guide from weaving between neighbouring bends.
 for(let pass=0;pass<9;pass++){
  const next=new Float64Array(SAMPLES);
  for(let i=0;i<SAMPLES;i++)next[i]=(curvature[(i-1+SAMPLES)%SAMPLES]+curvature[i]*2+curvature[(i+1)%SAMPLES])*.25;
  curvature.set(next);
 }
 const look=Math.max(2,Math.round(24/ds));
 let offset=new Float64Array(SAMPLES);
 for(let i=0;i<SAMPLES;i++)offset[i]=-limit*.9*Math.tanh(curvature[(i+look)%SAMPLES]*170);
 for(let pass=0;pass<5;pass++){
  const next=new Float64Array(SAMPLES);
  for(let i=0;i<SAMPLES;i++)next[i]=(offset[(i-1+SAMPLES)%SAMPLES]+offset[i]*2+offset[(i+1)%SAMPLES])*.25;
  offset.set(next);
 }
 return {trackId,length,halfWidth:track.halfWidth,limit,samples:Array.from(offset,(o,i)=>({s:i*ds,offset:o}))};
}
/** Smoothly read the recorded line at any distance around the lap. */
export function lineOffsetAt(line,s) {
 const points=line.samples,n=points.length;
 if(!n)return 0;
 const length=line.length,ds=length/n,wrapped=((s%length)+length)%length,index=wrapped/ds,i=Math.floor(index)%n,j=(i+1)%n,t=index-Math.floor(index);
 return points[i].offset*(1-t)+points[j].offset*t;
}
/** Resample a recorded lap (s, offset pairs) onto the reference grid for
 * drawing. Gaps between samples are bridged linearly rather than filled. */
export function resampleLine(samples,length,count=SAMPLES) {
 if(!samples?.length)return [];
 const sorted=[...samples].sort((a,b)=>a[0]-b[0]),out=[];
 let cursor=0;
 for(let i=0;i<count;i++){
  const s=i/count*length;
  while(cursor<sorted.length-1 && sorted[cursor+1][0]<s)cursor++;
  const a=sorted[cursor],b=sorted[cursor+1];
  if(s<a[0]||!b)continue;
  const t=(s-a[0])/Math.max(1e-6,b[0]-a[0]);
  out.push({s,offset:a[1]*(1-t)+b[1]*t});
 }
 return out;
}
