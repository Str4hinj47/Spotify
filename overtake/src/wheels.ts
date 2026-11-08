import * as THREE from 'three';
import type { TrafficId } from './catalog';

// Only include materials/components known to belong to rotating assemblies.
// Brake calipers stay on the body. Mixed wheel/body materials are clipped
// to measured wheel volumes rather than spinning the whole mesh.
// Every new playable car must provide a reviewed wheel selection rule. The
// complete Record makes a missing rule a TypeScript build error, not a silent
// stationary-wheel regression.
const WHEEL_RULES: Record<TrafficId, (mesh: THREE.Mesh, material: string) => boolean> = {
  'bmw-m3': (_mesh, name) => /^(tire__Reifen|chrome__chrome|other__Bremsscheibe)$/.test(name),
  skyline: (_mesh, name) => /^(tire__RUBBERTYRE\.001|rim__GTR\.alloy.*)$/i.test(name),
  aventador: (_mesh, name) => /^(tire__pneu.*|rim__jante.*)$/.test(name),
  'aventador-game': (_mesh, name) => /^(tire__Rubber|other__BrushedMetal|brake__DiskBrakeTexture)$/.test(name),
  bugatti: (_mesh, name) => /^(tire__tyre.*|rim__rim_silver.*|rim__rim blue.*)$/i.test(name),
  'mercedes-560': (_mesh, name) => /^(tire__Tire_[01]|rim__Rim)$/.test(name),
  'range-rover': (_mesh, name) => /^(tire__Tire No Sidewall|rim__Glossy Black|rim__Chrome|rim__Blurry Chrome|rim__Diff Plastic)$/i.test(name),
  camry: (_mesh, name) => /^(tire__opom[ao].*|tire__opona.*|rim__felga)$/.test(name),
  golf: (_mesh, name) => /^(tire__New-Tyre|rim__Alloys|brake__Brake-discs|other__Wheel-nuts)$/.test(name),
  mercedes: (_mesh, name) => /^(tire__W222 - Wheel|rim__W222 - Rims(?:#2)?)$/.test(name),
  audi: (_mesh, name) => /^(tire__tire\.001|rim__RIM BRIGHT|rim__RIM DARK|carbon__carbon disk brake)$/.test(name),
  mustang: (_mesh, name) => /^(tire__M_Tire1|rim__M_Rim[12]|brake__M_BrakePad2)$/.test(name),
  ferrari: (_mesh, name) => /^(tire__Tire\.00[02]|rim__Rims\.000|brake__Break_Discs\.000)$/.test(name),
  r8: (mesh, name) => name === 'tire__r8' || name === 'rim__r8' || /^metal_2(?:_(?:[1-5]|1[1-6]))?$/.test(mesh.name),
  semi: (_mesh, name) => /^(tire__TireRubber|tire__TireTreads|chrome__Chrome)$/.test(name),
  kraz: (_mesh, name) => /^(tire__tire|chrome__wheel)$/.test(name),
  challenger: (mesh, name) => name === 'tire__challenger' || (name === 'rim__challenger' && /^mesh_(?:40|44|48|52)(?:_1)?$/.test(mesh.name)) ||
    /^Volkswagen_Touareg_Hybrid_Wheel_OBJ(?:004|007|014|015|010|011|002|005)(?:_|$)/.test(mesh.name),
};
function rotates(id: TrafficId, mesh: THREE.Mesh): boolean {
  return !Array.isArray(mesh.material) && WHEEL_RULES[id](mesh, mesh.material.name);
}

/** Split the source's merged wheel primitives once; clones share the buffers. */
export function rigWheels(root: THREE.Group, id: TrafficId): void {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const point = new THREE.Vector3();
  const truck = id === 'semi' || id === 'kraz';
  let centers: THREE.Vector3[], radii: number[], halfWidths: number[];
  if (truck) {
    // These models merge wheels with other parts. Axles were measured after
    // normalization; both dual tires on a side rotate about the same axle.
    const axles = id === 'semi' ? [-7.36, -2.985, -2.055, 6.245, 7.195] : [-2.965, 1.345, 2.865];
    const radius = id === 'semi' ? .397 : .695;
    centers = axles.flatMap(z => [-1, 1].map(side => new THREE.Vector3(side, radius, z)));
    radii = centers.map(() => radius);
    halfWidths = centers.map(() => .15);
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
    halfWidths = bounds.map(b => (b.max.x - b.min.x) / 2);
  }
  const pivots = centers.map((center, i) => {
    const pivot = new THREE.Group();
    pivot.name = `wheel_pivot_${i}`;
    pivot.position.copy(center);
    pivot.userData.wheelRadius = radii[i];
    pivot.userData.wheelHalfWidth = halfWidths[i];
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
      const newMixed = (id === 'bmw-m3' || id === 'aventador-game' || id === 'mercedes-560') && !Array.isArray(mesh.material) && !mesh.material.name.startsWith('tire__');
      if (mixedAudi || newMixed) {
        const center = centers[wheel];
        // The dark alloy lies inside a clear gap before the body wheel arch.
        // Require all three vertices inside it to avoid pulling body triangles.
        if (!vertices.every(v => Math.sign(v.x) === Math.sign(center.x) && Math.abs(v.x) > .65 &&
          Math.hypot(v.y - center.y, v.z - center.z) < (newMixed ? radii[wheel] * 1.05 : .32))) wheel = -1;
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
  // The Camry's front tires are likewise baked in a steering pose.
  if (id === 'camry') {
    pivots[0].rotation.y = THREE.MathUtils.degToRad(24.56);
    pivots[1].rotation.y = THREE.MathUtils.degToRad(24.75);
  }
  if (id === 'golf') {
    // Bake the correction into the wheel children, not the spinning pivot.
    // Otherwise an aftermarket rim attached to that pivot inherits the old
    // steering angle and spins on a skewed axle even when the tire is straight.
    for(const [i,degrees] of [[0,10.89],[1,12.70]] as const) {
      const correction=new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(degrees));
      for(const child of pivots[i].children) child.applyMatrix4(correction);
    }
  }
}

export function spinWheels(car: THREE.Group, distance: number): void {
  const wheels = car.userData.wheels as THREE.Group[] | undefined;
  if (!wheels || !distance) return;
  for (const wheel of wheels) wheel.rotation.x = (wheel.rotation.x - distance / wheel.userData.wheelRadius) % (Math.PI * 2);
}
