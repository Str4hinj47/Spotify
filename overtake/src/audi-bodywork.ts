import * as THREE from 'three';
import type { Customization } from './customization.mjs';

// Audi Avant panels and trim are distributed over several primitives. Work on the
// player clone only, cutting all intersecting primitives on identical seams.
// Coordinates are in the normalized car frame; negative Z is the front.
type Vertex = { p:THREE.Vector3; a:number[][] };
type Plane = (p:THREE.Vector3)=>number;
type Region = {part:'front'|'rear'|'skirts'; side?:number; center?:boolean; planes:Plane[]};
const smooth=(a:number,b:number,n:number)=>THREE.MathUtils.smoothstep(n,a,b);
function mix(a:Vertex,b:Vertex,t:number):Vertex {return {p:a.p.clone().lerp(b.p,t),a:a.a.map((v,i)=>v.map((n,j)=>THREE.MathUtils.lerp(n,b.a[i][j],t)))};}
function split(poly:Vertex[],plane:Plane):[Vertex[],Vertex[]] {
 const yes:Vertex[]=[],no:Vertex[]=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a.p),db=plane(b.p),ia=da>=0,ib=db>=0;(ia?yes:no).push(a);if(ia!==ib){const v=mix(a,b,da/(da-db));yes.push(v);no.push(v);}}
 return [yes,no];
}
function triangles(poly:Vertex[],out:Vertex[][]){for(let i=1;i+1<poly.length;i++)out.push([poly[0],poly[i],poly[i+1]]);}
function subdivide(t:Vertex[]):Vertex[][] {const [a,b,c]=t,ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];}
function regions(config:Customization):Region[] {
 const out:Region[]=[];
 if(config.front==='audi-aero'||config.front==='audi-splitter')out.push({part:'front',planes:[p=>.43-p.y,p=>-2.05-p.z]});
 if(config.rear==='audi-clean'||config.rear==='audi-diffuser') {
  // The low rear reflectors sit at the outer corners; the deeper center
  // replacement ends before them, so the factory lamps remain uncovered.
  out.push({part:'rear',center:true,planes:[p=>.47-p.y,p=>p.z-2.05,p=>.54-p.x,p=>.54+p.x]});
 }
 if(config.skirts==='audi-wide')for(const side of [-1,1])out.push({part:'skirts',side,planes:[p=>.37-p.y,p=>p.z+1.10,p=>.96-p.z,p=>side*p.x-.82]});
 return out;
}
function shape(p:THREE.Vector3,area:Region,config:Customization):THREE.Vector3 {
 const q=p.clone();
 if(area.part==='front') {const w=smooth(0,.14,.43-p.y)*smooth(0,.24,-2.05-p.z);q.y-=.04*w;q.z-=(config.front==='audi-splitter'?.085:.035)*w;}
 else if(area.part==='rear') {const w=smooth(0,.16,.47-p.y)*smooth(0,.23,p.z-2.05)*smooth(0,.10,.54-Math.abs(p.x));q.y-=.04*w;q.z+=(config.rear==='audi-diffuser'?.045:.025)*w;}
 else {const w=smooth(0,.12,.37-p.y)*smooth(0,.16,p.z+1.10)*smooth(0,.16,.96-p.z)*smooth(0,.08,Math.abs(p.x)-.82);q.y-=.035*w;q.x+=area.side!*.055*w;}
 return q;
}

/** Replace selected sections of the Avant's painted and trim primitives. */
export function fitAudiBodywork(inner:THREE.Group,wrapper:THREE.Group,kit:THREE.Group,config:Customization):THREE.BufferGeometry[] {
 const areas=regions(config);if(!areas.length)return [];
 const names=['audi_mesh_1','audi_mesh_7','audi_mesh_10','audi_mesh_14'];
 const owned:THREE.BufferGeometry[]=[],materials=kit.userData.ownedMaterials as THREE.Material[];
 wrapper.updateMatrixWorld(true);
 for(const name of names) {
  const mesh=inner.getObjectByName(name) as THREE.Mesh|undefined;if(!mesh?.isMesh||Array.isArray(mesh.material))continue;
  const geo=mesh.geometry,attrs=Object.entries(geo.attributes),pi=attrs.findIndex(([key])=>key==='position');if(pi<0)continue;
  const index=geo.index,n=index?index.count:geo.getAttribute('position').count;
  const matrix=wrapper.matrixWorld.clone().invert().multiply(mesh.matrixWorld),inverse=matrix.clone().invert();
  const vertex=(i:number):Vertex=>{const a=attrs.map(([,attr])=>Array.from({length:attr.itemSize},(_,j)=>attr.getComponent(i,j)));return {a,p:new THREE.Vector3(...a[pi] as [number,number,number]).applyMatrix4(matrix)};};
  const stock:Vertex[][]=[],fitted=areas.map(()=>[] as Vertex[][]);
  for(let i=0;i+2<n;i+=3){
   let remaining:Vertex[][]=[[vertex(index?index.getX(i):i),vertex(index?index.getX(i+1):i+1),vertex(index?index.getX(i+2):i+2)]];
   areas.forEach((area,j)=>{const next:Vertex[][]=[];for(const face of remaining){let inside=face;for(const plane of area.planes){if(!inside.length)break;const [yes,no]=split(inside,plane);triangles(no,next);inside=yes;}triangles(inside,fitted[j]);}remaining=next;});
   stock.push(...remaining);
  }
  if(fitted.every(f=>!f.length))continue;
  const build=(faces:Vertex[][],area?:Region)=>{const arrays=attrs.map(()=>[] as number[]);for(const face of faces)for(const tri of area?subdivide(face):[face])for(const v of tri){const p=area?shape(v.p,area,config).applyMatrix4(inverse):null;attrs.forEach(([,a],j)=>arrays[j].push(...(j===pi&&p?[p.x,p.y,p.z]:v.a[j].slice(0,a.itemSize))));}
   const result=new THREE.BufferGeometry();attrs.forEach(([key,a],i)=>result.setAttribute(key,new THREE.Float32BufferAttribute(arrays[i],a.itemSize,a.normalized)));result.computeBoundingSphere();return result;};
  mesh.geometry=build(stock);owned.push(mesh.geometry);
  const paint=mesh.material.name.startsWith('paint__');
  // Copy trim materials and their maps: disposal of a player kit must not
  // dispose a texture or material still shared by traffic/the source model.
  let trim:THREE.Material|undefined;
  if(!paint){trim=mesh.material.clone();const m=trim as THREE.MeshStandardMaterial;if(m.map)m.map=m.map.clone();materials.push(trim);}
  areas.forEach((area,j)=>{
   if(!fitted[j].length)return;const group=kit.getObjectByName(`custom-${area.part}`);if(!group)return;
   const finish=paint?(kit.userData.partMaterials?.[area.part] ?? (config[`${area.part}Finish`]==='carbon'?materials[2]:area.part==='skirts'?materials[1]:materials[0])):trim!;
   const replacement=new THREE.Mesh(build(fitted[j],area),finish);replacement.name=`audi-fitted-${area.part}`;
   replacement.matrix.copy(matrix);replacement.matrixAutoUpdate=false;replacement.castShadow=true;group.add(replacement);
  });
 }
 return owned;
}
