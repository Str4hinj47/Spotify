// Local ranked progression. Neither snapshots nor results are server-verified.
export const RANKS = Object.freeze([
  { id:'rookie', name:'Rookie', min:0, color:'#c9a17b', glow:'#a96139' },
  { id:'street', name:'Street', min:120, color:'#9ee2e4', glow:'#438c9c' },
  { id:'gearhead', name:'Gearhead', min:350, color:'#b2e46d', glow:'#508d34' },
  { id:'apex', name:'Apex', min:700, color:'#ffd46a', glow:'#c9771f' },
  { id:'turbo', name:'Turbo', min:1200, color:'#6cdbff', glow:'#3077df' },
  { id:'overdrive', name:'Overdrive', min:1850, color:'#db9bff', glow:'#8135d0' },
  { id:'legend', name:'Road Legend', min:2700, color:'#ffbe72', glow:'#e94638' },
]);
import { TRACKS } from './circuit.mjs';
// Ranked now runs closed-track races only. Legacy scenario results remain in
// saves under their original IDs; those IDs are never reused for new tracks.
export const SCENARIOS = Object.freeze(TRACKS.map((track,i)=>({
  id:track.id, title:track.name, kicker:`0${i+1} / ${track.kind==='drift'?'DRIFT':'CIRCUIT'} RACE`,
  trackId:track.id, kind:track.kind, distance:track.length*track.laps, laps:track.laps,
  multiplier:1, objective:track.kind==='drift'?'Drift cars only':'All playable cars',
})));
const LEGACY_IDS=['slipstream','needle','gauntlet'];
export const RANKED_STORAGE_KEY = 'overtake-ranked-v1';
const SCENARIO_IDS = [...LEGACY_IDS,...SCENARIOS.map(s=>s.id)];
// Track IDs stay stable, but times from the old routes aren't comparable.
export const RACE_LAYOUT_REVISION = 2;
const MAX_POINTS = 1_000_000;
export function getScenario(id) { return SCENARIOS.find(s=>s.id===id) ?? SCENARIOS[0]; }
export function emptyRanked() { return { version:1, points:0, attempts:0, scenarios:{} }; }
const integer = (n, max=MAX_POINTS) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
export function sanitizeRanked(raw) {
  const result=emptyRanked();
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return result;
  result.points=integer(raw.points);result.attempts=integer(raw.attempts);
  for (const id of SCENARIO_IDS) {
    const item=raw.scenarios?.[id];
    if (!item || typeof item !== 'object') continue;
    const time = n => typeof n==='number' && Number.isFinite(n) && n>0 && n<=86400 ? n : null;
    const stats={completions:integer(item.completions),bestTime:time(item.bestTime),
      bestMedal:['bronze','silver','gold'].includes(item.bestMedal) ? item.bestMedal : null};
    if(SCENARIOS.some(s=>s.id===id)) {
      // Retain the previous route's record separately; only compare new runs
      // against times set on this layout. Preserve RP, completions and medals.
      const current=item.layoutRevision===RACE_LAYOUT_REVISION;
      stats.legacyBestTime=time(item.legacyBestTime) ?? (current ? null : stats.bestTime);
      if(!current)stats.bestTime=null;
      stats.layoutRevision=RACE_LAYOUT_REVISION;
    }
    result.scenarios[id]=stats;
  }
  return result;
}
export function rankFor(points) {
  const n=integer(points);
  let index=0;
  for (let i=1;i<RANKS.length;i++) if (n>=RANKS[i].min) index=i;
  const rank=RANKS[index], next=RANKS[index+1] ?? null;
  return { rank, index, next, progress:next ? Math.min(1,(n-rank.min)/(next.min-rank.min)) : 1, points:n };
}
export function rankedOutcome(run, devRun=false) {
  if (devRun) return { delta:0, medal:null, success:false, eligible:false };
  const place=run.racePosition;
  if (run.reason!=='distance' || !Number.isInteger(place) || place<1 || place>6 || !Number.isFinite(run.elapsed) || run.elapsed<=0)
    return {delta:-12,medal:null,success:false,eligible:true};
  if (place>3) return {delta:-12,medal:null,success:false,eligible:true};
  const medal=place===1?'gold':place===2?'silver':'bronze';
  return {delta:place===1?40:place===2?28:18,medal,success:true,eligible:true};
}
export function applyRankedResult(raw, run, devRun=false) {
  const state=sanitizeRanked(raw), outcome=rankedOutcome(run,devRun), before=rankFor(state.points);
  if (!outcome.eligible) return {state, outcome, before, after:before, delta:0};
  state.points=Math.max(0,Math.min(MAX_POINTS,state.points+outcome.delta));
  state.attempts++;
  const scenario=getScenario(run.rankedScenario);
  const stats=state.scenarios[scenario.id] ?? {completions:0,bestTime:null,bestMedal:null,legacyBestTime:null,layoutRevision:RACE_LAYOUT_REVISION};
  if (outcome.success) {
    stats.completions=Math.min(MAX_POINTS,stats.completions+1);
    if (stats.bestTime===null || run.elapsed<stats.bestTime) stats.bestTime=run.elapsed;
    const order=[null,'bronze','silver','gold'];
    if (order.indexOf(outcome.medal)>order.indexOf(stats.bestMedal)) stats.bestMedal=outcome.medal;
  }
  state.scenarios[scenario.id]=stats;
  const after=rankFor(state.points);
  return {state,outcome,before,after,delta:state.points-before.points};
}
