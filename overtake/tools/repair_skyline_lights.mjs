// Repair creased shading only on the Skyline's rear lamp surrounds, without
// moving the body, changing its other normals, or touching the lamp meshes.
// Usage: node tools/repair_skyline_lights.mjs input.glb output.glb
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { unweldPrimitive, weldPrimitive } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
const [source,dest] = process.argv.slice(2);
if (!source || !dest || source === dest) throw new Error('Provide distinct input and output GLBs');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(source);let changed=0;
for(const mesh of doc.getRoot().listMeshes()) for(const prim of mesh.listPrimitives()) {
  if(!prim.getMaterial()?.getName().startsWith('paint__') || prim.getMode()!==4) continue;
  unweldPrimitive(prim);
  const pos=prim.getAttribute('POSITION'), old=prim.getAttribute('NORMAL'), verts=pos.getArray(), normals=old.getArray();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(verts,3));
  const smooth=toCreasedNormals(geometry,Math.PI/3), candidate=smooth.getAttribute('normal').array;
  const output=new Float32Array(normals);
  for(let i=0;i<verts.length;i+=3) {
    const x=Math.abs(verts[i]),y=verts[i+1],z=verts[i+2];
    if(x>.34 && x<.82 && y>.71 && y<.98 && z>2.035) {
      output[i]=candidate[i];output[i+1]=candidate[i+1];output[i+2]=candidate[i+2];changed++;
    }
  }
  const normal=doc.createAccessor().setType('VEC3').setBuffer(pos.getBuffer()).setArray(output);
  prim.setAttribute('NORMAL',normal);if(old.listParents().length===1)old.dispose();
  const tangent=prim.getAttribute('TANGENT');if(tangent){prim.setAttribute('TANGENT',null);if(tangent.listParents().length===1)tangent.dispose()}
  weldPrimitive(prim);geometry.dispose();smooth.dispose();
}
if(!changed)throw Error('No Skyline lamp-surround vertices found');
await io.write(dest,doc);console.log(`Smoothed ${changed} lamp-surround vertices`);
