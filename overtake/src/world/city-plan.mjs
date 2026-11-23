// Pure city layout data and math for the OVERTAKE open world. No three.js
// imports — this module is unit-tested directly and shared by the renderer
// (world/city.ts) and the physics in game.ts. All units are metres.
//
// The district is a true block grid: three north–south avenues, two east–west
// streets, ten built blocks. Every block side that fronts a street carries a
// continuous row of buildings, so the streets read as a city rather than a
// handful of isolated props. Two blocks are deliberately open: a central park
// with a fountain, and a marked parking lot.

export const CITY_BOUND = 214;          // hedge wall; hard clamp for the car
export const CITY_HALF = 224;           // ground slab / street coverage
export const PLAYABLE = 214;

// --- Streets ----------------------------------------------------------------
// Every street is an axis-aligned rectangle: centre (x, z), footprint (w, d).
export const STREETS = [
  { name: 'Central Avenue', x: 0,    z: 0, w: 20, d: CITY_BOUND * 2, axis: 'z', half: 10 },
  { name: 'West Avenue',    x: -140, z: 0, w: 12, d: CITY_BOUND * 2, axis: 'z', half: 6 },
  { name: 'East Avenue',    x: 140,  z: 0, w: 12, d: CITY_BOUND * 2, axis: 'z', half: 6 },
  { name: 'North Street',   x: 0, z: -120, w: CITY_BOUND * 2, d: 12, axis: 'x', half: 6 },
  { name: 'South Street',   x: 0, z: 40,   w: CITY_BOUND * 2, d: 12, axis: 'x', half: 6 },
];

// Sidewalk aprons: concrete strips that wrap each street.
export const SIDEWALKS = STREETS.map(s => ({ x: s.x, z: s.z, w: s.w + 10, d: s.d + 10 }));

/** Setback from the block edge to a building facade — leaves a tree verge. */
const SETBACK = 3.2;
/** Gap between neighbouring buildings along a row. */
const ROW_GAP = 2.4;
/** Extra clearance between a corner building and the row on the cross street. */
const CORNER_GAP = 1.6;

// --- Building archetypes ------------------------------------------------------
// Archetype keys match node names in public/models/city/city.glb (bldg_*).
// `w`/`d` are the footprint in metres, `height` the roofline.
// Footprints are measured from the exported GLB so layout, colliders and the
// drawn geometry always agree. Facades face -Z (see facingRotationY).
export const BUILDING_SPECS = {
  apt_brick:       { w: 16.5 , d: 14.5 , height: 17.8  },
  apt_stucco:      { w: 15.5 , d: 14.5 , height: 14.8  },
  bakery:          { w: 11.4 , d: 13.5 , height: 8.2  , shop: 'BAKERY' },
  bank:            { w: 17.6 , d: 17.4 , height: 11.2  },
  barber:          { w: 10.4 , d: 12.5 , height: 8.2  , shop: 'BARBER' },
  books:           { w: 11.4 , d: 14   , height: 11.8 , shop: 'BOOKS' },
  cafe:            { w: 12.4 , d: 12.5 , height: 11.8 , shop: 'CAFE' },
  diner:           { w: 14.4 , d: 13.6 , height: 5    , shop: 'DINER' },
  flowers:         { w: 10.4 , d: 13   , height: 8.2  , shop: 'FLOWERS' },
  glass_tower:     { w: 19.4 , d: 38   , height: 33.8  },
  grocer:          { w: 15.4 , d: 17.5 , height: 4.4  , shop: 'GROCER' },
  hardware:        { w: 14.4 , d: 17.5 , height: 4.4  , shop: 'HARDWARE' },
  laundry:         { w: 11.4 , d: 13   , height: 8.2  , shop: 'LAUNDRY' },
  market:          { w: 16.4 , d: 18.5 , height: 4.4  , shop: 'MARKET' },
  office_slab:     { w: 26.5 , d: 14.9 , height: 24.6  },
  pharmacy:        { w: 13.4 , d: 15   , height: 8.2  , shop: 'PHARMACY' },
  pizzeria:        { w: 10.4 , d: 13.5 , height: 8.2  , shop: 'PIZZERIA' },
  rowhouse_a:      { w: 9.4  , d: 13.1 , height: 12    },
  rowhouse_b:      { w: 9.4  , d: 13.1 , height: 12    },
  rowhouse_c:      { w: 9.4  , d: 12.1 , height: 9.1   },
  tailor:          { w: 10.4 , d: 13.5 , height: 8.2  , shop: 'TAILOR' },
  tower_setback:   { w: 18.4 , d: 18.4 , height: 33.8  },
  townhouse:       { w: 12.5 , d: 17.3 , height: 13.1  },
  toys:            { w: 11.4 , d: 13.5 , height: 8.2  , shop: 'TOYS' },
};

