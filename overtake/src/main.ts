import '@fontsource-variable/inter';
import { createIcons, Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, Cloud, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor } from 'lucide';
import { ModelLibrary } from './models';
import { OvertakeGame, CAMERA_ORDER, type Mode, type HudState, type RunStats, type CameraPreset } from './game';
import { RUN_MODES, eventFor, type RunMode } from './run.mjs';
import { bestFor } from './records.mjs';
import { RANKS, SCENARIOS, rankFor, type ScenarioId } from './ranked.mjs';
import { rankBadge } from './rank-badges';
import { CAR_PRICES, UPGRADE_PRICES, earnedCar, upgradeLevels, tunePrice, emptyProgression, type Upgrade } from './progression.mjs';
import { CARS, getCar, PAINT_COLORS, type CarId } from './catalog';
import { GameAudio } from './audio';
import { hexToNumber, sanitizePaints } from './paint.mjs';
import { BODY_FITS } from './body-kits';
import { LIVERIES } from './livery';
import { BODY_PARTS, DEFAULT_CUSTOMIZATION, sanitizeCustomization, sanitizeCustomizations, type Customization } from './customization.mjs';

createIcons({ icons: { Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, Cloud, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor } });

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
let frontScreen: 'menu' | 'garage' = 'menu';

// A new economy starts from zero exactly once. Keep a backup of old cosmetics,
// but do not carry free, already-equipped tuning into the paid economy.
function initializeEconomy() {
  try {
    if (localStorage.getItem('overtake-progression-v2') !== null) return;
    for (const key of ['overtake-paints', 'overtake-customization-v1']) {
      const old = localStorage.getItem(key);
      if (old !== null) localStorage.setItem(`${key}-before-economy`, old);
    }
    localStorage.setItem('overtake-progression-v2', JSON.stringify(emptyProgression()));
    localStorage.removeItem('overtake-paints');
    localStorage.removeItem('overtake-customization-v1');
    localStorage.removeItem('overtake-car');
  } catch { /* storage may be unavailable */ }
}
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
    const key = ({'custom-paint-scheme':'paintScheme','custom-secondary-finish':'secondaryFinish','custom-livery':'livery'} as Record<string,string>)[select.id]
      ?? select.id.replace(/^custom-/, '').replace(/-finish$/, 'Finish');
    const progress = game.getProgression();
    group.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      const value = button.dataset.value!;
      const option = options.find(o => o.value === value)!;
      const price = tunePrice(key, value);
      const owned = progress.tunes[selected]?.includes(`${key}:${value}`);
      button.textContent = `${option.text}${price ? progress.dev ? ' · DEV' : owned ? ' · Owned' : ` · $${fmt(price)}` : ''}`;
      button.disabled = select.disabled;
      button.setAttribute('aria-pressed', String(button.dataset.value === select.value));
    });
  });
}
function syncCustomizationUI() {
  const config = currentCustomization();
  $('custom-car-name').textContent = `${getCar(selected).maker} ${getCar(selected).name}`;
  $('custom-balance').textContent = `$${fmt(game.getProgression().money)}`;
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
  const config = sanitizeCustomization(value), current = currentCustomization();
  for (const key of Object.keys(config) as (keyof Customization)[]) {
    if (config[key] === current[key]) continue;
    const option = key === 'underglow' ? (config[key] ? 'on' : 'off') : String(config[key]);
    if (!game.purchaseTune(selected, key, option)) {
      $('tune-message').textContent = `Not enough money. This option costs $${fmt(tunePrice(key, option))}.`;
      syncCustomizationUI(); return;
    }
  }
  customizations[selected] = config;
  if (!game.getProgression().dev) {
    try { localStorage.setItem('overtake-customization-v1', JSON.stringify(customizations)); } catch { /* storage may be unavailable */ }
  }
  $('tune-message').textContent = game.getProgression().dev ? 'Dev preview is temporary. Paid options remain yours.' : 'Purchased options can be reused free.';
  library.setCustomization(selected, config);
  game.setSelectedCar(selected);
  syncCustomizationUI(); syncProgressionUI();
}

function showCustomization(show: boolean) {
  $('garage').classList.toggle('customizing', show);
  game.setGarageWorkshop(show);
  $('car-detail').classList.toggle('hidden', show);
  $('custom-panel').classList.toggle('hidden', !show);
  if (show) syncCustomizationUI();
}

