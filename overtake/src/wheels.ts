import * as THREE from 'three';
import type { TrafficId } from './catalog';

// Only include materials/components known to belong to rotating assemblies.
// Brake calipers stay on the body. The RS6's dark rim material also contains
// bodywork, so only its separate bright alloy is included.
function rotates(id: TrafficId, mesh: THREE.Mesh): boolean {
  if (Array.isArray(mesh.material)) return false;
  const name = mesh.material.name;
  if (id === 'golf') return /^(tire__New-Tyre|rim__Alloys|brake__Brake-discs|other__Wheel-nuts)$/.test(name);
  if (id === 'mercedes') return /^(tire__W222 - Wheel|rim__W222 - Rims(?:#2)?)$/.test(name);
  if (id === 'audi') return /^(tire__tire\.001|rim__RIM BRIGHT|carbon__carbon disk brake)$/.test(name);
  if (id === 'mustang') return /^(tire__M_Tire1|rim__M_Rim[12]|brake__M_BrakePad2)$/.test(name);
  if (id === 'ferrari') return /^(tire__Tire\.00[02]|rim__Rims\.000|brake__Break_Discs\.000)$/.test(name);
  if (id === 'r8') return name === 'tire__r8' || name === 'rim__r8' || /^metal_2(?:_(?:[1-5]|1[1-6]))?$/.test(mesh.name);
  if (id === 'challenger') return name === 'tire__challenger' || (name === 'rim__challenger' && /^mesh_(?:40|44|48|52)(?:_1)?$/.test(mesh.name)) ||
    /^Volkswagen_Touareg_Hybrid_Wheel_OBJ(?:004|007|014|015|010|011|002|005)(?:_|$)/.test(mesh.name);
  return false;
}

/** Split the source's merged wheel primitives once; clones share the buffers. */
export function rigWheels(root: THREE.Group, id: TrafficId): void {
  if (id === 'semi' || id === 'kraz') return;
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const bounds = Array.from({ length: 4 }, () => new THREE.Box3().makeEmpty());
  const point = new THREE.Vector3();
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material) || !mesh.material.name.startsWith('tire__')) continue;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (point.y > .8 || Math.abs(point.x) < .3 || Math.abs(point.z) < .4) continue;
      bounds[(point.x > 0 ? 1 : 0) + (point.z > 0 ? 2 : 0)].expandByPoint(point);
    }
  }
  if (bounds.some(b => b.isEmpty())) return;
  const centers = bounds.map(b => b.getCenter(new THREE.Vector3()));
  const pivots = centers.map((center, i) => {
    const pivot = new THREE.Group();
    pivot.name = `wheel_pivot_${i}`;
    pivot.position.copy(center);
    pivot.userData.wheelRadius = (bounds[i].max.y - bounds[i].min.y) / 2;
    root.add(pivot);
    return pivot;
  });
  root.updateMatrixWorld(true);
  for (const mesh of meshes) {
    if (!rotates(id, mesh)) continue;
    const geometry = mesh.geometry, pos = geometry.getAttribute('position'), index = geometry.index;
    if (!pos) continue;
    const triangles: number[][] = [[], [], [], []];
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      let x = 0, z = 0;
      const indices: number[] = [];
      for (let j = 0; j < 3; j++) {
        const n = index ? index.getX(i + j) : i + j;
        indices.push(n);
        point.fromBufferAttribute(pos, n).applyMatrix4(mesh.matrixWorld);
        x += point.x; z += point.z;
      }
      triangles[(x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)].push(...indices);
    }
    for (let i = 0; i < 4; i++) {
      if (!triangles[i].length) continue;
      const partGeometry = new THREE.BufferGeometry();
      for (const name of Object.keys(geometry.attributes)) partGeometry.setAttribute(name, geometry.getAttribute(name));
      partGeometry.setIndex(triangles[i]);
      const part = mesh.clone(false);
      part.name = `${mesh.name}_rotating_${i}`;
      part.geometry = partGeometry;
      mesh.parent!.add(part);
      part.updateWorldMatrix(true, false);
      pivots[i].attach(part);
    }
    // Keep the original object in the hierarchy for name-based customization,
    // but draw the triangles only from the independent wheel pivots.
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', pos);
    empty.setIndex([]);
    mesh.geometry = empty;
  }
}

export function spinWheels(car: THREE.Group, distance: number): void {
  const wheels = car.userData.wheels as THREE.Group[] | undefined;
  if (!wheels || !distance) return;
  for (const wheel of wheels) wheel.rotation.x = (wheel.rotation.x - distance / wheel.userData.wheelRadius) % (Math.PI * 2);
}