// --- Deterministic helpers ----------------------------------------------------
function hash01(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
const round1 = v => Math.round(v * 10) / 10;

/** Facade tints applied per instance so repeated archetypes never look alike. */
export const FACADE_TINTS = [
  0xffffff, 0xf4e7d3, 0xe4d4be, 0xd9dee3, 0xd0d9ca, 0xe9d3cc,
  0xd3cde1, 0xf1e3b9, 0xcad8dc, 0xe1d0c1, 0xbfc9b4, 0xdcc9a8,
  0xc9c2b6, 0xe6dccb,
];

const SHOP_KEYS = ['bakery', 'pizzeria', 'books', 'flowers', 'cafe', 'market', 'barber', 'hardware',
  'pharmacy', 'laundry', 'tailor', 'toys', 'grocer', 'diner'];
const CIVIC_KEYS = ['office_slab', 'glass_tower', 'tower_setback', 'bank'];
const HOUSE_KEYS = ['rowhouse_a', 'rowhouse_b', 'rowhouse_c', 'townhouse', 'apt_brick', 'apt_stucco'];
/** Every archetype — used downtown so all 24 designs appear. */
export const ALL_KEYS = [...SHOP_KEYS, ...CIVIC_KEYS, ...HOUSE_KEYS];

// --- Open blocks --------------------------------------------------------------
/** Central park, north-centre block (between West and Central Avenues). */
export const PARK = { x0: -134, x1: -16, z0: -214, z1: -126 };
/** Parking lot, south-centre block. */
export const PARKING_LOT = { x0: -128, x1: -22, z0: 52, z1: 206 };
export const FOUNTAIN = { x: (PARK.x0 + PARK.x1) / 2, z: (PARK.z0 + PARK.z1) / 2 - 8 };

// --- Block grid ---------------------------------------------------------------
// Kerb lines: avenue centre ± (half width + verge). The bands below are the
// block interiors between those kerbs, so no building can ever sit on a street.
const X_BANDS = [[-CITY_BOUND, -146], [-134, -16], [16, 134], [146, CITY_BOUND]];
const Z_BANDS = [[-CITY_BOUND, -126], [-114, 28], [46, CITY_BOUND]];

function isOpen(b) {
  const overlaps = (a, r) => a.x0 < r.x1 && a.x1 > r.x0 && a.z0 < r.z1 && a.z1 > r.z0;
  return overlaps(b, PARK) || overlaps(b, PARKING_LOT);
}

export const BLOCKS = (() => {
  const blocks = [];
  for (const [x0, x1] of X_BANDS) {
    for (const [z0, z1] of Z_BANDS) {
      const b = { x0, x1, z0, z1 };
      if (!isOpen(b)) blocks.push(b);
    }
  }
  return blocks;
})();

/**
 * Fill one side of a block with a continuous row of buildings.
 *  axis 'z' → the row runs north–south and its facades face ±X.
 *  axis 'x' → the row runs east–west and its facades face ±Z.
 * `dir` is the facade normal: +1 means the row grows toward +x (or +z) and so
 * looks back toward the street on its negative side.
 */
function frontageRow(out, { axis, dir, edge, from, to, seed, keys }) {
  if (to - from < 12) return null;
  let t = from;
  let i = 0;
  let idx = Math.floor(hash01(seed * 977) * keys.length) % keys.length;
  let deepest = 0;
  while (t < to - 8) {
    let placed = null;
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[(idx + attempt) % keys.length];
      const spec = BUILDING_SPECS[key];
      // When a building faces E/W the footprint swaps, so in both cases the
      // storefront width `w` is the extent along the row and `d` is the depth.
      const run = spec.w;
      const depth = spec.d;
      if (t + run * 1.06 + ROW_GAP <= to) { placed = { key, spec, offset: attempt }; break; }
    }
    if (!placed) break;
    const { key, spec } = placed;
    idx = (idx + placed.offset + 1) % keys.length;
    // Scale is drawn per instance; the slot and facade offset account for it so
    // storefronts stay flush with the kerb line.
    const scale = 0.94 + hash01(seed * 613 + i * 29) * 0.12;
    const run = spec.w * scale;
    const depth = spec.d * scale;
    const along = t + run / 2;
    const off = SETBACK + depth / 2;
    const x = axis === 'z' ? edge + dir * off : along;
    const z = axis === 'z' ? along : edge + dir * off;
    // A glTF front points down -Z at rotation 0.
    const facing = axis === 'z' ? (dir > 0 ? 'W' : 'E') : (dir > 0 ? 'N' : 'S');
    const entry = {
      key, x: round1(x), z: round1(z), facing,
      tint: FACADE_TINTS[Math.floor(hash01(seed * 7919 + i * 131) * FACADE_TINTS.length) % FACADE_TINTS.length],
      // Distinct neighbours should not always share the same storey rhythm.
      scale: Math.round(scale * 100) / 100,
    };
    out.push(entry);
    deepest = Math.max(deepest, depth);
    t += run + ROW_GAP;
    i++;
  }
  return deepest ? { inset: SETBACK + deepest } : null;
}