function savePaints() {
  try { if (!game.getProgression().dev) localStorage.setItem('overtake-paints', JSON.stringify(paints)); } catch { /* ignore */ }
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
  if (hex !== null && hex !== (paints[selected] ?? getCar(selected).color) && !game.purchaseTune(selected, 'paint', 'paint')) {
    $('car-requirement').textContent = 'Paint costs $250. Earn more money first.';
    $('tune-message').textContent = 'Paint costs $250. Earn more money first.';
    syncPaintUI(selected); syncCustomizationUI(); return;
  }
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
  syncProgressionUI();
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
  $('progress-xp').textContent = `$${fmt(progress.money)}`;
  $('progress-next').textContent = 'Money earned from your score';
  const dev = $('dev-toggle') as HTMLButtonElement;
  dev.textContent = `Dev options: ${progress.dev ? 'ON' : 'OFF'}`;
  dev.setAttribute('aria-pressed', String(progress.dev));
  const owned = earnedCar(progress, selected), available = game.canDrive(selected);
  $('car-requirement').textContent = owned ? 'Owned' : progress.dev ? `Dev access · purchase for $${fmt(CAR_PRICES[selected])}` : `Not owned · $${fmt(CAR_PRICES[selected])}`;
  const buy = $('buy-car') as HTMLButtonElement;
  buy.classList.toggle('hidden', owned);
  buy.textContent = `Buy car · $${fmt(CAR_PRICES[selected])}`;
  buy.disabled = progress.money < CAR_PRICES[selected];
  ($('btn-start') as HTMLButtonElement).disabled = !available;
  ($('btn-customize') as HTMLButtonElement).disabled = !available;
  document.querySelectorAll<HTMLButtonElement>('.paint-swatch').forEach(button => { button.disabled = !available; });
  ($('paint-custom') as HTMLInputElement).disabled = !available;
  ($('paint-reset') as HTMLButtonElement).disabled = !available;
  const startLabel = available ? game.getRunMode() === 'ranked' ? 'Start ranked attack' : 'Start engine' : 'Buy car to drive';
  $('start-label').textContent = startLabel;
  $('menu-start-label').textContent = startLabel.toUpperCase();
  ($('menu-start') as HTMLButtonElement).disabled = !available;
  ($('menu-mobile-start') as HTMLButtonElement).disabled = !available;
  $('menu-mobile-start-label').textContent = startLabel.toUpperCase();
  $('menu-car-name').textContent = `${getCar(selected).maker} ${getCar(selected).name}`;
  $('menu-car-status').textContent = owned ? 'OWNED' : progress.dev ? 'DEV ACCESS' : 'NOT OWNED';
  document.querySelectorAll<HTMLButtonElement>('.car-card').forEach(card => {
    const id = card.dataset.car as CarId, hasCar = earnedCar(progress, id);
    const status = card.querySelector<HTMLElement>('.cc-unlock')!;
    status.textContent = hasCar ? 'Owned' : progress.dev ? `Dev · $${fmt(CAR_PRICES[id])}` : `$${fmt(CAR_PRICES[id])}`;
    card.classList.toggle('locked', !hasCar);
    card.setAttribute('aria-label', `${getCar(id).maker} ${getCar(id).name}, ${status.textContent}`);
  });
  const levels = upgradeLevels(progress, selected);
  const list = $('upgrade-list'); list.replaceChildren();
  for (const [key, name, effect] of [['engine','Engine','+8% acceleration, +4% top speed'],['tires','Tires','+6% grip'],['brakes','Brakes','+10% braking']] as [Upgrade,string,string][]) {
    const level = levels[key], price = UPGRADE_PRICES[key][level];
    const button = document.createElement('button'); button.type = 'button'; button.dataset.upgrade = key;
    button.textContent = `${name} ${level}/3 · ${price === undefined ? 'MAX' : `$${fmt(price)}`}`;
    button.title = `${effect} per stage${progress.dev ? ' · Dev uses maximum stages temporarily' : ''}`;
    button.disabled = !owned || price === undefined || progress.money < price;
    button.addEventListener('click', () => { if (game.purchaseUpgrade(selected, key)) { syncProgressionUI(); audio.click(); } });
    list.appendChild(button);
  }
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
  if (m === 'garage') { syncModeUI(); syncProgressionUI(); syncRankUI(); }
  $('main-menu').classList.toggle('hidden', m !== 'garage' || frontScreen !== 'menu');
  $('garage').classList.toggle('hidden', m !== 'garage' || frontScreen !== 'garage');
  $('hud').classList.toggle('hidden', m === 'garage');
  $('pause').classList.toggle('hidden', m !== 'paused');
  $('quit-label').textContent = game.getRunMode() === 'ranked' && !game.getProgression().dev ? 'Quit ranked run · −12 RP' : 'Back to menu';
  $('gameover').classList.toggle('hidden', m !== 'gameover');
  $('btn-account').classList.toggle('hidden', m !== 'garage');
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

function showFrontScreen(screen: 'menu' | 'garage') {
  if (game.mode !== 'garage') return;
  if (screen === 'menu' && !$('custom-panel').classList.contains('hidden')) showCustomization(false);
  frontScreen = screen;
  setMode('garage');
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

function formatRankCountdown(seconds: number) { const t = Math.floor(Math.max(0, seconds) * 10) / 10; return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; }

function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }

function syncModeUI() {
  if (!game) return;
  const mode = game.getRunMode();
  const records = game.getRecords();
  $('menu-ranked').classList.toggle('hidden', mode !== 'ranked');
  $('menu-selected-mode').textContent = RUN_MODES[mode].label.toUpperCase();
  const info = rankFor(game.getRanked().points);
  $('mode-best-ranked').textContent = info.rank.name;
  syncMenuStats();
  $('best-top').textContent = fmt(mode === 'ranked' ? game.getRanked().points : game.getBest());
  document.querySelector('.best-pill')?.setAttribute('title', mode === 'ranked' ? 'Local rank points' : 'Personal best score');
  document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('mode-best-endless').textContent = fmt(bestFor(records, 'endless'));
  $('mode-best-rush').textContent = fmt(bestFor(records, 'rush'));
  for (const key of ['near', 'daily', 'weekly'] as const) $('mode-best-' + key).textContent = fmt(bestFor(records, key));
  $('mode-best-trial').textContent = records.modes.trial.bestTime === null ? '—' : formatTime(records.modes.trial.bestTime);
  $('daily-desc').textContent = eventFor('daily').contract.desc + ' · UTC';
  $('weekly-desc').textContent = eventFor('weekly').contract.desc + ' · UTC';
  $('active-mode-info').textContent = mode === 'daily' || mode === 'weekly' ? `${RUN_MODES[mode].label} · ${eventFor(mode).contract.desc} · UTC` : RUN_MODES[mode].tagline;
  const recent = records.modes[mode].recent.slice(0, 3);
  $('recent-runs').classList.toggle('hidden', recent.length === 0);
  $('recent-mode').textContent = RUN_MODES[mode].label;
  const list = $('recent-list');
  list.innerHTML = '';
  for (const r of recent) {
    const row = document.createElement('div');
    row.className = 'recent-row';
    const medal = r.medal ? `<span class="medal-dot ${r.medal}"></span>` : '';
    row.innerHTML = `${medal}<span>${mode === 'trial' && r.reason === 'distance' ? formatTime(r.elapsed) : fmt(r.score)}</span><small>${(r.distance / 1000).toFixed(1)} km · ${r.overtakes} passed</small>`;
    list.appendChild(row);
  }
}

function syncMenuStats() {
  if (!game) return;
  const records = game.getRecords(), buckets = Object.entries(records.modes).filter(([mode]) => mode !== 'ranked').map(([, bucket]) => bucket);
  const ranked = game.getRanked(), info = rankFor(ranked.points), progress = game.getProgression();
  $('menu-best-score').textContent = fmt(Math.max(0, ...buckets.map(b => b.bestScore)));
  $('menu-longest').innerHTML = `${(Math.max(0, ...buckets.map(b => b.bestDistance)) / 1000).toFixed(1)} <small>KM</small>`;
  $('menu-runs').textContent = fmt(buckets.reduce((sum, b) => sum + b.runs, 0) + ranked.attempts);
  $('menu-owned').textContent = `${progress.owned.length} / ${CARS.length}`;
  $('menu-rank-badge').innerHTML = rankBadge(info.index);
  $('menu-rank-name').textContent = info.rank.name;
  $('menu-rank-points').textContent = `${fmt(info.points)} RP`;
}
function showGarageTab(tab: string) {
  document.querySelectorAll<HTMLButtonElement>('[data-garage-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.garageTab === tab)));
  for (const section of ['upgrades', 'style']) $('garage-' + section).classList.toggle('hidden', section !== tab);
}
function syncRankUI() {
  if (!game) return;
  const state = game.getRanked(), info = rankFor(state.points), selectedScenario = game.getRankedScenario();
  const hero = $('rank-hero'); hero.style.setProperty('--rank-color', info.rank.color); hero.style.setProperty('--rank-glow', info.rank.glow);
  $('rank-badge').innerHTML = rankBadge(info.index); $('rank-name').textContent = info.rank.name;
  $('rank-status').textContent = game.getProgression().dev ? 'DEV PREVIEW · NO RANK POINTS' : 'LOCAL RANKED · TIME ATTACK';
  $('rank-points').textContent = fmt(state.points); $('rank-progress-fill').style.width = `${info.progress * 100}%`;
  $('rank-next').textContent = info.next ? `${fmt(info.next.min - state.points)} RP to ${info.next.name}` : 'Top rank reached';
  const list = $('rank-scenarios'); list.replaceChildren();
  for (const scenario of SCENARIOS) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.scenario = scenario.id;
    button.className = `rank-scenario${scenario.id === selectedScenario.id ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(scenario.id === selectedScenario.id));
    const best = state.scenarios[scenario.id];
    button.innerHTML = `<span class="rank-scenario-top"><span>${scenario.kicker}</span><span>GOLD +${Math.round(40 * scenario.multiplier)} RP</span></span><strong>${scenario.title}</strong><small>${(scenario.distance / 1000).toFixed(1)} km in ${scenario.limit}s · ${scenario.objective}</small><small>Gold ≤ ${scenario.gold}s · Silver ≤ ${scenario.silver}s · Bronze +${Math.round(18 * scenario.multiplier)} / Silver +${Math.round(28 * scenario.multiplier)} RP${best?.bestTime ? ` · Best ${formatTime(best.bestTime)}` : ''}</small>`;
    button.addEventListener('click', () => { game.setRankedScenario(scenario.id as ScenarioId); syncRankUI(); list.querySelector<HTMLButtonElement>(`[data-scenario="${scenario.id}"]`)?.focus(); audio.click(); });
    list.appendChild(button);
  }
  const road = $('rank-road-grid'); road.replaceChildren();
  RANKS.forEach((rank, i) => {
    const item = document.createElement('div'); item.className = `road-rank${i === info.index ? ' current' : ''}${i > info.index ? ' locked' : ''}`;
    item.innerHTML = `<div class="road-badge">${rankBadge(i)}</div><b>${rank.name}</b><small>${fmt(rank.min)} RP${i === info.index ? ' · CURRENT' : i > info.index ? ' · LOCKED' : ' · REACHED'}</small>`;
    road.appendChild(item);
  });
}

function selectMode(mode: RunMode) {
  game.setRunMode(mode);
  syncModeUI(); syncProgressionUI();
  $('best-top').textContent = fmt(mode === 'ranked' ? game.getRanked().points : game.getBest());
  audio.click();
}

function onHud(h: HudState) {
  $('hud-score').textContent = fmt(h.score);
  $('hud-speed').textContent = String(Math.round(h.speed));
  const maxSpeed = game.getMaxSpeed() * 3.6;
  $('speed-max').textContent = String(Math.round(maxSpeed));
  $('speed-arc').style.strokeDashoffset = String(100 * (1 - Math.min(1, Math.max(0, h.speed / maxSpeed))));
  $('hud-dist').textContent = (h.distance / 1000).toFixed(2);
  $('hud-overtakes').textContent = String(h.overtakes);
  $('best-top').textContent = fmt(h.runMode === 'ranked' ? game.getRanked().points : h.best);
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
  $('run-time').textContent = h.timeLeft !== null ? (h.runMode === 'ranked' ? formatRankCountdown(h.timeLeft) : formatClock(h.timeLeft)) : formatClock(h.elapsed);
  $('run-clock').classList.toggle('rush', h.runMode === 'rush');
  $('run-clock').classList.toggle('urgent', h.timeLeft !== null && h.timeLeft <= 15);
  const card = $('contract-card');
  if (h.runMode === 'ranked') {
    const scenario = game.getRankedScenario(); const value = scenario.metric === 'overtakes' ? h.overtakes : h.nearMisses;
    card.classList.remove('hidden'); $('contract-index').textContent = 'RANKED · TIME ATTACK'; $('contract-reward').textContent = `GOLD ${scenario.limit - scenario.gold}s+ LEFT`;
    $('contract-title').textContent = scenario.title;
    $('contract-desc').textContent = `${scenario.objective} · ${(h.distance / 1000).toFixed(2)} / ${(scenario.distance / 1000).toFixed(1)} km`;
    $('contract-fill').style.width = `${Math.min(100, h.distance / scenario.distance * 100)}%`;
    $('contract-count').textContent = `${Math.min(value, scenario.target)} / ${scenario.target} ${scenario.metric === 'overtakes' ? 'overtakes' : 'near misses'}`;
  } else if (h.contract) {
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

let latestResult: RunStats | null = null;
function onGameOver(s: RunStats) {
  latestResult = s;
  $('share-status').textContent = s.devRun ? 'Dev run · excluded from personal records' : 'Local result · not globally verified';
  $('final-progress').textContent = `+$${fmt(s.moneyGained)} earned`;
  $('final-score').textContent = fmt(s.score);
  $('final-overtakes').textContent = String(s.overtakes);
  $('final-near').textContent = String(s.nearMisses);
  $('final-dist').textContent = (s.distance / 1000).toFixed(1);
  $('final-top').textContent = String(Math.round(s.topSpeed));
  const ranked = s.ranked;
  $('final-contracts').textContent = ranked ? `${Math.min(ranked.scenario.metric === 'overtakes' ? s.overtakes : s.nearMisses, ranked.scenario.target)}/${ranked.scenario.target}` : `${s.contractsDone}/${s.contractsTotal}`;
  $('final-contract-label').textContent = ranked ? (ranked.scenario.metric === 'overtakes' ? 'overtakes goal' : 'near miss goal') : 'contracts';
  const rankPanel = $('final-ranked'); rankPanel.classList.toggle('hidden', !ranked);
  if (ranked) {
    const change = ranked.change, current = change.after;
    rankPanel.style.setProperty('--rank-color', current.rank.color);
    $('final-rank-badge').innerHTML = rankBadge(current.index);
    $('final-rank-label').textContent = `${ranked.scenario.title} · ${current.rank.name.toUpperCase()}`;
    $('final-rank-change').textContent = s.devRun ? '0 RP · DEV PREVIEW' : `${change.delta > 0 ? '+' : ''}${change.delta} RP`;
    $('final-rank-message').textContent = s.devRun ? 'Dev runs do not affect rank' : current.index > change.before.index ? `PROMOTED TO ${current.rank.name.toUpperCase()}!` : current.index < change.before.index ? `Rank changed to ${current.rank.name}` : `${fmt(current.points)} RP · local, unverified`;
  }
  const rankedBest = ranked ? game.getRanked().scenarios[ranked.scenario.id]?.bestTime ?? null : null;
  $('final-best').textContent = ranked ? (rankedBest === null ? '—' : formatTime(rankedBest)) : s.mode === 'trial' ? (s.bestTime === null ? '—' : formatTime(s.bestTime)) : fmt(s.best);
  $('final-best-label').textContent = ranked || s.mode === 'trial' ? 'Fastest time' : 'Personal best';
  $('new-best').classList.toggle('hidden', !s.newBest);
  $('best-top').textContent = fmt(ranked ? ranked.change.after.points : s.best);
  $('final-title').textContent = s.reason === 'crash' ? 'Wrecked' : s.reason === 'objective' ? 'Challenge complete' : s.reason === 'distance' ? `Finished · ${formatTime(s.elapsed)}` : s.reason === 'objective_failed' ? 'Objective missed' : 'Time up';
  $('final-title').classList.toggle('finish-title', s.reason !== 'crash');
  const medal = $('final-medal');
  medal.className = `final-medal ${s.medal ?? ''}`.trim();
  medal.classList.toggle('hidden', !s.medal);
  medal.textContent = s.medal ? `${s.medal} medal` : '';
  syncModeUI(); syncRankUI();
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
  $('menu-start').addEventListener('click', startRun);
  $('menu-mobile-start').addEventListener('click', startRun);
  $('menu-mobile-garage').addEventListener('click', () => showFrontScreen('garage'));
  $('menu-garage').addEventListener('click', () => showFrontScreen('garage'));
  $('garage-back').addEventListener('click', () => showFrontScreen('menu'));
  $('menu-rank-select').addEventListener('click', () => { selectMode('ranked'); $('menu-ranked').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('dev-toggle').addEventListener('click', () => {
    const enabled = !game.getProgression().dev;
    game.setDeveloperMode(enabled);
    if (!enabled) {
      loadPaints(); loadCustomizations();
      for (const car of CARS) { library.setPaint(car.id, paints[car.id] ? hexToNumber(paints[car.id]) : null); library.setCustomization(car.id, customizations[car.id] ?? { ...DEFAULT_CUSTOMIZATION }); void refreshThumbnail(car.id); }
      game.setSelectedCar(selected); syncPaintUI(selected);
    }
    syncProgressionUI(); syncRankUI(); audio.click();
  });
  $('buy-car').addEventListener('click', () => { if (game.purchaseCar(selected)) { syncProgressionUI(); audio.click(); } });
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
  $('btn-quit').addEventListener('click', () => { frontScreen = 'menu'; game.toGarage(); });
  document.querySelectorAll<HTMLButtonElement>('[data-garage-tab]').forEach(button => button.addEventListener('click', () => showGarageTab(button.dataset.garageTab!)));
  const rankRoad = $('rank-road') as HTMLDialogElement;
  $('rank-road-open').addEventListener('click', () => { syncRankUI(); rankRoad.showModal(); $('rank-road-close').focus(); });
  $('rank-road-close').addEventListener('click', () => rankRoad.close());
  rankRoad.addEventListener('close', () => $('rank-road-open').focus());
  $('btn-share-result').addEventListener('click', async () => {
    if (!latestResult) return;
    const s = latestResult;
    const detail = s.ranked ? `${s.ranked.scenario.title} · ${s.reason === 'distance' ? formatTime(s.elapsed) : 'unfinished'} · ${s.ranked.change.delta > 0 ? '+' : ''}${s.ranked.change.delta} RP` : s.mode === 'trial' && s.reason === 'distance' ? `3 km in ${formatTime(s.elapsed)}` : `${fmt(s.score)} points · ${(s.distance / 1000).toFixed(1)} km`;
    const text = `OVERTAKE · ${RUN_MODES[s.mode].label}\n${detail} · ${s.overtakes} overtakes\n${s.devRun ? 'Dev run, excluded from records' : 'Local result, not globally verified'}\n${location.origin}/`;
    try {
      if (navigator.share) { await navigator.share({ title: 'OVERTAKE', text }); $('share-status').textContent = 'Shared'; }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); $('share-status').textContent = 'Result copied'; }
      else throw new Error('Sharing unavailable');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Selectable fallback works even on insecure origins or denied clipboard permissions.
      const box = document.createElement('textarea'); box.value = text; box.readOnly = true; box.className = 'share-fallback';
      $('share-status').textContent = 'Copy your result:'; $('share-status').appendChild(box); box.focus(); box.select();
    }
  });
  $('btn-download-card').addEventListener('click', () => {
    if (!latestResult) return;
    const s = latestResult, canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    const c = canvas.getContext('2d');
    if (!c) { $('share-status').textContent = 'Could not create a card on this device.'; return; }
    c.fillStyle = '#0b1114'; c.fillRect(0, 0, 1200, 630);
    c.fillStyle = '#172126'; c.fillRect(800, 0, 400, 630);
    c.fillStyle = '#ff713d'; c.fillRect(0, 0, 14, 630);
    c.fillStyle = '#f4f7f3'; c.font = 'bold 38px sans-serif'; c.fillText('OVERTAKE', 72, 82);
    c.fillStyle = '#ff713d'; c.font = 'bold 24px sans-serif'; c.fillText(RUN_MODES[s.mode].label.toUpperCase(), 72, 170);
    c.fillStyle = '#f4f7f3'; c.font = 'bold 100px sans-serif';
    const primary = (s.mode === 'trial' || s.ranked) && s.reason === 'distance' ? formatTime(s.elapsed) : s.ranked ? `${s.ranked.change.delta > 0 ? '+' : ''}${s.ranked.change.delta} RP` : fmt(s.score);
    c.fillText(primary, 72, 290, 700);
    c.fillStyle = '#a9bab6'; c.font = 'bold 24px sans-serif';
    c.fillText(s.ranked ? (s.reason === 'distance' ? `${s.ranked.scenario.title.toUpperCase()} · TIME` : 'RANKED ATTACK') : s.mode === 'trial' && s.reason === 'distance' ? '3 KM TIME' : 'POINTS', 76, 330, 700);
    c.fillStyle = '#f4f7f3'; c.font = 'bold 27px sans-serif'; c.fillText(`${s.overtakes} OVERTAKES   /   ${s.nearMisses} NEAR MISSES   /   ${(s.distance / 1000).toFixed(1)} KM`, 72, 423, 720);
    c.fillStyle = '#ff9b76'; c.font = 'bold 22px sans-serif'; c.fillText(s.devRun ? 'DEV RUN · EXCLUDED FROM RECORDS' : 'LOCAL RESULT · NOT GLOBALLY VERIFIED', 72, 535, 720);
    c.fillStyle = '#9cafaa'; c.font = '20px sans-serif'; c.fillText(location.origin, 72, 575, 720);
    c.strokeStyle = '#ff713d'; c.lineWidth = 8; c.beginPath(); c.moveTo(900, 440); c.lineTo(1090, 250); c.moveTo(990, 250); c.lineTo(1090, 250); c.lineTo(1090, 350); c.stroke();
    canvas.toBlob(blob => {
      if (!blob) { $('share-status').textContent = 'Could not create a card on this device.'; return; }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'overtake-result.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      $('share-status').textContent = 'Result card downloaded.';
    }, 'image/png');
  });
  $('btn-retry').addEventListener('click', startRun);
  $('btn-garage').addEventListener('click', () => { frontScreen = 'garage'; game.toGarage(); });
  $('btn-result-menu').addEventListener('click', () => { frontScreen = 'menu'; game.toGarage(); });
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
  syncProgressionUI();

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
    if (($('rank-road') as HTMLDialogElement).open) return;
    const target = e.target as HTMLElement | null;
    if (e.key === 'Escape' && !$('graphics-panel').classList.contains('hidden')) {
      e.preventDefault(); closeGraphicsPanel(); $(game.mode === 'paused' ? 'btn-pause-graphics' : 'btn-graphics').focus(); return;
    }
    if (e.key === 'Escape' && !$('sound-panel').classList.contains('hidden')) {
      e.preventDefault(); closeSoundPanel(); $(game.mode === 'paused' ? 'btn-pause-sound' : 'btn-sound-settings').focus(); return;
    }
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || (['BUTTON', 'A'].includes(target.tagName) && e.key === 'Enter'))) return;
    const name = keyMap[e.key];
    if (name) { if (game.mode === 'driving') { e.preventDefault(); game.setInput(name, true); } return; }
    if (!e.repeat && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); game.toggleSignal('left'); return; }
    if (!e.repeat && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); game.toggleSignal('right'); return; }
    switch (e.key) {
      case 'p': case 'P': case 'Escape':
        if (!$('help').classList.contains('hidden')) closeHelp();
        else if (e.key === 'Escape' && game.mode === 'garage' && frontScreen === 'garage') { if (!$('custom-panel').classList.contains('hidden')) showCustomization(false); else showFrontScreen('menu'); }
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
    if (name) { if (game.mode === 'driving') e.preventDefault(); game.setInput(name, false); }
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
  initializeEconomy();
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
  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (requestedMode && Object.hasOwn(RUN_MODES, requestedMode)) game.setRunMode(requestedMode as RunMode);
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
