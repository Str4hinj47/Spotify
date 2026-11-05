// The OBJ has both front and rear lens meshes named "glass lamp". Repair the
// rear lenses that were incorrectly exported as white headlights.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const path = 'public/models/r8.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(path);
const rear = doc.getRoot().listMaterials().find(m => m.getName() === 'taillight__r8');
if (!rear) throw new Error('R8 rear light material not found');
let count = 0;
for (const node of doc.getRoot().listNodes()) {
  if (node.getName() !== 'glass lamp' || !node.getMesh()) continue;
  for (const primitive of node.getMesh().listPrimitives()) {
    const pos = primitive.getAttribute('POSITION');
    if (pos && pos.getMax([])[2] < 0) { primitive.setMaterial(rear); count++; }
  }
}
if (count < 2) throw new Error(`Expected rear R8 lenses, found ${count}`);
await io.write(path, doc);
