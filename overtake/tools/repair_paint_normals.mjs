// Repair shading on already-converted car body panels, without moving any
// vertices. Run on an original GLB and write to a separate output path:
//   node tools/repair_paint_normals.mjs original.glb repaired.glb
// Keeps intentional panel creases, UVs and materials. Authored wheel normals
// and glass are deliberately left alone.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { unweldPrimitive, weldPrimitive } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [source, dest] = process.argv.slice(2);
if (!source || !dest || source === dest) throw new Error('Provide distinct input and output GLB paths');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(source);
let repaired = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  if (!prim.getMaterial()?.getName().startsWith('paint__') || prim.getMode() !== 4) continue;
  unweldPrimitive(prim);
  const position = prim.getAttribute('POSITION');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position.getArray(), 3));
  const smoothed = toCreasedNormals(geometry, Math.PI / 3);
  const normal = doc.createAccessor().setType('VEC3').setBuffer(position.getBuffer())
    .setArray(smoothed.getAttribute('normal').array);
  const oldNormal = prim.getAttribute('NORMAL');
  prim.setAttribute('NORMAL', normal);
  if (oldNormal?.listParents().length === 1) oldNormal.dispose();
  // A tangent derived from the old normals would be invalid. The body paint
  // uses no normal map; tangents can be regenerated if one is added later.
  const tangent = prim.getAttribute('TANGENT');
  if (tangent) { prim.setAttribute('TANGENT', null); if (tangent.listParents().length === 1) tangent.dispose(); }
  weldPrimitive(prim);
  geometry.dispose();
  repaired++;
}
await io.write(dest, doc);
console.log(`Repaired ${repaired} paint primitives: ${dest}`);
