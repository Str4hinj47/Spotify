import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared geometry is instanced for every roadside slot: layered crowns and
// branching trunks give recognizable trees without hundreds of draw calls.
function merge(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!;
  parts.forEach(p => p.dispose());
  return result;
}
function branch(from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const d = to.clone().sub(from);
  const geo = new THREE.CylinderGeometry(radius * 0.35, radius, d.length(), 7);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  geo.translate((to.x + from.x) / 2, (to.y + from.y) / 2, (to.z + from.z) / 2);
  return geo;
}
function shade(geo: THREE.BufferGeometry, value: number) {
  const color = new Float32Array(geo.getAttribute('position').count * 3);
  color.fill(value);
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return geo;
}
export function createTreeGeometries() {
  const wood: THREE.BufferGeometry[] = [branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5.6, 0), 0.32)];
  const leaves: THREE.BufferGeometry[] = [];
  // Several overlapping lobes form an irregular, multi-toned broadleaf crown.
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996;
    const radius = i === 0 ? 0 : 0.65 + (i % 5) * 0.36;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const y = 4.2 + (i % 4) * 0.62 + (i % 3) * 0.15;
    if (i < 10) wood.push(branch(new THREE.Vector3(0, 2.4 + (i % 3) * 0.35, 0), new THREE.Vector3(x, y, z), 0.12));
    const lobe = new THREE.IcosahedronGeometry(1, 2);
    lobe.scale(1.1 + (i % 3) * 0.14, 0.8 + (i % 4) * 0.08, 1.05 + (i % 2) * 0.2);
    lobe.translate(x, y, z);
    leaves.push(shade(lobe, 0.68 + (i % 5) * 0.07));
  }
  const pineWood = [branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 9.5, 0), 0.22)];
  const needles: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const radius = 2.1 - i * 0.23;
    const crown = new THREE.ConeGeometry(radius, 3.2 - i * 0.12, 11, 2);
    crown.translate(0, 2.3 + i * 1.03, 0);
    needles.push(shade(crown, 0.72 + (i % 3) * 0.08));
  }
  return { broadWood: merge(wood), broadCrown: merge(leaves), pineWood: merge(pineWood), pineCrown: merge(needles) };
}
