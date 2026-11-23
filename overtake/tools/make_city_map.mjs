// Renders the Central City district as a top-down map.
//
//   node tools/make_city_map.mjs        → docs/city-map.svg
//
// Every footprint, road, bay, tree and lamp comes straight from
// src/world/city-plan.mjs, so the map cannot drift from what the game draws.
// North is up: the plan's -Z axis is north (see facingRotationY).
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  CITY_BOUND, STREETS, SIDEWALKS, BUILDINGS, BUILDING_SPECS, buildingHalfExtents,
  PARK, PARKING_LOT, BAYS, PARKED_CARS, FOUNTAIN, TREES, LAMPS, BENCHES, HEDGES,
  ROAD_MARKINGS,
} from '../src/world/city-plan.mjs';

// --- Canvas -----------------------------------------------------------------
const SPAN = CITY_BOUND * 2;          // 428 m across
const SCALE = 3.2;                     // px per metre
const MAP = Math.round(SPAN * SCALE);
const PAD_X = 72;
const HEADER = 150;
const LEGEND = 220;
const PAD_BOT = 34;
const W = Math.round(MAP + PAD_X * 2);
const H = Math.round(HEADER + MAP + LEGEND + PAD_BOT);
const X = x => PAD_X + (x + CITY_BOUND) * SCALE;
const Y = z => HEADER + (z + CITY_BOUND) * SCALE;
const L = m => m * SCALE;              // length in px

