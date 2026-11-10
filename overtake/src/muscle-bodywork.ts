import * as THREE from 'three';
import { customPaintMaterial } from './livery';
import type { Customization } from './customization.mjs';

// Sections are cut from the individual player clone, not painted over the
// source. Negative Z is the front of the normalized model.
type Vertex={p:THREE.Vector3;a:number[][]};
type Plane=(p:THREE.Vector3)=>number;
type Region={part:'front'|'rear';planes:Plane[]};
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
function mix(a:Vertex,b:Vertex,t:number):Vertex{return {p:a.p.clone().lerp(b.p,t),a:a.a.map((v,i)=>v.map((n,j)=>THREE.MathUtils.lerp(n,b.a[i][j],t)))};}
function split(poly:Vertex[],plane:Plane):[Vertex[],Vertex[]]{
 const yes:Vertex[]=[],no:Vertex[]=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a.p),db=plane(b.p),ia=da>=0,ib=db>=0;(ia?yes:no).push(a);if(ia!==ib){const v=mix(a,b,da/(da-db));yes.push(v);no.push(v);}}
 return [yes,no];
}
function triangles(poly:Vertex[],out:Vertex[][]){for(let i=1;i+1<poly.length;i++)out.push([poly[0],poly[i],poly[i+1]]);}
function subdivide(t:Vertex[]):Vertex[][]{const [a,b,c]=t,ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];}
function regions(id:'mustang'|'challenger',config:Customization):Region[]{
 const out:Region[]=[];
 if(id==='mustang'){
  if(config.front!=='stock')out.push({part:'front',planes:[p=>.38-p.y,p=>-1.90-p.z]});
  if(config.rear!=='stock')out.push({part:'rear',planes:[p=>.40-p.y,p=>p.z-1.90]});
 }else{
  if(config.front!=='stock')out.push({part:'front',planes:[p=>.52-p.y,p=>-1.93-p.z]});
  if(config.rear!=='stock')out.push({part:'rear',planes:[p=>.50-p.y,p=>p.z-1.95]});
 }
 return out;
}
function shape(id:'mustang'|'challenger',p:THREE.Vector3,area:Region,config:Customization):THREE.Vector3{
 const q=p.clone(),option=config[area.part],strength=option==='street'?.6:option==='touring'?.8:option==='track'?1.2:option==='mustang-heritage'||option==='challenger-aero'||option==='mustang-valance'||option==='challenger-diffuser'?1.35:1;
 if(area.part==='front'){
  const top=id==='mustang'?.38:.52,cut=id==='mustang'?-1.90:-1.93;
  const w=smooth(0,.13,top-p.y)*smooth(0,.24,cut-p.z);
  q.y-=(id==='mustang'?.025:.035)*w*strength;q.z-=(id==='mustang'?.025:.055)*w*strength;
 }else if(area.part==='rear'){
  const top=id==='mustang'?.40:.50,cut=id==='mustang'?1.90:1.95;
  const w=smooth(0,.13,top-p.y)*smooth(0,.24,p.z-cut);
  q.y-=(id==='mustang'?.018:.025)*w*strength;q.z+=(id==='mustang'?.015:.025)*w*strength;
 }
 return q;
}
/** Replace selected painted body sections while retaining all lights, chrome and exhaust primitives. */
export function fitMuscleBodywork(id:'mustang'|'challenger',inner:THREE.Group,wrapper:THREE.Group,kit:THREE.Group,config:Customization):THREE.BufferGeometry[]{
 const areas=regions(id,config);if(!areas.length)return [];
 const names=id==='mustang'?['mustang_mesh_7','mustang_mesh_1','mustang_mesh_5','mustang_mesh_8']:['Plane001_Plane033','Plane002_Plane034','Plane003_Plane035','Plane005_Plane037','Plane006_Plane038','Plane013_Plane039','Plane014_Plane040'];
 const owned:THREE.BufferGeometry[]=[],materials=kit.userData.ownedMaterials as THREE.Material[];wrapper.updateMatrixWorld(true);
 for(const name of names){
  const mesh=inner.getObjectByName(name) as THREE.Mesh|undefined;if(!mesh?.isMesh||Array.isArray(mesh.material))continue;
  const geo=mesh.geometry,attrs=Object.entries(geo.attributes),pi=attrs.findIndex(([key])=>key==='position');if(pi<0)continue;
  const index=geo.index,n=index?index.count:geo.getAttribute('position').count,matrix=wrapper.matrixWorld.clone().invert().multiply(mesh.matrixWorld),inverse=matrix.clone().invert();
  // Skip whole primitives outside all cut regions. The planes are linear, so
  // checking all corners of the transformed bounds cannot reject a crossing.
  if(!geo.boundingBox)geo.computeBoundingBox();
  const bounds=geo.boundingBox!.clone().applyMatrix4(matrix),corners:THREE.Vector3[]=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
  if(!areas.some(area=>area.planes.every(plane=>corners.some(corner=>plane(corner)>=0))))continue;
  const vertex=(i:number):Vertex=>{const a=attrs.map(([,attr])=>Array.from({length:attr.itemSize},(_,j)=>attr.getComponent(i,j)));return {a,p:new THREE.Vector3(...a[pi] as [number,number,number]).applyMatrix4(matrix)};};
  const stock:Vertex[][]=[],fitted=areas.map(()=>[] as Vertex[][]);
  for(let i=0;i+2<n;i+=3){let remaining:Vertex[][]=[[vertex(index?index.getX(i):i),vertex(index?index.getX(i+1):i+1),vertex(index?index.getX(i+2):i+2)]];
   areas.forEach((area,j)=>{const next:Vertex[][]=[];for(const face of remaining){let inside=face;for(const plane of area.planes){if(!inside.length)break;const [yes,no]=split(inside,plane);triangles(no,next);inside=yes;}triangles(inside,fitted[j]);}remaining=next;});stock.push(...remaining);
  }
  if(fitted.every(f=>!f.length))continue;
  const build=(faces:Vertex[][],area?:Region)=>{const arrays=attrs.map(()=>[] as number[]);for(const face of faces)for(const tri of area?subdivide(face):[face])for(const v of tri){const p=area?shape(id,v.p,area,config).applyMatrix4(inverse):null;attrs.forEach(([,a],j)=>arrays[j].push(...(j===pi&&p?[p.x,p.y,p.z]:v.a[j].slice(0,a.itemSize))));}
   const result=new THREE.BufferGeometry();attrs.forEach(([key,a],i)=>result.setAttribute(key,new THREE.Float32BufferAttribute(arrays[i],a.itemSize,a.normalized)));result.computeBoundingSphere();return result;};
  mesh.geometry=build(stock);owned.push(mesh.geometry);
  const isPaint=mesh.material.name.startsWith('paint__');
  let trim:THREE.Material|undefined;
  if(!isPaint){trim=mesh.material.clone();const material=trim as THREE.MeshStandardMaterial;if(material.map)material.map=material.map.clone();materials.push(trim);}
  areas.forEach((area,j)=>{
   if(!fitted[j].length)return;const group=kit.getObjectByName(`custom-${area.part}`);if(!group)return;
   let finish=isPaint ? kit.userData.partMaterials?.[area.part] as THREE.Material|undefined : trim;
   if(!finish && config[`${area.part}Finish`]==='carbon')finish=materials[2];
   if(!finish){finish=customPaintMaterial(mesh.material as THREE.MeshStandardMaterial,matrix,id,config);const paint=finish as THREE.MeshStandardMaterial;if(paint.map)paint.map=paint.map.clone();materials.push(finish);}
   const replacement=new THREE.Mesh(build(fitted[j],area),finish);replacement.name=`${id}-fitted-${area.part}`;replacement.matrix.copy(matrix);replacement.matrixAutoUpdate=false;replacement.castShadow=true;group.add(replacement);
  });
 }
 return owned;
}
