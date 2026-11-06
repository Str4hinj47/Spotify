// Modest desktop supersampling makes thin vehicle details clearer; avoid
// multiplying the already high cost of high-DPI mobile screens. The budget
// bounds the extra work without rendering below the previous pixel ratio.
export function vehiclePixelRatio(devicePixelRatio, width, height, coarsePointer, maxRenderSize = Infinity) {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const w = Math.max(1, width), h = Math.max(1, height);
  const baseline = Math.min(dpr, 1.75);
  const preferred = coarsePointer || w < 768 ? baseline : Math.min(dpr * 1.25, 2);
  const budget = Math.sqrt(5_000_000 / (w * h));
  const deviceLimit = maxRenderSize / Math.max(w, h);
  return Math.max(0.1, Math.min(preferred, Math.max(baseline, budget), deviceLimit));
}
