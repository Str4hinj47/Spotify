import * as THREE from 'three';
import * as track from './track.js';

// ---------------------------------------------------------------------------
// Night-time neon Tokyo: skyline, kanji sign stacks, billboards, animated
// jumbotrons, Tokyo Tower, Ferris wheel, torii gates, sakura grove, zen garden
// (with Party Mater), drifting petals and simple particle pools.
// ---------------------------------------------------------------------------

const WATER = { x: 268, z: 25, w: 190, h: 350 };   // bay under the bridge
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

function distToTrack(x, z) {
  let d2 = Infinity;
  for (let i = 0; i < track.N; i += 4) {
    const dx = x - track.pts[i].x, dz = z - track.pts[i].z;
    const d = dx * dx + dz * dz;
    if (d < d2) d2 = d;
  }
  return Math.sqrt(d2);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const JP_FONT = '"Hiragino Sans","Yu Gothic","Noto Sans JP","MS Gothic",sans-serif';

// ---------------------------------------------------------------------------
export function buildEnvironment(scene) {
  const api = { update() {}, updateScreens() {} };
  const animators = [];

  // --- atmosphere -----------------------------------------------------------
  scene.background = new THREE.Color(0x04060f);
  scene.fog = new THREE.Fog(0x04060f, 130, 560);

  scene.add(new THREE.HemisphereLight(0x4a5c8a, 0x141826, 1.35));
  const moonDir = new THREE.DirectionalLight(0x9db8ff, 1.05);
  moonDir.position.set(-260, 320, -180);
  scene.add(moonDir);
  scene.add(new THREE.AmbientLight(0x2e364e, 1.0));

  // stars
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 700 + Math.random() * 60;
      const y = 60 + Math.random() * 380;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false });
    scene.add(new THREE.Points(g, m));
  }

  // moon
  {
    const moon = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }));
    disc.material.color.setRGB(2.2, 2.1, 1.7);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(46, 32),
      new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.1 }));
    halo.position.z = -1;
    moon.add(halo, disc);
    moon.position.set(-430, 250, -480);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
  }

  // ground + bay water
  {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(950, 48),
      new THREE.MeshStandardMaterial({ color: 0x07080f, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08;
    scene.add(ground);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(WATER.w, WATER.h, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a2438, roughness: 0.25, metalness: 0.7,
        emissive: 0x0d3050, emissiveIntensity: 0.55 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(WATER.x, 0.12, WATER.z);
    scene.add(water);
    const wpos = water.geometry.attributes.position;
    animators.push(dt => {
      const t = performance.now() / 1000;
      for (let i = 0; i < wpos.count; i++) {
        const x = wpos.getX(i), y = wpos.getY(i);
        wpos.setZ(i, Math.sin(x * 0.08 + t * 1.4) * 0.35 + Math.cos(y * 0.1 + t) * 0.3);
      }
      wpos.needsUpdate = true;
    });
  }

  // --- skyline --------------------------------------------------------------
  {
    const winTex = n => canvasTex(128, 256, (g) => {
      g.fillStyle = '#05070d'; g.fillRect(0, 0, 128, 256);
      const cols = 6, rows = 15, mw = 8, mh = 8;
      const cw = (128 - mw * 2) / cols, ch = (256 - mh * 2) / rows;
      for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
        if (Math.random() < 0.42) continue;
        const warm = Math.random() < 0.6;
        g.fillStyle = warm
          ? `rgba(255,${180 + (Math.random() * 50 | 0)},${110 + (Math.random() * 60 | 0)},${0.55 + Math.random() * 0.45})`
          : `rgba(${140 + (Math.random() * 60 | 0)},${210 + (Math.random() * 40 | 0)},255,${0.5 + Math.random() * 0.5})`;
        g.fillRect(mw + cx * cw + 2, mh + cy * ch + 2, cw - 4, ch - 5);
      }
      void n;
    });
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const mats = [0, 1, 2].map(() => {
      const tex = winTex();
      return new THREE.MeshStandardMaterial({
        color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.95, roughness: 0.85, metalness: 0.1,
      });
    });
    const meshes = mats.map(m => new THREE.InstancedMesh(box, m, 110));
    meshes.forEach(m => { m.instanceMatrix.setUsage(THREE.StaticDrawUsage); scene.add(m); });
    const counts = [0, 0, 0];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0, guard = 0;
    const beacons = [];
    while (placed < 290 && guard++ < 4000) {
      const gx = (Math.random() * 13 | 0) - 6, gz = (Math.random() * 13 | 0) - 6;
      const x = gx * 62 + rand(-16, 16), z = gz * 62 + rand(-16, 16);
      const r = Math.hypot(x, z);
      if (r < 62 || r > 430) continue;
      if (distToTrack(x, z) < 27) continue;
      if (Math.abs(x - WATER.x) < WATER.w / 2 + 16 && Math.abs(z - WATER.z) < WATER.h / 2 + 16) continue;
      if (Math.hypot(x + 30, z + 60) < 58) continue;          // Tokyo Tower spot
      if (Math.hypot(x + 150, z + 20) < 42) continue;         // zen garden
      if (Math.hypot(x, z + 250) < 52) continue;              // start plaza
      if (Math.hypot(x - 365, z - 90) < 58) continue;         // ferris wheel
      const w = rand(13, 24), d = rand(13, 24), h = rand(16, 95) * (Math.random() < 0.16 ? 1.5 : 1);
      const k = placed % 3, idx = counts[k]++;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(-0.15, 0.15));
      m4.compose(pp.set(x, 0, z), q, sc.set(w, h, d));
      meshes[k].setMatrixAt(idx, m4);
      meshes[k].setColorAt(idx, col.setHSL(0.6 + Math.random() * 0.08, 0.25, rand(0.16, 0.34)));
      if (h > 60 && Math.random() < 0.5) beacons.push([x, h + 1.4, z]);
      placed++;
    }
    meshes.forEach((m, k) => { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });

    // rooftop beacons
    if (beacons.length) {
      const pos = new Float32Array(beacons.length * 3);
      beacons.forEach((b, i) => { pos[i * 3] = b[0]; pos[i * 3 + 1] = b[1]; pos[i * 3 + 2] = b[2]; });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const bm = new THREE.PointsMaterial({ color: 0xff3b30, size: 2.4, sizeAttenuation: false, toneMapped: false, transparent: true });
      scene.add(new THREE.Points(g, bm));
      animators.push(() => { bm.opacity = 0.35 + 0.65 * (Math.sin(performance.now() / 400) > 0 ? 1 : 0.05); });
    }
  }

  // --- vertical neon sign stacks ---------------------------------------------
  {
    const words = ['ネオン', 'ラーメン', 'カラオケ', '東京', 'ドリフト', '夜桜'];
    const hues = [0.92, 0.52, 0.13, 0.42, 0.0, 0.72];
    const texes = words.map((w, i) => canvasTex(96, 384, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 384);
      grad.addColorStop(0, '#0a0c16'); grad.addColorStop(1, '#11131f');
      g.fillStyle = grad; g.fillRect(0, 0, 96, 384);
      g.strokeStyle = `hsl(${hues[i] * 360},90%,65%)`; g.lineWidth = 6;
      g.strokeRect(5, 5, 86, 374);
      g.fillStyle = `hsl(${hues[i] * 360},100%,75%)`;
      g.font = `700 52px ${JP_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = [...w];
      chars.forEach((ch, j) => g.fillText(ch, 48, 52 + j * (330 / Math.max(chars.length - 1, 1))));
    }));
    const geo = new THREE.PlaneGeometry(2.6, 10.5);
    const pole = new THREE.BoxGeometry(0.22, 1, 0.22); pole.translate(0, -5.6, 0);
    const meshes = texes.map(t => {
      const m = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false, transparent: true, alphaTest: 0.05 });
      m.color.setScalar(1.15);
      return new THREE.InstancedMesh(geo, m, 26);
    });
    const poleMesh = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0x1a1f2c }), 26 * 4);
    meshes.forEach(m => scene.add(m)); scene.add(poleMesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
    const cnt = [0, 0, 0, 0, 0, 0]; let pc = 0;
    let placed = 0, guard = 0;
    while (placed < 120 && guard++ < 3000) {
      const i = (Math.random() * track.N) | 0, p = track.pts[i], r = track.rights[i];
      const side = Math.random() < 0.5 ? 1 : -1, off = rand(11, 22);
      const x = p.x + r.x * side * off, z = p.z + r.z * side * off;
      if (Math.abs(x - WATER.x) < WATER.w / 2 && Math.abs(z - WATER.z) < WATER.h / 2) continue;
      const yaw = rand(0, Math.PI * 2);
      q.setFromAxisAngle(up, yaw);
      const k = placed % 6, idx = cnt[k]++;
      const hgt = rand(3, 16);
      m4.compose(new THREE.Vector3(x, hgt + 5.25, z), q, sc.set(1, 1, 1));
      meshes[k].setMatrixAt(idx, m4);
      if (pc < 104) { m4.compose(new THREE.Vector3(x, hgt + 5.25 - 5.6, z), q, sc.set(1, hgt, 1)); poleMesh.setMatrixAt(pc++, m4); }
      placed++;
    }
    meshes.forEach((m, k) => { m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; });
    poleMesh.count = pc; poleMesh.instanceMatrix.needsUpdate = true;
  }

  // --- big billboards on poles ------------------------------------------------
  {
    const ads = [
      canvasTex(512, 288, g => {
        const gr = g.createLinearGradient(0, 0, 512, 288);
        gr.addColorStop(0, '#ff2d78'); gr.addColorStop(1, '#5b0f8f');
        g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
        g.fillStyle = '#fff'; g.font = '900 italic 84px Arial'; g.textAlign = 'center';
        g.fillText('TOKYO', 256, 130);
        g.fillStyle = '#ffe95e'; g.font = '900 italic 52px Arial';
        g.fillText('NIGHT LIGHTS', 256, 205);
      }),
      canvasTex(512, 288, g => {
        g.fillStyle = '#03121e'; g.fillRect(0, 0, 512, 288);
        g.strokeStyle = '#25e0ff'; g.lineWidth = 10; g.strokeRect(14, 14, 484, 260);
        g.fillStyle = '#25e0ff'; g.textAlign = 'center';
        g.font = `700 96px ${JP_FONT}`; g.fillText('東京', 256, 130);
        g.font = '900 italic 54px Arial'; g.fillText('GRAND PRIX', 256, 215);
      }),
      canvasTex(512, 288, g => {
        const gr = g.createLinearGradient(0, 0, 0, 288);
        gr.addColorStop(0, '#ff9d3f'); gr.addColorStop(1, '#d43a2f');
        g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
        g.fillStyle = '#fff'; g.textAlign = 'center';
        g.font = `700 110px ${JP_FONT}`; g.fillText('桜', 256, 150);
        g.font = '900 italic 46px Arial'; g.fillText('SAKURA FESTIVAL', 256, 235);
      }),
      canvasTex(512, 288, g => {
        g.fillStyle = '#10131c'; g.fillRect(0, 0, 512, 288);
        g.fillStyle = '#6fff9e'; g.textAlign = 'center';
        g.font = `700 92px ${JP_FONT}`; g.fillText('ラーメン', 256, 125);
        g.fillStyle = '#fff'; g.font = '900 italic 44px Arial'; g.fillText('OPEN ALL NIGHT', 256, 215);
      }),
    ];
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.7 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x232a3a, roughness: 0.8 });
    for (let b = 0; b < 12; b++) {
      const i = (b * track.N / 12 + 17) % track.N, p = track.pts[i], r = track.rights[i];
      const side = b % 2 === 0 ? 1 : -1, off = rand(20, 34);
      const x = p.x + r.x * side * off, z = p.z + r.z * side * off;
      if (Math.abs(x - WATER.x) < WATER.w / 2 && Math.abs(z - WATER.z) < WATER.h / 2) continue;
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 9),
        new THREE.MeshBasicMaterial({ map: pick(ads), side: THREE.DoubleSide, toneMapped: false }));
      board.material.color.setScalar(1.05);
      board.position.y = 10.5;
      const border = new THREE.Mesh(new THREE.BoxGeometry(16.7, 9.7, 0.5), frameMat);
      border.position.y = 10.5; border.position.z = -0.3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 6.4, 8), poleMat);
      pole.position.y = 3.2;
      g.add(pole, border, board);
      g.position.set(x, 0, z);
      g.lookAt(p.x, 0, p.z);
      scene.add(g);
    }
  }

  // --- animated jumbotrons ----------------------------------------------------
  const screens = [];
  function makeScreen(x, z, lookAtX, lookAtZ, w = 15, h = 8.4, y = 12.5) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    const border = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x161b28, roughness: 0.6, metalness: 0.4 }));
    border.position.z = -0.35;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x232a3a });
    for (const lx of [-w / 2 + 1, w / 2 - 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, y - h / 2, 6), legMat);
      leg.position.set(lx, (y - h / 2) / 2, 0); g.add(leg);
    }
    g.add(border, board);
    g.position.set(x, y, z);
    g.lookAt(lookAtX, y, lookAtZ);
    scene.add(g);
    screens.push({ ctx, tex });
  }

  // Tokyo Tower (stylised lattice) --------------------------------------------
  {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a2a, wireframe: true, transparent: true, opacity: 0.9 });
    const parts = [
      [30, 62, 31], [19, 56, 88], [9, 38, 134],
    ];
    for (const [rad, h, y] of parts) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 4, 6, true), mat);
      cone.position.y = y; g.add(cone);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 22, 6), mat);
    ant.position.y = 162; g.add(ant);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6),
      new THREE.MeshBasicMaterial({ toneMapped: false }));
    beacon.material.color.setRGB(3, 0.25, 0.2);
    beacon.position.y = 174; g.add(beacon);
    const beacon2 = beacon.clone(); beacon2.position.y = 88; g.add(beacon2);
    g.position.set(-30, 0, -60);
    scene.add(g);
    animators.push(() => {
      const on = Math.sin(performance.now() / 500) > 0;
      beacon.visible = beacon2.visible = on;
    });
  }

  // Ferris wheel ---------------------------------------------------------------
  {
    const g = new THREE.Group();
    const wheel = new THREE.Group();
    const R = 34;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 8, 42),
      new THREE.MeshStandardMaterial({ color: 0x8f1626, roughness: 0.5, metalness: 0.5, emissive: 0x30060c }));
    wheel.add(ring);
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0x5c6474, roughness: 0.6 });
    for (let s = 0; s < 8; s++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, R * 2, 0.5), spokeMat);
      sp.rotation.z = s * Math.PI / 8;
      wheel.add(sp);
    }
    const gondolas = [];
    const gondolaGeo = new THREE.BoxGeometry(2.6, 2.8, 2.6);
    for (let s = 0; s < 14; s++) {
      const a = s / 14 * Math.PI * 2;
      const gm = new THREE.MeshBasicMaterial({ toneMapped: false });
      gm.color.setHSL(s / 14, 0.85, 0.6).multiplyScalar(1.1);
      const gond = new THREE.Mesh(gondolaGeo, gm);
      gond.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(gond); gondolas.push(gond);
    }
    wheel.position.y = R + 4;
    g.add(wheel);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.7 });
    for (const dx of [-6, 6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, R + 4, 6), baseMat);
      leg.position.set(dx, (R + 4) / 2, 0); leg.rotation.z = dx > 0 ? -0.18 : 0.18;
      g.add(leg);
    }
    g.position.set(365, 0, 90);
    g.rotation.y = Math.PI / 2 + 0.4;
    scene.add(g);
    animators.push(dt => {
      wheel.rotation.z += dt * 0.14;
      for (const gond of gondolas) gond.rotation.z = -wheel.rotation.z;
    });
  }

  // torii gates over the track ---------------------------------------------------
  function torii(f) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8372a, roughness: 0.5,
      emissive: 0x40100a, emissiveIntensity: 0.5 });
    for (const dx of [-8.6, 8.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 10, 8), mat);
      post.position.set(dx, 5, 0); g.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(21.5, 1.5, 1.9), mat);
    top.position.y = 10.4; g.add(top);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(23, 0.6, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4 }));
    cap.position.y = 11.35; g.add(cap);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(18, 0.9, 1.2), mat);
    mid.position.y = 7.6; g.add(mid);
    const p = new THREE.Vector3();
    track.pointOn(f, 0, p);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = track.yawAt(f);
    scene.add(g);
  }
  torii(0.035); torii(0.385); torii(0.655);

  // sakura grove -----------------------------------------------------------------
  {
    const treePos = [];
    for (let k = 0; k < 64; k++) {
      const f = 0.40 + (k / 64) * 0.16;
      const i = Math.floor(f * track.N) % track.N;
      const p = track.pts[i], r = track.rights[i];
      const side = Math.random() < 0.5 ? 1 : -1, off = rand(12, 30);
      const x = p.x + r.x * side * off, z = p.z + r.z * side * off;
      if (Math.abs(x - WATER.x) < WATER.w / 2 + 8) continue;
      treePos.push([x, z, rand(0.8, 1.4)]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 2.8, 6); trunkGeo.translate(0, 1.4, 0);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 1 }), treePos.length);
    const canopyGeo = new THREE.IcosahedronGeometry(2.1, 1);
    const canopyMesh = new THREE.InstancedMesh(canopyGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true,
        emissive: 0x33101f, emissiveIntensity: 0.5 }), treePos.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const col = new THREE.Color();
    treePos.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6));
      m4.compose(new THREE.Vector3(x, 0, z), q, sc.set(s, s * rand(0.9, 1.3), s));
      trunkMesh.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, 2.9 * s, z), q, sc.set(s, s * 0.85, s));
      canopyMesh.setMatrixAt(i * 2, m4);
      canopyMesh.setColorAt(i * 2, col.setHSL(0.93, 0.7, rand(0.72, 0.84)));
      m4.compose(new THREE.Vector3(x + rand(-1, 1), 3.6 * s, z + rand(-1, 1)), q, sc.set(s * 0.6, s * 0.55, s * 0.6));
      canopyMesh.setMatrixAt(i * 2 + 1, m4);
      canopyMesh.setColorAt(i * 2 + 1, col.setHSL(0.94, 0.65, rand(0.75, 0.88)));
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
    scene.add(trunkMesh, canopyMesh);
  }

  // zen garden + Party Mater -------------------------------------------------------
  {
    const Z = { x: -150, z: -20 };
    const sand = new THREE.Mesh(new THREE.CircleGeometry(19, 40),
      new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(Z.x, 0.05, Z.z);
    scene.add(sand);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8f7f5c, roughness: 1 });
    for (const rr of [6, 10, 14, 17.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.09, 4, 60), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.set(Z.x, 0.09, Z.z);
      scene.add(ring);
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.9, flatShading: true });
    [[-8, 5, 1.6], [9, -4, 2.2], [3, 9, 1.0]].forEach(([dx, dz, s]) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(Z.x + dx, s * 0.6, Z.z + dz);
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      scene.add(rock);
    });

    // Party Mater (tow truck + sombrero)
    const M = new THREE.Group();
    const rust = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.85, metalness: 0.2 });
    const rust2 = new THREE.MeshStandardMaterial({ color: 0x6e4526, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.15, 4.6), rust);
    body.position.y = 1.0; M.add(body);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 2.4), rust2);
    bed.position.set(0, 1.75, -1.0); M.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.15, 1.7), rust);
    cab.position.set(0, 2.0, 1.2); M.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.2, metalness: 0.6 }));
    glass.position.set(0, 2.25, 2.06); M.add(glass);
    const eyeG = new THREE.SphereGeometry(0.26, 10, 8);
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xf4f6f8 });
    const pupM = new THREE.MeshBasicMaterial({ color: 0x101216 });
    for (const dx of [-0.42, 0.42]) {
      const e = new THREE.Mesh(eyeG, eyeM); e.position.set(dx, 2.35, 2.2); M.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), pupM); p.position.set(dx, 2.35, 2.42); M.add(p);
    }
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf0ead2 }));
    teeth.position.set(0, 1.78, 2.15); M.add(teeth);
    const wheelG = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 10);
    wheelG.rotateZ(Math.PI / 2);
    const wheelM = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });
    for (const [dx, dz] of [[-1.15, 1.55], [1.15, 1.55], [-1.15, -1.5], [1.15, -1.5]]) {
      const w = new THREE.Mesh(wheelG, wheelM); w.position.set(dx, 0.52, dz); M.add(w);
    }
    const craneMat = new THREE.MeshStandardMaterial({ color: 0x4c4f58, roughness: 0.6, metalness: 0.5 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6), craneMat);
    post.position.set(0.8, 3.0, -1.0); M.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.6), craneMat);
    arm.position.set(0.8, 4.2, -2.1); arm.rotation.x = 0.5; M.add(arm);
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), craneMat);
    hook.position.set(0.8, 3.4, -3.1); M.add(hook);
    // sombrero!
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xd9b36a, roughness: 0.9 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 18), hatMat);
    brim.position.set(0, 2.72, 1.2); M.add(brim);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.0, 14), hatMat);
    crown.position.set(0, 3.2, 1.2); M.add(crown);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.09, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0xb33a2b }));
    trim.rotation.x = Math.PI / 2; trim.position.set(0, 2.95, 1.2); M.add(trim);

    M.position.set(Z.x + 24, 0, Z.z + 6);
    M.rotation.y = 2.4;
    scene.add(M);

    // confetti sprinkles
    const n = 160, pos = new Float32Array(n * 3), ccol = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = rand(3, 15);
      pos[i * 3] = M.position.x + Math.cos(a) * rr;
      pos[i * 3 + 1] = Math.random() < 0.75 ? 0.08 : rand(0.5, 4);
      pos[i * 3 + 2] = M.position.z + Math.sin(a) * rr;
      c.setHSL(Math.random(), 0.9, 0.6);
      ccol[i * 3] = c.r; ccol[i * 3 + 1] = c.g; ccol[i * 3 + 2] = c.b;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cg.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
    const conf = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, toneMapped: false }));
    scene.add(conf);
  }

  // start-arch + big screen + mid-track screen (built here, uses track anchors)
  {
    // start arch
    const g = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.5, metalness: 0.5 });
    for (const dx of [-10.4, 10.4]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.3, 10.5, 1.3), pillarMat);
      pil.position.set(dx, 5.25, 0); g.add(pil);
    }
    const beamTex = canvasTex(1024, 128, (gc) => {
      gc.fillStyle = '#0b1120'; gc.fillRect(0, 0, 1024, 128);
      for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) {
        gc.fillStyle = (x + y) % 2 ? '#0b0d12' : '#dfe6ee';
        gc.fillRect(x * 16, y * 10, 16, 10);
      }
      gc.fillStyle = '#3ce0ff'; gc.font = '900 italic 74px Arial'; gc.textAlign = 'center';
      gc.shadowColor = '#3ce0ff'; gc.shadowBlur = 22;
      gc.fillText('TOKYO GRAND PRIX', 512, 92);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(21.6, 2.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: beamTex,
        emissive: 0xffffff, emissiveMap: beamTex, emissiveIntensity: 0.9 }));
    beam.position.y = 11.6; g.add(beam);
    const p = new THREE.Vector3();
    track.pointOn(0, 0, p);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = track.yawAt(0);
    scene.add(g);

    // jumbotron above the arch (facing back along the straight)
    const fwd = track.tans[0];
    makeScreen(p.x - fwd.x * 6, p.z - fwd.z * 6, p.x - fwd.x * 60, p.z - fwd.z * 60, 14, 7.9, 16.5);
    // mid-track big screen near sakura
    const pm = new THREE.Vector3(), tm = track.tans[Math.floor(0.47 * track.N)];
    track.pointOn(0.47, 0, pm);
    makeScreen(pm.x - tm.x * 26 + tm.z * 18, pm.z - tm.z * 26 - tm.x * 18, pm.x, pm.z, 18, 10, 13);
  }

  function drawScreen(scr, lines, t) {
    const g = scr.ctx;
    g.fillStyle = '#04070d'; g.fillRect(0, 0, 512, 288);
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#ff2d78'); grad.addColorStop(0.5, '#25b6ff'); grad.addColorStop(1, '#ffd75e');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 46);
    g.fillStyle = '#04070d'; g.font = '900 italic 30px Arial'; g.textAlign = 'center';
    const msg = '★ TOKYO GRAND PRIX — WORLD GRAND PRIX ROUND 1 — 3 LAPS — ';
    const w = g.measureText(msg).width;
    const off = (t * 90) % w;
    g.save(); g.beginPath(); g.rect(0, 0, 512, 46); g.clip();
    g.fillText(msg, 256 - off, 34); g.fillText(msg, 256 - off + w, 34);
    g.restore();
    g.textAlign = 'left';
    lines.forEach((ln, i) => {
      g.fillStyle = i === 0 ? '#ffe95e' : (i % 2 ? '#bfe9ff' : '#e8f2ff');
      g.font = `700 ${i === 0 ? 34 : 30}px Arial`;
      g.fillText(ln, 26, 92 + i * 38);
    });
    g.fillStyle = 'rgba(60,224,255,0.9)'; g.font = '700 22px Arial';
    const tick = 'SAKURA CIRCUIT • 夜桜 • NEON NIGHT RACE • スピード • ';
    const tw = g.measureText(tick).width;
    const toff = (t * 60) % tw;
    g.save(); g.beginPath(); g.rect(0, 252, 512, 36); g.clip();
    g.fillText(tick, 12 - toff, 278); g.fillText(tick, 12 - toff + tw, 278);
    g.restore();
    scr.tex.needsUpdate = true;
  }
  api.updateScreens = (lines, t) => screens.forEach(s => drawScreen(s, lines, t));

  // --- sakura petals ------------------------------------------------------------
  const petalN = 1000;
  const petalPos = new Float32Array(petalN * 3);
  const petalSeed = new Float32Array(petalN);
  for (let i = 0; i < petalN; i++) {
    petalPos[i * 3] = rand(-300, 360);
    petalPos[i * 3 + 1] = rand(0, 70);
    petalPos[i * 3 + 2] = rand(-290, 300);
    petalSeed[i] = Math.random() * 100;
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({
    color: 0xffb3cf, size: 0.55, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  scene.add(petals);

  // --- particle pools (smoke / sparks) --------------------------------------------
  function makePool(n, size, colFn) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3), life = new Float32Array(n), maxLife = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true,
      opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    let cursor = 0;
    const c = new THREE.Color();
    return {
      emit(x, y, z, vx, vy, vz, l) {
        const i = cursor; cursor = (cursor + 1) % n;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
        life[i] = l; maxLife[i] = l;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
          life[i] -= dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          const k = Math.max(life[i] / maxLife[i], 0);
          c.copy(colFn).multiplyScalar(k * k);
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },
    };
  }
  const smoke = makePool(240, 1.1, new THREE.Color(0.16, 0.17, 0.2));
  const sparks = makePool(160, 0.3, new THREE.Color(3.0, 1.6, 0.5));

  api.fx = {
    smokeAt(x, y, z) { smoke.emit(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(1.2, 2.2), rand(-0.6, 0.6), rand(0.5, 0.9)); },
    sparksAt(x, y, z) {
      for (let k = 0; k < 5; k++)
        sparks.emit(x, y, z, rand(-4, 4), rand(1, 5), rand(-4, 4), rand(0.2, 0.5));
    },
  };

  // --- per-frame update ------------------------------------------------------------
  api.update = (dt, t) => {
    for (const a of animators) a(dt, t);
    const pp = petalGeo.attributes.position;
    for (let i = 0; i < petalN; i++) {
      let y = pp.getY(i) - dt * (1.1 + (petalSeed[i] % 1) * 1.6);
      let x = pp.getX(i) + Math.sin(t * 1.2 + petalSeed[i]) * dt * 1.6;
      let z = pp.getZ(i) + Math.cos(t * 0.9 + petalSeed[i] * 2) * dt * 1.2;
      if (y < 0.3) { y = rand(45, 70); x = rand(-300, 360); z = rand(-290, 300); }
      pp.setY(i, y); pp.setX(i, x); pp.setZ(i, z);
    }
    pp.needsUpdate = true;
    smoke.update(dt); sparks.update(dt);
  };

  return api;
}
