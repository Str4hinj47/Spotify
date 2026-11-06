import '@fontsource-variable/inter';
import { createIcons, Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor } from 'lucide';
import { ModelLibrary } from './models';
import { OvertakeGame, CAMERA_ORDER, type Mode, type HudState, type RunStats, type CameraPreset } from './game';
import { RUN_MODES, type RunMode } from './run.mjs';
import { bestFor } from './records.mjs';
import { CAR_XP, earnedCar, nextUnlock } from './progression.mjs';
import { CARS, getCar, PAINT_COLORS, type CarId } from './catalog';
import { GameAudio } from './audio';
import { hexToNumber, sanitizePaints } from './paint.mjs';
import { BODY_FITS } from './body-kits';
import { LIVERIES } from './livery';
import { BODY_PARTS, DEFAULT_CUSTOMIZATION, sanitizeCustomization, sanitizeCustomizations, type Customization } from './customization.mjs';

createIcons({ icons: { Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor } });

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const audio = new GameAudio();
(window as any).__audio = audio; // test/debug hook
let game: OvertakeGame;
let library: ModelLibrary;
let selected: CarId = 'golf';
let helpPaused = false;
let paints: Record<string, string> = {};
let customizations: Record<string, Customization> = {};

function loadPaints() {
  try {
    paints = sanitizePaints(JSON.parse(localStorage.getItem('overtake-paints') || '{}'), CARS.map((c) => c.id));
  } catch { paints = {}; }
}

function loadCustomizations() {
  try { customizations = sanitizeCustomizations(JSON.parse(localStorage.getItem('overtake-customization-v1') || '{}'), CARS.map(c => c.id)); }
  catch { customizations = {}; }
}
function currentCustomization() { return sanitizeCustomization(customizations[selected] ?? DEFAULT_CUSTOMIZATION); }
// Keep native selects as the single source of truth while presenting their
// choices as visible buttons instead of stacked popup menus.
function syncWorkshopChoices() {
  document.querySelectorAll<HTMLSelectElement>('#custom-panel select').forEach(select => {
    let group = select.parentElement?.nextElementSibling as HTMLElement | null;
    if (!group?.classList.contains('workshop-choices')) {
      group = document.createElement('div');
      group.className = 'workshop-choices';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', select.getAttribute('aria-label') || 'Options');
      select.parentElement!.after(group);
      select.hidden = true;
    }
    const options = Array.from(select.options);
    const signature = options.map(option => `${option.value}:${option.text}`).join('|');
    if (group.dataset.signature !== signature) {
      group.dataset.signature = signature;
      group.replaceChildren(...options.map(option => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = option.text; button.dataset.value = option.value;
        button.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return button;
      }));
    }
    group.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.disabled = select.disabled;
      button.setAttribute('aria-pressed', String(button.dataset.value === select.value));
    });
  });
}
function syncCustomizationUI() {
  const config = currentCustomization();
  $('custom-car-name').textContent = `${getCar(selected).maker} ${getCar(selected).name}`;
  for (const part of BODY_PARTS) {
    const select = $(`custom-${part}`) as HTMLSelectElement;
    const labels = BODY_FITS[selected].labels[part];
    const options = [['stock','Factory'], ['street',labels[0]], ['touring','Touring'], ['sport','Sport'], ['track',labels[1]]];
    if (part === 'exhaust') options.push(['flame','Afterfire flames']);
    select.replaceChildren(...options.map(([value,label]) => {
      const option=document.createElement('option'); option.value=value; option.textContent=label; return option;
    }));
    select.value = config[part];
    const finish = $(`custom-${part}-finish`) as HTMLSelectElement;
    finish.value = config[`${part}Finish`]; finish.disabled = config[part] === 'stock';
  }
  ($('custom-primary-color') as HTMLInputElement).value=paints[selected] ?? getCar(selected).color;
  ($('custom-paint-scheme') as HTMLSelectElement).value=config.paintScheme;
  ($('custom-secondary-color') as HTMLInputElement).value=config.secondaryColor;
  ($('custom-secondary-color') as HTMLInputElement).disabled=config.paintScheme==='single' || config.secondaryFinish==='carbon';
  ($('custom-secondary-finish') as HTMLSelectElement).value=config.secondaryFinish;
  ($('custom-secondary-finish') as HTMLSelectElement).disabled=config.paintScheme==='single';
  const livery = $('custom-livery') as HTMLSelectElement;
  livery.replaceChildren(...[['none','None'],['stripe',LIVERIES[selected].labels[0]],['race',LIVERIES[selected].labels[1]]].map(([value,label]) => {
    const option=document.createElement('option');option.value=value;option.textContent=label;return option;
  }));
  livery.value=config.livery;
  const liveryColor=$('custom-livery-color') as HTMLInputElement;
  liveryColor.value=config.liveryColor;liveryColor.disabled=config.livery==='none';
  ($('custom-glow-enabled') as HTMLInputElement).checked = config.underglow;
  const color = $('custom-glow-color') as HTMLInputElement;
  color.value = config.glowColor; color.disabled = !config.underglow;
  syncWorkshopChoices();
}
function applyCustomization(value: Customization) {
  const config = sanitizeCustomization(value);
  customizations[selected] = config;
  try { localStorage.setItem('overtake-customization-v1', JSON.stringify(customizations)); } catch { /* storage may be unavailable */ }
  library.setCustomization(selected, config);
  game.setSelectedCar(selected);
  syncCustomizationUI();
}
function showCustomization(show: boolean) {
  $('garage').classList.toggle('customizing', show);
  game.setGarageWorkshop(show);
  $('car-detail').classList.toggle('hidden', show);
  $('custom-panel').classList.toggle('hidden', !show);
  if (show) syncCustomizationUI();
}

