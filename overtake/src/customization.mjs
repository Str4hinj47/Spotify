import { normalizeHex } from './paint.mjs';
import { LIVERY_OPTIONS, RIM_OPTIONS } from './content/cosmetics.mjs';

export const BODY_PARTS = ['front', 'rear', 'skirts', 'spoiler', 'exhaust', 'hood', 'roof'];
export const PART_OPTIONS = ['stock', 'street', 'touring', 'sport', 'track'];
export const PAINT_SCHEMES = ['single','upper','lower','roof-only'];
export const GOLF_REAR_OPTIONS = ['golf-r32', 'golf-clean', 'golf-diffuser'];
export const GOLF_PART_OPTIONS = Object.freeze({front:['golf-wide','golf-splitter'],rear:GOLF_REAR_OPTIONS,skirts:['golf-superwide'],spoiler:['golf-wing'],exhaust:['golf-quad-flame'],hood:['golf-vented','golf-rally'],roof:['golf-roof-scoop','golf-roof-vents']});
export const MERCEDES_PART_OPTIONS = Object.freeze({front:['mercedes-aero','mercedes-splitter'],rear:['mercedes-clean','mercedes-diffuser'],skirts:['mercedes-wide']});
export const AUDI_PART_OPTIONS = Object.freeze({front:['audi-aero','audi-splitter'],rear:['audi-clean','audi-diffuser'],skirts:['audi-wide']});
export const DEFAULT_CUSTOMIZATION = Object.freeze({
  front:'stock', rear:'stock', skirts:'stock', spoiler:'stock', exhaust:'stock', hood:'stock', roof:'stock',
  frontFinish:'standard', rearFinish:'standard', skirtsFinish:'standard', spoilerFinish:'standard', exhaustFinish:'standard', hoodFinish:'standard', roofFinish:'standard',
  paintScheme:'single', secondaryColor:'#141b24', secondaryFinish:'paint',
  livery:'none', liveryColor:'#f2f5f7', underglow:false, glowColor:'#00ddff',
  afterfire:false, removePlates:false, rim:'stock', rimColor:'', tireWidth:'standard', tireProfile:'standard', flameColor:'#ff6a1a', headlights:'stock', mirrors:'stock',
});

/** Sanitize untrusted local storage, including older saved configurations. */
export function sanitizeCustomization(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = { ...DEFAULT_CUSTOMIZATION };
  for (const part of BODY_PARTS) {
    if (PART_OPTIONS.includes(raw[part]) || (part === 'exhaust' && raw[part] === 'flame') || (GOLF_PART_OPTIONS[part]?.includes(raw[part])) || (MERCEDES_PART_OPTIONS[part]?.includes(raw[part])) || (AUDI_PART_OPTIONS[part]?.includes(raw[part]))) out[part] = raw[part];
    if (raw[`${part}Finish`] === 'carbon') out[`${part}Finish`] = 'carbon';
  }
  if (PAINT_SCHEMES.includes(raw.paintScheme)) out.paintScheme = raw.paintScheme;
  if (raw.secondaryFinish === 'carbon') out.secondaryFinish = 'carbon';
  if (LIVERY_OPTIONS.some(option => option.id === raw.livery)) out.livery = raw.livery;
  out.secondaryColor = normalizeHex(raw.secondaryColor) || DEFAULT_CUSTOMIZATION.secondaryColor;
  out.liveryColor = normalizeHex(raw.liveryColor) || DEFAULT_CUSTOMIZATION.liveryColor;
  if (RIM_OPTIONS.includes(raw.rim)) out.rim = raw.rim;
  out.rimColor = normalizeHex(raw.rimColor) || '';
  if (['narrow','standard','wide'].includes(raw.tireWidth)) out.tireWidth = raw.tireWidth;
  if (['low','standard','thick'].includes(raw.tireProfile)) out.tireProfile = raw.tireProfile;
  out.afterfire = raw.afterfire === true;
  out.removePlates = raw.removePlates === true;
  out.flameColor = normalizeHex(raw.flameColor) || DEFAULT_CUSTOMIZATION.flameColor;
  if (['stock','smoked','halo'].includes(raw.headlights)) out.headlights=raw.headlights;
  if (['stock','sport','carbon'].includes(raw.mirrors)) out.mirrors=raw.mirrors;
  out.underglow = raw.underglow === true;
  out.glowColor = normalizeHex(raw.glowColor) || DEFAULT_CUSTOMIZATION.glowColor;
  return out;
}
export function sanitizeCustomizations(value, ids) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const id of ids) if (raw[id] && typeof raw[id] === 'object') { out[id] = sanitizeCustomization(raw[id]); if (id !== 'golf') { for (const [part, options] of Object.entries(GOLF_PART_OPTIONS)) if(options.includes(out[id][part])) out[id][part] = 'stock'; out[id].headlights='stock'; out[id].mirrors='stock'; out[id].tireProfile='standard'; } if(id!=='mercedes') for(const [part, options] of Object.entries(MERCEDES_PART_OPTIONS)) if(options.includes(out[id][part])) out[id][part]='stock'; if(id!=='audi') for(const [part, options] of Object.entries(AUDI_PART_OPTIONS)) if(options.includes(out[id][part])) out[id][part]='stock'; }
  return out;
}
