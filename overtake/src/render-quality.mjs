// Preferences only affect rendering resolution, not vehicle models or physics.
export const GRAPHICS_QUALITIES = ['performance', 'balanced', 'sharp'];
export function sanitizeGraphicsQuality(value) {
  return GRAPHICS_QUALITIES.includes(value) ? value : 'sharp';
}

// Modest desktop supersampling makes car details clearer; a hard pixel budget
// and the GPU's maximum buffer size prevent extreme high-DPI allocations.
export function vehiclePixelRatio(devicePixelRatio, width, height, coarsePointer, maxRenderSize = Infinity, quality = 'sharp') {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const w = Math.max(1, width), h = Math.max(1, height);
  const baseline = Math.min(dpr, 1.75);
  const mode = sanitizeGraphicsQuality(quality);
  const preferred = mode === 'performance' ? Math.min(dpr, 1.25) * 0.8
    : mode === 'balanced' ? Math.min(dpr, 1.5)
    : coarsePointer || w < 768 ? baseline : Math.min(dpr * 1.25, 2);
  const extraBudget = Math.sqrt(5_000_000 / (w * h));
  const hardBudget = Math.sqrt(8_294_400 / (w * h));
  const deviceLimit = maxRenderSize / Math.max(w, h);
  const budgeted = mode === 'sharp' ? Math.min(preferred, Math.max(baseline, extraBudget)) : preferred;
  return Math.min(budgeted, hardBudget, deviceLimit);
}

// Adapt only the driving render target, never the saved graphics preference.
// Sustained slow frames lower GPU fill cost; brief hitches do nothing and a
// longer fast period restores detail gradually. Hidden tabs are ignored.
export function createAdaptiveResolution() { return {scale:1,slow:0,fast:0,cooldown:0}; }
export function stepAdaptiveResolution(state,dt,active=true) {
  if(!active || !Number.isFinite(dt) || dt<=0) {state.slow=0;state.fast=0;return false;}
  dt=Math.min(dt,.1);
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(dt>.026){state.slow+=dt;state.fast=0;}
  else if(dt<.019){state.fast+=dt;state.slow=0;}
  else {state.slow=0;state.fast=0;}
  if(state.cooldown>0)return false;
  const previous=state.scale;
  if(state.slow>=2){state.scale=Math.max(.65,Math.round((state.scale-.1)*100)/100);state.slow=0;state.cooldown=1.5;}
  else if(state.fast>=5){state.scale=Math.min(1,Math.round((state.scale+.1)*100)/100);state.fast=0;state.cooldown=1.5;}
  return previous!==state.scale;
}
