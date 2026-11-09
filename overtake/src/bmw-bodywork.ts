import * as THREE from 'three';
import { customPaintMaterial } from './livery';
import type { Customization } from './customization.mjs';

type Vertex={p:THREE.Vector3; attributes:number[][]};
type Plane=(p:THREE.Vector3)=>number;
function split(poly:Vertex[], plane:Plane):[Vertex[],Vertex[]] {
  const inside:Vertex[]=[],outside:Vertex[]=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a.p),db=plane(b.p),inA=da>=0,inB=db>=0;
    (inA?inside:outside).push(a);
    if(inA!==inB){const t=da/(da-db),v={p:a.p.clone().lerp(b.p,t),attributes:a.attributes.map((v,j)=>v.map((x,k)=>THREE.MathUtils.lerp(x,b.attributes[j][k],t)))};inside.push(v);outside.push(v);}
  }
  return [inside,outside];
}

/** Player-only simplification. Source race panels remain untouched and can be
 * selected independently; clipping retains every vertex attribute at seams. */
export function fitBmwStreetBody(inner:THREE.Group,wrapper:THREE.Group,config:Customization, ownedMaterials:THREE.Material[]):THREE.BufferGeometry[] {
  const hood=config.hood!=='bmw-race-hood',front=config.front!=='bmw-race-front',rear=config.rear!=='bmw-race-rear';
  if(!hood&&!front&&!rear)return [];
  const paint=inner.getObjectByName('bmw-m3_mesh') as THREE.Mesh|undefined;
  if(!paint?.isMesh)return [];
  wrapper.updateMatrixWorld(true);
  const xHalf=.52,zFront=-1.83,zRear=-1.025,cols=48,rows=48;
  // Sample the intact hood boundary before any geometry is cut. Coons patch
  // spans those measurements and fills the race vent holes, not a flat decal.
  const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,-1,0).transformDirection(wrapper.matrixWorld);
  function hoodY(x:number,z:number) {
    ray.set(wrapper.localToWorld(new THREE.Vector3(x,2,z)),direction);
    const hit=ray.intersectObject(paint!,false).find(h=>wrapper.worldToLocal(h.point.clone()).y>.53);
    return hit?wrapper.worldToLocal(hit.point.clone()).y:.72;
  }
  const left:number[]=[],right:number[]=[],near:number[]=[],far:number[]=[];
  if(hood){for(let j=0;j<=rows;j++){let z=THREE.MathUtils.lerp(zFront,zRear,j/rows);left.push(hoodY(-xHalf,z));right.push(hoodY(xHalf,z));}for(let i=0;i<=cols;i++){let x=THREE.MathUtils.lerp(-xHalf,xHalf,i/cols);near.push(hoodY(x,zFront));far.push(hoodY(x,zRear));}}
  const zones:Plane[][]=[];
  if(hood)zones.push([p=>p.x+xHalf,p=>xHalf-p.x,p=>p.z-zFront,p=>zRear-p.z,p=>p.y-.53]);
  // Smooth the central GT3 diffuser cutouts without touching the quad tips.
  if(rear)zones.push([p=>p.x+.38,p=>.38-p.x,p=>p.y-.20,p=>.325-p.y,p=>p.z-1.9]);
  const owned:THREE.BufferGeometry[]=[];
  for(const name of ['bmw-m3_mesh','bmw-m3_mesh_8']) {
    const mesh=inner.getObjectByName(name) as THREE.Mesh|undefined;if(!mesh?.isMesh)continue;
    const src=mesh.geometry,attrs=Object.entries(src.attributes),posIndex=attrs.findIndex(([key])=>key==='position'),idx=src.index;
    const toCar=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld),toMesh=toCar.clone().invert();
    const vertex=(i:number):Vertex=>{const attributes=attrs.map(([,a])=>Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j)));return {attributes,p:new THREE.Vector3(...attributes[posIndex] as [number,number,number]).applyMatrix4(toCar)}};
    const output:Vertex[][]=[],n=idx?idx.count:src.getAttribute('position').count;
    for(let i=0;i+2<n;i+=3){let pieces:Vertex[][]=[[vertex(idx?idx.getX(i):i),vertex(idx?idx.getX(i+1):i+1),vertex(idx?idx.getX(i+2):i+2)]];
      for(const planes of zones){const next:Vertex[][]=[];for(const triangle of pieces){let part=triangle;for(const plane of planes){if(!part.length)break;const [yes,no]=split(part,plane);for(let j=1;j+1<no.length;j++)next.push([no[0],no[j],no[j+1]]);part=yes;}}pieces=next;}output.push(...pieces);
    }
    const arrays=attrs.map(()=>[] as number[]);
    for(const tri of output)for(const v of tri){
      if(front && v.p.z< -1.8 && v.p.y<.28){
        // Pull the deeply projecting race splitter back under the nose.
        const limit=-2.13+.42*v.p.x*v.p.x, weight=THREE.MathUtils.smoothstep(.28-v.p.y,0,.16);
        if(v.p.z<limit)v.p.z=THREE.MathUtils.lerp(v.p.z,limit,weight);
        const q=v.p.clone().applyMatrix4(toMesh);v.attributes[posIndex]=q.toArray();
      }
      attrs.forEach(([,a],j)=>arrays[j].push(...v.attributes[j].slice(0,a.itemSize)));
    }
    const geo=new THREE.BufferGeometry();attrs.forEach(([key,a],i)=>geo.setAttribute(key,new THREE.Float32BufferAttribute(arrays[i],a.itemSize,a.normalized)));mesh.geometry=geo;owned.push(geo);
  }
  // Patch vertices are in wrapper space, unlike the imported mesh. Give them
  // their own car-space paint shader so hood colors and liveries stay aligned.
  const panelMaterial=customPaintMaterial(paint.material as THREE.MeshStandardMaterial,new THREE.Matrix4(),'bmw-m3',config);
  ownedMaterials.push(panelMaterial);
  if(hood){const positions:number[]=[],indices:number[]=[];
    for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++){
      const u=i/cols,v=j/rows,x=THREE.MathUtils.lerp(-xHalf,xHalf,u),z=THREE.MathUtils.lerp(zFront,zRear,v);
      const bilinear=(1-u)*(1-v)*near[0]+u*(1-v)*near[cols]+(1-u)*v*far[0]+u*v*far[cols];
      const y=(1-u)*left[j]+u*right[j]+(1-v)*near[i]+v*far[i]-bilinear+.006*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      positions.push(x,y,z);
    }
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=i*(rows+1)+j,b=a+1,c=a+rows+1,d=c+1;indices.push(a,b,c,b,d,c)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const panel=new THREE.Mesh(geo,panelMaterial);panel.name='bmw-street-hood';wrapper.add(panel);owned.push(geo);
  }
  if(rear){const positions:number[]=[],indices:number[]=[],width=64,height=24;
    for(let i=0;i<=width;i++)for(let j=0;j<=height;j++){const x=THREE.MathUtils.lerp(-.38,.38,i/width),y=THREE.MathUtils.lerp(.20,.325,j/height),z=2.22+.032*(j/height)-.15*x*x;positions.push(x,y,z)}
    for(let i=0;i<width;i++)for(let j=0;j<height;j++){const a=i*(height+1)+j,b=a+1,c=a+height+1,d=c+1;indices.push(a,c,b,b,c,d)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const panel=new THREE.Mesh(geo,panelMaterial);panel.name='bmw-street-rear';wrapper.add(panel);owned.push(geo);
  }
  return owned;
}
