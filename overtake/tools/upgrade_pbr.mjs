// Bake Khronos physical-material extensions into the distributed car GLBs.
//
// Uses the open-source glTF-Transform packages (https://github.com/donmccurdy/glTF-Transform)
// and draco3dgltf. Geometry, textures and material names are preserved; only
// PBR factors/extensions on paint, glass and chrome change. Run from overtake/:
//   node tools/upgrade_pbr.mjs [id ...]
// The game also promotes paint materials at runtime, so this tool is safe to
// rerun after a fresh model conversion.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS, KHRMaterialsClearcoat, KHRMaterialsIOR, KHRMaterialsSpecular,
} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const ALL_IDS = ['golf', 'mercedes', 'audi', 'mustang', 'ferrari', 'r8', 'challenger', 'semi', 'kraz'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL_IDS;
if (ids.some(id => !ALL_IDS.includes(id))) throw new Error(`Unknown vehicle ID: ${ids.filter(id => !ALL_IDS.includes(id)).join(', ')}`);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const manifestPath = path.resolve('public/models/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

for (const id of ids) {
  const file = path.resolve(`public/models/${id}.glb`);
  const doc = await io.read(file);
  const clearcoatExt = doc.createExtension(KHRMaterialsClearcoat);
  const iorExt = doc.createExtension(KHRMaterialsIOR);
  const specularExt = doc.createExtension(KHRMaterialsSpecular);
  let count = 0;
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName();
    const paint = name.startsWith('paint__');
    const glass = name.startsWith('glass__');
    const chrome = name.startsWith('chrome__');
    if (!paint && !glass && !chrome) continue;
    if (paint) {
      material.setMetallicFactor(.55).setRoughnessFactor(.28);
      const clearcoat = clearcoatExt.createClearcoat()
        .setClearcoatFactor(.9)
        .setClearcoatRoughnessFactor(.075);
      material.setExtension(KHRMaterialsClearcoat.EXTENSION_NAME, clearcoat);
    }
    const ior = iorExt.createIOR().setIOR(glass ? 1.48 : 1.5);
    material.setExtension(KHRMaterialsIOR.EXTENSION_NAME, ior);
    const specular = specularExt.createSpecular()
      .setSpecularFactor(1)
      .setSpecularColorFactor([1, 1, 1]);
    material.setExtension(KHRMaterialsSpecular.EXTENSION_NAME, specular);
    count++;
  }
  // Keep the .glb suffix on the temporary file: NodeIO infers GLB vs glTF
  // from the extension, and a .tmp target would spill external .bin/images.
  const tmp = `${file}.tmp.glb`;
  await io.write(tmp, doc);
  fs.renameSync(tmp, file);
  if (manifest[id]) manifest[id].bytes = fs.statSync(file).size;
  console.log(`${id}: upgraded ${count} materials -> ${fs.statSync(file).size} bytes`);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
