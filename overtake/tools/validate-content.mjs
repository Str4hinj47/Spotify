// Fast pre-release checks for data errors and missing content assets.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CAR_CONTENT } from '../src/content/cars.mjs';
import { LIVERY_OPTIONS, PAINT_COLORS, RIM_OPTIONS } from '../src/content/cosmetics.mjs';
import { CONTENT_REVISION } from '../src/content/version.mjs';
import { SEASON_TIERS, PREMIUM_TIERS } from '../src/season-pass.mjs';

const root = new URL('../', import.meta.url);
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const hexPattern = /^#[0-9a-fA-F]{6}$/;
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

export function validateContent({ cars = CAR_CONTENT, liveries = LIVERY_OPTIONS, paints = PAINT_COLORS, revision = CONTENT_REVISION, checkFiles = true } = {}) {
  const errors = [], ids = new Set(), liveryIds = new Set();
  if (!Number.isSafeInteger(revision) || revision < 1) errors.push('Content revision must be a positive integer.');
  if (!Array.isArray(cars) || !cars.length) return ['At least one car is required.'];
  let manifest = {}, sillProfiles = {}, released = {};
  if (checkFiles) {
    try { manifest = JSON.parse(fs.readFileSync(new URL('public/models/manifest.json', root), 'utf8')); }
    catch { errors.push('Cannot read public/models/manifest.json.'); }
    try { sillProfiles = JSON.parse(fs.readFileSync(new URL('src/sill-profiles.json', root), 'utf8')); }
    catch { errors.push('Cannot read src/sill-profiles.json.'); }
    try { released = JSON.parse(fs.readFileSync(new URL('src/content/released-ids.json', root), 'utf8')); }
    catch { errors.push('Cannot read src/content/released-ids.json.'); }
  }
  for (const car of cars) {
    if (!car || typeof car !== 'object') { errors.push('Invalid car entry.'); continue; }
    const id = car?.id, tag = `Car ${String(id)}`;
    if (typeof id !== 'string' || id.length > 64 || !idPattern.test(id) || id === 'semi' || id === 'kraz' || ['camry','mercedes-560','range-rover'].includes(id)) errors.push(`${tag}: ID must be lowercase, URL-safe and not a truck ID.`);
    if (ids.has(id)) errors.push(`${tag}: duplicate ID.`); ids.add(id);
    for (const field of ['name','maker','tagline','klass','collection','credit']) if (!text(car[field])) errors.push(`${tag}: missing or invalid ${field}.`);
    if (!hexPattern.test(car.color ?? '')) errors.push(`${tag}: invalid factory paint.`);
    for (const [field,min,max] of [['price',0,1_000_000_000],['maxSpeed',1,150],['accel',.1,50],['handling',.1,50],['bonus',.1,5],['trafficCruise',1,100],['orientationDegrees',-360,360]]) if (!finite(car[field],min,max)) errors.push(`${tag}: invalid ${field}.`);
    if (!Number.isSafeInteger(car.price)) errors.push(`${tag}: price must be an integer.`);
    if (!Number.isSafeInteger(car.unlockTier) || car.unlockTier<1) errors.push(`${tag}: invalid unlock tier.`);
    if (!['Common','Uncommon','Rare','Epic','Exotic','Legendary'].includes(car.rarity)) errors.push(`${tag}: invalid rarity.`);
    for (const key of ['speed','handling','bonus']) if (!Number.isInteger(car.stats?.[key]) || !finite(car.stats[key],1,5)) errors.push(`${tag}: ${key} rating must be 1–5.`);
    for (const [key,min,max] of [['grip',.1,5],['brake',.1,50],['wheelbase',.5,10],['maxSteer',.01,2],['understeer',0,1],['yawResponse',.1,50],['steerResponse',.1,50],['drag',.00001,.1]]) if (!finite(car.physics?.[key],min,max)) errors.push(`${tag}: invalid physics.${key}.`);
    if (checkFiles && typeof id === 'string' && idPattern.test(id)) {
      const path = `models/${id}.glb`;
      if (manifest[id]?.id !== id || manifest[id]?.file !== path) errors.push(`${tag}: missing or mismatched model manifest entry.`);
      if (car.bodywork !== false && (!sillProfiles[id]?.range || !sillProfiles[id]?.sides)) errors.push(`${tag}: missing sill profile.`);
      try { const data = fs.readFileSync(new URL(`public/${path}`, root)); if (data.length < 12 || data.toString('ascii',0,4) !== 'glTF') errors.push(`${tag}: invalid GLB header.`); }
      catch { errors.push(`${tag}: missing ${path}.`); }
    }
  }
  // Tiers must be contiguous and in showroom order; same-tier variants cost the same.
  let previousTier=0, previousPrice=-1, previousRarity=-1;
  const rarities=['Common','Uncommon','Rare','Epic','Exotic','Legendary'];
  for (const car of cars) {
    const rarity=rarities.indexOf(car.rarity);
    if (car.unlockTier<previousTier || car.unlockTier>previousTier+1 || (car.unlockTier===previousTier ? car.price!==previousPrice : car.price<=previousPrice) || rarity<previousRarity) errors.push(`Car ${car.id}: tiers, prices and rarity must follow showroom order.`);
    previousTier=car.unlockTier;previousPrice=car.price;previousRarity=rarity;
  }
  if (cars[0]?.id!=='golf' || cars[0]?.unlockTier!==1) errors.push('Golf must remain the tier 1 starter.');
  if (!cars.some(car => car?.id === 'golf' && car.price === 0)) errors.push('The free starter car golf must remain in the catalog.');
  if (!Array.isArray(liveries) || !liveries.length) errors.push('At least one livery option is required.');
  else for (const item of liveries) {
    if (!item || typeof item !== 'object') { errors.push('Invalid livery entry.'); continue; }
    const tag = `Livery ${String(item?.id)}`;
    if (typeof item?.id !== 'string' || item.id.length > 64 || !idPattern.test(item.id)) errors.push(`${tag}: invalid ID.`);
    if (liveryIds.has(item?.id)) errors.push(`${tag}: duplicate ID.`); liveryIds.add(item?.id);
    if (!text(item?.label) || !text(item?.collection)) errors.push(`${tag}: label and collection are required.`);
    if (!['none','stripe','race','center','sprint','velocity','heritage','apex','flames'].includes(item?.pattern)) errors.push(`${tag}: unsupported renderer pattern.`);
    if (![null,0,1].includes(item?.fittedLabel)) errors.push(`${tag}: fittedLabel must be null, 0 or 1.`);
    if (!Number.isSafeInteger(item?.price) || !finite(item.price,0,1_000_000_000)) errors.push(`${tag}: invalid price.`);
    if (item?.defaultColor !== null && !hexPattern.test(item?.defaultColor ?? '')) errors.push(`${tag}: invalid default color.`);
  }
  for (const [id,pattern] of [['none','none'],['stripe','stripe'],['race','race']]) if (!Array.isArray(liveries) || !liveries.some(item => item?.id === id && item.pattern === pattern)) errors.push(`Keep legacy livery ${id} with its original pattern for saved games.`);
  if (!Array.isArray(liveries) || liveries.find(item => item?.id === 'none')?.price !== 0) errors.push('The no-livery option must remain free.');
  if (checkFiles) {
    if (!Array.isArray(released.rims) || released.rims.some(id => !RIM_OPTIONS.includes(id)) || RIM_OPTIONS.some(id => !released.rims.includes(id))) errors.push('Rim IDs must match the released ID ledger.');
    try { const rimAsset=fs.readFileSync(new URL('public/models/custom-rims.glb',root)); if(rimAsset.toString('ascii',0,4)!=='glTF') errors.push('Invalid rim GLB.'); }
    catch { errors.push('Missing rim GLB.'); }
    if (released.revision !== revision || !Array.isArray(released.cars) || !released.liveries || typeof released.liveries !== 'object') errors.push('Update the released ID ledger and revision together.');
    else {
      for (const id of released.cars) if (!ids.has(id)) errors.push(`Released car ${id} is missing; never remove IDs used by saves.`);
      for (const id of ids) if (!released.cars.includes(id)) errors.push(`Car ${String(id)} is not in the released ID ledger.`);
      for (const [id,pattern] of Object.entries(released.liveries)) if (!Array.isArray(liveries) || !liveries.some(item => item?.id === id && item.pattern === pattern)) errors.push(`Released livery ${id} is missing or changed pattern.`);
      for (const id of liveryIds) if (!Object.hasOwn(released.liveries,id)) errors.push(`Livery ${String(id)} is not in the released ID ledger.`);
    }
  }
  // Reward IDs must stay meaningful in saves; thresholds must be ordered.
  let lastXp=0;
  for(const reward of SEASON_TIERS) {
    if (!Number.isSafeInteger(reward.xp) || reward.xp<=lastXp || !ids.has(reward.car) || !text(reward.label)) errors.push(`Invalid season reward at ${reward.xp} XP.`);
    if (reward.type==='upgrade' && (!['engine','tires','brakes'].includes(reward.key) || !Number.isInteger(reward.level) || reward.level<1 || reward.level>3)) errors.push(`Invalid season upgrade at ${reward.xp} XP.`);
    else if (reward.type==='tune' && !((['front','rear','skirts','spoiler','exhaust','hood','roof'].includes(reward.key) && ['street','touring','sport','track'].includes(reward.value)) || (reward.key==='underglow' && reward.value==='on'))) errors.push(`Invalid season tune at ${reward.xp} XP.`);
    else if (!['upgrade','tune'].includes(reward.type)) errors.push(`Unknown season reward at ${reward.xp} XP.`);
    lastXp=reward.xp;
  }
  lastXp=0;
  for(const reward of PREMIUM_TIERS) {
    if(reward.type!=='tune' || !Number.isSafeInteger(reward.xp) || reward.xp<=lastXp || !ids.has(reward.car) || !text(reward.label) || !((['front','rear','skirts','spoiler','exhaust','hood','roof'].includes(reward.key) && ['street','touring','sport','track'].includes(reward.value)) || (reward.key==='underglow' && reward.value==='on') || (reward.key==='livery' && liveries.some(l=>l.id===reward.value)))) errors.push(`Invalid or non-cosmetic premium reward at ${reward.xp} XP.`);
    lastXp=reward.xp;
  }
  if (!Array.isArray(paints) || !paints.length) errors.push('At least one paint swatch is required.');
  else for (const paint of paints) if (!text(paint?.name) || !hexPattern.test(paint?.hex ?? '')) errors.push(`Invalid paint swatch: ${String(paint?.name)}.`);
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateContent();
  if (errors.length) { console.error(`Content validation failed:\n- ${errors.join('\n- ')}`); process.exitCode = 1; }
  else console.log(`Content OK: ${CAR_CONTENT.length} cars, ${LIVERY_OPTIONS.length} liveries, ${PAINT_COLORS.length} paint swatches; revision ${CONTENT_REVISION}. Run the TypeScript build and browser checklist as well.`);
}
