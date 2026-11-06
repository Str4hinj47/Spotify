import * as THREE from 'three';
import type { TrafficId } from './catalog';

// Only include materials/components known to belong to rotating assemblies.
// Brake calipers stay on the body. Mixed wheel/body materials are clipped
// to measured wheel volumes rather than spinning the whole mesh.
function rotates(id: TrafficId, mesh: THREE.Mesh): boolean {
  if (Array.isArray(mesh.material)) return false;
  const name = mesh.material.name;
  if (id === 'golf') return /^(tire__New-Tyre|rim__Alloys|brake__Brake-discs|other__Wheel-nuts)$/.test(name);
  if (id === 'mercedes') return /^(tire__W222 - Wheel|rim__W222 - Rims(?:#2)?)$/.test(name);
  if (id === 'audi') return /^(tire__tire\.001|rim__RIM BRIGHT|rim__RIM DARK|carbon__carbon disk brake)$/.test(name);
  if (id === 'mustang') return /^(tire__M_Tire1|rim__M_Rim[12]|brake__M_BrakePad2)$/.test(name);
  if (id === 'ferrari') return /^(tire__Tire\.00[02]|rim__Rims\.000|brake__Break_Discs\.000)$/.test(name);
  if (id === 'r8') return name === 'tire__r8' || name === 'rim__r8' || /^metal_2(?:_(?:[1-5]|1[1-6]))?$/.test(mesh.name);
  if (id === 'semi') return /^(tire__TireRubber|tire__TireTreads|chrome__Chrome)$/.test(name);
  if (id === 'kraz') return /^(tire__tire|chrome__wheel)$/.test(name);
  if (id === 'challenger') return name === 'tire__challenger' || (name === 'rim__challenger' && /^mesh_(?:40|44|48|52)(?:_1)?$/.test(mesh.name)) ||
    /^Volkswagen_Touareg_Hybrid_Wheel_OBJ(?:004|007|014|015|010|011|002|005)(?:_|$)/.test(mesh.name);
  return false;
}

/** Split the source's merged wheel primitives once; clones share the buffers. */
export function rigWheels(root: THREE.Group, id: TrafficId): void {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const point = new THREE.Vector3();
  const truck = id === 'semi' || id === 'kraz';
  let centers: THREE.Vector3[], radii: number[];
  if (truck) {
    // These models merge wheels with other parts. Axles were measured after
    // normalization; both dual tires on a side rotate about the same axle.
    const axles = id === 'semi' ? [-7.36, -2.985, -2.055, 6.245, 7.195] : [-2.965, 1.345, 2.865];
    const radius = id === 'semi' ? .397 : .695;
    centers = axles.flatMap(z => [-1, 1].map(side => new THREE.Vector3(side, radius, z)));
    radii = centers.map(() => radius);
  } else {
    const bounds = Array.from({ length: 4 }, () => new THREE.Box3().makeEmpty());
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
    centers = bounds.map(b => b.getCenter(new THREE.Vector3()));
    radii = bounds.map(b => (b.max.y - b.min.y) / 2);
  }
  const pivots = centers.map((center, i) => {
    const pivot = new THREE.Group();
    pivot.name = `wheel_pivot_${i}`;
    pivot.position.copy(center);
    pivot.userData.wheelRadius = radii[i];
    root.add(pivot);
    return pivot;
  });
  root.updateMatrixWorld(true);
  for (const mesh of meshes) {
    if (!rotates(id, mesh)) continue;
    const geometry = mesh.geometry, pos = geometry.getAttribute('position'), index = geometry.index;
    if (!pos) continue;
    const triangles: number[][] = centers.map(() => []);
    const stationary: number[] = [];
    const mixedAudi = id === 'audi' && !Array.isArray(mesh.material) && mesh.material.name === 'rim__RIM DARK';
    const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      let x = 0, y = 0, z = 0;
      const indices: number[] = [];
      for (let j = 0; j < 3; j++) {
        const n = index ? index.getX(i + j) : i + j;
        indices.push(n);
        point.fromBufferAttribute(pos, n).applyMatrix4(mesh.matrixWorld);
        vertices[j].copy(point);
        x += point.x; y += point.y; z += point.z;
      }
      let wheel = (x > 0 ? 1 : 0) + (z > 0 ? 2 : 0);
      if (truck) {
        x /= 3; y /= 3; z /= 3;
        wheel = centers.findIndex((c, n) => Math.sign(x) === Math.sign(c.x) && Math.abs(x) > (id === 'semi' ? .58 : .75) &&
          Math.hypot(y - c.y, z - c.z) < radii[n] * 1.035);
      }
      if (mixedAudi) {
        const center = centers[wheel];
        // The dark alloy lies inside a clear gap before the body wheel arch.
        // Require all three vertices inside it to avoid pulling body triangles.
        if (!vertices.every(v => Math.sign(v.x) === Math.sign(center.x) && Math.abs(v.x) > .65 &&
          Math.hypot(v.y - center.y, v.z - center.z) < .32)) wheel = -1;
      }
      (wheel < 0 ? stationary : triangles[wheel]).push(...indices);
    }
    for (let i = 0; i < centers.length; i++) {
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
    // drawing only non-wheel triangles there for mixed-material truck meshes.
    const empty = new THREE.BufferGeometry();
    for (const name of Object.keys(geometry.attributes)) empty.setAttribute(name, geometry.getAttribute(name));
    empty.setIndex(stationary);
    mesh.geometry = empty;
  }
  // The Golf source mesh was exported with its front wheels turned left,
  // unlike its straight rear wheels. Correct the baked-in toe at the pivot
  // so the tires, rims, discs and nuts rotate together on a straight axle.
  if (id === 'golf') {
    pivots[0].rotation.y = THREE.MathUtils.degToRad(10.89);
    pivots[1].rotation.y = THREE.MathUtils.degToRad(12.70);
  }
}

export function spinWheels(car: THREE.Group, distance: number): void {
  const wheels = car.userData.wheels as THREE.Group[] | undefined;
  if (!wheels || !distance) return;
  for (const wheel of wheels) wheel.rotation.x = (wheel.rotation.x - distance / wheel.userData.wheelRadius) % (Math.PI * 2);
}
