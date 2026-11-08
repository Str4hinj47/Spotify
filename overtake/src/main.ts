import '@fontsource-variable/inter';
import { createIcons, Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, Cloud, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor, Settings } from 'lucide';
import { ModelLibrary } from './models';
import { OvertakeGame, CAMERA_ORDER, type Mode, type HudState, type RunStats, type CameraPreset } from './game';
import { RUN_MODES, eventFor, HIGH_SPEED_THRESHOLD, type RunMode } from './run.mjs';
import { bestFor } from './records.mjs';
import { RANKS, SCENARIOS, rankFor, type ScenarioId } from './ranked.mjs';
import { rankBadge } from './rank-badges';
import { SEASON_TIERS, PREMIUM_TIERS, PREMIUM_PASS_PRICE, currentSeasonPass, seasonLabel } from './season-pass.mjs';
import { CAR_PRICES, UPGRADE_PRICES, earnedCar, missingCarPrerequisite, upgradeLevels, effectiveUpgrades, tunePrice, emptyProgression, type Upgrade } from './progression.mjs';
import { CARS, getCar, PAINT_COLORS, type CarId } from './catalog';
import { GameAudio } from './audio';
import { hexToNumber, sanitizePaints } from './paint.mjs';
import { BODY_FITS } from './body-kits';
import { isDriftCar } from './drift.mjs';
import { createRaceMap, raceGaps, lapComparison, rearProximity, type RaceMap } from './race-hud.mjs';
import { getTrack, type TrackId } from './circuit.mjs';
import { LIVERIES } from './livery';
import { performanceStats } from './car-performance.mjs';
import { LIVERY_OPTIONS } from './content/cosmetics.mjs';
import { CAR_CONTENT } from './content/cars.mjs';
import { BODY_PARTS, DEFAULT_CUSTOMIZATION, sanitizeCustomization, sanitizeCustomizations, type Customization } from './customization.mjs';

createIcons({ icons: { Trophy, Volume2, VolumeX, HelpCircle, Pause, Play, Route, Zap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Home, Camera, AlertTriangle, SunMoon, Clock, Cloud, CloudSun, Mountain, Timer, Target, Gauge, SlidersHorizontal, Monitor, Settings } });

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
type Currency = 'coin' | 'credit' | 'gem';
// Values are numeric and labels are fixed; the accessible name spells out
// the currency while the visual UI uses distinct flat 2D icons.
function currency(n:number, kind:Currency, prefix='') {
  const label=kind==='coin'?'coins':kind==='credit'?'credits':'gems';
  return `<span class="currency" aria-label="${prefix}${fmt(n)} ${label}"><span aria-hidden="true">${prefix}${fmt(n)}</span><i class="currency-icon currency-${kind}" title="${label}" aria-hidden="true"></i></span>`;
}

const audio = new GameAudio();
(window as any).__audio = audio; // test/debug hook
let game: OvertakeGame;
let library: ModelLibrary;
let selected: CarId = 'golf';
let helpPaused = false;
let paints: Record<string, string> = {};
let customizations: Record<string, Customization> = {};
let frontScreen: 'menu' | 'garage' = 'menu';
let rearKeyboardHeld=false, rearButtonKeyHeld=false, rearPointerId:number|null=null;
function updateRearControl() {
  const held=rearKeyboardHeld || rearButtonKeyHeld || rearPointerId!==null;
  game.setLookBehind(held);
  $('look-behind').setAttribute('aria-pressed',String(game.getLookBehind()));
}
function clearRearControl() {
  rearKeyboardHeld=false;rearButtonKeyHeld=false;rearPointerId=null;
  game.setLookBehind(false);$('look-behind').setAttribute('aria-pressed','false');
}
function updateRearProximity(race:HudState['race']) {
  const distance=race ? rearProximity(race.player.progress,race.rivals,getTrack(race.track).length) : null;
  const label=$('rear-proximity');label.classList.toggle('hidden',distance===null);
  label.textContent=distance===null?'':`${Math.max(1,Math.round(distance))}m BACK`;
  $('look-behind').classList.toggle('rear-near',distance!==null && distance<15);
}

