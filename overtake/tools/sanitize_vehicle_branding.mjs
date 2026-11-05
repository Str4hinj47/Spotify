// Remove identified badges from the distributed GLBs. Golf and Mustang's
// separate logo objects are excluded by convert_assets.py before this step.
// Needs @gltf-transform, draco3dgltf, and Python 3 with Pillow for the W222
// texture atlas. Run after each conversion, not repeatedly on original sources.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import draco from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco.createDecoderModule(), 'draco3d.encoder': await draco.createEncoderModule(),
});
const allIds = ['golf','mercedes','audi','mustang','ferrari','r8','challenger'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : allIds;
if (ids.some(id => !allIds.includes(id))) throw new Error('Unknown vehicle ID');
const manifestPath = 'public/models/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const python = process.env.PYTHON || 'python3';

// Remove disconnected components whose bounding boxes match verified badges.
// Joining positions at 0.1 mm also reconnects UV/normal-split vertices.
function removeComponents(prim, matches) {
  const pos = prim.getAttribute('POSITION').getArray(), index = prim.getIndices();
  if (!index) return 0;
  const arr = index.getArray(), count = pos.length / 3, parent = Int32Array.from({length:count}, (_,i)=>i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a,b) => { a=find(a); b=find(b); if (a !== b) parent[b]=a; };
  const positions = new Map();
  for (let i=0; i<count; i++) {
    const key = [pos[i*3],pos[i*3+1],pos[i*3+2]].map(x => Math.round(x*10000)).join(',');
    if (positions.has(key)) union(positions.get(key),i); else positions.set(key,i);
  }
  for(let i=0; i<arr.length; i+=3) { union(arr[i],arr[i+1]); union(arr[i],arr[i+2]); }
  const groups = new Map();
  for (let i=0; i<count; i++) {
    const root=find(i); if (!groups.has(root)) groups.set(root, [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
    const b=groups.get(root);
    for (let j=0;j<3;j++){ const v=pos[i*3+j]; b[j]=Math.min(b[j],v); b[j+3]=Math.max(b[j+3],v); }
  }
  const removed = new Set([...groups].filter(([,b])=>matches(b)).map(([root])=>root));
  if (!removed.size) return 0;
  const kept=[]; for(let i=0;i<arr.length;i+=3) if(!removed.has(find(arr[i]))) kept.push(arr[i],arr[i+1],arr[i+2]);
  index.setArray(new arr.constructor(kept));
  return (arr.length-kept.length)/3;
}
function inside(b, x0,y0,z0,x1,y1,z1) {
  return b[0]>=x0 && b[1]>=y0 && b[2]>=z0 && b[3]<=x1 && b[4]<=y1 && b[5]<=z1;
}
function worldBounds(node) {
  const m=node.getWorldMatrix(), b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for (const p of node.getMesh().listPrimitives()) {
    const a=p.getAttribute('POSITION').getArray();
    for(let i=0;i<a.length;i+=3){const [x,y,z]=a.subarray(i,i+3);const q=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];for(let k=0;k<3;k++){b[k]=Math.min(b[k],q[k]);b[k+3]=Math.max(b[k+3],q[k]);}}
  }
  return b;
}
for (const id of ids) {
  const filename=`public/models/${id}.glb`, doc=await io.read(filename), root=doc.getRoot(); let removed=0;
  if (id==='ferrari') for (const mesh of root.listMeshes()) for (const p of [...mesh.listPrimitives()]) {
    if (p.getMaterial()?.getName().startsWith('logo__')) { removed += p.getIndices()?.getCount()/3 || 0; mesh.removePrimitive(p); p.dispose(); }
  }
  if (id==='golf') for(const m of root.listMaterials()) {
    if (m.getName().startsWith('plate__') || m.getName().startsWith('tire__')) m.setBaseColorTexture(null);
    if (m.getName().startsWith('tire__')) m.setBaseColorFactor([.018,.018,.02,1]);
  }
  if (id==='golf') for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMaterial()?.getName()==='paint__Carpaint') removed += removeComponents(p,b=>inside(b,-.065,.57,-2.03,.06,.72,-1.90));
  }
  if (id==='mercedes') {
    for(const mesh of root.listMeshes()) for(const p of mesh.listPrimitives()) if(p.getMaterial()?.getName()==='chrome__W222 - Chrome') {
      removed += removeComponents(p, b =>
        inside(b,-.05,.80,-2.52,.05,.94,-2.43) || // hood star and stalk
        inside(b,-.05,.94,2.46,.05,1.04,2.54));  // trunk star
    }
    const tex = root.listTextures().find(t=>t.getName()==='MB_W222_Photo_Textures.1001');
    if (tex) {
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'car-atlas-')), src=path.join(dir,'in.png'), out=path.join(dir,'out.png');
      try { fs.writeFileSync(src,tex.getImage()); execFileSync(python,['tools/redact_mercedes_atlas.py',src,out]); tex.setImage(new Uint8Array(fs.readFileSync(out))); }
      finally { fs.rmSync(dir,{recursive:true,force:true}); }
    }
  }
  if (id==='audi') for(const mesh of root.listMeshes()) for(const p of mesh.listPrimitives()) {
    const name=p.getMaterial()?.getName();
    if(name==='rim__RIM DARK') removed += removeComponents(p,b=>
      inside(b,-.15,.55,2.40,.15,.68,2.48) || // four front rings
      inside(b,-.52,.55,2.36,-.39,.61,2.41)); // front model badge
    if(name==='carbon__Front grill') removed += removeComponents(p,b=>
      inside(b,-.15,.55,2.44,.15,.68,2.49) || // front emblem inlay
      inside(b,-.12,.91,-2.42,.12,1.00,-2.36) || // rear four rings
      inside(b,.42,.71,-2.36,.60,.76,-2.31)); // rear model lettering
  }
  if (id==='r8' || id==='challenger') for (const node of [...root.listNodes()]) {
    if(!node.getMesh()) continue;
    const name=node.getName(), b=worldBounds(node);
    const remove = id==='challenger' ? /^Text(?:\.\d+)?$/.test(name) :
      name==='logo red' || (name==='chrome' && (
        inside(b,-.10,.54,2.06,.10,.60,2.14) || // front rings
        inside(b,-.10,.68,-2.15,.10,.75,-2.10) || // rear rings
        inside(b,.24,.67,-2.14,.35,.72,-2.10) || // rear lettering
        inside(b,-.33,.45,2.13,-.21,.49,2.17))) || // grille lettering
      (name==='black matt' && inside(b,-.33,.45,2.13,-.21,.49,2.17));
    if(remove) { removed += node.getMesh().listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??0)/3,0); node.dispose(); }
  }
  await doc.transform(prune());
  await io.write(filename,doc);
  manifest[id].bytes=fs.statSync(filename).size;
  manifest[id].triangles=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+(p.getIndices()?.getCount()??0)/3,0);
  console.log(id, 'removed triangles', removed, 'remaining', manifest[id].triangles, 'bytes',manifest[id].bytes);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2)+'\n');
