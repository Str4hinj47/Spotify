import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tokyo GP circuit — a closed spline inspired by the Cars 2 Japan race:
// long start straight, bay bridge S-curves (elevated), top chicane through
// the sakura grove, left-side sweepers and a big hairpin before the straight.
// ---------------------------------------------------------------------------
export const N = 720;            // spline samples
export const ROAD_HALF = 7;      // half road width
export const WALL = 6.95;        // guard-rail offset
export const CLAMP = 5.8;        // car centre clamp (wall collision)
export const LAPS = 3;

const CTRL = [
  [   0, 0, -250], [ 170, 0, -250],           // start/finish straight ->
  [ 258, 0, -208], [ 292, 3, -110],           // T1 sweeper, begin climb
  [ 258, 6,  -18], [ 292, 6,   78],           // bay-bridge S curves (elevated)
  [ 238, 3,  168], [ 140, 0,  212],           // descend, top-right corner
  [  34, 0,  182], [ -78, 0,  216],           // chicane (sakura grove)
  [-190, 0,  172], [-244, 0,   62],           // corner + left sweep
  [-206, 0,  -52], [-262, 0, -142],           // dip in, hairpin outside
  [-178, 0, -224], [ -70, 0, -254],           // hairpin exit, final corner
];

const curve = new THREE.CatmullRomCurve3(
  CTRL.map(c => new THREE.Vector3(c[0], c[1], c[2])), true, 'centripetal');

export const pts = [], tans = [], rights = [];
for (let i = 0; i < N; i++) pts.push(curve.getPointAt(i / N));
for (const p of pts) p.y = Math.max(p.y, 0.04);   // avoid spline overshoot under ground
for (let i = 0; i < N; i++) tans.push(curve.getTangentAt(i / N).setY(0).normalize());
for (let i = 0; i < N; i++) { const t = tans[i]; rights.push(new THREE.Vector3(-t.z, 0, t.x).normalize()); }

export const sArc = new Float32Array(N + 1);
for (let i = 0; i < N; i++) sArc[i + 1] = sArc[i] + pts[i].distanceTo(pts[(i + 1) % N]);
export const L = sArc[N];

// curvature + AI corner-speed profile ---------------------------------------
export const curv = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = tans[(i - 1 + N) % N], b = tans[(i + 1) % N];
  const ds = pts[i].distanceTo(pts[(i - 1 + N) % N]) + pts[i].distanceTo(pts[(i + 1) % N]);
  curv[i] = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / Math.max(ds, 0.001);
}
export const cap = new Float32Array(N);       // AI speed limit per sample
for (let i = 0; i < N; i++) cap[i] = Math.min(52, Math.sqrt(25 / Math.max(curv[i], 1e-4)));
for (let k = 0; k < 4; k++)
  for (let i = N - 1; i >= 0; i--) {
    const a = (i + 1) % N, ds = pts[i].distanceTo(pts[a]);
    cap[i] = Math.min(cap[i], Math.sqrt(cap[a] * cap[a] + 2 * 15 * ds));
  }
export function capAt(f) {
  const x = (((f % 1) + 1) % 1) * N;
  const i = Math.floor(x) % N, j = (i + 1) % N, a = x - Math.floor(x);
  return cap[i] * (1 - a) + cap[j] * a;
}
export function curvAt(f) {
  const x = (((f % 1) + 1) % 1) * N;
  return curv[Math.floor(x) % N];
}

// interpolation helpers ------------------------------------------------------
export function makeSample() { return { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3() }; }
export function sampleAt(f, dst) {
  const x = (((f % 1) + 1) % 1) * N;
  const i0 = Math.floor(x) % N, i1 = (i0 + 1) % N, a = x - Math.floor(x);
  dst.p.lerpVectors(pts[i0], pts[i1], a);
  dst.t.lerpVectors(tans[i0], tans[i1], a).setY(0).normalize();
  dst.r.lerpVectors(rights[i0], rights[i1], a).setY(0).normalize();
  return dst;
}
const _s = makeSample();
export function pointOn(f, lat, out) {
  sampleAt(f, _s);
  return out.copy(_s.p).addScaledVector(_s.r, lat);
}
export function yawAt(f) { sampleAt(f, _s); return Math.atan2(_s.t.x, _s.t.z); }

