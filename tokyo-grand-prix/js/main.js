import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/postprocessing/OutputPass.js';
import * as track from './track.js';
import { buildEnvironment } from './environment.js';
import * as cars from './cars.js';
import { HUD, fmtTime } from './hud.js';
import { RaceAudio } from './audio.js';

// ---------------------------------------------------------------------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.3, 1400);
camera.position.set(0, 30, -290);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// world ------------------------------------------------------------------------
track.buildScene(scene);
const env = buildEnvironment(scene);
const racers = cars.createRacers(scene);
const player = racers.find(r => r.isPlayer);
cars.gridReset(racers);

const hud = new HUD();
const audio = new RaceAudio();

const state = {
  phase: 'title',       // title | flyover | countdown | racing | finished
  paused: false,
  time: 0,
  raceTime: 0,
  flyT: 0,
  cdT: 0,
  cdShown: -1,
  shake: 0,
  camMode: 0,
  wrongT: 0,
  finishT: 0,
  resultsShown: false,
  newRecord: false,
  standingsCache: racers.slice(),
  standT: 0,
  screensT: 0,
  resT: 0,
};

// stored track record -----------------------------------------------------------
let storedBest = parseFloat(localStorage.getItem('tgp_best') || '0') || null;

// input --------------------------------------------------------------------------
const input = { gas: false, brake: false, left: false, right: false, drift: false };
const keyMap = {
  KeyW: 'gas', ArrowUp: 'gas',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'drift',
};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === 'Enter') {
    if (state.phase === 'title') startRace();
    else if (state.phase === 'flyover') beginCountdown();
    else if (state.phase === 'finished' && state.resultsShown) restart();
  }
  if (e.code === 'KeyC' && (state.phase === 'racing' || state.phase === 'finished')) {
    state.camMode = (state.camMode + 1) % 3;
  }
  if (e.code === 'KeyM') {
    const m = audio.toggleMute();
    hud.message(m ? '🔇 SOUND OFF' : '🔊 SOUND ON', 800);
  }
  if (e.code === 'KeyR' && state.phase === 'racing') resetToTrack();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
addEventListener('keyup', e => { if (keyMap[e.code]) input[keyMap[e.code]] = false; });

// touch controls
if (matchMedia('(pointer: coarse)').matches) hud.showTouch(true);
const bindTouch = (id, key) => {
  const b = document.getElementById(id);
  if (!b) return;
  const on = e => { e.preventDefault(); input[key] = true; };
  const off = e => { e.preventDefault(); input[key] = false; };
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('touchend', off, { passive: false });
  b.addEventListener('touchcancel', off, { passive: false });
  b.addEventListener('mousedown', on);
  b.addEventListener('mouseup', off);
  b.addEventListener('mouseleave', off);
};
bindTouch('tGas', 'gas'); bindTouch('tBrake', 'brake');
bindTouch('tLeft', 'left'); bindTouch('tRight', 'right'); bindTouch('tDrift', 'drift');

document.getElementById('startBtn').addEventListener('click', () => startRace());
document.getElementById('againBtn').addEventListener('click', () => restart());
document.getElementById('resumeBtn').addEventListener('click', () => togglePause());
document.getElementById('restartBtn').addEventListener('click', () => restart());
// keep clicked buttons from stealing SPACE/ENTER later
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'racing' && !state.paused) togglePause();
});

function startRace() {
  if (state.phase !== 'title') return;
  audio.init();
  hud.showTitle(false);
  hud.showHud(true);
  document.activeElement?.blur?.();
  state.phase = 'flyover';
  state.flyT = 0;
}
function beginCountdown() {
  state.phase = 'countdown';
  state.cdT = 0;
  state.cdShown = -1;
}
function restart() {
  hud.hideResults();
  hud.showPause(false);
  state.paused = false;
  cars.gridReset(racers);
  state.raceTime = 0;
  state.shake = 0;
  state.wrongT = 0;
  state.resultsShown = false;
  state.newRecord = false;
  state.finishT = 0;
  state.resT = 0;
  state.camMode = 0;
  hud.clearMessage();
  audio.stopDrums();
  beginCountdown();
}
function togglePause() {
  if (state.phase !== 'racing' && state.phase !== 'finished') return;
  state.paused = !state.paused;
  hud.showPause(state.paused);
  if (state.paused) { audio.engineOff(); audio.stopDrums(); }
  else if (state.phase === 'racing') audio.startDrums();
}
function resetToTrack() {
  const near = track.nearest(player.pos.x, player.pos.z, -1);
  const smp = track.sampleAt(near.frac, player.smp);
  player.pos.copy(smp.p);
  player.heading = Math.atan2(smp.t.x, smp.t.z);
  player.vf = 0; player.vl = 0;
  player.hint = near.i;
  audio.thunk(4);
}

