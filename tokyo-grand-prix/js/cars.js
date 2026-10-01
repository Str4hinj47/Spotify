import * as THREE from 'three';
import * as track from './track.js';

// ---------------------------------------------------------------------------
// Character cars (eyes on the windshield!), arcade physics for the player,
// spline-following AI opponents with corner-speed profiles + rubber-banding.
// ---------------------------------------------------------------------------

export const MAXS = 58;        // player top speed (u/s) ≈ 209 km/h display
const ACCEL = 26, BRAKE = 44, DRAG = 0.38, TURN = 2.5, REV = 13;

export const TEAM_SPECS = [
  { name: 'F. BERNOULLI', color: 0xf2f4f5, accent: 0x00a24e, num: '1',  skill: 1.045, lane: -3.2 },
  { name: 'C. VELOSO',    color: 0x0d47a1, accent: 0xffd600, num: '8',  skill: 1.020, lane: 3.2 },
  { name: 'S. TODOROKI',  color: 0xeceff1, accent: 0xd32f2f, num: '2',  skill: 1.000, lane: -1.6 },
  { name: 'M. SCHNELL',   color: 0x8fa1ad, accent: 0x222a38, num: '4',  skill: 0.982, lane: 1.6 },
  { name: 'N. GEARSLEY',  color: 0x1f7a33, accent: 0xf5f5f5, num: '7',  skill: 0.960, lane: 0.0 },
];
export const PLAYER_SPEC = { name: 'McQUEEN', color: 0xd02010, accent: 0x2b2b2b, num: '95', skill: 1, lane: 0 };

function numTexture(num, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.fillStyle = '#14161c'; g.font = '900 italic 74px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(num, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCarMesh(spec, scene) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, metalness: 0.55,
    emissive: spec.color, emissiveIntensity: 0.22 });
  const accent = new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.4, metalness: 0.5,
    emissive: spec.accent, emissiveIntensity: 0.14 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0d141d, roughness: 0.15, metalness: 0.75 });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.6), paint);
  lower.position.y = 0.58; body.add(lower);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 3.1), paint);
  mid.position.set(0, 1.05, -0.15); body.add(mid);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.15), accent);
  nose.position.set(0, 0.5, 2.25); body.add(nose);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.17, 1.6), paint);
  roof.position.set(0, 1.45, -0.35); body.add(roof);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 1.4), glass);
  cabin.position.set(0, 1.22, -0.35); body.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.9), glass);
  windshield.position.set(0, 1.2, 0.62);
  windshield.rotation.x = -0.32; body.add(windshield);

  // eyes on the windshield — the Cars signature
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.3 });
  const pupMat = new THREE.MeshBasicMaterial({ color: 0x0e1013 });
  const pupils = [];
  for (const dx of [-0.37, 0.37]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), eyeMat);
    e.position.set(dx, 1.24, 1.02); body.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), pupMat);
    p.position.set(dx, 1.24, 1.2); body.add(p); pupils.push(p);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.45), paint);
    lid.position.set(dx, 1.44, 1.0); lid.rotation.x = -0.32; body.add(lid);
  }

  // spoiler
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.09, 0.5), accent);
  wing.position.set(0, 1.32, -2.2); body.add(wing);
  for (const dx of [-0.6, 0.6]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.3), dark);
    strut.position.set(dx, 1.12, -2.2); body.add(strut);
  }

  // number roundels
  const nt = numTexture(spec.num, '#' + new THREE.Color(spec.color).getHexString());
  const rMat = new THREE.MeshBasicMaterial({ map: nt, transparent: true });
  for (const dx of [-1.04, 1.04]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), rMat);
    r.position.set(dx, 0.72, 0.4);
    r.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    body.add(r);
  }
  const hoodR = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), rMat);
  hoodR.rotation.x = -Math.PI / 2; hoodR.position.set(0, 1.31, 0.7);
  body.add(hoodR);

  // lights
  const headMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  headMat.color.setRGB(1.8, 1.75, 1.4);
  const tailMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  tailMat.color.setRGB(1.6, 0.12, 0.1);
  for (const dx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), headMat);
    h.position.set(dx, 0.62, 2.82); body.add(h);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.06), tailMat);
  tailBar.position.set(0, 0.85, -2.31); body.add(tailBar);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.38, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [dx, dz, front] of [[-0.98, 1.55, true], [0.98, 1.55, true], [-0.98, -1.55, false], [0.98, -1.55, false]]) {
    const holder = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo, dark);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    holder.add(w, hub);
    holder.position.set(dx, 0.42, dz);
    body.add(holder);
    wheels.push({ holder, front });
  }

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  group.add(shadow);

  scene.add(group);
  return { group, body, wheels, pupils, tailMat };
}

