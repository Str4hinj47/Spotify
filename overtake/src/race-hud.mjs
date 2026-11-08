import { getTrack, trackPoint, trackSample } from './circuit.mjs';

// Shared, aspect-preserving projection for the actual centreline and race cars.
export function createRaceMap(trackId, width=150, height=100, padding=9) {
  const track=getTrack(trackId),points=Array.from({length:200},(_,i)=>trackSample(track.length*i/200,track.id));
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
  const scale=Math.min((width-2*padding)/Math.max(1,maxX-minX),(height-2*padding)/Math.max(1,maxZ-minZ));
  const left=(width-(maxX-minX)*scale)/2,top=(height-(maxZ-minZ)*scale)/2;
  const project=(x,z)=>({x:left+(x-minX)*scale,y:top+(z-minZ)*scale});
  const path=points.map((p,i)=>{const q=project(p.x,p.z);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`}).join(' ')+' Z';
  const marker=(progress,offset=0)=>{const p=trackPoint(progress,offset,track.id);return project(p.x,p.z)};
  return {path,marker,start:marker(0),width,height};
}

export function createLapTiming() { return {lapTimes:[],lastCrossing:0}; }
// Record each *forward* crossing exactly once. Linearly interpolate the time
// within the physics step rather than reporting the next frame's timestamp.
export function recordLapCrossings(state,previous,current,elapsedBefore,elapsedAfter,length,laps) {
  if(current<=previous || length<=0) return [];
  const recorded=[];
  while(state.lapTimes.length<laps) {
    const boundary=(state.lapTimes.length+1)*length;
    if(previous>=boundary || current<boundary)break;
    const fraction=Math.max(0,Math.min(1,(boundary-previous)/(current-previous)));
    const crossing=elapsedBefore+(elapsedAfter-elapsedBefore)*fraction;
    const lap=Math.max(0,crossing-state.lastCrossing);state.lapTimes.push(lap);state.lastCrossing=crossing;recorded.push(lap);
  }
  return recorded;
}

// Gaps use unwrapped race progress, not physical proximity around the lap seam.
// Finishers keep driving, so clamp their competitive progress to the finish.
export function raceGaps(playerProgress, rivals, finish) {
  let ahead=null, behind=null;
  for(const rival of rivals) {
    const progress=Math.min(rival.progress,finish), gap=progress-playerProgress;
    if(gap>0 && (!ahead || gap<ahead.distance)) ahead={distance:gap,finished:rival.progress>=finish};
    else if(gap<=0 && (!behind || -gap<behind.distance)) behind={distance:Math.abs(gap),finished:false};
  }
  return {ahead,behind};
}

// Compare a newly completed lap against the best earlier lap, not itself.
export function lapComparison(lapTimes) {
  if(!lapTimes.length)return null;
  const lap=lapTimes.length,time=lapTimes[lap-1];
  const previousBest=lap>1?Math.min(...lapTimes.slice(0,-1)):null;
  return {lap,time,delta:previousBest===null?null:time-previousBest,best:previousBest===null||time<previousBest};
}

// Physical gap around the track (not race standing): useful for a car that's
// close behind even when it is on a different lap. Returns null outside range.
export function rearProximity(playerProgress,rivals,length,range=45) {
  if(!(length>0) || !(range>0))return null;
  let closest=Infinity;
  for(const rival of rivals) {
    const gap=((playerProgress-rival.progress)%length+length)%length;
    if(gap<=range && gap<closest)closest=gap;
  }
  return Number.isFinite(closest)?closest:null;
}