let raceMap:RaceMap|null=null, raceMapTrack:TrackId|null=null;
let lastRacePosition:number|null=null, lastRaceCountdown:number|null=null, lastRaceLapCount=0, raceFeedbackUntil=0;
function resetRaceHud() {
  raceMap=null;raceMapTrack=null;lastRacePosition=null;lastRaceCountdown=null;lastRaceLapCount=0;raceFeedbackUntil=0;
  $('race-map').classList.add('hidden');$('race-feedback').classList.add('hidden');
}
function updateRaceHud(race:NonNullable<HudState['race']>,elapsed:number) {
  $('race-map').classList.remove('hidden');
  if(raceMapTrack!==race.track || !raceMap) {
    raceMap=createRaceMap(race.track);raceMapTrack=race.track;
    $('race-map-route').setAttribute('d',raceMap.path);$('race-map-shadow').setAttribute('d',raceMap.path);
    $('race-map-start').setAttribute('cx',String(raceMap.start.x));$('race-map-start').setAttribute('cy',String(raceMap.start.y));
    const container=$('race-map-rivals');container.replaceChildren();
    race.rivals.forEach(()=>{const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','2.7');dot.setAttribute('class','race-map-rival');container.appendChild(dot);});
  }
  const setMarker=(el:Element,marker:{progress:number;offset:number})=>{const p=raceMap!.marker(marker.progress,marker.offset);el.setAttribute('cx',p.x.toFixed(1));el.setAttribute('cy',p.y.toFixed(1));};
  setMarker($('race-map-player'),race.player);
  race.rivals.forEach((r,i)=>{const dot=$('race-map-rivals').children[i];if(dot)setMarker(dot,r);});
  $('race-map-lap').textContent=`LAP ${race.lap}/${race.laps}`;
  const track=getTrack(race.track), gaps=raceGaps(race.player.progress,race.rivals,track.length*track.laps);
  $('race-gap-ahead').textContent=gaps.ahead ? `AHEAD ${gaps.ahead.finished?'FINISHED':`${Math.round(gaps.ahead.distance)}m`}` : 'AHEAD —';
  $('race-gap-behind').textContent=gaps.behind ? `BEHIND ${Math.round(gaps.behind.distance)}m` : 'BEHIND —';
  if(lastRaceCountdown!==null && race.countdown<=0 && lastRaceCountdown>0)audio.raceCountdown(true);
  else if(race.countdown>0 && (lastRaceCountdown===null || Math.ceil(lastRaceCountdown)>Math.ceil(race.countdown)))audio.raceCountdown(false);
  lastRaceCountdown=race.countdown;
  const position=race.position;
  const lap=lapComparison(race.lapTimes),notice=$('race-feedback');
  if(lap && race.lapTimes.length>lastRaceLapCount) {
    const delta=lap.delta===null?'':` · ${lap.delta<0?'−':'+'}${Math.abs(lap.delta).toFixed(2)}s`;
    notice.textContent=`LAP ${lap.lap} · ${formatTime(lap.time)}${delta}${lap.best && lap.delta!==null?' · BEST':''}`;
    notice.classList.toggle('gained',lap.best);notice.classList.remove('hidden');raceFeedbackUntil=elapsed+3;
  } else if(lastRacePosition!==null && race.countdown<=0 && position!==lastRacePosition) {
    const gained=position<lastRacePosition;
    notice.textContent=`${gained?'POSITION GAINED':'POSITION LOST'} · P${position}`;
    notice.classList.toggle('gained',gained);notice.classList.remove('hidden');raceFeedbackUntil=elapsed+2;
  }
  lastRaceLapCount=race.lapTimes.length;lastRacePosition=position;
  if(elapsed>raceFeedbackUntil) $('race-feedback').classList.add('hidden');
  const length=getTrack(race.track).length,s=((race.player.progress%length)+length)%length;
  const startProximity=Math.min(s,length-s);
  const nearest=race.rivals.reduce<{gap:number;speed:number}>((best,r)=>{
    const diff=Math.abs(((r.progress-race.player.progress+length/2)%length+length)%length-length/2);
    const gap=Math.hypot(diff,r.offset-race.player.offset);
    return gap<best.gap?{gap,speed:r.speed}:best;
  },{gap:Infinity,speed:0});
  audio.raceAmbience(true,Math.max(0,1-startProximity/180),Math.max(0,1-nearest.gap/75),nearest.speed);
}


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
function loadPaints(dev = false) {
  try {
    paints = sanitizePaints(JSON.parse(localStorage.getItem(dev ? 'overtake-paints-dev' : 'overtake-paints') ?? (dev ? localStorage.getItem('overtake-paints') : null) ?? '{}'), CAR_CONTENT.map((c) => c.id));
    if (!paints['aventador-game'] && paints.aventador) paints['aventador-game'] = paints.aventador;
  } catch { paints = {}; }
}

function loadCustomizations(dev = false) {
  try { customizations = sanitizeCustomizations(JSON.parse(localStorage.getItem(dev ? 'overtake-customization-dev-v1' : 'overtake-customization-v1') ?? (dev ? localStorage.getItem('overtake-customization-v1') : null) ?? '{}'), CAR_CONTENT.map(c => c.id)); if (!customizations['aventador-game'] && customizations.aventador) customizations['aventador-game'] = { ...customizations.aventador }; }
  catch { customizations = {}; }
}
function currentCustomization() { return sanitizeCustomization(customizations[selected] ?? DEFAULT_CUSTOMIZATION); }
// Keep native selects as the single source of truth while presenting their
// choices as visible buttons instead of stacked popup menus.
const workshopPages = new Map<string, number>();
function syncWorkshopChoices() {
  const progress = game.getProgression();
  document.querySelectorAll<HTMLSelectElement>('#custom-panel select').forEach(select => {
    const isRim = select.id === 'custom-rim';
    const part = select.id.replace(/^custom-/, '');
    const isBody = BODY_PARTS.some(p => p === part);
    if (!isRim && !isBody) {
      const key = ({'custom-paint-scheme':'paintScheme','custom-secondary-finish':'secondaryFinish','custom-livery':'livery'} as Record<string,string>)[select.id]
        ?? select.id.replace(/^custom-/, '').replace(/-finish$/, 'Finish');
      for (const option of Array.from(select.options)) {
        const base=option.dataset.baseLabel ?? option.text; option.dataset.baseLabel=base;
        const price=tunePrice(key,option.value), owned=progress.tunes[selected]?.includes(`${key}:${option.value}`);
        option.textContent=`${base}${price ? progress.dev ? ' · DEV' : owned ? ' · Owned' : ` · ${fmt(price)} gems` : ''}`;
      }
      return;
    }
    select.hidden = true;
    let group = select.parentElement?.nextElementSibling as HTMLElement | null;
    if (!group?.classList.contains('workshop-choices')) {
      group = document.createElement('div'); group.className = 'workshop-choices';
      group.setAttribute('role','group'); group.setAttribute('aria-label',select.getAttribute('aria-label') || `${part} options`);
      select.parentElement!.after(group);
    }
    const options = Array.from(select.options);
    const key = isRim ? 'rim' : part;
    const pageSize = 4;
    const maxPage = Math.max(0,Math.ceil(options.length/pageSize)-1);
    const selectedPage=Math.max(0,Math.floor(options.findIndex(option=>option.value===select.value)/pageSize));
    const currentPage = Math.min(workshopPages.get(select.id) ?? selectedPage,maxPage);
    workshopPages.set(select.id,currentPage);
    // Hidden panels wait until opened before creating expensive 3D previews.
    const panel = select.closest<HTMLElement>('[data-part-panel], [data-workshop-panel]');
    const active = !!panel && !panel.hidden && !panel.closest<HTMLElement>('[data-workshop-panel]')?.hidden;
    group.replaceChildren();
    const cards = document.createElement('div'); cards.className='workshop-card-grid';
    for (const option of options.slice(currentPage*pageSize,(currentPage+1)*pageSize)) {
      const button=document.createElement('button'); button.type='button'; button.className='workshop-card';
      button.dataset.value=option.value; button.disabled=select.disabled;
      button.setAttribute('aria-pressed',String(option.value===select.value));
      const price=tunePrice(key,option.value), owned=progress.tunes[selected]?.includes(`${key}:${option.value}`);
      const name=document.createElement('strong'); name.textContent=option.text;
      const badge=document.createElement('small'); badge.innerHTML=price ? progress.dev ? 'DEV' : owned ? 'OWNED' : currency(price,'gem') : option.value === 'stock' ? 'FACTORY' : 'FREE';
      const image=document.createElement('div'); image.className='workshop-card-image';
      if(option.value==='stock') image.textContent='FACTORY';
      else if(active) { const img=document.createElement('img'); img.alt=''; img.src=library.workshopThumbnail(selected,key,option.value); image.append(img); }
      button.append(image,name,badge);
      button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));});
      cards.append(button);
    }
    group.append(cards);
    if(maxPage>0) {
      const nav=document.createElement('div');nav.className='workshop-card-pager';
      const prev=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
      prev.type=next.type='button';prev.textContent='‹';next.textContent='›';prev.setAttribute('aria-label',`Previous ${part} options`);next.setAttribute('aria-label',`Next ${part} options`);
      prev.disabled=currentPage===0;next.disabled=currentPage===maxPage;label.textContent=`${currentPage+1} / ${maxPage+1}`;
      prev.addEventListener('click',()=>{workshopPages.set(select.id,currentPage-1);syncWorkshopChoices();});
      next.addEventListener('click',()=>{workshopPages.set(select.id,currentPage+1);syncWorkshopChoices();});
      nav.append(prev,label,next);group.append(nav);
    }
  });
}
function syncCustomizationUI() {
  const config = currentCustomization();
  $('custom-car-name').textContent = `${getCar(selected).maker} ${getCar(selected).name}`;
  $('custom-balance').innerHTML = currency(game.getProgression().gems,'gem');
  const bodywork = !!BODY_FITS[selected];
  const bodyTab = document.querySelector<HTMLButtonElement>('[data-workshop-tab="body"]')!;
  bodyTab.hidden = !bodywork;
  for (const part of BODY_PARTS) { const tab = document.querySelector<HTMLButtonElement>(`[data-workshop-part="${part}"]`); if (tab) tab.hidden = !bodywork; }
  $('stock-bodywork-note').classList.toggle('hidden', bodywork);
  if (!bodywork && bodyTab.getAttribute('aria-pressed') === 'true') document.querySelector<HTMLButtonElement>('[data-workshop-tab="paint"]')!.click();
  for (const part of BODY_PARTS) {
    const select = $(`custom-${part}`) as HTMLSelectElement;
    const labels = part === 'hood' ? ['Street vents','Race scoop'] : part === 'roof' ? ['Shark fin','Race fins'] : BODY_FITS[selected]?.labels[part] ?? ['Stock only', 'Stock only'];
    const golfLabels:Partial<Record<string,string[]>> = {
      front:['25th-inspired chin','Touring chin','Sport chin','Cup chin'],
      rear:['25th-inspired valance','Touring valance','Sport diffuser','Cup diffuser'],
      skirts:['25th-inspired sills','Touring sills','Sport sills','Cup sills'],
    };
    const named=selected==='golf' ? golfLabels[part] : undefined;
    const options = [['stock','Factory'], ['street',named?.[0] ?? labels[0]], ['touring',named?.[1] ?? 'Touring'], ['sport',named?.[2] ?? 'Sport'], ['track',named?.[3] ?? labels[1]]];
    if(selected==='golf') {
      const extra:Partial<Record<string,string[][]>>={front:[['golf-wide','Extended front'],['golf-splitter','Canard splitter']],skirts:[['golf-superwide','Superwide spike skirts']],rear:[['golf-r32','R32-inspired full rear'],['golf-clean','Clean full rear'],['golf-diffuser','Seven-fin diffuser']],spoiler:[['golf-wing','High roof wing']],exhaust:[['golf-quad-flame','Quad afterfire']],hood:[['golf-vented','Twin louver hood'],['golf-rally','Rally scoop hood']],roof:[['golf-roof-scoop','Roof air scoop'],['golf-roof-vents','Twin roof vents']]};
      options.push(...(extra[part] ?? []));
    }
    if(selected==='mercedes') { const extra:Partial<Record<string,string[][]>>={front:[['mercedes-aero','Executive lower fascia'],['mercedes-splitter','Canard splitter fascia']],rear:[['mercedes-clean','Clean rear fascia'],['mercedes-diffuser','Touring diffuser rear']],skirts:[['mercedes-wide','Superwide spike skirts']]};options.push(...(extra[part]??[])); }
    if(selected==='audi') { const extra:Partial<Record<string,string[][]>>={front:[['audi-aero','Avant aero fascia'],['audi-splitter','Canard splitter fascia']],rear:[['audi-clean','Clean rear valance'],['audi-diffuser','Sport diffuser valance']],skirts:[['audi-wide','Superwide spike skirts']]};options.push(...(extra[part]??[])); }
    if (part === 'exhaust') options.push(['flame','Afterfire flames']);
    select.replaceChildren(...options.map(([value,label]) => {
      const option=document.createElement('option'); option.value=value; option.textContent=label; return option;
    }));
    select.value = config[part];
    const finish = $(`custom-${part}-finish`) as HTMLSelectElement;
    finish.value = config[`${part}Finish`]; finish.disabled = config[part] === 'stock';
  }
  for(const part of ['front','rear','skirts','spoiler','hood','roof'] as const) {
    const input=$(`custom-${part}-color`) as HTMLInputElement;
    input.value=config[`${part}Color`] || paints[selected] || getCar(selected).color;
    input.disabled=part!=='hood' && part!=='roof' && config[part]==='stock' && !(selected==='golf' && ['front','rear','skirts'].includes(part));
    const reset=document.querySelector<HTMLButtonElement>(`[data-part-color-reset="${part}"]`)!;
    reset.disabled=!config[`${part}Color`];
  }
  $('golf-door-colors').classList.toggle('hidden',selected!=='golf');
  for(const [id,key] of [['left-front','leftFrontDoorColor'],['right-front','rightFrontDoorColor'],['left-rear','leftRearDoorColor'],['right-rear','rightRearDoorColor']] as const) {
    ($(`custom-${id}-door-color`) as HTMLInputElement).value=config[key] || paints[selected] || getCar(selected).color;
    document.querySelector<HTMLButtonElement>(`[data-door-color-reset="${key}"]`)!.disabled=!config[key];
  }
  ($('custom-primary-color') as HTMLInputElement).value=paints[selected] ?? getCar(selected).color;
  ($('custom-paint-scheme') as HTMLSelectElement).value=config.paintScheme;
  ($('custom-secondary-color') as HTMLInputElement).value=config.secondaryColor;
  ($('custom-secondary-color') as HTMLInputElement).disabled=config.paintScheme==='single' || config.secondaryFinish==='carbon';
  ($('custom-secondary-finish') as HTMLSelectElement).value=config.secondaryFinish;
  ($('custom-secondary-finish') as HTMLSelectElement).disabled=config.paintScheme==='single';
  const livery = $('custom-livery') as HTMLSelectElement;
  livery.replaceChildren(...LIVERY_OPTIONS.map(item => {
    const option=document.createElement('option'); option.value=item.id;
    option.textContent=item.fittedLabel === null ? item.label : LIVERIES[selected].labels[item.fittedLabel];
    return option;
  }));
  livery.value=config.livery;
  const liveryColor=$('custom-livery-color') as HTMLInputElement;
  liveryColor.value=config.liveryColor;liveryColor.disabled=config.livery==='none';
  ($('custom-rim') as HTMLSelectElement).value=config.rim;
  ($('custom-rim-color') as HTMLInputElement).value=config.rimColor || '#bbc2cb';
  ($('custom-tire-width') as HTMLSelectElement).value=config.tireWidth;
  ($('custom-tire-profile') as HTMLSelectElement).value=config.tireProfile;
  ($('custom-afterfire') as HTMLInputElement).checked=config.afterfire || config.exhaust==='flame' || config.exhaust==='golf-quad-flame' || (selected==='golf' && config.exhaust==='sport');
  ($('custom-afterfire') as HTMLInputElement).disabled=config.exhaust==='flame' || config.exhaust==='golf-quad-flame' || (selected==='golf' && config.exhaust==='sport');
  ($('custom-remove-plates') as HTMLInputElement).checked=config.removePlates;
  ($('custom-flame-color') as HTMLInputElement).value=config.flameColor;
  ($('custom-diffuser-color') as HTMLInputElement).value=config.rearDiffuserColor || '#4b5357';
  $('golf-diffuser-color-row').classList.toggle('hidden',selected!=='golf');
  $('custom-diffuser-reset').classList.toggle('hidden',selected!=='golf');
  ($('custom-headlights') as HTMLSelectElement).value=config.headlights;
  ($('custom-taillights') as HTMLSelectElement).value=config.taillights;
  ($('custom-mirrors') as HTMLSelectElement).value=config.mirrors;
  for(const id of ['golf-tire-profile-row','golf-headlights-row','golf-taillights-row','golf-mirrors-row']) $(id).classList.toggle('hidden',selected!=='golf');
  $('custom-plate-row').classList.toggle('hidden',selected!=='golf' && selected!=='mercedes');
  ($('custom-glow-enabled') as HTMLInputElement).checked = config.underglow;
  const color = $('custom-glow-color') as HTMLInputElement;
  color.value = config.glowColor; color.disabled = !config.underglow;
  syncWorkshopChoices();
}
function applyCustomization(value: Customization) {
  const config = sanitizeCustomization(value), current = currentCustomization();
  if (!BODY_FITS[selected]) for (const part of BODY_PARTS) config[part] = 'stock';
  for (const key of Object.keys(config) as (keyof Customization)[]) {
    if (config[key] === current[key]) continue;
    const option = key === 'underglow' || key === 'afterfire' ? (config[key] ? 'on' : 'off') : String(config[key]);
    if (!game.purchaseTune(selected, key, option)) {
      $('tune-message').innerHTML = `Not enough gems. This option costs ${currency(tunePrice(key, option),'gem')}.`;
      syncCustomizationUI(); return;
    }
  }
  customizations[selected] = config;
  try { localStorage.setItem(game.getProgression().dev ? 'overtake-customization-dev-v1' : 'overtake-customization-v1', JSON.stringify(customizations));
    $('tune-message').textContent = game.getProgression().dev ? 'Dev customization saved on this device.' : 'Customization saved on this device. Purchased options can be reused free.';
  } catch { $('tune-message').textContent = 'Could not save customization on this device.'; }
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
  try { localStorage.setItem(game.getProgression().dev ? 'overtake-paints-dev' : 'overtake-paints', JSON.stringify(paints)); } catch { $('tune-message').textContent = 'Could not save paint on this device.'; }
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
    $('car-requirement').innerHTML = `Paint costs ${currency(5,'gem')}. Complete quests to earn gems.`;
    $('tune-message').innerHTML = `Paint costs ${currency(5,'gem')}. Complete quests to earn gems.`;
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

function updateDetail(id: CarId) {
  const c = getCar(id);
  $('d-maker').textContent = c.maker;
  $('d-name').textContent = c.name;
  $('d-class').textContent = `${c.klass}${isDriftCar(id) ? ' · DRIFT' : ''} · ${c.rarity.toUpperCase()} · TIER ${c.unlockTier}`;
  $('d-class').dataset.rarity = c.rarity.toLowerCase();
  $('d-tagline').textContent = c.tagline;
  document.querySelectorAll<HTMLButtonElement>('.car-card').forEach((b) => {
    const active = b.dataset.car === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  syncPaintUI(id);
  syncProgressionUI();
}

function syncTopWallet() {
  if (!game) return;
  const p=game.getProgression();
  $('top-wallet').innerHTML=`${currency(p.coins,'coin')} ${currency(p.credits,'credit')} ${currency(p.gems,'gem')}`;
}

function syncProgressionUI() {
  if (!game) return;
  const progress = game.getProgression();
  syncTopWallet();
  const stats = performanceStats(getCar(selected), effectiveUpgrades(progress, selected), library.getCustomization(selected).tireWidth);
  $('stat-speed').textContent = String(Math.round(stats.topSpeed * 3.6));
  $('stat-accel').textContent = stats.sprint === null ? '—' : stats.sprint.toFixed(1);
  $('stat-braking').textContent = stats.brakingDistance.toFixed(1);
  $('stat-grip').textContent = stats.grip.toFixed(2);
  $('stat-bonus').textContent = stats.bonus.toFixed(2);
  $('progress-xp').innerHTML = `${currency(progress.coins,'coin')} ${currency(progress.credits,'credit')} ${currency(progress.gems,'gem')}`;
  $('progress-next').innerHTML = `<i class="currency-icon currency-coin" title="Coins" aria-label="Coins"></i> upgrades · <i class="currency-icon currency-credit" title="Credits" aria-label="Credits"></i> cars · <i class="currency-icon currency-gem" title="Gems" aria-label="Gems"></i> cosmetics &amp; pass`;
  const dev = $('dev-toggle') as HTMLButtonElement;
  dev.textContent = `Dev options: ${progress.dev ? 'ON' : 'OFF'}`;
  dev.setAttribute('aria-pressed', String(progress.dev));
  const owned = earnedCar(progress, selected), available = game.canDrive(selected);
  const prerequisite = owned ? null : missingCarPrerequisite(progress, selected);
  const requirement = prerequisite ? `Unlock ${getCar(prerequisite).maker} ${getCar(prerequisite).name} first` : currency(CAR_PRICES[selected],'credit');
  $('car-requirement').innerHTML = owned ? 'Owned' : progress.dev ? `Dev preview · ${requirement}` : prerequisite ? requirement : `Ready to unlock · ${requirement}`;
  const buy = $('buy-car') as HTMLButtonElement;
  buy.classList.toggle('hidden', owned);
  buy.innerHTML = `Buy car · ${currency(CAR_PRICES[selected],'credit')}`;
  buy.disabled = prerequisite !== null || progress.credits < CAR_PRICES[selected];
  const eligible=game.canEnterSelectedRace();
  if (available && !eligible) $('car-requirement').textContent='Choose a drift car for this track';
  ($('btn-start') as HTMLButtonElement).disabled = !available || !eligible;
  ($('btn-customize') as HTMLButtonElement).disabled = !available;
  document.querySelectorAll<HTMLButtonElement>('.paint-swatch').forEach(button => { button.disabled = !available; });
  ($('paint-custom') as HTMLInputElement).disabled = !available;
  ($('paint-reset') as HTMLButtonElement).disabled = !available;
  const startLabel = !available ? 'Buy car to drive' : !eligible ? 'Choose a drift car' : game.getRunMode() === 'ranked' ? 'Start ranked race' : 'Start engine';
  $('start-label').textContent = startLabel;
  $('menu-start-label').textContent = !available ? 'LOCKED' : !eligible ? 'DRIFT CAR NEEDED' : 'PLAY';
  ($('menu-start') as HTMLButtonElement).disabled = !available || !eligible;
  ($('menu-mobile-start') as HTMLButtonElement).disabled = !available || !eligible;
  $('menu-mobile-start-label').textContent = !available ? 'LOCKED' : !eligible ? 'DRIFT CAR NEEDED' : 'PLAY';
  $('menu-car-name').textContent = `${getCar(selected).maker} ${getCar(selected).name}`;
  $('menu-car-status').textContent = `${isDriftCar(selected) ? 'DRIFT CAR · ' : ''}${owned ? 'OWNED' : progress.dev ? 'DEV ACCESS' : 'NOT OWNED'}`;
  document.querySelectorAll<HTMLButtonElement>('.car-card').forEach(card => {
    const id = card.dataset.car as CarId, hasCar = earnedCar(progress, id);
    const status = card.querySelector<HTMLElement>('.cc-unlock')!;
    const missing=hasCar ? null : missingCarPrerequisite(progress,id), spec=getCar(id);
    status.innerHTML = hasCar ? 'Owned' : missing ? `Unlock ${getCar(missing).name} first` : currency(CAR_PRICES[id],'credit');
    const rarity=card.querySelector<HTMLElement>('.cc-rarity')!;rarity.textContent=`${spec.rarity} · T${spec.unlockTier}`;rarity.dataset.rarity=spec.rarity.toLowerCase();
    card.classList.toggle('locked', !hasCar);
    if(isDriftCar(id)) rarity.textContent += ' · DRIFT';
    card.setAttribute('aria-label', `${getCar(id).maker} ${getCar(id).name}, ${spec.rarity}, tier ${spec.unlockTier}, ${status.querySelector('.currency')?.getAttribute('aria-label') ?? status.textContent}`);
  });
  const levels = upgradeLevels(progress, selected);
  const list = $('upgrade-list'); list.replaceChildren();
  for (const [key, name, effect] of [['engine','Engine','+8% acceleration, +4% top speed'],['tires','Tires','+6% grip'],['brakes','Brakes','+10% braking']] as [Upgrade,string,string][]) {
    const level = levels[key], price = UPGRADE_PRICES[key][level];
    const button = document.createElement('button'); button.type = 'button'; button.dataset.upgrade = key;
    button.innerHTML = `${name} ${level}/3 · ${price === undefined ? 'MAX' : currency(price,'coin')}`;
    button.title = `${effect} per stage${progress.dev ? ' · Dev uses maximum stages temporarily' : ''}`;
    button.disabled = !owned || price === undefined || progress.coins < price;
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
  if (m !== 'gameover') hidePromotion();
  audio.setActive(m === 'driving');
  if(m!=='driving') { clearRearControl(); updateRearProximity(null); }
  if(m==='garage' || m==='gameover') resetRaceHud();
  if (m === 'garage') { syncModeUI(); syncProgressionUI(); syncRankUI(); syncSeasonPassUI(); }
  game.setLobbyPreview(m === 'garage' && frontScreen === 'menu');
  $('main-menu').classList.toggle('hidden', m !== 'garage' || frontScreen !== 'menu');
  if (m !== 'garage') closeLobbyDrawer();
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
  $('settings-actions').classList.add('hidden'); $('btn-settings-menu').setAttribute('aria-expanded', 'false');
  if (m !== 'driving' && m !== 'paused') {
    $('camera-panel').classList.add('hidden');
    $('world-panel').classList.add('hidden');
  }
}

function showFrontScreen(screen: 'menu' | 'garage') {
  if (game.mode !== 'garage') return;
  if (screen === 'menu' && !$('custom-panel').classList.contains('hidden')) showCustomization(false);
  frontScreen = screen;
  if (screen === 'garage') updateCarPage(true);
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

function buildCircuitEventCards() {
  const list=document.querySelector<HTMLElement>('.mode-select')!, ranked=list.querySelector('.ranked-mode-card')!;
  for(const scenario of SCENARIOS) {
    const card=document.createElement('button');card.type='button';card.className='mode-card circuit-event-card';
    card.dataset.mode='circuit';card.dataset.track=scenario.id;
    card.style.backgroundImage=`linear-gradient(90deg,rgba(12,27,40,.94),rgba(12,27,40,.56)),url('${(import.meta as any).env?.BASE_URL ?? '/'}tracks/${scenario.id}.webp')`;
    card.innerHTML=`<span class="mode-name">${scenario.title}</span><span class="mode-desc">${scenario.laps} laps · 5 AI rivals</span><span class="mode-best">${scenario.kind==='drift' ? 'DRIFT CAR REQUIRED' : 'CIRCUIT RACE · NO RP'}</span>`;
    list.insertBefore(card,ranked);
  }
}

function syncModeUI() {
  if (!game) return;
  const mode = game.getRunMode();
  const records = game.getRecords();
  if (mode !== 'ranked' && mode !== 'circuit') $('menu-ranked').classList.add('hidden');
  $('open-tracks').classList.toggle('hidden',mode !== 'circuit' && mode !== 'ranked');
  $('menu-selected-mode').textContent = mode === 'circuit' ? `CIRCUIT · ${game.getCircuitScenario().title.toUpperCase()}` : mode === 'ranked' ? `RANKED · ${game.getRankedScenario().title.toUpperCase()}` : RUN_MODES[mode].label.toUpperCase();
  $('brand-tag').textContent = mode === 'circuit' || mode === 'ranked' ? 'CIRCUIT RACING' : 'HIGHWAY RUN';
  const info = rankFor(game.getRanked().points);
  $('mode-best-ranked').textContent = info.rank.name;
  syncMenuStats();
  $('best-top').textContent = fmt(mode === 'ranked' ? game.getRanked().points : game.getBest());
  document.querySelector('.best-pill')?.setAttribute('title', mode === 'ranked' ? 'Local rank points' : 'Personal best score');
  document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((b) => {
    const active = b.dataset.mode === mode && (mode !== 'circuit' || b.dataset.track === game.getCircuitScenario().id);
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('mode-best-endless').textContent = fmt(bestFor(records, 'endless'));
  $('mode-best-rush').textContent = fmt(bestFor(records, 'rush'));
  $('mode-best-trial').textContent = records.modes.trial.bestTime === null ? '—' : formatTime(records.modes.trial.bestTime);
  $('active-mode-info').textContent = mode === 'circuit' ? `${game.getCircuitScenario().title} · 3 laps · 5 AI rivals · no RP` : RUN_MODES[mode].tagline;
  const recent = records.modes[mode].recent.slice(0, 3);
  $('recent-runs').classList.toggle('hidden', recent.length === 0);
  $('recent-mode').textContent = RUN_MODES[mode].label;
  const list = $('recent-list');
  list.innerHTML = '';
  for (const r of recent) {
    const row = document.createElement('div');
    row.className = 'recent-row';
    const medal = r.medal ? `<span class="medal-dot ${r.medal}"></span>` : '';
    row.innerHTML = `${medal}<span>${(mode === 'trial' || mode === 'ghost') && r.reason === 'distance' ? formatTime(r.elapsed) : fmt(r.score)}</span><small>${(r.distance / 1000).toFixed(1)} km · ${r.overtakes} passed</small>`;
    list.appendChild(row);
  }
}

function syncMenuStats() {
  if (!game) return;
  const records = game.getRecords(), entries = Object.entries(records.modes).filter(([mode]) => mode !== 'ranked');
  const buckets = entries.map(([, bucket]) => bucket);
  const currentBests = entries.filter(([mode, bucket]) => mode !== 'daily' && mode !== 'weekly' && mode !== 'seasonal' || bucket.period === eventFor(mode).period).map(([, bucket]) => bucket);
  const ranked = game.getRanked(), info = rankFor(ranked.points), progress = game.getProgression();
  $('menu-best-score').textContent = fmt(Math.max(0, ...currentBests.map(b => b.bestScore)));
  $('menu-longest').innerHTML = `${(Math.max(0, ...currentBests.map(b => b.bestDistance)) / 1000).toFixed(1)} <small>KM</small>`;
  $('menu-runs').textContent = fmt(buckets.reduce((sum, b) => sum + b.runs, 0) + ranked.attempts);
  $('menu-owned').textContent = `${CARS.filter(car => earnedCar(progress, car.id)).length} / ${CARS.length}`;
  $('menu-rank-badge').innerHTML = rankBadge(info.index);
  $('menu-rank-name').textContent = info.rank.name;
  $('menu-rank-points').textContent = `${fmt(info.points)} RP`;
}
function showGarageTab(tab: string) {
  document.querySelectorAll<HTMLButtonElement>('[data-garage-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.garageTab === tab)));
  for (const section of ['stats', 'upgrades', 'style']) $('garage-' + section).classList.toggle('hidden', section !== tab);
}
function syncSeasonPassUI() {
  const pass=currentSeasonPass(game.getProgression().seasonPass), max=SEASON_TIERS[SEASON_TIERS.length-1].xp;
  $('season-period').textContent=seasonLabel(pass.period);
  $('season-xp').textContent=`${fmt(pass.xp)} / ${fmt(max)} XP`;
  $('season-xp-fill').style.width=`${Math.min(100,pass.xp/max*100)}%`;
  $('season-progress').setAttribute('aria-valuenow',String(pass.xp));
  const upcoming=SEASON_TIERS.find(t=>t.xp>pass.xp);
  $('season-next').textContent=upcoming ? `Next: ${upcoming.label} · ${fmt(upcoming.xp-pass.xp)} XP to go` : 'Reward track complete';
  const progress=game.getProgression();
  $('season-wallet').innerHTML=`${currency(progress.gems,'gem')} available`;
  const buy=$('season-premium-buy') as HTMLButtonElement;
  buy.textContent=pass.premium ? 'PREMIUM ACTIVE THIS SEASON' : `UNLOCK PREMIUM · ${PREMIUM_PASS_PRICE} GEMS`;
  buy.disabled=pass.premium || progress.gems<PREMIUM_PASS_PRICE;
  if (!pass.premium) buy.innerHTML=`UNLOCK PREMIUM · ${currency(PREMIUM_PASS_PRICE,'gem')}`;
  function rewardCard(tier: typeof SEASON_TIERS[number], premium: boolean) {
    const reached=tier.xp<=pass.xp, unlocked=reached && (!premium || pass.premium);
    const item=document.createElement('li');
    item.className=`pass-reward ${premium?'premium-reward':'free-reward'}${unlocked?' earned':''}${!premium || pass.premium?'':' premium-locked'}`;
    const parts=tier.label.split(' · '), car=document.createElement('span'), icon=document.createElement('span'), title=document.createElement('strong'), status=document.createElement('b');
    car.className='reward-car';car.textContent=parts[0];
    icon.className=`reward-symbol ${tier.type==='upgrade'?'upgrade-symbol':''}`;icon.setAttribute('aria-hidden','true');
    const symbols: Record<string,string>={front:'▰',tires:'◎',underglow:'✺',spoiler:'➜',engine:'⚙',hood:'▲',roof:'▥',livery:'✧'};
    icon.textContent=symbols[tier.key] ?? '✦';
    title.textContent=parts.slice(1).join(' · ') || tier.label;
    status.textContent=unlocked?'UNLOCKED':premium && !pass.premium && reached?'NEEDS PREMIUM':`${tier.xp} XP`;
    item.append(car,icon,title,status);return item;
  }
  $('season-premium-list').replaceChildren(...PREMIUM_TIERS.map(tier=>rewardCard(tier,true)));
  $('season-reward-list').replaceChildren(...SEASON_TIERS.map(tier=>rewardCard(tier,false)));
  $('season-tier-markers').replaceChildren(...SEASON_TIERS.map((tier,i)=>{
    const item=document.createElement('li');item.className=tier.xp<=pass.xp?'reached':'';
    item.textContent=String(i+1).padStart(2,'0');item.setAttribute('aria-label',`Tier ${i+1}, ${tier.xp} XP`);return item;
  }));
}

let rankTrackPage=0;
function syncRankUI() {
  if (!game) return;
  const ranked = game.getRunMode() === 'ranked';
  const state = game.getRanked(), info = rankFor(state.points), selectedScenario = ranked ? game.getRankedScenario() : game.getCircuitScenario();
  const hero = $('rank-hero'); hero.style.setProperty('--rank-color', info.rank.color); hero.style.setProperty('--rank-glow', info.rank.glow);
  $('rank-badge').innerHTML = rankBadge(info.index); $('rank-name').textContent = info.rank.name;
  $('rank-status').textContent = game.getProgression().dev ? 'DEV PREVIEW · NO RANK POINTS' : 'LOCAL RANKED · AI RACING';
  $('rank-points').textContent = fmt(state.points); $('rank-progress-fill').style.width = `${info.progress * 100}%`;
  $('rank-next').textContent = info.next ? `${fmt(info.next.min - state.points)} RP to ${info.next.name}` : 'Top rank reached';
  const list = $('rank-scenarios'); list.replaceChildren();
  rankTrackPage=Math.max(0,Math.min(Math.ceil(SCENARIOS.length/3)-1,rankTrackPage));
  for (const [index,scenario] of SCENARIOS.entries()) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.scenario = scenario.id;
    button.className = `rank-scenario${scenario.id === selectedScenario.id ? ' active' : ''}`;
    button.classList.toggle('hidden',Math.floor(index/3)!==rankTrackPage);
    button.setAttribute('aria-pressed', String(scenario.id === selectedScenario.id));
    const best = state.scenarios[scenario.id];
    button.innerHTML = `<span class="track-photo" style="background-image:url('/tracks/${scenario.id}.webp')" aria-hidden="true"></span><span class="track-copy"><span class="rank-scenario-top"><span>${scenario.kicker}</span><span>${scenario.kind==='drift'?'DRIFT':'RACE'}</span></span><strong>${scenario.title}</strong><small>${scenario.laps} laps · ${(scenario.distance / scenario.laps / 1000).toFixed(2)} km · ${scenario.objective}</small><small>${ranked ? `1st +40 · 2nd +28 · 3rd +18 RP${best?.bestTime ? ` · Best ${formatTime(best.bestTime)}` : ''}` : '5 AI rivals · no RP'}</small></span>`;
    button.addEventListener('click', () => { if(ranked) game.setRankedScenario(scenario.id as ScenarioId); else game.setCircuitScenario(scenario.id as ScenarioId); syncModeUI(); syncRankUI(); syncProgressionUI(); list.querySelector<HTMLButtonElement>(`[data-scenario="${scenario.id}"]`)?.focus(); audio.click(); });
    list.appendChild(button);
  }
  $('rank-track-page').textContent=`${rankTrackPage+1} / ${Math.ceil(SCENARIOS.length/3)}`;
  ($('rank-track-prev') as HTMLButtonElement).disabled=rankTrackPage===0;
  ($('rank-track-next') as HTMLButtonElement).disabled=rankTrackPage>=Math.ceil(SCENARIOS.length/3)-1;
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
  updateRearProximity(h.race);
  if(h.race) updateRaceHud(h.race,h.elapsed);
  else { $('race-map').classList.add('hidden');$('race-feedback').classList.add('hidden');audio.raceAmbience(false,0); }
  $('hud-score').textContent = fmt(h.score);
  $('speed-bonus-active').classList.toggle('hidden', h.speed <= HIGH_SPEED_THRESHOLD * 3.6);
  $('hud-speed').textContent = String(Math.round(h.speed));
  const maxSpeed = game.getMaxSpeed() * 3.6;
  $('speed-max').textContent = String(Math.round(maxSpeed));
  $('speed-arc').style.strokeDashoffset = String(100 * (1 - Math.min(1, Math.max(0, h.speed / maxSpeed))));
  $('hud-dist').textContent = (h.distance / 1000).toFixed(2);
  $('hud-overtakes').textContent = h.race ? `${h.race.position}/${h.race.total}` : String(h.overtakes);
  $('hud-overtakes-label').textContent = h.race ? 'position' : 'passed';
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
  $('ghost-hud').classList.toggle('hidden', h.runMode !== 'ghost');
  $('ghost-hud').textContent = h.ghostGap === null ? 'LOCAL GHOST · FIRST RUN' : `LOCAL GHOST · ${h.ghostGap >= 0 ? 'AHEAD' : 'BEHIND'} ${Math.abs(Math.round(h.ghostGap))} m`;
  $('mode-rule-hud').classList.toggle('hidden', h.runMode !== 'speed');
  $('mode-rule-hud').textContent = h.speed >= 140 ? 'SPEED BONUS · +50 POINTS / SEC' : 'REACH 140 KM/H · +50 POINTS / SEC';
  $('run-clock').classList.toggle('rush', h.runMode === 'rush');
  $('run-clock').classList.toggle('urgent', h.timeLeft !== null && h.timeLeft <= 15);
  const card = $('contract-card');
  if (h.race) {
    card.classList.remove('hidden'); $('contract-index').textContent = h.runMode==='ranked' ? 'RANKED RACE · OFFLINE' : 'CIRCUIT RACE · OFFLINE';
    $('contract-reward').textContent = `POSITION ${h.race.position}/${h.race.total}`;
    $('contract-title').textContent = h.race.countdown > 0 ? `STARTING IN ${Math.ceil(h.race.countdown)}` : `LAP ${h.race.lap} / ${h.race.laps}`;
    $('contract-desc').textContent = getTrack(h.race.track).name;
    $('contract-fill').style.width = `${h.race.progress*100}%`;
    $('contract-count').textContent = h.race.countdown > 0 ? 'Hold throttle to launch' : h.race.lapTimes.length ? `LAST ${formatTime(h.race.lapTimes[h.race.lapTimes.length-1])} · BEST ${formatTime(Math.min(...h.race.lapTimes))}` : `${Math.round(h.race.progress*100)}% complete`;
  } else if (h.runMode === 'checkpoint') {
    const progress = h.distance % 500;
    card.classList.remove('hidden');
    $('contract-index').textContent = `CHECKPOINT ${Math.floor(h.distance / 500) + 1}`;
    $('contract-reward').textContent = '+15s · +250';
    $('contract-title').textContent = 'Race the clock';
    $('contract-desc').textContent = 'Reach the next 500 m before time runs out';
    $('contract-fill').style.width = `${Math.min(100, progress / 500 * 100)}%`;
    $('contract-count').textContent = `${Math.floor(progress)} / 500 m`;
  } else if (h.contract) {
    card.classList.remove('hidden');
    $('contract-index').textContent = `Quest ${h.contract.index}/${h.contract.total}`;
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
  if(e.kind==='contract' || e.kind==='finish') syncTopWallet();
  if (e.kind === 'contract' || (e.kind === 'finish' && game.getRunMode()!=='circuit' && game.getRunMode()!=='ranked')) {
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
  const eventText = e.text.replace(/\+(\d+) GEMS\b/g, (_match, amount) => currency(Number(amount),'gem','+'));
  div.innerHTML = `${eventText}${e.points ? `<small>+${fmt(e.points)}</small>` : ''}`;
  $('events').appendChild(div);
  setTimeout(() => div.remove(), 1300);
}

let promotionTimer: ReturnType<typeof setTimeout> | undefined;
function hidePromotion() {
  clearTimeout(promotionTimer);
  $('rank-promotion').classList.add('hidden');
}
function showPromotion(index: number) {
  hidePromotion();
  const rank=RANKS[index], panel=$('rank-promotion');
  panel.style.setProperty('--rank-color',rank.color);
  panel.style.setProperty('--rank-glow',rank.glow);
  $('promotion-badge').innerHTML=rankBadge(index);
  $('promotion-name').textContent=rank.name.toUpperCase();
  panel.classList.remove('hidden');
  promotionTimer=setTimeout(hidePromotion, 5500);
}
$('promotion-close').addEventListener('click',hidePromotion);
document.addEventListener('keydown',event=>{if(event.key==='Escape' && !$('rank-promotion').classList.contains('hidden')) {event.preventDefault();event.stopImmediatePropagation();hidePromotion();}},true);

let latestResult: RunStats | null = null;
function onGameOver(s: RunStats) {
  syncTopWallet();
  latestResult = s;
  hidePromotion();
  $('share-status').textContent = s.devRun ? 'Dev run · excluded from personal records' : 'Local result · not globally verified';
  $('final-progress').innerHTML = `${currency(s.coinsGained,'coin','+')} ${currency(s.creditsGained,'credit','+')} ${s.gemsGained ? currency(s.gemsGained,'gem','+') : ''} earned`;
  $('final-score').textContent = fmt(s.score);
  const race=s.racePosition!==null, validLaps=s.raceLapTimes.filter(t=>t>0);
  $('final-overtakes').textContent = race ? (validLaps.length ? formatTime(Math.min(...validLaps)) : '—') : String(s.overtakes);
  $('final-overtakes-label').textContent = race ? 'best lap' : 'overtakes';
  $('final-near').textContent = race ? (validLaps.length ? formatTime(validLaps[validLaps.length-1]) : '—') : String(s.nearMisses);
  $('final-near-label').textContent = race ? 'last lap' : 'near misses';
  const lapPanel=$('race-laps');lapPanel.classList.toggle('hidden',!race || !s.raceLapTimes.length);
  lapPanel.replaceChildren();
  if(race) {
    const best=validLaps.length?Math.min(...validLaps):null;
    s.raceLapTimes.forEach((time,i)=>{
      const item=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');
      label.textContent=`LAP ${i+1}`;value.textContent=time>0?formatTime(time):'—';item.append(label,value);
      if(best!==null && time===best)item.classList.add('best');lapPanel.appendChild(item);
    });
  }
  $('race-celebration').classList.toggle('hidden',!race || s.racePosition!>3);
  $('gameover').classList.toggle('race-podium',race && s.racePosition!<=3);
  $('gameover').classList.toggle('race-result',race);
  if(race) audio.raceFinish(s.racePosition!);
  $('final-dist').textContent = (s.distance / 1000).toFixed(1);
  $('final-top').textContent = String(Math.round(s.topSpeed));
  const ranked = s.ranked;
  $('final-contracts').textContent = s.racePosition !== null ? `${s.racePosition}/6` : `${s.contractsDone}/${s.contractsTotal}`;
  $('final-contract-label').textContent = s.racePosition !== null ? 'race position' : 'contracts';
  const rankPanel = $('final-ranked'); rankPanel.classList.toggle('hidden', !ranked);
  if (ranked) {
    const change = ranked.change, current = change.after;
    rankPanel.style.setProperty('--rank-color', current.rank.color);
    $('final-rank-badge').innerHTML = rankBadge(current.index);
    $('final-rank-label').textContent = `${ranked.scenario.title} · ${current.rank.name.toUpperCase()}`;
    $('final-rank-change').textContent = s.devRun ? '0 RP · DEV PREVIEW' : `${change.delta > 0 ? '+' : ''}${change.delta} RP`;
    if (!s.devRun && current.index > change.before.index) showPromotion(current.index);
    $('final-rank-message').textContent = s.devRun ? 'Dev runs do not affect rank' : current.index > change.before.index ? `PROMOTED TO ${current.rank.name.toUpperCase()}!` : current.index < change.before.index ? `Rank changed to ${current.rank.name}` : `${fmt(current.points)} RP · local, unverified`;
  }
  const rankedBest = ranked ? game.getRanked().scenarios[ranked.scenario.id]?.bestTime ?? null : null;
  const ghostBest = s.mode === 'ghost' ? game.getGhost()?.time ?? null : null;
  $('final-best').textContent = s.mode === 'ghost' ? (ghostBest === null ? '—' : formatTime(ghostBest)) : ranked ? (rankedBest === null ? '—' : formatTime(rankedBest)) : s.mode === 'trial' ? (s.bestTime === null ? '—' : formatTime(s.bestTime)) : fmt(s.best);
  $('final-best-label').textContent = ranked || s.mode === 'trial' || s.mode === 'ghost' ? 'Fastest time' : 'Personal best';
  $('new-best').classList.toggle('hidden', !(s.mode === 'ghost' ? s.ghostNewBest : s.newBest));
  $('best-top').textContent = fmt(ranked ? ranked.change.after.points : s.best);
  $('final-title').textContent = s.racePosition !== null ? `${s.racePosition===1?'VICTORY':s.racePosition<=3?'PODIUM':'RACE FINISHED'} · P${s.racePosition}` : s.reason === 'crash' ? 'Wrecked' : s.reason === 'objective' ? 'Challenge complete' : s.reason === 'distance' ? `Finished · ${formatTime(s.elapsed)}` : s.reason === 'objective_failed' ? 'Objective missed' : 'Time up';
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
  ($('sound-race') as HTMLInputElement).checked = audio.raceSounds;
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

let modePage = 0, carPage = 0;
function carsPerPage() { return window.innerWidth <= 700 && window.innerHeight > window.innerWidth ? 3 : window.innerHeight <= 500 ? 3 : 5; }
function updateCarPage(focusSelected=false) {
  const cards=[...document.querySelectorAll<HTMLButtonElement>('.car-card')], count=carsPerPage(), pages=Math.ceil(cards.length/count);
  if (focusSelected) carPage=Math.floor(Math.max(0,cards.findIndex(card=>card.dataset.car===selected))/count);
  carPage=Math.max(0,Math.min(pages-1,carPage));
  cards.forEach((card,i)=>card.classList.toggle('hidden',Math.floor(i/count)!==carPage));
  $('car-page-label').textContent=`${carPage+1} / ${pages}`;
  ($('car-prev') as HTMLButtonElement).disabled=carPage===0; ($('car-next') as HTMLButtonElement).disabled=carPage===pages-1;
}
function updateModePage() {
  const cards = [...document.querySelectorAll<HTMLButtonElement>('.mode-card')];
  const perPage = 6, pages = Math.ceil(cards.length / perPage);
  modePage = Math.max(0, Math.min(pages - 1, modePage));
  cards.forEach((card, i) => card.classList.toggle('hidden', Math.floor(i / perPage) !== modePage));
  $('mode-page-label').textContent = `${modePage + 1} / ${pages}`;
  ($('mode-prev') as HTMLButtonElement).disabled = modePage === 0;
  ($('mode-next') as HTMLButtonElement).disabled = modePage === pages - 1;
}
function showRankDrawer(open: boolean) {
  $('menu-drive').classList.toggle('hidden',open);
  document.querySelector('.mode-pager')!.classList.toggle('hidden',open);
  $('menu-ranked').classList.toggle('hidden',!open);
  const ranked=game.getRunMode()==='ranked';
  $('rank-hero').classList.toggle('hidden',!ranked); $('rank-road-open').classList.toggle('hidden',!ranked); $('circuit-picker-info').classList.toggle('hidden',ranked);
  $('drawer-title').textContent=open ? (ranked ? 'RANKED RACING' : 'CIRCUIT RACE') : 'GAME MODES';
  if(open) { const selected=ranked ? game.getRankedScenario() : game.getCircuitScenario(); rankTrackPage=Math.floor(SCENARIOS.findIndex(s=>s.id===selected.id)/3); syncRankUI(); }
}
function closeLobbyDrawer() { $('lobby-drawer').classList.add('hidden'); }
function openLobbyDrawer(page: 'modes' | 'stats' | 'season', rank=false) {
  $('lobby-drawer').classList.remove('hidden');
  for(const name of ['modes','stats','season']) $('drawer-'+name).classList.toggle('hidden',name!==page);
  $('drawer-title').textContent=page==='modes'?'GAME MODES':page==='stats'?'YOUR PROFILE':'SEASON PASS';
  if(page==='modes') { updateModePage(); showRankDrawer(rank); }
  if(page==='season') requestAnimationFrame(syncPassScrollControls);
  $('drawer-close').focus();
}
function syncPassScrollControls() {
  const road=$('season-road-viewport'), max=Math.max(0,road.scrollWidth-road.clientWidth);
  ($('pass-scroll-prev') as HTMLButtonElement).disabled=road.scrollLeft<=1;
  ($('pass-scroll-next') as HTMLButtonElement).disabled=road.scrollLeft>=max-1;
}
function bindUI() {
  $('car-prev').addEventListener('click',()=>{carPage--;updateCarPage()});
  $('car-next').addEventListener('click',()=>{carPage++;updateCarPage()});
  window.addEventListener('resize',()=>updateCarPage(true));
  $('open-modes').addEventListener('click',()=>openLobbyDrawer('modes'));
  $('open-tracks').addEventListener('click',()=>{
    if(game.getRunMode()==='ranked') openLobbyDrawer('modes',true);
    else {const cards=[...document.querySelectorAll<HTMLButtonElement>('.mode-card')];modePage=Math.floor(Math.max(0,cards.findIndex(b=>b.dataset.track===game.getCircuitScenario().id))/6);openLobbyDrawer('modes');}
  });
  $('open-stats').addEventListener('click',()=>openLobbyDrawer('stats'));
  $('open-season').addEventListener('click',()=>openLobbyDrawer('season'));
  $('drawer-close').addEventListener('click',closeLobbyDrawer);
  $('lobby-drawer').addEventListener('click',e=>{ if(e.target === $('lobby-drawer')) closeLobbyDrawer(); });
  $('rank-back-to-modes').addEventListener('click',()=>showRankDrawer(false));
  $('rank-track-prev').addEventListener('click',()=>{rankTrackPage--;syncRankUI()});
  $('rank-track-next').addEventListener('click',()=>{rankTrackPage++;syncRankUI()});
  $('mode-prev').addEventListener('click',()=>{modePage--;updateModePage()});
  $('mode-next').addEventListener('click',()=>{modePage++;updateModePage()});
  $('season-road-viewport').addEventListener('scroll',syncPassScrollControls);
  window.addEventListener('resize',syncPassScrollControls);
  $('pass-scroll-prev').addEventListener('click',()=>$('season-road-viewport').scrollBy({left:-400,behavior:'smooth'}));
  $('pass-scroll-next').addEventListener('click',()=>$('season-road-viewport').scrollBy({left:400,behavior:'smooth'}));
  $('season-road-viewport').addEventListener('keydown',(event:KeyboardEvent)=>{
    const road=$('season-road-viewport');
    if(event.key==='Home' || event.key==='End') { event.preventDefault();road.scrollLeft=event.key==='Home'?0:road.scrollWidth; }
    else if(event.key==='ArrowLeft' || event.key==='ArrowRight') { event.preventDefault();road.scrollLeft+=event.key==='ArrowLeft'?-120:120; }
  });
  $('btn-settings-menu').addEventListener('click',()=>{const panel=$('settings-actions');const open=panel.classList.toggle('hidden')===false;$('btn-settings-menu').setAttribute('aria-expanded',String(open));});
  $('btn-start').addEventListener('click', startRun);
  $('menu-start').addEventListener('click', startRun);
  $('menu-mobile-start').addEventListener('click', startRun);
  $('menu-mobile-garage').addEventListener('click', () => showFrontScreen('garage'));
  $('menu-garage').addEventListener('click', () => showFrontScreen('garage'));
  $('garage-back').addEventListener('click', () => showFrontScreen('menu'));
  $('menu-rank-select').addEventListener('click', () => { selectMode('ranked'); openLobbyDrawer('modes', true); });
  $('dev-toggle').addEventListener('click', () => {
    const enabled = !game.getProgression().dev;
    game.setDeveloperMode(enabled);
    {
      loadPaints(enabled); loadCustomizations(enabled);
      for (const car of CARS) { library.setPaint(car.id, paints[car.id] ? hexToNumber(paints[car.id]) : null); library.setCustomization(car.id, customizations[car.id] ?? { ...DEFAULT_CUSTOMIZATION }); void refreshThumbnail(car.id); }
      game.setSelectedCar(selected); syncPaintUI(selected);
    }
    syncProgressionUI(); syncRankUI(); audio.click();
  });
  $('buy-car').addEventListener('click', () => { if (game.purchaseCar(selected)) { syncProgressionUI(); audio.click(); } });
  document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((b) => {
    b.addEventListener('click', () => {
      const mode=b.dataset.mode as RunMode;
      if(mode==='circuit' && b.dataset.track)game.setCircuitScenario(b.dataset.track as ScenarioId);
      selectMode(mode);
      if(mode==='ranked')showRankDrawer(true);else closeLobbyDrawer();
    });
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
    const detail = s.ranked ? `${s.ranked.scenario.title} · ${s.reason === 'distance' ? formatTime(s.elapsed) : 'unfinished'} · ${s.ranked.change.delta > 0 ? '+' : ''}${s.ranked.change.delta} RP` : (s.mode === 'trial' || s.mode === 'ghost') && s.reason === 'distance' ? `3 km in ${formatTime(s.elapsed)}` : `${fmt(s.score)} points · ${(s.distance / 1000).toFixed(1)} km`;
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
    const primary = (s.mode === 'trial' || s.mode === 'ghost' || s.ranked) && s.reason === 'distance' ? formatTime(s.elapsed) : s.ranked ? `${s.ranked.change.delta > 0 ? '+' : ''}${s.ranked.change.delta} RP` : fmt(s.score);
    c.fillText(primary, 72, 290, 700);
    c.fillStyle = '#a9bab6'; c.font = 'bold 24px sans-serif';
    c.fillText(s.ranked ? (s.reason === 'distance' ? `${s.ranked.scenario.title.toUpperCase()} · TIME` : 'RANKED RACING') : (s.mode === 'trial' || s.mode === 'ghost') && s.reason === 'distance' ? '3 KM TIME' : 'POINTS', 76, 330, 700);
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
  $('sound-race').addEventListener('change', e => audio.setRaceSounds((e.target as HTMLInputElement).checked));
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
      syncWorkshopChoices();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-workshop-part]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('[data-workshop-part]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      document.querySelectorAll<HTMLElement>('[data-part-panel]').forEach(panel => { panel.hidden = panel.dataset.partPanel !== button.dataset.workshopPart; });
      syncWorkshopChoices();
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
  for (const [id,key,event] of controls) $(id).addEventListener(event, e => {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    const suggestedColor = key === 'livery' ? LIVERY_OPTIONS.find(item => item.id === value)?.defaultColor : null;
    applyCustomization({ ...currentCustomization(), [key]:value, ...(suggestedColor ? { liveryColor:suggestedColor } : {}) } as Customization);
  });
  for (const [id,key,event] of [['custom-rim','rim','change'],['custom-rim-color','rimColor','change'],['custom-tire-width','tireWidth','change'],['custom-tire-profile','tireProfile','change'],['custom-flame-color','flameColor','change'],['custom-headlights','headlights','change'],['custom-taillights','taillights','change'],['custom-mirrors','mirrors','change']] as const) $(id).addEventListener(event, e => applyCustomization({ ...currentCustomization(), [key]:(e.target as HTMLInputElement | HTMLSelectElement).value } as Customization));
  for(const [id,key] of [['left-front','leftFrontDoorColor'],['right-front','rightFrontDoorColor'],['left-rear','leftRearDoorColor'],['right-rear','rightRearDoorColor']] as const) {
    $(`custom-${id}-door-color`).addEventListener('change',event=>applyCustomization({...currentCustomization(),[key]:(event.target as HTMLInputElement).value}));
    document.querySelector<HTMLButtonElement>(`[data-door-color-reset="${key}"]`)!.addEventListener('click',()=>applyCustomization({...currentCustomization(),[key]:''}));
  }
  for(const part of ['front','rear','skirts','spoiler','hood','roof'] as const) {
    $(`custom-${part}-color`).addEventListener('change',event=>applyCustomization({...currentCustomization(),[`${part}Color`]:(event.target as HTMLInputElement).value}));
    document.querySelector<HTMLButtonElement>(`[data-part-color-reset="${part}"]`)!.addEventListener('click',()=>applyCustomization({...currentCustomization(),[`${part}Color`]:''}));
  }
  $('custom-diffuser-color').addEventListener('change', event => applyCustomization({ ...currentCustomization(), rearDiffuserColor:(event.target as HTMLInputElement).value }));
  $('custom-diffuser-reset').addEventListener('click', () => applyCustomization({ ...currentCustomization(), rearDiffuserColor:'' }));
  $('custom-afterfire').addEventListener('change', event => applyCustomization({ ...currentCustomization(), afterfire:(event.target as HTMLInputElement).checked }));
  $('custom-remove-plates').addEventListener('change', event => applyCustomization({ ...currentCustomization(), removePlates:(event.target as HTMLInputElement).checked }));
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
  const rear=$('look-behind');
  rear.addEventListener('pointerdown',(e:PointerEvent)=>{
    if(game.mode!=='driving' || rearPointerId!==null || (e.pointerType==='mouse' && e.button!==0))return;
    e.preventDefault();rearPointerId=e.pointerId;
    try { rear.setPointerCapture(e.pointerId); } catch { rearPointerId=null; }
    updateRearControl();
  });
  const releaseRear=(e:PointerEvent)=>{if(e.pointerId!==rearPointerId)return;rearPointerId=null;updateRearControl();};
  rear.addEventListener('pointerup',releaseRear);rear.addEventListener('pointercancel',releaseRear);rear.addEventListener('lostpointercapture',releaseRear);
  rear.addEventListener('keydown',(e:KeyboardEvent)=>{if((e.key===' '||e.key==='Enter') && game.mode==='driving'){e.preventDefault();e.stopPropagation();rearButtonKeyHeld=true;updateRearControl();}});
  rear.addEventListener('keyup',(e:KeyboardEvent)=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();rearButtonKeyHeld=false;updateRearControl();}});
  rear.addEventListener('blur',()=>{rearButtonKeyHeld=false;updateRearControl();});

  const keyMap: Record<string, 'throttle' | 'brake' | 'left' | 'right' | 'handbrake'> = {
    ArrowUp: 'throttle', w: 'throttle', W: 'throttle',
    ArrowDown: 'brake', s: 'brake', S: 'brake',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ' ': 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (($('rank-road') as HTMLDialogElement).open) return;
    if (e.key === 'Escape' && !$('lobby-drawer').classList.contains('hidden')) { e.preventDefault(); closeLobbyDrawer(); return; }
    const target = e.target as HTMLElement | null;
    if (e.key === 'Escape' && !$('graphics-panel').classList.contains('hidden')) {
      e.preventDefault(); closeGraphicsPanel(); $(game.mode === 'paused' ? 'btn-pause-graphics' : 'btn-graphics').focus(); return;
    }
    if (e.key === 'Escape' && !$('sound-panel').classList.contains('hidden')) {
      e.preventDefault(); closeSoundPanel(); $(game.mode === 'paused' ? 'btn-pause-sound' : 'btn-sound-settings').focus(); return;
    }
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || (['BUTTON', 'A'].includes(target.tagName) && e.key === 'Enter'))) return;
    if ((e.key==='r' || e.key==='R') && game.mode==='driving') { e.preventDefault();rearKeyboardHeld=true;updateRearControl();return; }
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
    if(e.key==='r' || e.key==='R') {rearKeyboardHeld=false;updateRearControl();}
    const name = keyMap[e.key];
    if (name) { if (game.mode === 'driving') e.preventDefault(); game.setInput(name, false); }
  });
  window.addEventListener('blur', () => {
    clearRearControl();
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
  let dev = false;
  try { dev = JSON.parse(localStorage.getItem('overtake-progression-v2') || '{}').dev === true; } catch { /* malformed save */ }
  loadPaints(dev);
  loadCustomizations(dev);
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

  $('car-count').textContent = `${CARS.length} ${CARS.length === 1 ? 'car' : 'cars'}`;
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
        <div class="cc-rarity" data-rarity="${c.rarity.toLowerCase()}">${c.rarity} · T${c.unlockTier}</div>
        <div class="cc-unlock"></div>
      </div>`;
    btn.addEventListener('click', () => selectCar(c.id));
    cards.appendChild(btn);
  }
  $('load-bar').style.width = '100%';

  try {
    const saved = localStorage.getItem('overtake-car') as CarId | null;
    if (saved === 'aventador') selected = 'aventador-game'; else if (saved && CARS.some((c) => c.id === saved)) selected = saved;
  } catch { /* ignore */ }

  game = new OvertakeGame($('game') as HTMLCanvasElement, library, {
    onHud, onEvent, onGameOver, onMode: setMode,
  });
  (window as any).__overtake = game; // test/debug hook
  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (requestedMode && Object.hasOwn(RUN_MODES, requestedMode)) game.setRunMode(requestedMode as RunMode);
  game.setSelectedCar(selected);
  updateDetail(selected);
  buildCircuitEventCards();
  syncModeUI();
  $('best-top').textContent = fmt(game.getBest());
  syncSoundUI();

  bindUI();
  updateCarPage(true);
  setMode('garage');
  $('loading').classList.add('hidden');
  $('topbar').classList.remove('hidden');
}

void boot();

$('season-premium-buy').addEventListener('click',()=>{ if(game.purchasePremiumPass()){syncSeasonPassUI();syncProgressionUI();audio.click();} });