// --- Palette ----------------------------------------------------------------
const C = {
  page: '#0b0e12',
  ground: '#22322a',
  block: '#27372e',
  walk: '#3b434e',
  road: '#252b33',
  paint: '#8b97a6',
  paintDim: '#5d6773',
  hedge: '#1d3326',
  park: '#2c4f38',
  parkDeep: '#356044',
  path: '#8d8778',
  lot: '#2a3038',
  bay: '#cfd6dd',
  shop: '#e8a94b',
  shopEdge: '#f6c882',
  home: '#6fbf9e',
  homeEdge: '#9fdcc2',
  civic: '#79a6f2',
  civicEdge: '#a8c7ff',
  fountain: '#54bcdd',
  volt: '#d7ff3f',
  text: '#eef2f6',
  dim: '#93a1b0',
  faint: '#5c6774',
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = v => Math.round(v * 100) / 100;

const out = [];
const push = s => out.push(s);

// --- Helpers ----------------------------------------------------------------
function rectWorld(x, z, w, d, fill, extra = '') {
  push(`<rect x="${n(X(x - w / 2))}" y="${n(Y(z - d / 2))}" width="${n(L(w))}" height="${n(L(d))}" fill="${fill}" ${extra}/>`);
}
function spanRect(x0, z0, x1, z1, fill, extra = '') {
  push(`<rect x="${n(X(x0))}" y="${n(Y(z0))}" width="${n(L(x1 - x0))}" height="${n(L(z1 - z0))}" fill="${fill}" ${extra}/>`);
}

// Which palette bucket an archetype belongs to.
const CIVIC = new Set(['office_slab', 'glass_tower', 'tower_setback', 'bank']);
const bucket = key => (CIVIC.has(key) ? 'civic' : BUILDING_SPECS[key]?.shop ? 'shop' : 'home');

// --- Header -----------------------------------------------------------------
push(`<rect width="${W}" height="${H}" fill="${C.page}"/>`);
push(`<text x="${PAD_X}" y="52" fill="${C.volt}" font-size="13" font-weight="700" letter-spacing="5.5">OVERTAKE · SEASON 01</text>`);
push(`<text x="${PAD_X}" y="100" fill="${C.text}" font-size="46" font-weight="800" letter-spacing="0.5">Central City</text>`);
push(`<text x="${PAD_X}" y="128" fill="${C.dim}" font-size="14" letter-spacing="0.6">Free-roam district · ${SPAN} m × ${SPAN} m · ${BUILDINGS.length} buildings · 24 unique designs · north is up</text>`);

// Compass rose, top right.
const cx = W - PAD_X - 46, cy = 76;
push(`<g>
  <circle cx="${cx}" cy="${cy}" r="42" fill="none" stroke="${C.faint}" stroke-width="1.2"/>
  <circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${C.faint}" stroke-width="0.7" stroke-dasharray="3 5"/>
  <path d="M ${cx} ${cy - 34} L ${cx + 11} ${cy + 6} L ${cx} ${cy - 2} L ${cx - 11} ${cy + 6} Z" fill="${C.volt}"/>
  <path d="M ${cx} ${cy + 34} L ${cx + 8} ${cy + 2} L ${cx} ${cy + 8} L ${cx - 8} ${cy + 2} Z" fill="${C.faint}"/>
  <text x="${cx}" y="${cy - 50}" fill="${C.text}" font-size="12" font-weight="700" letter-spacing="2" text-anchor="middle">N</text>
</g>`);

// --- Map body ---------------------------------------------------------------
push(`<g>`);
// Ground.
spanRect(-CITY_BOUND, -CITY_BOUND, CITY_BOUND, CITY_BOUND, C.ground);

// Blocks (the built-up land between the streets).
for (const s of SIDEWALKS) {
  rectWorld(s.x, s.z, s.w, s.d, C.walk);
}
for (const s of STREETS) {
  rectWorld(s.x, s.z, s.w, s.d, C.road);
}
rectWorld((PARKING_LOT.x0 + PARKING_LOT.x1) / 2, (PARKING_LOT.z0 + PARKING_LOT.z1) / 2,
  PARKING_LOT.x1 - PARKING_LOT.x0, PARKING_LOT.z1 - PARKING_LOT.z0, C.lot);

// Park.
spanRect(PARK.x0, PARK.z0, PARK.x1, PARK.z1, C.park);
// Cross paths through the plaza, exactly as the renderer lays them out.
spanRect(FOUNTAIN.x - 2.5, PARK.z0, FOUNTAIN.x + 2.5, PARK.z1, C.path);
spanRect(PARK.x0, FOUNTAIN.z - 2.5, PARK.x1, FOUNTAIN.z + 2.5, C.path);

// Road paint.
for (const m of ROAD_MARKINGS) {
  const col = m.color === 'yellow' ? '#c9a94a' : '#8e99a6';
  push(`<rect x="${n(X(m.x - m.w / 2))}" y="${n(Y(m.z - m.l / 2))}" width="${n(Math.max(1, L(m.w)))}" height="${n(Math.max(1, L(m.l)))}" fill="${col}" opacity="0.85"/>`);
}

// Parking bays.
for (const b of BAYS) {
  push(`<rect x="${n(X(b.x - b.w / 2))}" y="${n(Y(b.z - b.d / 2))}" width="${n(L(b.w))}" height="${n(L(b.d))}" fill="none" stroke="${C.bay}" stroke-width="0.8" opacity="0.72"/>`);
}
// Parked cars.
for (const p of PARKED_CARS) {
  const bay = BAYS[p.bay];
  const w = 1.9, d = 4.6;
  const col = `#${p.paint.toString(16).padStart(6, '0')}`;
  push(`<rect x="${n(X(bay.x - w / 2))}" y="${n(Y(bay.z - d / 2))}" width="${n(L(w))}" height="${n(L(d))}" rx="1.6" fill="${col}" stroke="#0b0e12" stroke-width="0.7" opacity="0.95"/>`);
}

// Trees (park copse + street planting).
for (const t of TREES) {
  const r = L(2.1 * t.s);
  const inPark = t.x > PARK.x0 && t.x < PARK.x1 && t.z > PARK.z0 && t.z < PARK.z1;
  push(`<circle cx="${n(X(t.x))}" cy="${n(Y(t.z))}" r="${n(r)}" fill="${inPark ? C.parkDeep : '#37543c'}" opacity="${inPark ? 0.95 : 0.8}"/>`);
  push(`<circle cx="${n(X(t.x))}" cy="${n(Y(t.z))}" r="${n(r * 0.42)}" fill="${inPark ? '#4d7d55' : '#456b47'}" opacity="0.85"/>`);
}

// Hedge boundary.
for (const h of HEDGES) {
  push(`<rect x="${n(X(h.x - 0.75))}" y="${n(Y(h.z - 0.75))}" width="${n(L(1.5))}" height="${n(L(1.5))}" fill="${C.hedge}"/>`);
}

// Street lamps: small warm ticks.
for (const lamp of LAMPS) {
  push(`<circle cx="${n(X(lamp.x))}" cy="${n(Y(lamp.z))}" r="1.5" fill="#f0d08a" opacity="0.7"/>`);
}

// Fountain.
push(`<circle cx="${n(X(FOUNTAIN.x))}" cy="${n(Y(FOUNTAIN.z))}" r="${n(L(4.4))}" fill="#2a4a3c" stroke="${C.path}" stroke-width="1"/>`);
push(`<circle cx="${n(X(FOUNTAIN.x))}" cy="${n(Y(FOUNTAIN.z))}" r="${n(L(3.0))}" fill="${C.fountain}" opacity="0.85"/>`);
push(`<circle cx="${n(X(FOUNTAIN.x))}" cy="${n(Y(FOUNTAIN.z))}" r="${n(L(1.1))}" fill="#d9f4fb" opacity="0.9"/>`);

// Benches.
for (const b of BENCHES) {
  push(`<rect x="${n(X(b.x - 1.1))}" y="${n(Y(b.z - 0.4))}" width="${n(L(2.2))}" height="${n(L(0.8))}" rx="1" fill="#8c6e4f" transform="rotate(${n(b.rotY * 180 / Math.PI)} ${n(X(b.x))} ${n(Y(b.z))})"/>`);
}

// Buildings: shadow, fill, edge. Tall ones get a stronger edge.
const ORDER = { home: 0, shop: 1, civic: 2 };
const sorted = [...BUILDINGS].sort((a, b) => ORDER[bucket(a.key)] - ORDER[bucket(a.key)]);
for (const b of sorted) {
  const { hw, hd } = buildingHalfExtents(b);
  const kind = bucket(b.key);
  const fill = C[kind];
  const stroke = C[kind + 'Edge'];
  const x0 = X(b.x - hw), y0 = Y(b.z - hd), w = L(hw * 2), d = L(hd * 2);
  push(`<rect x="${n(x0 + 1.6)}" y="${n(y0 + 1.9)}" width="${n(w)}" height="${n(d)}" fill="#000" opacity="0.30"/>`);
  push(`<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(d)}" fill="${fill}" stroke="${stroke}" stroke-width="0.75" fill-opacity="0.9"/>`);
  // A storefront tick on the street face, so shop rows read at a glance.
  if (kind === 'shop') {
    const rot = { N: 180, S: 0, E: 90, W: -90 }[b.facing] ?? 0;
    push(`<rect x="${n(x0 + w * 0.18)}" y="${n(y0 - 1)}" width="${n(w * 0.64)}" height="2.4" fill="${C.volt}" opacity="0.9" transform="rotate(${rot} ${n(x0 + w / 2)} ${n(y0 + d / 2)})"/>`);
  }
}

// District boundary.
push(`<rect x="${n(X(-CITY_BOUND))}" y="${n(Y(-CITY_BOUND))}" width="${n(L(SPAN))}" height="${n(L(SPAN))}" fill="none" stroke="#000" stroke-width="2" opacity="0.5"/>`);

// --- Labels -----------------------------------------------------------------
const label = (x, z, text, opts = {}) => {
  const { size = 13, rot = 0, fill = C.text, weight = 700, spacing = 2.6, op = 1, anchor = 'middle' } =
    opts;
  push(`<text x="${n(X(x))}" y="${n(Y(z))}" fill="${fill}" font-size="${size}" font-weight="${weight}"
    letter-spacing="${spacing}" text-anchor="${anchor}" opacity="${op}"
    transform="rotate(${rot} ${n(X(x))} ${n(Y(z))})"
    paint-order="stroke" stroke="#0b0e12" stroke-width="3.4" stroke-linejoin="round">${esc(text)}</text>`);
};

label(0, -70, 'CENTRAL AVENUE', { rot: -90, size: 15 });
label(0, 120, 'CENTRAL AVENUE', { rot: -90, size: 15 });
label(-140, 46, 'WEST AVENUE', { rot: -90, size: 12, op: 0.85 });
label(-140, -160, 'WEST AVENUE', { rot: -90, size: 12, op: 0.85 });
label(140, 46, 'EAST AVENUE', { rot: -90, size: 12, op: 0.85 });
label(140, -160, 'EAST AVENUE', { rot: -90, size: 12, op: 0.85 });
label(-90, -120, 'NORTH STREET', { size: 12, op: 0.85 });
label(90, -120, 'NORTH STREET', { size: 12, op: 0.85 });
label(-90, 40, 'SOUTH STREET', { size: 12, op: 0.85 });
label(0, -CITY_BOUND + 6.5, '↑ HIGHWAY', { size: 8.5, weight: 700, fill: C.faint, spacing: 1.5 });
label(90, 40, 'SOUTH STREET', { size: 12, op: 0.85 });

label(-104, -170, 'CITY PARK', { size: 12, fill: '#bfe6c9', spacing: 3.2 });
label(-104, -160, 'fountain plaza', { size: 9, weight: 500, fill: '#8fb79c', spacing: 1.2 });
label(-75, 132, 'PARKING LOT', { size: 12, fill: C.bay, spacing: 3.4 });
label(-75, 141, `${BAYS.length} marked bays · ${PARKED_CARS.length} cars`, { size: 9, weight: 500, fill: C.dim, spacing: 0.6 });

// Street exits through the hedge line.
for (const s of STREETS) {
  if (s.axis === 'z') {
    for (const side of [-1, 1]) {
      const z = side * CITY_BOUND;
      push(`<path d="M ${n(X(s.x))} ${n(Y(z) - side * 12)} l 7 ${side * 9} l -14 0 Z" fill="${C.faint}" opacity="0.9"/>`);
    }
  }
}

// Start marker.
const START = { x: 6, z: -8 };
push(`<g>
  <circle cx="${n(X(START.x))}" cy="${n(Y(START.z))}" r="13" fill="${C.volt}" opacity="0.18"/>
  <circle cx="${n(X(START.x))}" cy="${n(Y(START.z))}" r="7" fill="none" stroke="${C.volt}" stroke-width="2.2"/>
  <circle cx="${n(X(START.x))}" cy="${n(Y(START.z))}" r="2.6" fill="${C.volt}"/>
</g>`);
label(START.x, START.z - 8.5, 'START', { size: 10, fill: C.volt, spacing: 2.4 });

// Scale bar.
const sbX = X(-CITY_BOUND), sbY = Y(CITY_BOUND) - 26;
push(`<g>
  <rect x="${n(sbX)}" y="${n(sbY)}" width="${n(L(100))}" height="5" fill="${C.text}" opacity="0.85"/>
  <rect x="${n(sbX)}" y="${n(sbY)}" width="${n(L(50))}" height="5" fill="${C.page}" opacity="0.85"/>
  <rect x="${n(sbX)}" y="${n(sbY)}" width="${n(L(100))}" height="5" fill="none" stroke="${C.text}" stroke-width="1"/>
  <text x="${n(sbX)}" y="${n(sbY + 18)}" fill="${C.dim}" font-size="10" letter-spacing="1.4">0</text>
  <text x="${n(sbX + L(100))}" y="${n(sbY + 18)}" fill="${C.dim}" font-size="10" letter-spacing="1.4" text-anchor="end">100 m</text>
</g>`);
push(`</g>`);

// --- Legend -----------------------------------------------------------------
const LY = HEADER + MAP + 30;
push(`<line x1="${PAD_X}" y1="${LY - 16}" x2="${W - PAD_X}" y2="${LY - 16}" stroke="#242c36" stroke-width="1"/>`);
push(`<text x="${PAD_X}" y="${LY + 8}" fill="${C.text}" font-size="13" font-weight="700" letter-spacing="3">KEY</text>`);

const swatch = (x, y, fill, stroke, text, sub) => {
  push(`<rect x="${n(x)}" y="${n(y)}" width="26" height="15" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
  push(`<text x="${n(x + 36)}" y="${n(y + 11.5)}" fill="${C.text}" font-size="12" font-weight="600">${esc(text)}</text>`);
  if (sub) push(`<text x="${n(x + 36)}" y="${n(y + 25)}" fill="${C.faint}" font-size="9.5" letter-spacing="0.4">${esc(sub)}</text>`);
};
const col1 = PAD_X, col2 = PAD_X + 300, col3 = PAD_X + 620;
const shopCount = BUILDINGS.filter(b => bucket(b.key) === 'shop').length;
const homeCount = BUILDINGS.filter(b => bucket(b.key) === 'home').length;
const civicCount = BUILDINGS.filter(b => bucket(b.key) === 'civic').length;
swatch(col1, LY + 26, C.shop, C.shopEdge, `Shopfronts · ${shopCount}`, 'glass, awnings, sign lettering');
swatch(col1, LY + 66, C.home, C.homeEdge, `Homes · ${homeCount}`, 'rowhouses, townhouses, apartments');
swatch(col1, LY + 106, C.civic, C.civicEdge, `Towers & civic · ${civicCount}`, 'office slab, glass tower, bank');
swatch(col2, LY + 26, C.park, C.parkDeep, 'City park', 'fountain plaza, copse, paths');
swatch(col2, LY + 66, C.lot, C.bay, 'Parking lot', `${BAYS.length} marked bays`);
swatch(col2, LY + 106, C.road, C.paintDim, 'Streets', `${TREES.length} trees · ${LAMPS.length} lamps`);
swatch(col3, LY + 26, C.hedge, C.hedge, 'District wall', 'hedge with four street gaps');
swatch(col3, LY + 66, C.fountain, C.fountain, 'Fountain', 'centre of the park plaza');
swatch(col3, LY + 106, C.volt, C.volt, 'Start point', 'you spawn on Central Avenue');
swatch(col3, LY + 146, C.ground, '#3d5045', 'Block interior', 'open lawn — no street access');

// Shop roll-call.
const shopNames = [...new Set(BUILDINGS.filter(b => bucket(b.key) === 'shop').map(b => BUILDING_SPECS[b.key].shop))].sort();
push(`<text x="${PAD_X}" y="${LY + 186}" fill="${C.faint}" font-size="10.5" letter-spacing="1.6">SHOPS ON THE STREETS</text>`);
push(`<text x="${PAD_X}" y="${LY + 204}" fill="${C.dim}" font-size="11" letter-spacing="0.5">${esc(shopNames.join('  ·  '))}</text>`);
push(`<text x="${W - PAD_X}" y="${LY + 204}" fill="${C.faint}" font-size="9.5" letter-spacing="0.8" text-anchor="end">Generated from src/world/city-plan.mjs</text>`);

// --- Emit -------------------------------------------------------------------
mkdirSync('docs', { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
<style>text { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; }</style>
${out.join('\n')}
</svg>`;
writeFileSync('docs/city-map.svg', svg);
console.log(`docs/city-map.svg  ${W}×${H}  ${(svg.length / 1024).toFixed(0)} KB`);
console.log(`${BUILDINGS.length} buildings · ${TREES.length} trees · ${BAYS.length} bays · ${LAMPS.length} lamps`);
