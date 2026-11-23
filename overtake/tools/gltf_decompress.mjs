// Decode a Draco-compressed GLB into a plain GLB that tools lacking the native
// Draco shared library (Blender's bpy wheel, for one) can still read.
// The reader needs the Draco extension registered; the writer must NOT have it,
// or @gltf-transform re-compresses every primitive on the way out.
// Usage: node tools/gltf_decompress.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node tools/gltf_decompress.mjs <in.glb> <out.glb>');
const reader = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await reader.read(input);
const writer = new NodeIO().registerExtensions(
  KHRONOS_EXTENSIONS.filter((e) => e.EXTENSION_NAME !== "KHR_draco_mesh_compression"));
const bytes = await writer.writeBinary(doc);
fs.writeFileSync(output, Buffer.from(bytes));
console.log(`${input} -> ${output}  ${bytes.byteLength} bytes  dracoLeft=${
  Buffer.from(bytes).includes('KHR_draco_mesh_compression')}`);
