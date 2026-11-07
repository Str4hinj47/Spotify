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
// Time thresholds in seconds. All objectives must be met before crossing the line.
export const SCENARIOS = Object.freeze([
  { id:'slipstream', title:'Slipstream Sprint', kicker:'01 / TRAFFIC ATTACK', distance:2000, limit:60, silver:54, gold:49, metric:'overtakes', target:4, objective:'Overtake 4 cars', multiplier:1 },
  { id:'needle', title:'Thread the Needle', kicker:'02 / PRECISION ATTACK', distance:2800, limit:82, silver:73, gold:67, metric:'nearMisses', target:3, objective:'Make 3 near misses', multiplier:1.25 },
  { id:'gauntlet', title:'Redline Gauntlet', kicker:'03 / ENDURANCE ATTACK', distance:4000, limit:110, silver:99, gold:90, metric:'overtakes', target:8, objective:'Overtake 8 cars', multiplier:1.5 },
]);
export const RANKED_STORAGE_KEY = 'overtake-ranked-v1';
const SCENARIO_IDS = SCENARIOS.map(s=>s.id);
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
    result.scenarios[id]={ completions:integer(item.completions), bestTime:typeof item.bestTime==='number' && Number.isFinite(item.bestTime) && item.bestTime>0 && item.bestTime<=86400 ? item.bestTime : null,
      bestMedal:['bronze','silver','gold'].includes(item.bestMedal) ? item.bestMedal : null };
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
  const scenario=getScenario(run.rankedScenario);
  if (devRun) return { delta:0, medal:null, success:false, eligible:false };
  const success=run.reason==='distance' && Number.isFinite(run.elapsed) && run.elapsed>0 && run.elapsed<=scenario.limit+1e-7 && run.distance>=scenario.distance && run[scenario.metric]>=scenario.target;
  if (!success) return { delta:-12, medal:null, success:false, eligible:true };
  const medal=run.elapsed<=scenario.gold?'gold':run.elapsed<=scenario.silver?'silver':'bronze';
  const base={bronze:18,silver:28,gold:40}[medal];
  return { delta:Math.round(base*scenario.multiplier), medal, success:true, eligible:true };
}
export function applyRankedResult(raw, run, devRun=false) {
  const state=sanitizeRanked(raw), outcome=rankedOutcome(run,devRun), before=rankFor(state.points);
  if (!outcome.eligible) return {state, outcome, before, after:before, delta:0};
  state.points=Math.max(0,Math.min(MAX_POINTS,state.points+outcome.delta));
  state.attempts++;
  const scenario=getScenario(run.rankedScenario);
  const stats=state.scenarios[scenario.id] ?? {completions:0,bestTime:null,bestMedal:null};
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
