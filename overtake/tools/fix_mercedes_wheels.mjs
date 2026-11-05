// Repair the source's generically named wheel material, which represents the
// rubber tires rather than the separately authored alloy rim meshes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const path = 'public/models/mercedes.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(path);
const tire = doc.getRoot().listMaterials().find(m => m.getName() === 'other__W222 - Wheel' || m.getName() === 'tire__W222 - Wheel');
if (!tire) throw new Error('Mercedes wheel material not found');
tire.setName('tire__W222 - Wheel').setBaseColorFactor([0.018, 0.018, 0.02, 1]).setMetallicFactor(0).setRoughnessFactor(0.9);
await io.write(path, doc);
