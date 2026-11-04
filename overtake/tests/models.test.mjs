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
