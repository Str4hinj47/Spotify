import * as THREE from 'three';

// The converted GLBs are joined meshes. Split wheel-material triangles into
// four pivots at load time so the player car can steer and roll its wheels.
// If a model does not cluster cleanly, we leave it untouched rather than risk
// hiding bodywork.

export interface WheelRig {
  radius: number;
  count: number;
}

const LABELS = ['FL', 'FR', 'RL', 'RR'] as const;
type Label = typeof LABELS[number];

function isWheelMaterial(name: string) {
  if (!name) return false;
  if (/steering|arch/i.test(name)) return false;
  if (/^(tire|rim|brake)__/i.test(name)) return true;
  return /logo_wheel|wheel-nuts|wheel-centre|wheel-center|w222 - wheel$|disk brake|brake kit/i.test(name);
}

function materialName(mat: THREE.Material | THREE.Material[]) {
  return Array.isArray(mat) ? (mat[0]?.name ?? '') : (mat.name ?? '');
}

export function extractWheels(root: THREE.Group, size: THREE.Vector3): WheelRig {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const candidates: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    if (isWheelMaterial(materialName(mesh.material))) candidates.push(mesh);
  });
  if (!candidates.length) return { radius: 0.32, count: 0 };

  const x = size.x * 0.38;
  const z = size.z * 0.31;
  const seeds: Record<Label, THREE.Vector3> = {
    FL: new THREE.Vector3(-x, 0, -z),
    FR: new THREE.Vector3(x, 0, -z),
    RL: new THREE.Vector3(-x, 0, z),
    RR: new THREE.Vector3(x, 0, z),
  };
  type Bucket = { material: THREE.Material; positions: number[]; normals: number[]; uvs: number[] };
  const buckets: Record<Label, Bucket[]> = { FL: [], FR: [], RL: [], RR: [] };
  const boxes: Record<Label, THREE.Box3> = {
    FL: new THREE.Box3(), FR: new THREE.Box3(), RL: new THREE.Box3(), RR: new THREE.Box3(),
  };
  const counts: Record<Label, number> = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const p = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  for (const mesh of candidates) {
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    if (!pos) continue;
    const mat = invRoot.clone().multiply(mesh.matrixWorld);
    normalMat.getNormalMatrix(mat);
    const material = mesh.material as THREE.Material;
    const bucketFor = (label: Label) => {
      let b = buckets[label].find((q) => q.material === material);
      if (!b) { b = { material, positions: [], normals: [], uvs: [] }; buckets[label].push(b); }
      return b;
    };
    for (let i = 0; i < pos.count; i += 3) {
      c.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        p.fromBufferAttribute(pos, i + k).applyMatrix4(mat);
        c.add(p);
      }
      c.multiplyScalar(1 / 3);
      let label: Label = 'FL', best = Infinity;
      for (const l of LABELS) {
        const dx = c.x - seeds[l].x, dz = c.z - seeds[l].z;
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; label = l; }
      }
      const bucket = bucketFor(label);
      for (let k = 0; k < 3; k++) {
        p.fromBufferAttribute(pos, i + k).applyMatrix4(mat);
        bucket.positions.push(p.x, p.y, p.z);
        boxes[label].expandByPoint(p);
        if (nor) {
          n.fromBufferAttribute(nor, i + k).applyMatrix3(normalMat).normalize();
          bucket.normals.push(n.x, n.y, n.z);
        }
        if (uv) bucket.uvs.push(uv.getX(i + k), uv.getY(i + k));
      }
      counts[label] += 3;
    }
    if (geo !== mesh.geometry) geo.dispose();
  }

  if (LABELS.some((l) => counts[l] < 60)) return { radius: 0.32, count: 0 };

  let radiusSum = 0;
  for (const label of LABELS) {
    const box = boxes[label];
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.2, (box.max.y - box.min.y) * 0.5);
    center.y = box.min.y + radius;
    radiusSum += radius;
    const pivot = new THREE.Group();
    pivot.name = `wheel_${label}`;
    pivot.position.copy(center);
    pivot.userData.radius = radius;
    pivot.userData.front = label === 'FL' || label === 'FR';
    const spin = new THREE.Group();
    spin.name = `spin_${label}`;
    pivot.add(spin);
    for (const bucket of buckets[label]) {
      const g = new THREE.BufferGeometry();
      const positions = new Float32Array(bucket.positions.length);
      for (let i = 0; i < bucket.positions.length; i += 3) {
        positions[i] = bucket.positions[i] - center.x;
        positions[i + 1] = bucket.positions[i + 1] - center.y;
        positions[i + 2] = bucket.positions[i + 2] - center.z;
      }
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      if (bucket.normals.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
      if (bucket.uvs.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, bucket.material);
      mesh.name = `wheel_mesh_${label}`;
      spin.add(mesh);
    }
    root.add(pivot);
  }
  for (const mesh of candidates) mesh.parent?.remove(mesh);
  return { radius: radiusSum / 4, count: 4 };
}

export function animateWheels(wrapper: THREE.Object3D, speed: number, steerAngle: number, dt: number) {
  wrapper.traverse((o) => {
    if (!o.name.startsWith('wheel_') || o.name.startsWith('wheel_mesh')) return;
    const radius = (o.userData.radius as number) || 0.32;
    o.rotation.y = o.userData.front ? steerAngle : 0;
    const label = o.name.slice(6);
    const spin = o.getObjectByName(`spin_${label}`);
    if (spin) spin.rotation.x -= (speed / radius) * dt;
  });
}

export function countWheels(wrapper: THREE.Object3D) {
  let n = 0;
  wrapper.traverse((o) => { if (/^wheel_(FL|FR|RL|RR)$/.test(o.name)) n++; });
  return n;
}