// ---------------------------------------------------------------------------
export function createRacers(scene) {
  const racers = [];
  const mk = (spec, isPlayer) => {
    const mesh = createCarMesh(spec, scene);
    return {
      ...spec, isPlayer, mesh,
      group: mesh.group, pos: mesh.group.position,
      heading: 0, vf: 0, vl: 0, steerCur: 0, pitch: 0,
      lap: 1, s: 0, hint: -1, cp1: false, cp2: false,
      lapStart: 0, lapTimes: [], best: Infinity,
      finished: false, finishTime: 0,
      speed: 0, lane: spec.lane, laneTarget: spec.lane, phase: Math.random() * 9,
      smp: track.makeSample(),
    };
  };
  // grid order: Francesco, Carla, Shu, PLAYER, Max, Nigel
  racers.push(mk(TEAM_SPECS[0], false));
  racers.push(mk(TEAM_SPECS[1], false));
  racers.push(mk(TEAM_SPECS[2], false));
  racers.push(mk(PLAYER_SPEC, true));
  racers.push(mk(TEAM_SPECS[3], false));
  racers.push(mk(TEAM_SPECS[4], false));
  return racers;
}

export function gridReset(racers) {
  racers.forEach((r, i) => {
    const f = 0.004 + Math.floor(i / 2) * 0.0058;
    const lat = (i % 2 === 0 ? -1 : 1) * 2.7;
    const smp = track.sampleAt(f, r.smp);
    r.pos.copy(smp.p).addScaledVector(smp.r, lat);
    r.pos.y = smp.p.y;
    r.heading = Math.atan2(smp.t.x, smp.t.z);
    r.group.rotation.set(0, r.heading, 0);
    r.vf = 0; r.vl = 0; r.steerCur = 0;
    r.lap = 1; r.s = f; r.hint = Math.floor(f * track.N); r.cp1 = false; r.cp2 = false;
    r.lapStart = 0; r.lapTimes = []; r.best = Infinity;
    r.finished = false; r.finishTime = 0;
    r.speed = 0;
    r.lane = r.laneTarget = specLane(r);
  });
}

function specLane(r) { return r.isPlayer ? 0 : TEAM_SPECS.find(t => t.name === r.name)?.lane ?? 0; }

// lap / progress bookkeeping (anti-shortcut via two checkpoints) --------------
export function progressUpdate(r, frac, raceTime) {
  const ps = r.s;
  let event = null;
  if (ps > 0.75 && frac < 0.25) {           // forward wrap
    if (r.cp1 && r.cp2) {
      const t = raceTime - r.lapStart;
      r.lapTimes.push(t);
      if (t < r.best) r.best = t;
      r.lapStart = raceTime;
      r.lap++;
      event = 'lap';
    }
    r.cp1 = r.cp2 = false;
  } else if (ps < 0.25 && frac > 0.75) {    // backward wrap
    r.lap--; r.cp1 = true; r.cp2 = true;
    event = 'backlap';
  }
  if (frac > 0.28 && frac < 0.42) r.cp1 = true;
  if (frac > 0.60 && frac < 0.74) r.cp2 = true;
  r.s = frac;
  if (r.lap > track.LAPS && !r.finished) {
    r.finished = true;
    r.finishTime = raceTime;
    event = 'finish';
  }
  return event;
}

