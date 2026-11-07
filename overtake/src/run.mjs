// Run structure: modes, sequential contracts, contracts and medals.
// Pure module so progression can be unit-tested without WebGL.
import { multiplierFor, passScore } from './rules.mjs';

export const RUN_MODES = {
  endless: {
    id: 'endless', label: 'Endless', duration: null,
    tagline: 'Classic survival. Chain passes until you wreck.',
    medals: { bronze: 2500, silver: 6000, gold: 12000 },
  },
  trial: { id: 'trial', label: 'Time Trial', duration: null, tagline: 'Reach 3 km as fast as possible.', medals: { bronze: 2000, silver: 5000, gold: 10000 } },
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
  { id: 'oncoming2', title: 'Against the flow', desc: 'Dodge 2 oncoming cars up close', metric: 'oncomingDodges', target: 2, reward: 600 },
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
  const choices = mode === 'weekly' ? [
    { id:'weekly-pass', title:'Traffic tamer', desc:'Overtake 10 cars', metric:'overtakes', target:10, reward:1500 },
    { id:'weekly-near', title:'On the edge', desc:'Make 6 near misses', metric:'nearMisses', target:6, reward:1500 },
    { id:'weekly-distance', title:'Long haul', desc:'Drive 4 km', metric:'distance', target:4000, reward:1500 },
  ] : [
    { id:'daily-pass', title:'Clean run', desc:'Overtake 4 cars', metric:'overtakes', target:4, reward:650 },
    { id:'daily-near', title:'Close calls', desc:'Make 3 near misses', metric:'nearMisses', target:3, reward:650 },
    { id:'daily-distance', title:'Open road', desc:'Drive 1.5 km', metric:'distance', target:1500, reward:650 },
  ];
  const period = mode === 'weekly' ? week : day;
  return { period, contract: { ...choices[((period % choices.length) + choices.length) % choices.length] } };
}

export function createRun(mode = 'endless', seed = Date.now(), now = Date.now()) {
  const m = RUN_MODES[mode] ? mode : 'endless';
  const def = RUN_MODES[m];
  return {
    mode: m, seed: seed >>> 0, elapsed: 0, timeLeft: def.duration,
    distance: 0, score: 0, combo: 0, bestCombo: 0,
    overtakes: 0, nearMisses: 0, oncomingDodges: 0,
    topSpeed: 0, highSpeedTime: 0,
    contracts: m === 'daily' || m === 'weekly' ? [eventFor(m, now).contract] : pickContracts(seed), contractIndex: 0, contractBaseline: 0, contractsDone: 0,
    eventPeriod: m === 'daily' || m === 'weekly' ? eventFor(m, now).period : null,
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
  if (run.contractIndex >= run.contracts.length && !run.allContractsSent) {
    run.allContractsSent = true;
    events.push({ type: 'allContracts' });
    if (run.mode === 'daily' || run.mode === 'weekly') { run.finished = true; run.reason = 'objective'; events.push({ type:'finish', reason:'objective' }); }
  }
}

/** Advance time, distance and passive contract metrics. */
export function tickRun(run, dt, speed) {
  const events = [];
  if (run.finished) return events;
  dt = Math.max(0, Math.min(0.1, dt));
  const distanceBefore = run.distance, elapsedBefore = run.elapsed;
  run.elapsed += dt;
  run.distance += Math.max(0, speed) * dt;
  if (run.mode === 'trial' && distanceBefore < 3000 && run.distance >= 3000) {
    const fraction = (3000 - distanceBefore) / (run.distance - distanceBefore);
    run.elapsed = elapsedBefore + dt * fraction;
    run.distance = 3000; run.finished = true; run.reason = 'distance';
    events.push({ type: 'finish', reason: 'distance' });
  }
  run.topSpeed = Math.max(run.topSpeed, speed * 3.6);
  if (speed * 3.6 >= 140) run.highSpeedTime += dt;
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
  if (run.finished) return { points: 0, events };
  run.combo++;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  let points = 0;
  if (kind === 'same') {
    run.overtakes++;
    if (near) run.nearMisses++;
    points = passScore(run.combo, 'same', near, carBonus) + (signaled ? SIGNAL_BONUS : 0);
  } else if (kind === 'oncoming' && near) {
    run.oncomingDodges++;
    run.nearMisses++;
    points = passScore(run.combo, 'oncoming', true, carBonus);
  }
  if (run.mode === 'near') points = Math.round(points * (near ? 1.75 : 0.5));
  run.score += points;
  if (run.combo % 5 === 0) events.push({ type: 'combo', mult: multiplierFor(run.combo) });
  completeContracts(run, events);
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
