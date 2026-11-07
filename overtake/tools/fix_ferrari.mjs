// Correct baked-in 24.4 degree steering and remove a detached source artifact.
// Run on the original Ferrari GLB, before overwriting it. Requires
// @gltf-transform/core, @gltf-transform/extensions, and draco3dgltf.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const [source, dest] = process.argv.slice(2);
if (!source || !dest || source === dest) throw Error('Usage: node tools/fix_ferrari.mjs original.glb fixed.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(source);
const a = 13.5 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
const b = 24.4 * Math.PI / 180, cb = Math.cos(b), sb = Math.sin(b);
for (const mesh of doc.getRoot().listMeshes()) for (const p of [...mesh.listPrimitives()]) {
 const name = p.getMaterial()?.getName();
 // The only material-less primitive is a floating, disconnected studio sphere.
 if (!name) { mesh.removePrimitive(p); continue; }
 if (!/^(tire__|rim__|brake__|logo__Logo_Wheel)/.test(name)) continue;
 const pos = p.getAttribute('POSITION').getArray(), normal = p.getAttribute('NORMAL')?.getArray();
 for (let i=0; i<pos.length; i+=3) {
  let x=c*pos[i]+s*pos[i+2], z=-s*pos[i]+c*pos[i+2];
  if (z < 0) continue;
  const px=x<0 ? -0.844 : 0.777, pz=0.82;
  const dx=x-px, dz=z-pz;
  x=px+cb*dx+sb*dz; z=pz-sb*dx+cb*dz;
  pos[i]=c*x-s*z; pos[i+2]=s*x+c*z;
  if (normal) { const nx=normal[i], nz=normal[i+2]; normal[i]=cb*nx+sb*nz; normal[i+2]=-sb*nx+cb*nz; }
 }
}
await io.write(dest,doc);
