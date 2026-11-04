// Geometry height in metres for the raised snow layer. The shape is anchored to
// absolute road distance, while cover controls accumulation and melting.
export function snowDriftHeight(x, distance, cover, roadHalf) {
  const t = Math.max(0, Math.min(1, (Math.abs(x) - 2.9) / (roadHalf + 0.5 - 2.9)));
  const bank = t * t * (3 - 2 * t);
  const drift = 0.5 + 0.5 * Math.sin(distance * 0.11 + x * 0.6) * Math.cos(distance * 0.035 - x * 0.9);
  return Math.max(0, Math.min(1, cover)) * (0.012 + bank * (0.065 + 0.10 * drift) + 0.025 * drift);
}