// camera helpers -----------------------------------------------------------------
const camPos = new THREE.Vector3().copy(camera.position);
const camLook = new THREE.Vector3();
const _cf = new THREE.Vector3();
let fovCur = 68;

function updateCamera(dt) {
  const p = player;
  _cf.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  let desired, look, fovT = 68;

  if (state.phase === 'title') {
    const t = state.time * 0.06;
    desired = new THREE.Vector3(Math.cos(t) * 150, 42 + Math.sin(t * 0.7) * 12, Math.sin(t) * 150 - 30);
    look = new THREE.Vector3(-20, 30, -50);
    camPos.lerp(desired, 1 - Math.exp(-1.2 * dt));
    camLook.lerp(look, 1 - Math.exp(-1.2 * dt));
  } else if (state.phase === 'flyover') {
    const f = 0.865 + state.flyT * 0.135;
    const flyPos = track.pointOn(f, 0, new THREE.Vector3());
    const flyAhead = track.pointOn((f + 0.03) % 1, 0, new THREE.Vector3());
    desired = new THREE.Vector3(flyPos.x, flyPos.y + 16 - state.flyT * 9, flyPos.z);
    look = new THREE.Vector3(flyAhead.x, flyAhead.y + 1, flyAhead.z);
    camPos.lerp(desired, 1 - Math.exp(-3.5 * dt));
    camLook.lerp(look, 1 - Math.exp(-3.5 * dt));
  } else {
    const sp = Math.max(player.vf, 0);
    const ratio = sp / cars.MAXS;
    if (state.camMode === 0) {          // chase
      desired = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, -9.8).add(new THREE.Vector3(0, 4.1, 0));
      look = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, 6.5).add(new THREE.Vector3(0, 1.5, 0));
      fovT = 66 + ratio * 16;
    } else if (state.camMode === 1) {   // far
      desired = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, -15).add(new THREE.Vector3(0, 8, 0));
      look = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, 8).add(new THREE.Vector3(0, 2, 0));
      fovT = 60 + ratio * 10;
    } else {                            // hood
      desired = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, 0.6).add(new THREE.Vector3(0, 1.55, 0));
      look = new THREE.Vector3().copy(p.pos).addScaledVector(_cf, 30).add(new THREE.Vector3(0, 1.2, 0));
      fovT = 72 + ratio * 14;
    }
    const k = state.camMode === 2 ? 1 : 1 - Math.exp(-7.5 * dt);
    camPos.lerp(desired, k);
    camLook.lerp(look, 1 - Math.exp(-10 * dt));
  }

  camera.position.copy(camPos);
  if (state.shake > 0.001 && state.phase !== 'title') {
    camera.position.x += (Math.random() - 0.5) * state.shake;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.7;
    camera.position.z += (Math.random() - 0.5) * state.shake;
    state.shake *= Math.exp(-6 * dt);
  }
  camera.lookAt(camLook);
  fovCur += (fovT - fovCur) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - fovCur) > 0.05) {
    camera.fov = fovCur;
    camera.updateProjectionMatrix();
  }
}

// race flow helpers ---------------------------------------------------------------
function onPlayerEvent(ev) {
  if (ev === 'lap') {
    if (player.lap === track.LAPS) {
      hud.message('FINAL LAP!', 1600, 'final');
      audio.finalLap();
    } else if (player.lap <= track.LAPS) {
      hud.message(`LAP ${player.lap}/${track.LAPS}`, 1400);
      audio.lapDing();
    }
    if (!player.finished && player.best < (storedBest ?? Infinity)) {
      storedBest = player.best;
      localStorage.setItem('tgp_best', String(storedBest));
      state.newRecord = true;
    }
  }
  if (ev === 'finish') {
    state.phase = 'finished';
    state.finishT = 0;
    hud.message('FINISH!', 2200, 'go');
    hud.wrongWay(false);
    audio.stopDrums();
    audio.fanfare();
    if (player.best < (storedBest ?? Infinity)) {
      storedBest = player.best;
      localStorage.setItem('tgp_best', String(storedBest));
      state.newRecord = true;
    }
  }
}

