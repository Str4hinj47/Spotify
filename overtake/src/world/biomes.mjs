// Smooth, distance-based biome blending. Biomes are chosen per road segment,
// but neighbouring segments cross-fade over hundreds of metres so the world
// never snaps from one biome to another.
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D(() => 0.424242);

export const BIOME_IDS = ['meadow', 'forest', 'alpine', 'desert', 'urban'];

export const BIOME_PARAMS = {
  meadow: {
    label: 'Meadow', ground: 0x4a6b3a, shoulder: 0x6b6f4a, fog: 0xbfd4e2,
    tree: 0x3f7a3a, conifer: 0x2f5f3a, rock: 0x7a7f72, building: 0x8a8f96,
    mountain: 0x5a6b7a, treeDensity: 0.45, coniferRatio: 0.25, rockDensity: 0.08,
    buildingDensity: 0.10, mountainScale: 0.7, temperature: 0.6,
  },
  forest: {
    label: 'Forest', ground: 0x2f4a39, shoulder: 0x3d4a3a, fog: 0x9fb8b0,
    tree: 0x2f6b3f, conifer: 0x24523a, rock: 0x5f6b5f, building: 0x6f7a72,
    mountain: 0x3f5a5f, treeDensity: 0.95, coniferRatio: 0.65, rockDensity: 0.12,
    buildingDensity: 0.02, mountainScale: 0.9, temperature: 0.45,
  },
  alpine: {
    label: 'Alpine', ground: 0x6f7f86, shoulder: 0x8a949a, fog: 0xcfdbe6,
    tree: 0x3a5f4a, conifer: 0x2f4f42, rock: 0x8f9aa3, building: 0x9aa4ad,
    mountain: 0x9fb2c2, treeDensity: 0.35, coniferRatio: 0.9, rockDensity: 0.45,
    buildingDensity: 0.02, mountainScale: 1.5, temperature: 0.15,
  },
  desert: {
    label: 'Desert', ground: 0xb08a5a, shoulder: 0xc2a06a, fog: 0xe6cfa2,
    tree: 0x7a8a4a, conifer: 0x6f7a42, rock: 0xb08a62, building: 0xc2a878,
    mountain: 0xc29a6a, treeDensity: 0.08, coniferRatio: 0.1, rockDensity: 0.35,
    buildingDensity: 0.03, mountainScale: 0.8, temperature: 0.95,
  },
  urban: {
    label: 'Outskirts', ground: 0x5a625a, shoulder: 0x6f746f, fog: 0xbfc6cc,
    tree: 0x4a6b42, conifer: 0x3f5f42, rock: 0x7f847f, building: 0x7f8a94,
    mountain: 0x6f7a84, treeDensity: 0.25, coniferRatio: 0.2, rockDensity: 0.05,
    buildingDensity: 0.75, mountainScale: 0.5, temperature: 0.55,
  },
};

const SEGMENT = 1600;
const TRANSITION_START = 0.55;
const TRANSITION_END = 0.95;

function hashInt(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

export function biomeSegment(s) {
  const x = s / SEGMENT + noise2D(s * 0.00018, 7.7) * 0.22;
  const segment = Math.floor(x);
  const frac = x - segment;
  const a = BIOME_IDS[hashInt(segment) % BIOME_IDS.length];
  const b = BIOME_IDS[hashInt(segment + 1) % BIOME_IDS.length];
  const blend = smoothstep(TRANSITION_START, TRANSITION_END, frac);
  return { a, b, blend, segment, frac };
}

/** @returns {Record<string, number>} weights summing to 1 */
export function biomeWeights(s) {
  const { a, b, blend } = biomeSegment(s);
  const w = Object.fromEntries(BIOME_IDS.map((id) => [id, 0]));
  w[a] += 1 - blend;
  w[b] += blend;
  return w;
}

export function dominantBiome(s) {
  const { a, b, blend } = biomeSegment(s);
  return blend < 0.5 ? a : b;
}

export function biomeParams(s) {
  const { a, b, blend } = biomeSegment(s);
  const pa = BIOME_PARAMS[a], pb = BIOME_PARAMS[b];
  const out = { label: blend < 0.5 ? pa.label : pb.label, a, b, blend };
  for (const key of Object.keys(pa)) {
    const va = pa[key], vb = pb[key];
    if (typeof va === 'number') {
      out[key] = key.match(/ground|shoulder|fog|tree|conifer|rock|building|mounter|mountain/) && key !== 'treeDensity' && key !== 'coniferRatio' && key !== 'rockDensity' && key !== 'buildingDensity' && key !== 'mountainScale' && key !== 'temperature'
        ? lerpColor(va, vb, blend)
        : lerp(va, vb, blend);
    }
  }
  return out;
}

export function biomeContinuity(s, step = 1) {
  const p0 = biomeParams(s), p1 = biomeParams(s + step);
  let max = 0;
  for (const key of ['treeDensity', 'coniferRatio', 'rockDensity', 'buildingDensity', 'mountainScale', 'temperature']) {
    max = Math.max(max, Math.abs(p1[key] - p0[key]));
  }
  return max;
}