/** Distance from a block edge to the far side of a placed building. */
function footprintDepth(entry) {
  const spec = BUILDING_SPECS[entry.key];
  const deep = entry.facing === 'E' || entry.facing === 'W' ? spec.w : spec.d;
  return SETBACK + deep;
}

export const BUILDINGS = (() => {
  const out = [];
  let seed = 1;
  for (const b of BLOCKS) {
    // Downtown = the two centre columns; they get the full 24-design mix.
    const downtown = b.x0 === -134 || b.x0 === 16;
    const sets = downtown
      ? [ALL_KEYS, ALL_KEYS, ALL_KEYS, ALL_KEYS]
      : [SHOP_KEYS, HOUSE_KEYS, [...HOUSE_KEYS, ...SHOP_KEYS], [...SHOP_KEYS, ...HOUSE_KEYS]];

    // Only the sides that face a street get a frontage; the district wall
    // behind the outer bands stays open for the hedge line.
    const hasWest = b.x0 > -CITY_BOUND, hasEast = b.x1 < CITY_BOUND;
    const hasNorth = b.z0 > -CITY_BOUND, hasSouth = b.z1 < CITY_BOUND;

    // N/S rows own the corners.
    const north = hasNorth
      ? frontageRow(out, { axis: 'x', dir: 1, edge: b.z0, from: b.x0 + 1, to: b.x1 - 1, seed: seed++, keys: sets[0] })
      : null;
    const south = hasSouth
      ? frontageRow(out, { axis: 'x', dir: -1, edge: b.z1, from: b.x0 + 1, to: b.x1 - 1, seed: seed++, keys: sets[1] })
      : null;
    // Avenue rows are inset past the deepest corner footprint at each end.
    const northInset = north ? north.inset + CORNER_GAP : SETBACK;
    const southInset = south ? south.inset + CORNER_GAP : SETBACK;
    if (hasWest) {
      frontageRow(out, { axis: 'z', dir: 1, edge: b.x0, from: b.z0 + northInset, to: b.z1 - southInset, seed: seed++, keys: sets[2] });
    }
    if (hasEast) {
      frontageRow(out, { axis: 'z', dir: -1, edge: b.x1, from: b.z0 + northInset, to: b.z1 - southInset, seed: seed++, keys: sets[3] });
    }
  }
  return out;
})();