function savePaints() {
  try { localStorage.setItem('overtake-paints', JSON.stringify(paints)); } catch { /* ignore */ }
}

function syncPaintUI(id: CarId) {
  const current = paints[id] ?? getCar(id).color;
  const input = $('paint-custom') as HTMLInputElement;
  input.value = current;
  document.querySelectorAll<HTMLButtonElement>('.paint-swatch').forEach((b) => {
    const active = b.dataset.hex === current;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

async function refreshThumbnail(id: CarId) {
  const img = document.querySelector<HTMLImageElement>(`.car-card[data-car="${id}"] img`);
  if (!img) return;
  img.src = await library.thumbnail(id);
}

function applyPaint(hex: string | null) {
  if (hex === null) {
    delete paints[selected];
    library.setPaint(selected, null);
  } else {
    paints[selected] = hex;
    library.setPaint(selected, hexToNumber(hex));
  }
  savePaints();
  if (game) game.setSelectedCar(selected);
  syncPaintUI(selected);
  void refreshThumbnail(selected);
  audio.click();
}

function renderDots(el: HTMLElement, n: number) {
  el.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('i');
    if (i < n) dot.className = 'on';
    el.appendChild(dot);
  }
}

function updateDetail(id: CarId) {
  const c = getCar(id);
  $('d-maker').textContent = c.maker;
  $('d-name').textContent = c.name;
  $('d-class').textContent = c.klass;
  $('d-tagline').textContent = c.tagline;
  renderDots($('stat-speed'), c.stats.speed);
  renderDots($('stat-handling'), c.stats.handling);
  renderDots($('stat-bonus'), c.stats.bonus);
  document.querySelectorAll<HTMLButtonElement>('.car-card').forEach((b) => {
    const active = b.dataset.car === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  syncPaintUI(id);
  syncProgressionUI();
}

function syncProgressionUI() {
  if (!game) return;
  const progress = game.getProgression();
  const next = nextUnlock(progress);
  $('progress-xp').textContent = `${fmt(progress.xp)} XP`;
  $('progress-next').textContent = next ? `Next: ${getCar(next[0]).name} at ${fmt(next[1])} XP` : 'All cars earned';
  const dev = $('dev-toggle') as HTMLButtonElement;
  dev.textContent = `Dev options: ${progress.dev ? 'ON' : 'OFF'}`;
  dev.setAttribute('aria-pressed', String(progress.dev));
  const earned = earnedCar(progress, selected);
  const available = game.canDrive(selected);
  $('car-requirement').textContent = earned ? 'Unlocked' : progress.dev ? `Dev access · unlock at ${fmt(CAR_XP[selected])} XP` : `Locked · unlock at ${fmt(CAR_XP[selected])} XP`;
  ($('btn-start') as HTMLButtonElement).disabled = !available;
  $('start-label').textContent = available ? 'Start engine' : 'Car locked';
  document.querySelectorAll<HTMLButtonElement>('.car-card').forEach(card => {
    const id = card.dataset.car as CarId;
    const owned = earnedCar(progress, id);
    const status = card.querySelector<HTMLElement>('.cc-unlock')!;
    status.textContent = owned ? 'Unlocked' : progress.dev ? `Dev access · ${fmt(CAR_XP[id])} XP` : `${fmt(CAR_XP[id])} XP`;
    card.classList.toggle('locked', !owned);
    card.setAttribute('aria-label', `${getCar(id).maker} ${getCar(id).name}, ${status.textContent}`);
  });
}

function selectCar(id: CarId) {
  selected = id;
  game.setSelectedCar(id);
  updateDetail(id);
  audio.setCar(id);
  if (!$('custom-panel').classList.contains('hidden')) syncCustomizationUI();
  audio.click();
  try { localStorage.setItem('overtake-car', id); } catch { /* ignore */ }
}

function setMode(m: Mode) {
  audio.setActive(m === 'driving');
  if (m === 'garage') { syncModeUI(); syncProgressionUI(); }
  $('garage').classList.toggle('hidden', m !== 'garage');
  $('hud').classList.toggle('hidden', m === 'garage');
  $('pause').classList.toggle('hidden', m !== 'paused');
  $('gameover').classList.toggle('hidden', m !== 'gameover');
  $('btn-pause').classList.toggle('hidden', m !== 'driving' && m !== 'paused');
  $('btn-camera').classList.toggle('hidden', m !== 'driving' && m !== 'paused');
  $('btn-world').classList.toggle('hidden', m !== 'driving' && m !== 'paused');
  closeSoundPanel();
  closeGraphicsPanel();
  if (m !== 'driving' && m !== 'paused') {
    $('camera-panel').classList.add('hidden');
    $('world-panel').classList.add('hidden');
  }
}

function syncCameraUI() {
  const s = game.getCameraSettings();
  document.querySelectorAll<HTMLButtonElement>('.cam-preset').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === s.preset);
  });
  const set = (id: string, v: number, label: string) => {
    const input = $(id) as HTMLInputElement;
    input.value = String(v);
    $(`${id}-val`).textContent = label;
  };
  set('cam-distance', s.distance, `${s.distance.toFixed(1)}m`);
  set('cam-height', s.height, `${s.height.toFixed(1)}m`);
  set('cam-fov', s.fov, `${Math.round(s.fov)}°`);
  set('cam-look', s.lookAhead, `${Math.round(s.lookAhead)}m`);
  const free = game.getFreeCameraSettings();
  set('cam-sensitivity', free.sensitivity, `${free.sensitivity.toFixed(2)}×`);
  ($('cam-auto-center') as HTMLInputElement).checked = free.autoCenter;
  audio.setPerspective(s.preset === 'hood' || s.preset === 'bumper' ? 'cabin' : 'exterior');
}

function toggleCameraPanel() {
  const panel = $('camera-panel');
  panel.classList.toggle('hidden');
  $('world-panel').classList.add('hidden');
  closeSoundPanel();
  closeGraphicsPanel();
  if (!panel.classList.contains('hidden')) syncCameraUI();
}

function syncWorldUI() {
  const w = game.getWorldSettings();
  const time = $('world-time') as HTMLInputElement;
  time.value = String(w.hour);
  $('world-time-val').textContent = w.time;
  const speed = $('world-speed') as HTMLInputElement;
  speed.value = String(w.speed);
  $('world-speed-val').textContent = `${w.speed}×`;
  ($('world-running') as HTMLInputElement).checked = w.running;
  document.querySelectorAll<HTMLButtonElement>('.weather-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.weather === w.weatherMode);
    b.setAttribute('aria-pressed', String(b.dataset.weather === w.weatherMode));
  });
}

