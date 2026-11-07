// Run structure: modes, sequential contracts, contracts and medals.
// Pure module so progression can be unit-tested without WebGL.
import { multiplierFor, passScore } from './rules.mjs';
import { getScenario } from './ranked.mjs';

export const RUN_MODES = {
  endless: {
    id: 'endless', label: 'Endless', duration: null,
    tagline: 'Classic survival. Chain passes until you wreck.',
    medals: { bronze: 2500, silver: 6000, gold: 12000 },
  },
  ranked: { id: 'ranked', label: 'Ranked Attack', duration: null, tagline: 'Finish the scenario and climb the local ladder.', medals: { bronze: 2000, silver: 5000, gold: 10000 } },
  trial: { id: 'trial', label: 'Time Trial', duration: null, tagline: 'Reach 3 km as fast as possible.', medals: { bronze: 2000, silver: 5000, gold: 10000 } },
  seasonal: { id: 'seasonal', label: 'Seasonal Challenge', duration: 180, tagline: 'A local challenge rotates every UTC quarter.', medals: { bronze: 1500, silver: 3500, gold: 7000 } },
  convoy: { id: 'convoy', label: 'Convoy Run', duration: 150, tagline: 'Pass six cars in a slower traffic convoy.', medals: { bronze: 1500, silver: 3500, gold: 7000 } },
  checkpoint: { id:'checkpoint', label:'Checkpoint Chase', duration:35, tagline:'Start with 35 seconds. Every 500 m adds 15 seconds and 250 points.', medals:{ bronze:2000, silver:5000, gold:10000 } },
  precision: { id:'precision', label:'Precision Challenge', duration:120, tagline:'Land 8 near misses in 2 minutes. Close passes earn double points.', medals:{ bronze:1500, silver:3500, gold:7000 } },
  speed: { id:'speed', label:'Speed Run', duration:90, tagline:'Score 50 points per second above 140 km/h, plus regular passes and quests.', medals:{ bronze:2000, silver:5000, gold:9000 } },
  ghost: { id: 'ghost', label: 'Ghost Trial', duration: null, tagline: 'Race a local replay of your best 3 km run.', medals: { bronze: 2000, silver: 5000, gold: 10000 } },
  near: { id: 'near', label: 'Near Miss', duration: 90, tagline: 'Ninety seconds. Close passes pay more.', medals: { bronze: 1800, silver: 4000, gold: 7500 } },
  daily: { id: 'daily', label: 'Daily Drive', duration: 120, tagline: 'One rotating objective every UTC day.', medals: { bronze: 1000, silver: 2500, gold: 5000 } },
  weekly: { id: 'weekly', label: 'Weekly Event', duration: 240, tagline: 'A bigger rotating objective each UTC week.', medals: { bronze: 2000, silver: 5000, gold: 9000 } },
  rush: {
    id: 'rush', label: 'Rush', duration: 120,
    tagline: 'Two minutes. Maximum points. Contracts pay extra.',
    medals: { bronze: 1800, silver: 4000, gold: 7500 },
  },
};

