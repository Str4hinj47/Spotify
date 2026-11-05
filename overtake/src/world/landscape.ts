import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A continuous, seamless ring with several broad peaks and smaller ridges.
// Geometry is fixed in the horizon's local space; unlike individual cones it
// cannot create gaps as the camera changes direction.
export function createRidgeGeometry(radius: number, height: number, phase: number) {
  const segments = 256, levels = 6;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ridges = Math.pow(0.5 + 0.5 * Math.sin(a * 5 + phase), 1.8) * 0.45
      + Math.pow(0.5 + 0.5 * Math.sin(a * 9 - phase * 0.7), 2.8) * 0.28
      + (0.5 + 0.5 * Math.sin(a * 17 + phase * 2)) * 0.11
      + (0.5 + 0.5 * Math.sin(a * 31 - phase)) * 0.05;
    const peak = height * (0.22 + ridges);
    for (let row = 0; row <= levels; row++) {
      const t = row / levels;
      // Subtle ridgelines and eroded spurs give the slopes depth without
      // introducing separate cones or gaps between horizon segments.
      const erosion = Math.sin(a * 43 + phase + t * 4) * Math.sin(a * 19 - phase - t * 7);
      const r = radius + 16 * Math.sin(a * 7 + phase) + erosion * 9 * (1 - t);
      const y = -32 + (peak + 32) * t;
      const shade = Math.max(0.55, Math.min(1, 0.68 + t * 0.23 + erosion * 0.08 * Math.sin(t * Math.PI)));
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      colors.push(shade, shade, shade);
      if (i < segments && row < levels) {
        const n = i * (levels + 1) + row;
        indices.push(n, n + levels + 1, n + 1, n + 1, n + levels + 1, n + levels + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function tinted(geo: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex), data = new Float32Array(geo.getAttribute('position').count * 3);
  for (let i = 0; i < data.length; i += 3) { data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geo;
}

// A simple facade, rather than featureless boxes. All pieces are merged to
// keep a single instanced draw call and remain readable from the road.
export function createBuildingGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(tinted(g, color));
  };
  box(8, 12, 8, 0, 6, 0, 0xe4e2dc);
  box(8.5, 0.7, 8.5, 0, 12.1, 0, 0x858b8a);
  box(3, 0.8, 3, 0, 12.8, 0, 0xaeb4af);
  // Cornices, a ground-floor entrance and roof equipment read as architecture
  // rather than a featureless cube, while staying part of one instanced mesh.
  box(8.25, 0.28, 8.25, 0, 0.55, 0, 0x999c98);
  for (const y of [4.15, 9.55]) box(8.12, 0.12, 8.12, 0, y, 0, 0xb8bbb5);
  box(1.4, 2.1, 0.07, 0, 1.15, 4.04, 0x3d4b50);
  box(1.7, 0.12, 0.3, 0, 2.22, 4.15, 0xb0b0aa);
  box(0.8, 0.55, 1.4, -2.0, 12.7, -1.7, 0x6e787a);
  for (const x of [-2.3, 0, 2.3]) for (const y of [2.5, 5.2, 7.9, 10.6]) {
    box(1.1, 1.4, 0.05, x, y, 4.03, 0x536979);
    box(1.1, 1.4, 0.05, x, y, -4.03, 0x536979);
    box(0.05, 1.4, 1.1, 4.03, y, x, 0x536979);
    box(0.05, 1.4, 1.1, -4.03, y, x, 0x536979);
  }
  const result = mergeGeometries(parts, false)!;
  parts.forEach(p => p.dispose());
  return result;
}


// Faceted, slightly irregular boulders. Deforming by position keeps the shared
// corners coincident; individual rock instances are still just one draw call.
export function createRockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1.6, 1);
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const irregular = 0.88 + 0.10 * Math.sin(x * 3.1 + y * 1.7 + z * 2.3) + 0.06 * Math.cos(x * 2.6 - z * 2.1);
    pos.setXYZ(i, x * irregular * 1.15, y * irregular * 0.78, z * irregular);
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const shade = 0.76 + Math.max(0, normals.getY(i)) * 0.18 + 0.05 * Math.sin(pos.getX(i) * 7 + pos.getZ(i) * 5);
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Crossed, low-poly meadow tufts; instanced outside the driving corridor.
export function createGrassGeometry() {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, x = Math.cos(a) * (i % 2) * 0.32, z = Math.sin(a) * (i % 2) * 0.32;
    const dx = Math.cos(a) * 0.28, dz = Math.sin(a) * 0.28;
    const n = positions.length / 3;
    positions.push(x-dx,0,z-dz, x+dx,0,z+dz, x+dx*0.35,0.65+(i%3)*0.14,z+dz*0.35);
    const shade = 0.65 + i * 0.07;
    colors.push(shade,shade,shade, shade,shade,shade, 1,1,1);
    indices.push(n,n+1,n+2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

// Far trees deliberately use a much smaller mesh than the hero roadside trees.
export function createDistantTreeGeometries() {
  const lobes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(1.4, 1.1, 1.4);
    g.translate(Math.cos(a) * 0.9, 4.1 + (i % 2) * 0.7, Math.sin(a) * 0.9);
    lobes.push(tinted(g, i % 2 ? 0xcccccc : 0xffffff));
  }
  const crown = mergeGeometries(lobes, false)!;
  lobes.forEach(p => p.dispose());
  const cones: THREE.BufferGeometry[] = [];
  for (let i=0;i<3;i++) {
    const g = new THREE.ConeGeometry(2 - i * 0.42, 4.1, 7);
    g.translate(0, 3 + i * 1.8, 0);
    cones.push(tinted(g, i % 2 ? 0xd8d8d8 : 0xffffff));
  }
  const pine = mergeGeometries(cones, false)!;
  cones.forEach(p => p.dispose());
  const wood = new THREE.CylinderGeometry(0.22, 0.3, 5, 6);
  wood.translate(0, 2.5, 0);
  return { crown, pine, wood };
}