function toggleWorldPanel() {
  const panel = $('world-panel');
  panel.classList.toggle('hidden');
  $('camera-panel').classList.add('hidden');
  closeSoundPanel();
  closeGraphicsPanel();
  if (!panel.classList.contains('hidden')) syncWorldUI();
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function syncModeUI() {
  if (!game) return;
  const mode = game.getRunMode();
  const records = game.getRecords();
  document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('mode-best-endless').textContent = fmt(bestFor(records, 'endless'));
  $('mode-best-rush').textContent = fmt(bestFor(records, 'rush'));
  const recent = records.modes[mode].recent.slice(0, 3);
  $('recent-runs').classList.toggle('hidden', recent.length === 0);
  $('recent-mode').textContent = RUN_MODES[mode].label;
  const list = $('recent-list');
  list.innerHTML = '';
  for (const r of recent) {
    const row = document.createElement('div');
    row.className = 'recent-row';
    const medal = r.medal ? `<span class="medal-dot ${r.medal}"></span>` : '';
    row.innerHTML = `${medal}<span>${fmt(r.score)}</span><small>${(r.distance / 1000).toFixed(1)} km · ${r.overtakes} passed</small>`;
    list.appendChild(row);
  }
}

function selectMode(mode: RunMode) {
  game.setRunMode(mode);
  syncModeUI();
  $('best-top').textContent = fmt(game.getBest());
  audio.click();
}

function onHud(h: HudState) {
  $('hud-score').textContent = fmt(h.score);
  $('hud-speed').textContent = String(Math.round(h.speed));
  const maxSpeed = getCar(selected).maxSpeed * 3.6;
  $('speed-max').textContent = String(Math.round(maxSpeed));
  $('speed-arc').style.strokeDashoffset = String(100 * (1 - Math.min(1, Math.max(0, h.speed / maxSpeed))));
  $('hud-dist').textContent = (h.distance / 1000).toFixed(2);
  $('hud-overtakes').textContent = String(h.overtakes);
  $('best-top').textContent = fmt(h.best);
  const combo = $('hud-combo');
  if (h.combo >= 2) {
    combo.classList.remove('hidden');
    $('hud-mult').textContent = String(h.mult);
    $('hud-combo-n').textContent = String(h.combo);
  } else {
    combo.classList.add('hidden');
  }
  const warn = $('oncoming-warn');
  if (h.hazard) {
    warn.classList.remove('hidden');
    $('hazard-label').textContent = h.hazard.kind === 'oncoming' ? 'ONCOMING' : 'TRAFFIC';
    $('oncoming-dist').textContent = String(Math.round(h.hazard.distance));
    warn.classList.toggle('critical', h.hazard.ttc < 2.2);
  } else if (h.oncoming !== null && h.oncoming < 160) {
    warn.classList.remove('hidden');
    $('hazard-label').textContent = 'ONCOMING';
    $('oncoming-dist').textContent = String(Math.round(h.oncoming));
    warn.classList.remove('critical');
  } else {
    warn.classList.add('hidden');
  }
  $('run-mode-label').textContent = h.runLabel;
  $('run-time').textContent = h.timeLeft !== null ? formatClock(h.timeLeft) : formatClock(h.elapsed);
  $('run-clock').classList.toggle('rush', h.runMode === 'rush');
  $('run-clock').classList.toggle('urgent', h.timeLeft !== null && h.timeLeft <= 15);
  const card = $('contract-card');
  if (h.contract) {
    card.classList.remove('hidden');
    $('contract-index').textContent = `Contract ${h.contract.index}/${h.contract.total}`;
    $('contract-reward').textContent = `+${fmt(h.contract.reward)}`;
    $('contract-title').textContent = h.contract.title;
    $('contract-desc').textContent = h.contract.desc;
    $('contract-fill').style.width = `${Math.round(h.contract.ratio * 100)}%`;
    const val = h.contract.target >= 100 ? `${(h.contract.value / 1000).toFixed(2)} / ${(h.contract.target / 1000).toFixed(1)} km` : `${Math.floor(h.contract.value)} / ${h.contract.target}`;
    $('contract-count').textContent = val;
  } else {
    card.classList.add('hidden');
  }
  audio.setSignal(h.signal, h.signalLit);
  for (const side of ['left', 'right'] as const) {
    const button = $(`signal-${side}`);
    button.classList.toggle('lit', h.signal === side && h.signalLit);
    button.setAttribute('aria-pressed', String(h.signal === side));
  }
  $('hud').classList.toggle('offroad', h.offroad);
  $('env-time').textContent = h.time;
  $('env-weather').textContent = h.weather;
  $('env-biome').textContent = h.biome;
  $('env-chip').classList.toggle('night', h.night);
  const eng = audio.engine(h.speed / 3.6, h.throttle, h.brake);
  if (eng) {
    const rpm = Math.max(0, eng.rpm);
    const ratio = eng.redline > 0 ? Math.min(1, rpm / eng.redline) : 0;
    $('hud-rpm').textContent = String(Math.round(rpm).toLocaleString('en-US'));
    $('hud-gear').textContent = eng.gear > 0 ? String(eng.gear) : 'N';
    $('rpm-max').textContent = `${(eng.redline / 1000).toFixed(1)}k`;
    $('rpm-fill').style.width = `${ratio * 100}%`;
    $('speed-cluster').classList.toggle('redline', ratio > 0.92);
    const boost = $('hud-boost');
    boost.style.width = `${Math.round(Math.max(0, Math.min(1, eng.boost)) * 100)}%`;
    boost.parentElement?.classList.toggle('hidden', eng.boost <= 0.01);
  } else {
    // Audio initialization can fail or be unavailable; don't invent a gear.
    $('hud-rpm').textContent = '—';
    $('hud-gear').textContent = '—';
    $('rpm-max').textContent = '—';
    $('rpm-fill').style.width = '0%';
    $('speed-cluster').classList.remove('redline');
    $('hud-boost').parentElement?.classList.add('hidden');
  }
}

function onEvent(e: { kind: 'overtake' | 'near' | 'combo' | 'crash' | 'oncoming' | 'contract' | 'finish'; text: string; points?: number }) {
  if (e.kind === 'contract' || e.kind === 'finish') {
    audio.overtake(true);
  }
  if (e.kind === 'crash') {
    audio.crash();
    const flash = $('flash');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
  } else if (e.kind === 'overtake' || e.kind === 'near' || e.kind === 'oncoming') {
    audio.overtake(e.kind !== 'overtake');
  }
  const div = document.createElement('div');
  div.className = `event ${e.kind}`;
  div.innerHTML = `${e.text}${e.points ? `<small>+${fmt(e.points)}</small>` : ''}`;
  $('events').appendChild(div);
  setTimeout(() => div.remove(), 1300);
}

function onGameOver(s: RunStats) {
  $('final-progress').textContent = `+${fmt(s.xpGained)} XP${s.unlocked.length ? ` · Unlocked: ${s.unlocked.map(id => getCar(id).name).join(', ')}` : ''}`;
  $('final-score').textContent = fmt(s.score);
  $('final-overtakes').textContent = String(s.overtakes);
  $('final-near').textContent = String(s.nearMisses);
  $('final-dist').textContent = (s.distance / 1000).toFixed(1);
  $('final-top').textContent = String(Math.round(s.topSpeed));
  $('final-contracts').textContent = `${s.contractsDone}/3`;
  $('final-best').textContent = fmt(s.best);
  $('new-best').classList.toggle('hidden', !s.newBest);
  $('best-top').textContent = fmt(s.best);
  $('final-title').textContent = s.reason === 'time' ? 'Rush complete' : 'Wrecked';
  $('final-title').classList.toggle('finish-title', s.reason === 'time');
  const medal = $('final-medal');
  medal.className = `final-medal ${s.medal ?? ''}`.trim();
  medal.classList.toggle('hidden', !s.medal);
  medal.textContent = s.medal ? `${s.medal} medal` : '';
  syncModeUI();
}

function startRun() {
  if (!game.canDrive(selected)) return;
  closeSoundPanel();
  closeGraphicsPanel();
  audio.setCar(selected);
  void audio.unlock();
  game.start();
}

function togglePause() {
  if (game.mode === 'driving') game.pause();
  else if (game.mode === 'paused') game.resume();
}

function syncSoundUI() {
  ($('sound-master') as HTMLInputElement).checked = !audio.muted;
  ($('sound-score') as HTMLInputElement).checked = audio.scoreSounds;
  ($('sound-indicator') as HTMLInputElement).checked = audio.indicatorSounds;
  document.querySelector('.ic-on')?.classList.toggle('hidden', audio.muted);
  document.querySelector('.ic-off')?.classList.toggle('hidden', !audio.muted);
  $('btn-sound').setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  $('btn-sound').setAttribute('aria-pressed', String(audio.muted));
}

function closeSoundPanel() {
  $('sound-panel').classList.add('hidden');
  $('btn-sound-settings').setAttribute('aria-expanded', 'false');
  $('btn-pause-sound').setAttribute('aria-expanded', 'false');
}

function toggleSoundPanel() {
  const panel = $('sound-panel');
  const opening = panel.classList.contains('hidden');
  if (opening) {
    $('camera-panel').classList.add('hidden');
    $('world-panel').classList.add('hidden');
    syncSoundUI();
    closeGraphicsPanel();
  }
  panel.classList.toggle('hidden', !opening);
  $('btn-sound-settings').setAttribute('aria-expanded', String(opening));
  $('btn-pause-sound').setAttribute('aria-expanded', String(opening));
}

function closeGraphicsPanel() {
  $('graphics-panel').classList.add('hidden');
  $('btn-graphics').setAttribute('aria-expanded', 'false');
  $('btn-pause-graphics').setAttribute('aria-expanded', 'false');
}

function syncGraphicsUI() {
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => {
    const selected = button.dataset.quality === game.getGraphicsQuality();
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-scenery]').forEach((button) => {
    const selected = button.dataset.scenery === game.getSceneryQuality();
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function toggleGraphicsPanel() {
  const panel = $('graphics-panel');
  const opening = panel.classList.contains('hidden');
  if (opening) {
    closeSoundPanel();
    $('camera-panel').classList.add('hidden');
    $('world-panel').classList.add('hidden');
    syncGraphicsUI();
  }
  panel.classList.toggle('hidden', !opening);
  $('btn-graphics').setAttribute('aria-expanded', String(opening));
  $('btn-pause-graphics').setAttribute('aria-expanded', String(opening));
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  syncSoundUI();
}

function openHelp() {
  closeSoundPanel();
  closeGraphicsPanel();
  helpPaused = game.mode === 'driving';
  if (helpPaused) game.pause();
  $('help').classList.remove('hidden');
}

function closeHelp() {
  $('help').classList.add('hidden');
  if (helpPaused) { game.resume(); helpPaused = false; }
}

function bindHold(id: string, name: 'throttle' | 'brake' | 'left' | 'right' | 'handbrake') {
  const el = $(id);
  const down = (e: Event) => { e.preventDefault(); if (game.mode === 'driving') game.setInput(name, true); };
  const up = () => game.setInput(name, false);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}

function bindUI() {
  $('btn-start').addEventListener('click', startRun);
  $('dev-toggle').addEventListener('click', () => { game.setDeveloperMode(!game.getProgression().dev); syncProgressionUI(); audio.click(); });
  document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((b) => {
    b.addEventListener('click', () => selectMode(b.dataset.mode as RunMode));
  });
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-camera').addEventListener('click', toggleCameraPanel);
  $('btn-world').addEventListener('click', toggleWorldPanel);
  $('world-close').addEventListener('click', () => $('world-panel').classList.add('hidden'));
  $('world-time').addEventListener('input', (e) => {
    game.setTimeOfDay(Number((e.target as HTMLInputElement).value));
    syncWorldUI();
  });
  $('world-speed').addEventListener('input', (e) => {
    game.setCycleSpeed(Number((e.target as HTMLInputElement).value));
    syncWorldUI();
  });
  $('world-running').addEventListener('change', (e) => {
    game.setCycleRunning((e.target as HTMLInputElement).checked);
  });
  document.querySelectorAll<HTMLButtonElement>('.weather-btn').forEach((b) => {
    b.addEventListener('click', () => {
      game.setWeatherMode(b.dataset.weather as 'auto' | 'clear' | 'rain' | 'snow');
      syncWorldUI();
    });
  });
  $('cam-close').addEventListener('click', () => $('camera-panel').classList.add('hidden'));
  document.querySelectorAll<HTMLButtonElement>('.cam-preset').forEach((b) => {
    b.addEventListener('click', () => {
      game.setCameraPreset(b.dataset.cam as CameraPreset);
      syncCameraUI();
    });
  });
  const slider = (id: string, key: 'distance' | 'height' | 'fov' | 'lookAhead') => {
    $(id).addEventListener('input', (e) => {
      game.setCameraValue(key, Number((e.target as HTMLInputElement).value));
      syncCameraUI();
    });
  };
  slider('cam-distance', 'distance');
  slider('cam-height', 'height');
  slider('cam-fov', 'fov');
  slider('cam-look', 'lookAhead');
  $('cam-sensitivity').addEventListener('input', e => { game.setFreeCameraSettings({sensitivity:Number((e.target as HTMLInputElement).value)}); syncCameraUI(); });
  $('cam-auto-center').addEventListener('change', e => game.setFreeCameraSettings({autoCenter:(e.target as HTMLInputElement).checked}));
  $('btn-resume').addEventListener('click', () => game.resume());
  $('btn-quit').addEventListener('click', () => game.toGarage());
  $('btn-retry').addEventListener('click', startRun);
  $('btn-garage').addEventListener('click', () => game.toGarage());
  $('btn-sound').addEventListener('click', toggleMute);
  $('btn-sound-settings').addEventListener('click', toggleSoundPanel);
  $('btn-pause-sound').addEventListener('click', toggleSoundPanel);
  $('btn-graphics').addEventListener('click', toggleGraphicsPanel);
  $('btn-pause-graphics').addEventListener('click', toggleGraphicsPanel);
  $('graphics-close').addEventListener('click', () => { closeGraphicsPanel(); $(game.mode === 'paused' ? 'btn-pause-graphics' : 'btn-graphics').focus(); });
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.quality;
      if (value === 'performance' || value === 'balanced' || value === 'sharp') game.setGraphicsQuality(value);
      syncGraphicsUI();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-scenery]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.scenery;
      if (value === 'low' || value === 'medium' || value === 'high') game.setSceneryQuality(value);
      syncGraphicsUI();
    });
  });
  $('sound-close').addEventListener('click', () => { closeSoundPanel(); $(game.mode === 'paused' ? 'btn-pause-sound' : 'btn-sound-settings').focus(); });
  $('sound-master').addEventListener('change', e => { audio.setMuted(!(e.target as HTMLInputElement).checked); syncSoundUI(); });
  $('sound-score').addEventListener('change', e => audio.setScoreSounds((e.target as HTMLInputElement).checked));
  $('sound-indicator').addEventListener('change', e => audio.setIndicatorSounds((e.target as HTMLInputElement).checked));
  $('btn-help').addEventListener('click', openHelp);
  $('btn-close-help').addEventListener('click', closeHelp);

  const swatches = $('paint-swatches');
  for (const p of PAINT_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paint-swatch';
    b.dataset.hex = p.hex;
    b.style.background = p.hex;
    b.title = p.name;
    b.setAttribute('aria-label', `${p.name} paint`);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => applyPaint(p.hex));
    swatches.appendChild(b);
  }
  $('paint-custom').addEventListener('change', (e) => applyPaint((e.target as HTMLInputElement).value));
  $('paint-reset').addEventListener('click', () => applyPaint(null));
  document.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      document.querySelectorAll<HTMLElement>('[data-workshop-panel]').forEach(panel => { panel.hidden = panel.dataset.workshopPanel !== button.dataset.workshopTab; });
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-workshop-part]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-workshop-part]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      document.querySelectorAll<HTMLElement>('[data-part-panel]').forEach(panel => { panel.hidden = panel.dataset.partPanel !== button.dataset.workshopPart; });
    });
  });
  $('btn-customize').addEventListener('click', () => showCustomization(true));
  $('custom-close').addEventListener('click', () => showCustomization(false));
  $('custom-done').addEventListener('click', () => showCustomization(false));
  $('custom-reset').addEventListener('click', () => applyCustomization({ ...DEFAULT_CUSTOMIZATION }));
  for (const part of BODY_PARTS) {
    $(`custom-${part}-finish`).addEventListener('change', event => applyCustomization({ ...currentCustomization(), [`${part}Finish`]:(event.target as HTMLSelectElement).value } as Customization));
    $(`custom-${part}`).addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      applyCustomization({ ...currentCustomization(), [part]: value } as Customization);
    });
  }
  $('custom-primary-color').addEventListener('change', event => { applyPaint((event.target as HTMLInputElement).value); syncCustomizationUI(); });
  const controls: [string, 'paintScheme'|'secondaryColor'|'secondaryFinish'|'livery'|'liveryColor', 'input'|'change'][] = [
    ['custom-paint-scheme','paintScheme','change'], ['custom-secondary-color','secondaryColor','input'],
    ['custom-secondary-finish','secondaryFinish','change'], ['custom-livery','livery','change'], ['custom-livery-color','liveryColor','input'],
  ];
  for (const [id,key,event] of controls) $(id).addEventListener(event, e => applyCustomization({ ...currentCustomization(), [key]:(e.target as HTMLInputElement | HTMLSelectElement).value } as Customization));
  $('custom-glow-enabled').addEventListener('change', event => applyCustomization({ ...currentCustomization(), underglow:(event.target as HTMLInputElement).checked }));
  $('custom-glow-color').addEventListener('input', event => applyCustomization({ ...currentCustomization(), glowColor:(event.target as HTMLInputElement).value }));
  document.querySelectorAll<HTMLButtonElement>('[data-custom-view]').forEach(button => {
    button.addEventListener('click', () => game.setGarageView(button.dataset.customView as 'front'|'side'|'rear'));
  });
  syncPaintUI(selected);

  $('signal-left').addEventListener('click', () => game.toggleSignal('left'));
  $('signal-right').addEventListener('click', () => game.toggleSignal('right'));
  bindHold('t-left', 'left');
  bindHold('t-right', 'right');
  bindHold('t-gas', 'throttle');
  bindHold('t-brake', 'brake');

  const keyMap: Record<string, 'throttle' | 'brake' | 'left' | 'right' | 'handbrake'> = {
    ArrowUp: 'throttle', w: 'throttle', W: 'throttle',
    ArrowDown: 'brake', s: 'brake', S: 'brake',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ' ': 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (e.key === 'Escape' && !$('graphics-panel').classList.contains('hidden')) {
      e.preventDefault(); closeGraphicsPanel(); $(game.mode === 'paused' ? 'btn-pause-graphics' : 'btn-graphics').focus(); return;
    }
    if (e.key === 'Escape' && !$('sound-panel').classList.contains('hidden')) {
      e.preventDefault(); closeSoundPanel(); $(game.mode === 'paused' ? 'btn-pause-sound' : 'btn-sound-settings').focus(); return;
    }
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || (target.tagName === 'BUTTON' && e.key === 'Enter'))) return;
    const name = keyMap[e.key];
    if (name) { e.preventDefault(); if (game.mode === 'driving') game.setInput(name, true); return; }
    if (!e.repeat && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); game.toggleSignal('left'); return; }
    if (!e.repeat && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); game.toggleSignal('right'); return; }
    switch (e.key) {
      case 'p': case 'P': case 'Escape':
        if (!$('help').classList.contains('hidden')) closeHelp();
        else togglePause();
        break;
      case 'm': case 'M': toggleMute(); break;
      case 'c': case 'C': game.cycleCamera(); syncCameraUI(); break;
      case 'v': case 'V': toggleCameraPanel(); break;
      case 'b': case 'B': toggleWorldPanel(); break;
      case 'Enter':
        if (game.mode === 'garage' || game.mode === 'gameover') startRun();
        else if (game.mode === 'paused') game.resume();
        break;
    }
  });
  window.addEventListener('keyup', (e) => {
    const name = keyMap[e.key];
    if (name) { e.preventDefault(); game.setInput(name, false); }
  });
  window.addEventListener('blur', () => {
    for (const n of ['throttle', 'brake', 'left', 'right', 'handbrake'] as const) game.setInput(n, false);
    if (game.mode === 'driving') game.pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'driving') game.pause();
  });
}