// nearest sample search (hint = last known index for O(1) tracking)
export function nearest(x, z, hint = -1) {
  let best = 0, bd = Infinity;
  if (hint >= 0) {
    for (let k = -48; k <= 48; k++) {
      const i = (hint + k + N * 2) % N;
      const dx = x - pts[i].x, dz = z - pts[i].z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > 110 * 110) hint = -1;
  }
  if (hint < 0) {
    for (let i = 0; i < N; i += 5) {
      const dx = x - pts[i].x, dz = z - pts[i].z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    for (let k = -5; k <= 5; k++) {
      const i = (best + k + N) % N;
      const dx = x - pts[i].x, dz = z - pts[i].z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
  }
  const a = pts[best], b = pts[(best + 1) % N];
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz || 1;
  const u = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / l2, 0, 1);
  return { i: best, frac: ((best + u) / N) % 1, dist2: bd };
}

// minimap projection ---------------------------------------------------------
export const MAP = (() => {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const pad = 14, size = 190;
  const sc = Math.min((size - pad * 2) / (maxX - minX), (size - pad * 2) / (maxZ - minZ));
  const ox = (size - (maxX - minX) * sc) / 2, oz = (size - (maxZ - minZ) * sc) / 2;
  function toMap(x, z) { return [ox + (x - minX) * sc, oz + (z - minZ) * sc]; }
  const poly = [];
  for (let i = 0; i < N; i += 4) poly.push(toMap(pts[i].x, pts[i].z));
  return { toMap, poly, size };
})();

// ---------------------------------------------------------------------------
// static meshes: road, guard rails, neon glow strip, light posts, start line
// ---------------------------------------------------------------------------
function roadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#17191f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 60},${120 + Math.random() * 60},${140 + Math.random() * 60},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.20)';                       // tyre wear bands
  g.fillRect(80, 0, 26, 256); g.fillRect(150, 0, 26, 256);
  g.fillStyle = 'rgba(235,245,255,0.95)';                 // edge lines (x = across)
  g.fillRect(5, 0, 5, 256); g.fillRect(246, 0, 5, 256);
  g.fillStyle = 'rgba(140,225,255,0.85)';                 // dashed centre line (y = along)
  for (let y = 0; y < 256; y += 34) g.fillRect(124, y, 8, 20);
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping; t.wrapS = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function ribbonGeometry(offsetIn, offsetOut, y0, y1, faceIn) {
  // vertical ribbon from lateral offsetIn..offsetOut (same value = flat not needed) —
  // here used for walls: two lateral offsets equal, varying y
  const pos = [], uv = [], idx = [], nor = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], r = rights[i % N];
    const nx = faceIn ? -r.x : r.x, nz = faceIn ? -r.z : r.z;
    pos.push(p.x + r.x * offsetIn, p.y + y0, p.z + r.z * offsetIn);
    pos.push(p.x + r.x * offsetOut, p.y + y1, p.z + r.z * offsetOut);
    nor.push(nx, 0, nz, nx, 0, nz);
    uv.push(0, sArc[i] / 6, 1, sArc[i] / 6);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (faceIn) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function lateralStrip(latA, latB, y, faceUp = true) {
  const pos = [], uv = [], idx = [], nor = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], r = rights[i % N];
    pos.push(p.x + r.x * latA, p.y + y, p.z + r.z * latA);
    pos.push(p.x + r.x * latB, p.y + y, p.z + r.z * latB);
    nor.push(0, faceUp ? 1 : -1, 0, 0, faceUp ? 1 : -1, 0);
    uv.push(0, sArc[i] / 6, 1, sArc[i] / 6);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (faceUp) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export function buildScene(scene) {
  const group = new THREE.Group();

  // road
  {
    const pos = [], uv = [], idx = [], nor = [];
    for (let i = 0; i <= N; i++) {
      const p = pts[i % N], r = rights[i % N];
      pos.push(p.x - r.x * ROAD_HALF, p.y + 0.05, p.z - r.z * ROAD_HALF);
      pos.push(p.x + r.x * ROAD_HALF, p.y + 0.05, p.z + r.z * ROAD_HALF);
      nor.push(0, 1, 0, 0, 1, 0);
      uv.push(0, sArc[i] / 7, 1, sArc[i] / 7);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const rTex = roadTexture();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: rTex, roughness: 0.93, metalness: 0.0,
      emissive: 0xffffff, emissiveMap: rTex, emissiveIntensity: 0.30,
    }));
    group.add(road);
  }

  // guard-rail walls + neon glow strip on top
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbonGeometry(-WALL, -WALL, 0, 1.05, false), wallMat));
  group.add(new THREE.Mesh(ribbonGeometry(WALL, WALL, 0, 1.05, true), wallMat));

  const glowMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  glowMat.color.setRGB(0.25, 1.65, 2.0);
  group.add(new THREE.Mesh(ribbonGeometry(-WALL + 0.08, -WALL + 0.08, 0.52, 0.78, false), glowMat));
  group.add(new THREE.Mesh(ribbonGeometry(WALL - 0.08, WALL - 0.08, 0.52, 0.78, true), glowMat));

  // trackside light posts
  {
    const postCount = Math.floor(N / 30);
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 2.2, 5);
    const lampGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7 });
    const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    lampMat.color.setRGB(1.6, 1.7, 1.2);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, postCount);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, postCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    for (let k = 0; k < postCount; k++) {
      const i = k * 30, side = k % 2 === 0 ? 1 : -1;
      const p = pts[i], r = rights[i];
      m.compose(new THREE.Vector3(p.x + r.x * side * (WALL + 0.4), p.y + 1.1, p.z + r.z * side * (WALL + 0.4)), q, sc);
      poles.setMatrixAt(k, m);
      m.compose(new THREE.Vector3(p.x + r.x * side * (WALL + 0.4), p.y + 2.3, p.z + r.z * side * (WALL + 0.4)), q, sc);
      lamps.setMatrixAt(k, m);
    }
    group.add(poles, lamps);
  }

  // checkered start line
  {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? '#0b0d12' : '#e8ecf2';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 3.2),
      new THREE.MeshBasicMaterial({ map: t }));
    mesh.rotation.x = -Math.PI / 2;
    holder.add(mesh);
    const p0 = pts[0], t0 = tans[0];
    holder.position.set(p0.x, p0.y + 0.09, p0.z);
    holder.rotation.y = Math.atan2(t0.x, t0.z);
    group.add(holder);
  }

  scene.add(group);
}
