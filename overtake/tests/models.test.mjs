import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

test('Drive cars are valid, paintable compressed glTF assets', async () => {
  for (const id of ['r8', 'challenger']) {
    const doc = await io.read(new URL(`../public/models/${id}.glb`, import.meta.url).pathname);
    assert.ok(doc.getRoot().listMeshes().length > 0);
    assert.ok(doc.getRoot().listMaterials().some(m => m.getName().startsWith('paint__')));
    assert.ok(doc.getRoot().listMaterials().some(m => m.getName().startsWith('tire__')));
  }
});

test('Ferrari has no detached studio primitive and its front wheels are straight', async () => {
  const doc = await io.read(new URL('../public/models/ferrari.glb', import.meta.url).pathname);
  const primitives = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives());
  assert.ok(primitives.every(p => p.getMaterial()));
  const tire = primitives.find(p => p.getMaterial().getName() === 'tire__Tire.002');
  assert.ok(tire);
  const arr = tire.getAttribute('POSITION').getArray(), angle = 13.5 * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), points = [];
  for (let i = 0; i < arr.length; i += 3) {
    const x = c * arr[i] + s * arr[i+2], z = -s * arr[i] + c * arr[i+2];
    if (x > 0 && z > 0) points.push([x, z]);
  }
  const cx = points.reduce((sum,p) => sum+p[0],0)/points.length;
  const cz = points.reduce((sum,p) => sum+p[1],0)/points.length;
  let xx=0, xz=0, zz=0;
  for (const [x,z] of points) { xx+=(x-cx)**2; xz+=(x-cx)*(z-cz); zz+=(z-cz)**2; }
  const yaw = .5 * Math.atan2(2*xz, zz-xx) * 180 / Math.PI;
  assert.ok(Math.abs(yaw) < 3, `front wheel is turned ${yaw} degrees`);
});

test('car body normals remain consistent with their panel surfaces', async () => {
  // Large disagreement between face and vertex normals produces triangular
  // highlights even when the mesh has smooth shading enabled.
  for (const id of ['mercedes', 'audi', 'mustang', 'ferrari', 'r8', 'challenger']) {
    const doc = await io.read(new URL(`../public/models/${id}.glb`, import.meta.url).pathname);
    let count = 0, bad = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      if (!prim.getMaterial()?.getName().startsWith('paint__')) continue;
      const pos = prim.getAttribute('POSITION').getArray();
      const normal = prim.getAttribute('NORMAL').getArray();
      const indices = prim.getIndices().getArray();
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        const length = Math.hypot(x, y, z);
        if (length < 1e-12) continue;
        for (const j of [a, b, c]) {
          count++;
          const dot = (x * normal[j] + y * normal[j + 1] + z * normal[j + 2]) / length;
          if (!Number.isFinite(dot) || dot < 0.8) bad++;
        }
      }
    }
    assert.ok(count > 0 && bad / count < (id === 'challenger' ? 0.07 : 0.03), `${id}: ${bad}/${count} divergent normals`);
  }
});

test('Challenger keeps enough roof detail without an excessive triangle budget', async () => {
  const doc = await io.read(new URL('../public/models/challenger.glb', import.meta.url).pathname);
  const roof = doc.getRoot().listNodes().find(n => n.getName() === 'Plane.003_Plane.035');
  assert.ok(roof?.getMesh());
  const roofTriangles = roof.getMesh().listPrimitives().reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
  assert.ok(roofTriangles > 20000, `roof was over-simplified: ${roofTriangles}`);
  const allTriangles = doc.getRoot().listMeshes().reduce((sum, m) => sum + m.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0), 0);
  assert.ok(allTriangles < 400000, `Challenger too expensive for traffic: ${allTriangles}`);
});