/** How built-up the district is (smoke test + HUD copy). */
export const BUILDING_COUNT = BUILDINGS.length;

/** A building's roofline height in metres. */
export function buildingHeight(entry) {
  return BUILDING_SPECS[entry.key]?.height ?? 8;
}

/** Axis-aligned half extents for a building placement (swaps when sideways). */
export function buildingHalfExtents(entry) {
  const spec = BUILDING_SPECS[entry.key];
  if (!spec) throw new Error(`unknown building archetype: ${entry.key}`);
  const swap = entry.facing === 'E' || entry.facing === 'W';
  const s = entry.scale ?? 1;
  return { hw: (swap ? spec.d : spec.w) / 2 * s, hd: (swap ? spec.w : spec.d) / 2 * s };
}

/**
 * Facing → rotation.y. The Blender pack builds every storefront on +Y in
 * Blender, which the glTF exporter maps to -Z, so a building faces -Z (north)
 * at rotation 0. Verified against city.glb: the shopglass primitives sit at
 * z ≈ -7.6…-4.6 for every shop archetype.
 */
export function facingRotationY(facing) {
  switch (facing) {
    case 'N': return 0;
    case 'S': return Math.PI;
    case 'E': return -Math.PI / 2;
    case 'W': return Math.PI / 2;
    default: throw new Error(`unknown facing ${facing}`);
  }
}

// --- Parking lot ---------------------------------------------------------------
export const BAYS = (() => {
  const bays = [];
  const rows = [
    { z: 72, facing: 'N' }, { z: 112, facing: 'S' },
    { z: 152, facing: 'N' }, { z: 192, facing: 'S' },
  ];
  const span = 18 * 4.05;
  const firstCentre = (PARKING_LOT.x0 + PARKING_LOT.x1) / 2 - span / 2 + 4.05 / 2;
  for (const row of rows) {
    for (let i = 0; i < 18; i++) {
      bays.push({ id: bays.length, x: round1(firstCentre + i * 4.05), z: row.z, w: 3.3, d: 5.8, facing: row.facing });
    }
  }
  return bays;
})();

export const PARKED_CARS = [
  { car: 'golf',       bay: 2,  paint: 0xb0b7bd },
  { car: 'mustang',    bay: 5,  paint: 0x7a1f1f },
  { car: 'challenger', bay: 9,  paint: 0x2b2e33 },
  { car: 'ferrari',    bay: 13, paint: 0xb81418 },
  { car: 'audi',       bay: 17, paint: 0x3c4a5e },
  { car: 'r8',         bay: 22, paint: 0xd8d8d2 },
  { car: 'mercedes',   bay: 28, paint: 0x1c1c1e },
  { car: 'golf',       bay: 33, paint: 0x2e5a3c },
  { car: 'mustang',    bay: 39, paint: 0x804a20 },
  { car: 'challenger', bay: 44, paint: 0x5e6b7a },
  { car: 'ferrari',    bay: 49, paint: 0x1a1a1a },
  { car: 'audi',       bay: 55, paint: 0x6a1f2e },
  { car: 'r8',         bay: 60, paint: 0x274060 },
  { car: 'mercedes',   bay: 66, paint: 0x777d84 },
];

/** The bay a point sits in, or null on open asphalt. */
export function bayAt(x, z) {
  for (const b of BAYS) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) return b.id;
  }
  return null;
}

// --- Lamps, benches, trees ------------------------------------------------------
export const LAMPS = (() => {
  const lamps = [];
  for (const s of STREETS) {
    const side = s.half + 2.6;
    if (s.axis === 'z') {
      for (let t = -CITY_BOUND + 8; t <= CITY_BOUND - 8; t += 32) {
        lamps.push({ x: s.x - side, z: t, side: -1 });
        lamps.push({ x: s.x + side, z: t + 16, side: 1 });
      }
    } else {
      for (let t = -CITY_BOUND + 10; t <= CITY_BOUND - 10; t += 34) {
        lamps.push({ x: t, z: s.z - side, side: -1 });
        lamps.push({ x: t + 17, z: s.z + side, side: 1 });
      }
    }
  }
  // Park lamps hugging the fountain plaza.
  for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
    lamps.push({ x: FOUNTAIN.x + dx, z: FOUNTAIN.z + dz, side: 1 });
  }
  return lamps;
})();

