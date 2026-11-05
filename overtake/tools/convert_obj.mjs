// Converts user-provided OBJ files into compact glTF. Requires npm packages
// @gltf-transform/core, @gltf-transform/functions and meshoptimizer.
import fs from 'node:fs';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { weld, simplifyPrimitive, dedup, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); } };
const [id, input] = process.argv.slice(2);
if (!['r8','challenger'].includes(id) || !input) throw Error('Usage: node tools/convert_obj.mjs r8|challenger input.obj');
const model = new OBJLoader().parse(fs.readFileSync(input, 'utf8'));
const lines = []; model.traverse(o => { if (o.isLine || o.isPoints) lines.push(o); });
for (const line of lines) line.removeFromParent();
const bounds = new THREE.Box3().setFromObject(model);
const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
const scale = (id === 'r8' ? 4.43 : 5.03) / size.z;
const palette = {
 paint: [id === 'r8' ? 0xb3bbc3 : 0x3f7843, .5,.28], glass:[0x141c24,.15,.12],
 tire:[0x1a1b1d,0,.9], rim:[0x858b90,.8,.28], trim:[0x25272a,.12,.55],
 chrome:[0xa3abb1,.8,.2], headlight:[0xe4edff,.15,.2], taillight:[0xa71515,.15,.25],
};
const mats = new Map();
function classify(mesh, mat) {
 const n = (mesh.name + ' ' + mat.name).toLowerCase();
 // Both ends of the R8 are called "glass lamp" in the OBJ; the rear
 // lenses are at negative source Z and must not become white headlights.
 if (id === 'r8' && /glass lamp/.test(n)) {
  mesh.geometry.computeBoundingBox();
  if (mesh.geometry.boundingBox?.max.z < 0) return 'taillight';
 }
 if (/tail.?light/.test(n)) return 'taillight';
 if (/headlight|daylights|glass lamp|emissive/.test(n)) return 'headlight';
 if (/window|glass/.test(n)) return 'glass';
 if (/tyre|tire/.test(n)) return 'tire';
 if (/rims|wire_/.test(n)) return 'rim';
 if (/chrome|alumini|aluminum|steel/.test(n)) return 'chrome';
 if (/body color|greenbody/.test(n)) return 'paint';
 return 'trim';
}
model.traverse(mesh => {
 if (!mesh.isMesh) return;
 const convert = mat => {
  const category = classify(mesh,mat); if (mats.has(category)) return mats.get(category);
  const [color,metalness,roughness] = palette[category];
  const material = new THREE.MeshStandardMaterial({color,metalness,roughness});
  material.name = category+'__'+id;
  if (category === 'headlight' || category === 'taillight') { material.emissive.set(color); material.emissiveIntensity = .8; }
  mats.set(category, material); return material;
 };
 mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
 // Preserve authored split normals and prevent z-fighting artifacts caused by
 // transparent glass without matching source material definitions.
});
model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
model.scale.setScalar(scale);
const bytes = await new GLTFExporter().parseAsync(model, {binary:true});
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.readBinary(new Uint8Array(bytes));
await MeshoptSimplifier.ready;
await doc.transform(dedup(), weld({tolerance:0.0001}));
// Keep body panels close to their authored surfaces: aggressive decimation
// produced large triangular dents and warped specular highlights. Detail such
// as the wheel internals can be simplified much more aggressively instead.
for (const node of doc.getRoot().listNodes()) {
 const mesh = node.getMesh();
 if (!mesh) continue;
 for (const prim of mesh.listPrimitives()) {
  const body = prim.getMaterial()?.getName().startsWith('paint__') ||
   (id === 'challenger' && node.getName() === 'Plane_Plane.032'); // hood
  const wheel = id === 'challenger' && node.getName().includes('Wheel_OBJ');
  simplifyPrimitive(prim, {simplifier:MeshoptSimplifier,
   ratio: body ? 1 : wheel ? 0.16 : 0.28,
   error: body ? 0.00003 : wheel ? 0.01 : 0.0005});
 }
}
await doc.transform(draco());
const out = `public/models/${id}.glb`;
await io.write(out,doc);
console.log(id, 'source dimensions',size.toArray(), 'output bytes',fs.statSync(out).size);
