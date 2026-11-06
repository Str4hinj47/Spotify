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