const CONTRACT_POOL = [
  { id: 'pass5', title: 'Clean five', desc: 'Overtake 5 cars', metric: 'overtakes', target: 5, reward: 400 },
  { id: 'near3', title: 'Thread the needle', desc: 'Score 3 near misses', metric: 'nearMisses', target: 3, reward: 550 },
  { id: 'dist1500', title: 'Open road', desc: 'Drive 1.5 km', metric: 'distance', target: 1500, reward: 450 },
  { id: 'close2', title: 'Close quarters', desc: 'Make 2 close overtakes', metric: 'nearMisses', target: 2, reward: 600 },
  { id: 'combo10', title: 'In the zone', desc: 'Reach a 10-pass combo', metric: 'bestCombo', target: 10, reward: 650 },
  { id: 'speed12', title: 'Autobahn', desc: 'Hold 140+ km/h for 12 s total', metric: 'highSpeedTime', target: 12, reward: 500 },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickContracts(seed) {
  const rnd = mulberry32(seed);
  const pool = [...CONTRACT_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Always open with an approachable pass contract, then two random ones.
  const first = CONTRACT_POOL[0];
  const rest = pool.filter((c) => c.id !== first.id).slice(0, 2);
  return [first, ...rest].map((c) => ({ ...c }));
}

// Local events rotate on UTC boundaries. Their scores are not globally verified.
export function eventFor(mode, now = Date.now()) {
  const day = Math.floor(now / 86400000);
  const week = Math.floor((day + 3) / 7); // Monday UTC
  const quarterDate = new Date(now);
  const quarter = quarterDate.getUTCFullYear() * 4 + Math.floor(quarterDate.getUTCMonth() / 3);
  const choices = mode === 'seasonal' ? [
    { id:'season-pass', title:'Road legends', desc:'Overtake 8 cars', metric:'overtakes', target:8, reward:1200 },
    { id:'season-near', title:'Close call season', desc:'Make 5 near misses', metric:'nearMisses', target:5, reward:1200 },
    { id:'season-distance', title:'Open road season', desc:'Drive 3 km', metric:'distance', target:3000, reward:1200 },
  ] : mode === 'weekly' ? [
    { id:'weekly-pass', title:'Traffic tamer', desc:'Overtake 10 cars', metric:'overtakes', target:10, reward:1500 },
    { id:'weekly-near', title:'On the edge', desc:'Make 6 near misses', metric:'nearMisses', target:6, reward:1500 },
    { id:'weekly-distance', title:'Long haul', desc:'Drive 4 km', metric:'distance', target:4000, reward:1500 },
  ] : [
    { id:'daily-pass', title:'Clean run', desc:'Overtake 4 cars', metric:'overtakes', target:4, reward:650 },
    { id:'daily-near', title:'Close calls', desc:'Make 3 near misses', metric:'nearMisses', target:3, reward:650 },
    { id:'daily-distance', title:'Open road', desc:'Drive 1.5 km', metric:'distance', target:1500, reward:650 },
  ];
  const period = mode === 'seasonal' ? quarter : mode === 'weekly' ? week : day;
  return { period, contract: { ...choices[((period % choices.length) + choices.length) % choices.length] } };
}

export function createRun(mode = 'endless', seed = Date.now(), now = Date.now(), scenarioId = 'slipstream') {
  const m = RUN_MODES[mode] ? mode : 'endless';
  const def = RUN_MODES[m];
  const scenario = m === 'ranked' ? getScenario(scenarioId) : null;
  return {
    mode: m, seed: seed >>> 0, elapsed: 0, timeLeft: scenario ? scenario.limit : def.duration, rankedScenario: scenario?.id ?? null,
    distance: 0, score: 0, combo: 0, bestCombo: 0,
    overtakes: 0, nearMisses: 0, oncomingDodges: 0,
    topSpeed: 0, highSpeedTime: 0, speedBonusTime: 0,
    contracts: scenario || m === 'ghost' || m === 'checkpoint' ? [] : m === 'precision' ? [{ id:'precision-near', title:'Precision challenge', desc:'Make 8 near misses', metric:'nearMisses', target:8, reward:1200 }] : m === 'convoy' ? [{ id:'convoy-pass', title:'Convoy run', desc:'Overtake 6 cars', metric:'overtakes', target:6, reward:1000 }] : m === 'daily' || m === 'weekly' || m === 'seasonal' ? [eventFor(m, now).contract] : pickContracts(seed), contractIndex: 0, contractBaseline: 0, contractsDone: 0,
    eventPeriod: m === 'daily' || m === 'weekly' || m === 'seasonal' ? eventFor(m, now).period : null,
    finished: false, reason: null,
  };
}

export function medalFor(mode, score) {
  const def = RUN_MODES[mode] ?? RUN_MODES.endless;
  if (score >= def.medals.gold) return 'gold';
  if (score >= def.medals.silver) return 'silver';
  if (score >= def.medals.bronze) return 'bronze';
  return null;
}

export function contractProgress(run) {
  const c = run.contracts[run.contractIndex];
  if (!c) return { contract: null, value: 0, target: 1, ratio: 1 };
  const value = Math.max(0, run[c.metric] - run.contractBaseline);
  return { contract: c, value: Math.min(c.target, value), target: c.target, ratio: Math.min(1, value / c.target) };
}

function completeContracts(run, events) {
  while (run.contractIndex < run.contracts.length) {
    const c = run.contracts[run.contractIndex];
    const value = run[c.metric] - run.contractBaseline;
    if (value < c.target) break;
    run.score += c.reward;
    run.contractsDone++;
    run.contractIndex++;
    run.contractBaseline = run[c.metric];
    events.push({ type: 'contract', contract: c, points: c.reward });
  }
  if (run.contracts.length && run.contractIndex >= run.contracts.length && !run.allContractsSent) {
    run.allContractsSent = true;
    events.push({ type: 'allContracts' });
    if (run.mode === 'daily' || run.mode === 'weekly' || run.mode === 'seasonal' || run.mode === 'convoy' || run.mode === 'precision') { run.finished = true; run.reason = 'objective'; events.push({ type:'finish', reason:'objective' }); }
  }
}

// Flat score for uninterrupted time strictly above 200 km/h. Partial ticks
// reset below the threshold; this never affects combo, quest progress or RP.
export const HIGH_SPEED_THRESHOLD = 200 / 3.6;
export const HIGH_SPEED_BONUS = 25;
function awardHighSpeed(run, seconds, speed) {
  if (speed <= HIGH_SPEED_THRESHOLD) { run.speedBonusTime = 0; return; }
  run.speedBonusTime += seconds;
  const ticks = Math.floor((run.speedBonusTime + 1e-9) / .5);
  if (ticks) { run.score += ticks * HIGH_SPEED_BONUS; run.speedBonusTime = Math.max(0, run.speedBonusTime - ticks * .5); }
}

/** Advance time, distance and passive contract metrics. */
export function tickRun(run, dt, speed) {
  const events = [];
  if (run.finished) return events;
  dt = Math.max(0, Math.min(0.1, dt));
  if (run.mode === 'ranked') {
    const scenario = getScenario(run.rankedScenario);
    const available = Math.min(dt, Math.max(0, run.timeLeft ?? 0));
    const step = Math.max(0, speed) * available;
    const crossing = step > 0 && run.distance + step >= scenario.distance;
    const used = crossing ? available * (scenario.distance - run.distance) / step : available;
    run.elapsed += used; run.distance += Math.max(0, speed) * used;
    awardHighSpeed(run, used, speed);
    run.timeLeft = Math.max(0, (run.timeLeft ?? 0) - used);
    run.topSpeed = Math.max(run.topSpeed, speed * 3.6);
    if (crossing) {
      run.distance = scenario.distance;
      run.finished = true; run.reason = run[scenario.metric] >= scenario.target ? 'distance' : 'objective_failed';
      events.push({ type:'finish', reason:run.reason });
    } else if (run.timeLeft <= 1e-9) {
      run.timeLeft=0; run.finished=true; run.reason='time'; events.push({ type:'finish', reason:'time' });
    }
    return events;
  }
  if (run.mode === 'checkpoint') {
    // Simulate the deadline and each crossing in order, including a checkpoint
    // reached exactly as the clock expires. Never award after time has expired.
    let remaining = dt;
    while (remaining > 1e-10 && !run.finished) {
      const next = (Math.floor(run.distance / 500) + 1) * 500;
      const speedNow = Math.max(0, speed);
      const untilGate = speedNow > 0 ? Math.max(0, (next - run.distance) / speedNow) : Infinity;
      const used = Math.min(remaining, run.timeLeft, untilGate);
      run.elapsed += used; run.distance += speedNow * used;
      awardHighSpeed(run, used, speed);
      if (speedNow * 3.6 >= 140) run.highSpeedTime += used;
      run.timeLeft = Math.max(0, run.timeLeft - used); remaining -= used;
      if (untilGate <= used + 1e-10) {
        run.distance = next; run.timeLeft += 15; run.score += 250;
        events.push({type:'checkpoint', points:250});
      } else if (run.timeLeft <= 1e-10) {
        run.timeLeft = 0; run.finished = true; run.reason = 'time';
        events.push({type:'finish', reason:'time'});
      }
    }
    run.topSpeed = Math.max(run.topSpeed, speed * 3.6);
    return events;
  }
  if (run.timeLeft !== null) dt = Math.min(dt, Math.max(0, run.timeLeft));
  const distanceBefore = run.distance, elapsedBefore = run.elapsed;
  run.elapsed += dt;
  run.distance += Math.max(0, speed) * dt;
  let used = dt;
  if ((run.mode === 'trial' || run.mode === 'ghost') && distanceBefore < 3000 && run.distance >= 3000) {
    const fraction = (3000 - distanceBefore) / (run.distance - distanceBefore);
    used = dt * fraction;
    run.elapsed = elapsedBefore + used;
    run.distance = 3000; run.finished = true; run.reason = 'distance';
    events.push({ type: 'finish', reason: 'distance' });
  }
  run.topSpeed = Math.max(run.topSpeed, speed * 3.6);
  awardHighSpeed(run, used, speed);
  if (speed * 3.6 >= 140) {
    const before = run.highSpeedTime; run.highSpeedTime += used;
    if (run.mode === 'speed') run.score += 50 * (Math.floor(run.highSpeedTime + 1e-9) - Math.floor(before + 1e-9));
  }
  if (run.timeLeft !== null) {
    run.timeLeft = Math.max(0, run.timeLeft - dt);
    if (run.timeLeft <= 0) { run.finished = true; run.reason = 'time'; events.push({ type: 'finish', reason: 'time' }); }
  }

  completeContracts(run, events);
  return events;
}

/** A flat bonus for indicating the side of a completed same-direction pass. */
export const SIGNAL_BONUS = 50;

/** Register a clean pass. Returns points and any contract events. */
export function registerPass(run, kind, near, carBonus = 1, signaled = false) {
  const events = [];
  if (run.finished || kind !== 'same') return { points: 0, events };
  run.combo++;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  let points = 0;
  if (kind === 'same') {
    run.overtakes++;
    if (near) run.nearMisses++;
    points = passScore(run.combo, 'same', near, carBonus);
  }
  if (run.mode === 'near') points = Math.round(points * (near ? 1.75 : 0.5));
  if (run.mode === 'precision' && near) points *= 2;
  if (kind === 'same' && signaled) points += SIGNAL_BONUS;
  run.score += points;
  if (run.combo % 5 === 0) events.push({ type: 'combo', mult: multiplierFor(run.combo) });
  if (run.mode !== 'ranked') completeContracts(run, events);
  return { points, events };
}

export function finishRun(run, reason) {
  run.finished = true;
  run.reason = reason;
}

export function runSummary(run, carId) {
  return {
    mode: run.mode, car: carId, score: run.score, distance: run.distance, eventPeriod: run.eventPeriod,
    overtakes: run.overtakes, nearMisses: run.nearMisses, oncomingDodges: run.oncomingDodges,
    topSpeed: run.topSpeed, contractsDone: run.contractsDone, elapsed: run.elapsed,
    medal: medalFor(run.mode, run.score), reason: run.reason, date: Date.now(),
  };
}