export function totalProgress(r) { return (r.lap - 1) + r.s; }

// ---------------------------------------------------------------------------
// PLAYER
// ---------------------------------------------------------------------------
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();

export function updatePlayer(p, input, dt, fx, audio, state) {
  // steering smoothing
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  p.steerCur += (steerIn - p.steerCur) * Math.min(1, dt * 8);

  _f.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  _r.set(-_f.z, 0, _f.x);

  let vf = p.vf, vl = p.vl;

  // longitudinal
  if (input.gas) vf += ACCEL * dt * (vf < 0 ? 2 : 1);
  if (input.brake) {
    if (vf > 0.6) vf -= BRAKE * dt;
    else vf = Math.max(vf - 14 * dt, -REV);
  }
  vf -= vf * DRAG * dt;
  vf = THREE.MathUtils.clamp(vf, -REV, MAXS);
  if (input.drift && Math.abs(vf) > 8) vf *= 1 - 0.10 * dt;

  // lateral grip
  const grip = input.drift ? 2.1 : 9.0;
  vl *= Math.exp(-grip * dt);

  // yaw
  const speedFac = THREE.MathUtils.clamp(vf / 9, -1, 1) / (1 + Math.abs(vf) * 0.011);
  const turn = TURN * (input.drift ? 1.28 : 1);
  p.heading += p.steerCur * turn * speedFac * dt;

  // integrate
  _f.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  _r.set(-_f.z, 0, _f.x);
  _v.copy(_f).multiplyScalar(vf).addScaledVector(_r, vl);
  p.pos.addScaledVector(_v, dt);

  // track containment
  const near = track.nearest(p.pos.x, p.pos.z, p.hint);
  p.hint = near.i;
  const frac = near.frac;
  const smp = track.sampleAt(frac, p.smp);
  const latDx = p.pos.x - smp.p.x, latDz = p.pos.z - smp.p.z;
  const lat = latDx * smp.r.x + latDz * smp.r.z;
  if (Math.abs(lat) > track.CLAMP) {
    const over = Math.abs(lat) - track.CLAMP;
    p.pos.addScaledVector(smp.r, -Math.sign(lat) * over);
    if (Math.sign(vl) === Math.sign(lat) && Math.abs(vl) > 2) {
      const impact = Math.abs(vl);
      vl = -vl * 0.3;
      vf *= 0.985;
      if (impact > 5) {
        fx.sparksAt(p.pos.x, p.pos.y + 0.7, p.pos.z);
        state.shake = Math.min(0.5, state.shake + impact * 0.015);
        audio.thunk(impact);
      }
    } else {
      vf *= 0.995; // scraping along the rail
    }
  }
  p.vf = vf; p.vl = vl;

  // height + slope
  const yHere = smp.p.y;
  const ahead = 0.004;
  const yA = track.pointOn((frac + ahead) % 1, 0, new THREE.Vector3()).y;
  const yB = track.pointOn((frac - ahead + 1) % 1, 0, new THREE.Vector3()).y;
  const slope = (yA - yB) / (2 * ahead * track.L);
  p.pos.y = yHere;
  p.pitch = -Math.atan(slope) * 0.85;

  // visuals
  p.group.rotation.y = p.heading;
  p.group.rotation.x = p.pitch;
  const driftLean = THREE.MathUtils.clamp(-p.vl * 0.014, -0.2, 0.2);
  p.mesh.body.rotation.z = THREE.MathUtils.clamp(-p.steerCur * 0.06 * Math.abs(vf) / MAXS + driftLean, -0.22, 0.22);
  p.mesh.body.position.y = Math.abs(vf) > 2 ? Math.sin(state.time * 23) * 0.012 * (Math.abs(vf) / MAXS) : 0;

  for (const w of p.mesh.wheels) {
    w.holder.children[0].rotation.x += vf / 0.42 * dt;
    w.holder.children[1].rotation.x += vf / 0.42 * dt;
    if (w.front) w.holder.rotation.y = p.steerCur * 0.42;
  }
  for (const pup of p.mesh.pupils) pup.position.x += ((pup.userData.bx ??= pup.position.x) + p.steerCur * 0.09 - pup.position.x) * 0.2;

  // brake lights
  p.mesh.tailMat.color.setRGB(input.brake ? 3.2 : 1.6, input.brake ? 0.1 : 0.12, 0.1);

  // drift smoke
  if (input.drift && Math.abs(vf) > 10 && Math.random() < 0.75) {
    fx.smokeAt(p.pos.x - _f.x * 1.6, p.pos.y + 0.3, p.pos.z - _f.z * 1.6);
  }

  const ev = progressUpdate(p, frac, state.raceTime);
  return ev;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export function updateAI(r, dt, state, rubber) {
  if (state.phase !== 'racing' && state.phase !== 'finished') return;
  const ahead = (r.s + (7 + r.speed * 0.45) / track.L) % 1;
  let tgt = track.capAt(ahead) * r.skill * rubber;
  if (r.finished) tgt = Math.min(tgt, 18);       // cool-down cruise after flag
  r.speed += THREE.MathUtils.clamp(tgt - r.speed, -22 * dt, 11 * dt);
  const frac = (r.s + r.speed * dt / track.L) % 1;

  // lane weave
  const weave = Math.sin(state.time * 0.35 + r.phase) * 1.1;
  r.laneTarget = THREE.MathUtils.clamp(r.lane + weave, -4.4, 4.4);
  r.lane += (r.laneTarget - r.lane) * Math.min(1, dt * 0.9);

  const smp = track.sampleAt(frac, r.smp);
  r.pos.copy(smp.p).addScaledVector(smp.r, r.lane);
  r.pos.y = smp.p.y;

  const yaw = Math.atan2(smp.t.x, smp.t.z);
  let dy = yaw - r.heading;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  r.heading += dy * Math.min(1, dt * 6);
  r.group.rotation.y = r.heading;
  r.vf = r.speed;

  const slopeA = track.pointOn((frac + 0.004) % 1, r.lane, _v).y;
  r.group.rotation.x = -Math.atan((slopeA - smp.p.y) / (0.004 * track.L)) * 0.85;

  for (const w of r.mesh.wheels) {
    w.holder.children[0].rotation.x += r.speed / 0.42 * dt;
    w.holder.children[1].rotation.x += r.speed / 0.42 * dt;
  }
  const steerV = THREE.MathUtils.clamp(-track.curvAt(ahead) * 42 * Math.sign(r.lane + 0.01), -0.4, 0.4);
  for (const w of r.mesh.wheels) if (w.front) w.holder.rotation.y = steerV;

  progressUpdate(r, frac, state.raceTime);
}

// soft player<->AI collision ---------------------------------------------------
export function carCollisions(racers, state) {
  const p = racers.find(r => r.isPlayer);
  for (const r of racers) {
    if (r.isPlayer) continue;
    const dx = r.pos.x - p.pos.x, dz = r.pos.z - p.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 3.1 * 3.1 && d2 > 0.0001) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      const push = (3.1 - d) * 0.55;
      p.pos.x -= nx * push; p.pos.z -= nz * push;
      r.lane = THREE.MathUtils.clamp(r.lane + (nx * r.smp.r.x + nz * r.smp.r.z) * -0.8, -5, 5);
      p.vf *= 0.995;
      state.shake = Math.min(0.4, state.shake + 0.06);
    }
  }
}

export function standings(racers) {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return totalProgress(b) - totalProgress(a);
  });
}