const rubberFor = ai => {
  if (state.phase === 'finished') return 1;
  const diff = cars.totalProgress(player) - cars.totalProgress(ai);
  return THREE.MathUtils.clamp(1 + diff * 0.5, 0.88, 1.12);
};

// main loop --------------------------------------------------------------------------
const clock = new THREE.Clock();
const _pf = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.paused) {
    composer.render();
    return;
  }
  state.time += dt;
  hud.tick(dt);
  env.update(dt, state.time);

  if (state.phase === 'flyover') {
    state.flyT += dt / 8;
    if (state.flyT >= 1) beginCountdown();
  }

  if (state.phase === 'countdown') {
    state.cdT += dt;
    const step = Math.floor(state.cdT / 0.85);
    if (step !== state.cdShown && step <= 3) {
      state.cdShown = step;
      if (step < 3) {
        hud.message(String(3 - step), 700);
        audio.countBeep();
      } else {
        hud.message('GO!', 900, 'go');
        audio.goBeep();
        audio.startDrums();
        state.phase = 'racing';
        state.raceTime = 0;
      }
    }
    hud.minimap(racers);
  }

  if (state.phase === 'racing' || state.phase === 'finished') {
    state.raceTime += dt;

    if (state.phase === 'racing') {
      const ev = cars.updatePlayer(player, input, dt, env.fx, audio, state);
      if (ev) onPlayerEvent(ev);

      // wrong-way detection
      _pf.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      const facing = _pf.dot(player.smp.t);
      if (facing < -0.35 && player.vf > 6) state.wrongT += dt;
      else state.wrongT = 0;
      hud.wrongWay(state.wrongT > 0.9);
    } else {
      // cool-down after the flag: ease the car to a stop
      const doneInput = { gas: false, brake: player.vf > 2, left: false, right: false, drift: false };
      cars.updatePlayer(player, doneInput, dt, env.fx, audio, state);
      state.finishT += dt;
      if (!state.resultsShown && state.finishT > 1.6) {
        state.resultsShown = true;
        const st = cars.standings(racers);
        const pPos = st.indexOf(player) + 1;
        hud.results(st, pPos, player.best, state.newRecord);
      }
      if (state.resultsShown) {
        state.resT += dt;
        if (state.resT > 0.5) {
          state.resT = 0;
          const st = cars.standings(racers);
          const pPos = st.indexOf(player) + 1;
          hud.results(st, pPos, player.best, state.newRecord);
        }
      }
    }

    for (const r of racers) {
      if (!r.isPlayer) cars.updateAI(r, dt, state, rubberFor(r));
    }
    cars.carCollisions(racers, state);

    // standings cache (throttled)
    state.standT -= dt;
    if (state.standT <= 0) {
      state.standT = 0.2;
      state.standingsCache = cars.standings(racers);
      hud.standingsList(state.standingsCache);
    }

    // jumbotrons (throttled)
    state.screensT -= dt;
    if (state.screensT <= 0) {
      state.screensT = 0.35;
      const st = state.standingsCache;
      const leader = st[0];
      const lines = [`LEADER: ${leader.isPlayer ? 'McQUEEN' : leader.name}`];
      for (let i = 1; i < 4; i++) lines.push(`P${i + 1} ${st[i].isPlayer ? 'McQUEEN' : st[i].name}`);
      env.updateScreens(lines, state.time);
    }

    // HUD
    hud.speed(player.vf * 3.6);
    hud.lap(player.lap);
    hud.times(state.raceTime - player.lapStart, player.best);
    hud.position(state.standingsCache.indexOf(player) + 1);
    hud.minimap(racers);
  }

  audio.engine(
    THREE.MathUtils.clamp(Math.abs(player.vf) / cars.MAXS, 0, 1),
    input.gas && state.phase === 'racing' ? 1 : 0,
    input.drift && state.phase === 'racing',
  );

  updateCamera(dt);
  composer.render();
}

// boot: grid is set; show title over a slow city orbit
hud.showTitle(true);
frame();

// tiny debug/testing hook (used by automated smoke tests)
window.__tgp = { state, racers, player, track, cars, input };
