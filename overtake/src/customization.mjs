import { normalizeHex } from './paint.mjs';

export const BODY_PARTS = ['front', 'rear', 'skirts', 'spoiler', 'exhaust'];
export const PART_OPTIONS = ['stock', 'street', 'touring', 'sport', 'track'];
export const DEFAULT_CUSTOMIZATION = Object.freeze({
  front:'stock', rear:'stock', skirts:'stock', spoiler:'stock', exhaust:'stock',
  frontFinish:'standard', rearFinish:'standard', skirtsFinish:'standard', spoilerFinish:'standard', exhaustFinish:'standard',
  paintScheme:'single', secondaryColor:'#141b24', secondaryFinish:'paint',
  livery:'none', liveryColor:'#f2f5f7', underglow:false, glowColor:'#00ddff',
});

/** Sanitize untrusted local storage, including older saved configurations. */
export function sanitizeCustomization(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = { ...DEFAULT_CUSTOMIZATION };
  for (const part of BODY_PARTS) {
    if (PART_OPTIONS.includes(raw[part]) || (part === 'exhaust' && raw[part] === 'flame')) out[part] = raw[part];
    if (raw[`${part}Finish`] === 'carbon') out[`${part}Finish`] = 'carbon';
  }
  if (['single','upper','lower'].includes(raw.paintScheme)) out.paintScheme = raw.paintScheme;
  if (raw.secondaryFinish === 'carbon') out.secondaryFinish = 'carbon';
  if (['none','stripe','race'].includes(raw.livery)) out.livery = raw.livery;
  out.secondaryColor = normalizeHex(raw.secondaryColor) || DEFAULT_CUSTOMIZATION.secondaryColor;
  out.liveryColor = normalizeHex(raw.liveryColor) || DEFAULT_CUSTOMIZATION.liveryColor;
  out.underglow = raw.underglow === true;
  out.glowColor = normalizeHex(raw.glowColor) || DEFAULT_CUSTOMIZATION.glowColor;
  return out;
}
export function sanitizeCustomizations(value, ids) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const id of ids) if (raw[id] && typeof raw[id] === 'object') out[id] = sanitizeCustomization(raw[id]);
  return out;
}