export const BENCHES = (() => {
  const benches = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    benches.push({
      x: round1(FOUNTAIN.x + Math.cos(a) * 9.5),
      z: round1(FOUNTAIN.z + Math.sin(a) * 9.5),
      rotY: Math.round((-a + Math.PI / 2) * 1000) / 1000,
    });
  }
  // A couple of benches along Central Avenue for street life.
  benches.push({ x: 16, z: 8, rotY: -Math.PI / 2 }, { x: -16, z: -52, rotY: Math.PI / 2 });
  return benches;
})();

/** Deterministic planting. Returns [{x, z, s}] with s = scale. */
export const TREES = (() => {
  const trees = [];
  const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const nearFountain = (x, z) => Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 13;
  // Street trees in the verge between kerb and facade.
  let k = 0;
  for (const s of STREETS) {
    const verge = s.half + 1.6;
    if (s.axis === 'z') {
      for (let t = -CITY_BOUND + 12; t <= CITY_BOUND - 10; t += 15) {
        for (const sign of [-1, 1]) {
          const x = s.x + sign * verge, z = t + hash01(k * 13) * 5;
          k++;
          if (inRect(x, z, PARKING_LOT) || nearFountain(x, z)) continue;
          if (hash01(k * 7 + sign) < 0.16) continue;
          trees.push({ x: round1(x), z: round1(z), s: 0.72 + hash01(k * 11) * 0.42 });
        }
      }
    } else {
      for (let t = -CITY_BOUND + 14; t <= CITY_BOUND - 10; t += 17) {
        for (const sign of [-1, 1]) {
          const z = s.z + sign * verge, x = t + hash01(k * 17) * 6;
          k++;
          if (inRect(x, z, PARKING_LOT) || nearFountain(x, z)) continue;
          if (hash01(k * 5 + sign) < 0.2) continue;
          trees.push({ x: round1(x), z: round1(z), s: 0.72 + hash01(k * 19) * 0.42 });
        }
      }
    }
  }
  // Park copse: dense, but clear of the fountain plaza and its two paths.
  for (let i = 0; i < 260; i++) {
    const x = PARK.x0 + 4 + hash01(i * 31 + 3) * (PARK.x1 - PARK.x0 - 8);
    const z = PARK.z0 + 4 + hash01(i * 47 + 11) * (PARK.z1 - PARK.z0 - 8);
    if (nearFountain(x, z)) continue;
    if (Math.abs(z - FOUNTAIN.z) < 3.2) continue;
    if (Math.abs(x - FOUNTAIN.x) < 3.2) continue;
    trees.push({ x: round1(x), z: round1(z), s: 0.9 + hash01(i * 17 + 5) * 0.75 });
  }
  return trees;
})();

export const BUSHES = (() => {
  const bushes = [];
  for (let i = 0; i < 120; i++) {
    const inPark = i % 3 !== 0;
    let x, z;
    if (inPark) {
      x = PARK.x0 + 4 + hash01(i * 13 + 7) * (PARK.x1 - PARK.x0 - 8);
      z = PARK.z0 + 4 + hash01(i * 29 + 1) * (PARK.z1 - PARK.z0 - 8);
    } else {
      // Kerbside planters along the avenues.
      const s = STREETS[i % 2 === 0 ? 0 : 1];
      x = s.x + (hash01(i * 13 + 7) < 0.5 ? -1 : 1) * (s.half + 4.4);
      z = -CITY_BOUND + 20 + hash01(i * 29 + 1) * (CITY_BOUND * 2 - 40);
    }
    const near = Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 7;
    if (near) continue;
    bushes.push({ x: round1(x), z: round1(z), s: 0.55 + hash01(i * 37 + 9) * 0.6 });
  }
  return bushes;
})();