async function boot() {
  library = new ModelLibrary();
  loadPaints();
  loadCustomizations();
  try {
    await library.loadAll((done, total, label) => {
      $('load-bar').style.width = `${(done / total) * 90}%`;
      $('load-label').textContent = done < total ? `Loading ${label}…` : 'Building garage…';
    });
  } catch (err) {
    $('load-label').textContent = 'Failed to load models. Please refresh.';
    console.error(err);
    return;
  }

  for (const c of CARS) {
    const saved = paints[c.id];
    if (saved) library.setPaint(c.id, hexToNumber(saved));
    if (customizations[c.id]) library.setCustomization(c.id, customizations[c.id]);
  }

  const cards = $('car-cards');
  for (const c of CARS) {
    const url = await library.thumbnail(c.id);
    const btn = document.createElement('button');
    btn.className = 'car-card';
    btn.dataset.car = c.id;
    btn.innerHTML = `
      <img src="${url}" alt="${c.name}" />
      <div>
        <div class="cc-maker">${c.maker}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-class">${c.klass}</div>
        <div class="cc-unlock"></div>
      </div>`;
    btn.addEventListener('click', () => selectCar(c.id));
    cards.appendChild(btn);
  }
  $('load-bar').style.width = '100%';

  try {
    const saved = localStorage.getItem('overtake-car') as CarId | null;
    if (saved && CARS.some((c) => c.id === saved)) selected = saved;
  } catch { /* ignore */ }

  game = new OvertakeGame($('game') as HTMLCanvasElement, library, {
    onHud, onEvent, onGameOver, onMode: setMode,
  });
  (window as any).__overtake = game; // test/debug hook
  game.setSelectedCar(selected);
  updateDetail(selected);
  syncModeUI();
  $('best-top').textContent = fmt(game.getBest());
  syncSoundUI();

  bindUI();
  setMode('garage');
  $('loading').classList.add('hidden');
  $('topbar').classList.remove('hidden');
}

void boot();
