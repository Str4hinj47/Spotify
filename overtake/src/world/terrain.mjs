// Stable roadside elevation, measured from the road centerline. The shoulder
// stays clear and the countryside rises gently into irregular rolling banks.
export function terrainOffset(s, lateral) {
  const distance = Math.abs(lateral);
  const t = Math.max(0, Math.min(1, (distance - 8) / 24));
  const fade = t * t * (3 - 2 * t);
  const hills = 0.5 + 0.22 * Math.sin(s * .009 + lateral * .026)
    + 0.16 * Math.sin(s * .0042 - lateral * .041 + 2.1)
    + 0.12 * Math.cos(s * .018 + lateral * .015);
  return fade * (distance * .008 + Math.max(0, hills) * 2.8);
}