/** Hedge instances forming the district wall, with gaps where streets exit. */
export const HEDGES = (() => {
  const spots = [];
  const gapAt = (v, gaps) => gaps.some(g => Math.abs(v - g.centre) < g.half + 3);
  const streetX = STREETS.filter(s => s.axis === 'z').map(s => ({ centre: s.x, half: s.half }));
  const streetZ = STREETS.filter(s => s.axis === 'x').map(s => ({ centre: s.z, half: s.half }));
  for (let t = -CITY_BOUND; t <= CITY_BOUND; t += 1.65) {
    if (!gapAt(t, streetX)) { spots.push({ x: t, z: -CITY_BOUND }); spots.push({ x: t, z: CITY_BOUND }); }
    if (!gapAt(t, streetZ)) { spots.push({ x: -CITY_BOUND, z: t }); spots.push({ x: CITY_BOUND, z: t }); }
  }
  return spots;
})();

// --- Road markings --------------------------------------------------------------
/** Precomputed paint strips. `w` runs along X, `l` along Z. */
export const ROAD_MARKINGS = (() => {
  const marks = [];
  const dash = (x, z, w, l, color = 'white') => marks.push({ x: round1(x), z: round1(z), w, l, color });
  const isCrossroads = (axis, t) => (axis === 'z'
    ? STREETS.some(s => s.axis === 'x' && Math.abs(s.z - t) < s.half + 9)
    : STREETS.some(s => s.axis === 'z' && Math.abs(s.x - t) < s.half + 9));
  for (const s of STREETS) {
    if (s.axis === 'z') {
      for (let t = -CITY_BOUND; t < CITY_BOUND; t += 9) {
        if (isCrossroads('z', t + 2.2)) continue;
        dash(s.x, t + 2.2, 0.24, 4.4, s.x === 0 ? 'yellow' : 'white');
      }
      // Lane edges: solid white lines either side of the centre line.
      for (const sign of [-1, 1]) {
        for (let t = -CITY_BOUND; t < CITY_BOUND; t += 8) {
          if (isCrossroads('z', t + 4)) continue;
          dash(s.x + sign * (s.half - 0.45), t + 4, 0.16, 7.6);
        }
      }
    } else {
      for (let t = -CITY_BOUND; t < CITY_BOUND; t += 9) {
        if (isCrossroads('x', t + 2.2)) continue;
        dash(t + 2.2, s.z, 4.4, 0.24);
      }
      for (const sign of [-1, 1]) {
        for (let t = -CITY_BOUND; t < CITY_BOUND; t += 8) {
          if (isCrossroads('x', t + 4)) continue;
          dash(t + 4, s.z + sign * (s.half - 0.45), 7.6, 0.16);
        }
      }
    }
  }
  // Zebra crossings on all four arms of every intersection.
  for (const a of STREETS.filter(s => s.axis === 'z')) {
    for (const c of STREETS.filter(s => s.axis === 'x')) {
      for (const dz of [-1, 1]) {
        const z = c.z + dz * (c.half + 3.4);
        for (let i = -3; i <= 3; i++) dash(a.x + i * 1.9, z, 0.75, 3.1);
      }
      for (const dx of [-1, 1]) {
        const x = a.x + dx * (a.half + 3.4);
        for (let i = -3; i <= 3; i++) dash(x, c.z + i * 1.9, 3.1, 0.75);
      }
    }
  }
  return marks;
})();

// --- Collision ------------------------------------------------------------------
/** Static AABBs (buildings, axis-aligned after the facing swap). */
export const COLLISION_AABBS = BUILDINGS.map(entry => {
  const { hw, hd } = buildingHalfExtents(entry);
  return { x: entry.x, z: entry.z, hw: hw + 0.3, hd: hd + 0.3 };
});

export function collisionCircles() {
  const circles = [];
  for (const t of TREES) circles.push({ x: t.x, z: t.z, r: 0.95 });
  for (const l of LAMPS) circles.push({ x: l.x, z: l.z, r: 0.35 });
  for (const b of BENCHES) circles.push({ x: b.x, z: b.z, r: 1.15 });
  circles.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: 3.1 });
  for (const p of PARKED_CARS) {
    const bay = BAYS[p.bay];
    circles.push({ x: bay.x, z: bay.z, r: 2.35 });
  }
  return circles;
}
export const COLLISION_CIRCLES = collisionCircles();

