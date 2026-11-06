import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {simplifyPrimitive, prune} from '@gltf-transform/functions';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
// Input GLBs are the optimized CC0 Poly Haven assets documented in SCENERY_ASSETS.md.
for (const name of ['tree_small_02','pine_sapling_01','fern_02']) {
 const doc=await io.read(`source-assets/polyhaven-landscape/${name}.glb`);
 for(const p of doc.getRoot().listMeshes()[0].listPrimitives()){
   const mat=p.getMaterial(), n=mat.getName(); console.log(name,n,p.getIndices()?.getCount()/3);
   if(name==='tree_small_02'&&mat.getExtras().foliage){
     const index=p.getIndices(), old=index.getArray(), pos=p.getAttribute('POSITION').getArray(); const indices=[];
     for(let q=0;q<old.length/6;q++){
       let x=q+1; x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);x=(x^(x>>>16))>>>0;
       if(x%2!==0) continue;
       const ids=[old[q*6],old[q*6+1],old[q*6+2],old[q*6+5]];
       for(let j=0;j<3;j++){
         const mean=ids.reduce((v,i)=>v+pos[i*3+j],0)/4;
         for(const id of ids)pos[id*3+j]=Math.max(-32767,Math.min(32767,Math.round(mean+(pos[id*3+j]-mean)*1.38)));
       }
       for(let k=0;k<6;k++)indices.push(old[q*6+k]);
     }
     index.setArray(new Uint32Array(indices));
   }else if(name==='tree_small_02'){
     simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:.28,error:.01});
   }
   console.log('  after',p.getIndices().getCount()/3);
 }
 await doc.transform(prune());
 const output = `public/models/scenery/${{tree_small_02:'deciduous',pine_sapling_01:'conifer',fern_02:'fern'}[name]}.glb`;
 await io.write(output,doc);
 console.log('size',fs.statSync(output).size);
}
