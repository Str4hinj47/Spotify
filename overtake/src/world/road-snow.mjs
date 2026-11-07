// Geometry height in metres, anchored to absolute road distance. Banks build
// up at the edges; shallow wheel ruts and wind-sculpted drifts remain stable
// as the road mesh is recycled and the snow gradually accumulates or melts.
export function snowDriftHeight(x, distance, cover, roadHalf) {
  const t = Math.max(0, Math.min(1, (Math.abs(x) - 2.9) / (roadHalf + 0.5 - 2.9)));
  const bank = t * t * (3 - 2 * t);
  const drift = 0.5 + 0.5 * Math.sin(distance * 0.11 + x * 0.6) * Math.cos(distance * 0.035 - x * 0.9);
  const windRipple = 0.5 + 0.5 * Math.sin(distance * 0.24 + x * 1.5) * Math.cos(distance * 0.07 - x * 2.2);
  let rut = 0;
  for (const track of [-2.95, -1.25, 1.25, 2.95]) {
    const d = Math.abs(x - track - 0.08 * Math.sin(distance * 0.05));
    rut = Math.max(rut, Math.max(0, 1 - d / 0.48));
  }
  const depth = 0.018 + bank * (0.065 + 0.09 * drift) + 0.018 * drift + 0.012 * windRipple - rut * 0.012;
  return Math.max(0, Math.min(1, cover)) * Math.max(0.006, depth);
}