/**
 * Push a circle (the player car) out of every static collider. Returns the
 * corrected position and whether anything was hit. Pure — unit-tested.
 */
export function resolveCollisions(px, pz, radius) {
  let x = px, z = pz, hit = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of COLLISION_AABBS) {
      const dx = x - b.x, dz = z - b.z;
      const cx = Math.max(-b.hw, Math.min(b.hw, dx));
      const cz = Math.max(-b.hd, Math.min(b.hd, dz));
      const ex = dx - cx, ez = dz - cz;
      const distSq = ex * ex + ez * ez;
      if (distSq > radius * radius) continue;
      hit = true;
      if (distSq > 1e-9) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        x += (ex / dist) * push; z += (ez / dist) * push;
      } else {
        // Inside the box: push out along the shallowest axis.
        const pushX = b.hw - Math.abs(dx), pushZ = b.hd - Math.abs(dz);
        if (pushX < pushZ) x = b.x + Math.sign(dx || 1) * (b.hw + radius);
        else z = b.z + Math.sign(dz || 1) * (b.hd + radius);
      }
    }
    for (const c of COLLISION_CIRCLES) {
      const dx = x - c.x, dz = z - c.z;
      const distSq = dx * dx + dz * dz, min = radius + c.r;
      if (distSq >= min * min) continue;
      hit = true;
      const dist = Math.sqrt(distSq) || 0.001;
      x = c.x + (dx / dist) * min; z = c.z + (dz / dist) * min;
    }
  }
  // District wall: clamp the car inside the hedge line.
  const r = CITY_BOUND - 0.6;
  x = Math.max(-r, Math.min(r, x));
  z = Math.max(-r, Math.min(r, z));
  return { x, z, hit };
}

// --- Free-roam car -----------------------------------------------------------------
export function createCityCar() {
  return { speed: 0, steer: 0, yawDelta: 0 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** One physics sub-step for the free-roam car. Pure and unit-tested. */
export function stepCityCar(state, input, spec, grip, dt) {
  const up = clamp(Math.abs(state.speed) / 42, 0, 1);
  const maxSteer = spec.maxSteer * (1 - 0.62 * up);
  const steerDir = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerTarget = steerDir * maxSteer;
  const response = spec.steerResponse ?? 6.5;
  state.steer += clamp(steerTarget - state.steer, -response * dt * maxSteer, response * dt * maxSteer);

  const forward = input.throttle ? 1 : 0;
  const brake = input.brake ? 1 : 0;
  let dv = forward * spec.accel;
  if (brake) {
    if (state.speed > 0.45) dv -= spec.brake;              // braking from forward motion
    else if (state.speed < -0.45) dv += spec.brake * 0.8;  // braking from reverse
    else dv -= spec.accel * 0.6;                           // launch backwards from standstill
  } else if (!forward) {
    dv -= Math.sign(state.speed) * 1.5;                    // engine braking / coasting drag
  }
  dv -= spec.drag * state.speed * Math.abs(state.speed) + Math.sign(state.speed) * 0.85;
  state.speed += dv * dt;
  if (!forward && !brake && Math.abs(state.speed) < 0.35) state.speed = 0;
  state.speed = clamp(state.speed, -8.5, spec.maxSpeed);

  const surface = clamp(grip, 0.32, 1.25);
  const understeer = 1 / (1 + state.speed * state.speed * spec.understeer * 1.9);
  // v < 0 (reverse) naturally flips the yaw rate, so steering stays intuitive.
  const yawRate = (state.speed / spec.wheelbase) * Math.tan(state.steer * understeer) * surface;
  state.yawDelta = yawRate * (input.handbrake ? 1.42 : 1) * dt;
  if (input.handbrake) state.speed -= Math.sign(state.speed) * 7.5 * dt;
  return state;
}
