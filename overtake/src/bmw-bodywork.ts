import * as THREE from 'three';
import { customPaintMaterial } from './livery';
import { bmwExhaustLayout } from './bmw-exhaust.mjs';
import type { Customization } from './customization.mjs';

type Vertex={p:THREE.Vector3; attributes:number[][]};
type Plane=(p:THREE.Vector3)=>number;
type BumperBoundary={top:number[]; normals:(THREE.Vector3|null)[]; topWidth:number; cut:number; height:number};
type Measurements={hood?:{left:number[];right:number[];near:number[];far:number[]}; front?:BumperBoundary; rear?:BumperBoundary};
// The normalized source geometry is shared by player clones. Cache only the
// measured car-space curves, never the clone's disposable geometry/materials.
const measurements=new WeakMap<THREE.BufferGeometry,Measurements>();
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
  let measured=measurements.get(paint.geometry);
  if(!measured){measured={};measurements.set(paint.geometry,measured);}
  const {left,right,near,far}=measured.hood??{left:[],right:[],near:[],far:[]};
  if(hood&&!measured.hood){for(let j=0;j<=rows;j++){let z=THREE.MathUtils.lerp(zFront,zRear,j/rows);left.push(hoodY(-xHalf,z));right.push(hoodY(xHalf,z));}for(let i=0;i<=cols;i++){let x=THREE.MathUtils.lerp(-xHalf,xHalf,i/cols);near.push(hoodY(x,zFront));far.push(hoodY(x,zRear));}measured.hood={left,right,near,far};}
  // Capture the perimeter of the original bumper while the source is intact.
  // Each section ends at a wheel-side cut and follows its existing
  // cross-section, so the new skin returns into the wheel arch instead of
  // terminating in a flat sheet across it.
  const segments=160, levels=48, bottom=.105;
  function boundary(isFront:boolean):BumperBoundary {
    const sign=isFront?-1:1, cut=isFront?-1.64:1.62, height=isFront?.37:.42;
    const raySide=new THREE.Raycaster(), rayEnd=new THREE.Raycaster();
    raySide.set(wrapper.localToWorld(new THREE.Vector3(3,height,cut)),new THREE.Vector3(-1,0,0).transformDirection(wrapper.matrixWorld));
    const sideHit=raySide.intersectObject(paint!,false).find(h=>wrapper.worldToLocal(h.point.clone()).x>.5);
    const fill=(a:number[],fallback:number)=>{
      for(let i=0;i<a.length;i++)if(!Number.isFinite(a[i])){let l=i-1,r=i+1;while(l>=0&&!Number.isFinite(a[l]))l--;while(r<a.length&&!Number.isFinite(a[r]))r++;a[i]=l<0?(a[r]??fallback):r>=a.length?a[l]:THREE.MathUtils.lerp(a[l],a[r],(i-l)/(r-l));}
    };
    const topWidth=sideHit?wrapper.worldToLocal(sideHit.point.clone()).x:(isFront?.91:.90), top:number[]=[], normals:(THREE.Vector3|null)[]=[];
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(paint!.matrixWorld));
    for(let i=0;i<=segments;i++){
      const x=THREE.MathUtils.lerp(-topWidth,topWidth,i/segments);
      rayEnd.set(wrapper.localToWorld(new THREE.Vector3(x,height,sign*4)),new THREE.Vector3(0,0,-sign).transformDirection(wrapper.matrixWorld));
      const hit=rayEnd.intersectObject(paint!,false).find(h=>sign*(wrapper.worldToLocal(h.point.clone()).z-cut)>-.002);
      top.push(hit?wrapper.worldToLocal(hit.point.clone()).z:NaN);
      normals.push(hit?.normal?hit.normal.clone().applyMatrix3(normalMatrix).normalize():null);
    }
    top[0]=cut;top[segments]=cut;fill(top,cut);
    return {top,normals,topWidth,cut,height};
  }
  const frontBoundary=front?(measured.front??=boundary(true)):null,rearBoundary=rear?(measured.rear??=boundary(false)):null;
  const wheelCut=(y:number,isFront:boolean)=>{
    const sign=isFront?-1:1,cut=isFront?-1.64:1.62,height=isFront?.37:.42;
    const wheelY=isFront?.312:.324,wheelZ=isFront?-1.384:1.269,wheelR=isFront?.35:.36;
    const dz=Math.sqrt(Math.max(0,wheelR*wheelR-(y-wheelY)*(y-wheelY)));
    return THREE.MathUtils.lerp(cut,wheelZ+sign*dz,THREE.MathUtils.smoothstep(height-y,0,.08));
  };
  const zones:Plane[][]=[];
  if(hood)zones.push([p=>p.x+xHalf,p=>xHalf-p.x,p=>p.z-zFront,p=>zRear-p.z,p=>p.y-.53]);
  if(front)zones.push([p=>.37-p.y,p=>wheelCut(p.y,true)-p.z]);
  if(rear)zones.push([p=>.42-p.y,p=>p.z-wheelCut(p.y,false)]);
  const owned:THREE.BufferGeometry[]=[];
  for(const name of ['bmw-m3_mesh','bmw-m3_mesh_8']) {
    const mesh=inner.getObjectByName(name) as THREE.Mesh|undefined;if(!mesh?.isMesh)continue;
    const src=mesh.geometry,attrs=Object.entries(src.attributes),posIndex=attrs.findIndex(([key])=>key==='position'),idx=src.index;
    const toCar=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
    const vertex=(i:number):Vertex=>{const attributes=attrs.map(([,a])=>Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j)));return {attributes,p:new THREE.Vector3(...attributes[posIndex] as [number,number,number]).applyMatrix4(toCar)}};
    const output:Vertex[][]=[],n=idx?idx.count:src.getAttribute('position').count;
    for(let i=0;i+2<n;i+=3){let pieces:Vertex[][]=[[vertex(idx?idx.getX(i):i),vertex(idx?idx.getX(i+1):i+1),vertex(idx?idx.getX(i+2):i+2)]];
      for(const planes of zones){const next:Vertex[][]=[];for(const triangle of pieces){let part=triangle;for(const plane of planes){if(!part.length)break;const [yes,no]=split(part,plane);for(let j=1;j+1<no.length;j++)next.push([no[0],no[j],no[j+1]]);part=yes;}}pieces=next;}output.push(...pieces);
    }
    const arrays=attrs.map(()=>[] as number[]);
    for(const tri of output)for(const v of tri){
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
  if(frontBoundary||rearBoundary){
    const dark=new THREE.MeshStandardMaterial({color:0x15191c,metalness:.12,roughness:.78});
    const metal=new THREE.MeshStandardMaterial({color:0xaeb9be,metalness:.82,roughness:.25});ownedMaterials.push(dark,metal);
    const layout=bmwExhaustLayout(config.exhaust), outlets=layout.centers, radius=layout.radius, mouthY=layout.y;
    const box=(x:number,y:number,cx:number,cy:number,hx:number,hy:number,r:number)=>{const qx=Math.abs(x-cx)-(hx-r),qy=Math.abs(y-cy)-(hy-r);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;};
    const make=(boundary:BumperBoundary,isFront:boolean)=>{
      const positions:number[]=[],body:number[]=[],vents:number[]=[], sign=isFront?-1:1;
      const zAt=(u:number,t:number)=>{
        const f=(u+1)*.5*segments,i=Math.min(segments-1,Math.floor(f));
        const seam=THREE.MathUtils.lerp(boundary.top[i],boundary.top[i+1],f-i);
        // Lower edge rolls in underneath the body.
        return seam+sign*(.025*Math.sin(Math.PI*t)-.18*(1-t)*(1-t))*Math.pow(1-Math.abs(u),.35);
      };
      for(let i=0;i<=segments;i++)for(let j=0;j<=levels;j++){
        const u=-1+2*i/segments,t=j/levels,x=u*boundary.topWidth,y=THREE.MathUtils.lerp(bottom,boundary.height,t);
        // Follow the exposed wheel opening at the return instead of ending in
        // a vertical tab in front of the tire. The top edge remains fixed.
        const edge=THREE.MathUtils.smoothstep(Math.abs(u),.90,1);
        const z=THREE.MathUtils.lerp(zAt(u,t),wheelCut(y,isFront),edge);
        positions.push(x,y,z);
      }
      const add=(a:number,b:number,c:number)=>{
        const x=(positions[3*a]+positions[3*b]+positions[3*c])/3,y=(positions[3*a+1]+positions[3*b+1]+positions[3*c+1])/3;
        if(!isFront&&outlets.some(cx=>Math.hypot((x-cx)/(radius*(layout.oval?1.35:1)),(y-mouthY)/radius)<1.1))return;
        const vent=isFront?Math.min(box(x,y,0,.205,.42,.055,.025),box(Math.abs(x),y,.62,.205,.105,.047,.022))<0:box(x,y,0,.13,.59,.018,.015)<0;
        (vent?vents:body).push(a,b,c);
      };
      for(let i=0;i<segments;i++)for(let j=0;j<levels;j++){const a=i*(levels+1)+j,b=a+1,c=a+levels+1,d=c+1;if(isFront){add(a,b,c);add(b,d,c)}else{add(a,c,b);add(b,c,d)}}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([...body,...vents]);geometry.addGroup(0,body.length,0);geometry.addGroup(body.length,vents.length,1);geometry.computeVertexNormals();
      // Blend the new surface normals into the measured original at the cut.
      // This keeps the lighting continuous without welding or mutating the asset.
      const normal=geometry.getAttribute('normal') as THREE.BufferAttribute;
      for(let i=0;i<=segments;i++){
        let n=boundary.normals[i];
        if(!n){let l=i-1,r=i+1;while(l>=0&&!boundary.normals[l])l--;while(r<=segments&&!boundary.normals[r])r++;n=l>=0?boundary.normals[l]:r<=segments?boundary.normals[r]:null;}
        if(!n)continue;
        for(let j=levels-8;j<=levels;j++){
          const index=i*(levels+1)+j,w=THREE.MathUtils.smoothstep(j,levels-8,levels),v=new THREE.Vector3().fromBufferAttribute(normal,index).lerp(n,w).normalize();
          normal.setXYZ(index,v.x,v.y,v.z);
        }
      }
      normal.needsUpdate=true;
      const panel=new THREE.Mesh(geometry,[panelMaterial,dark]);panel.name=isFront?'bmw-street-front':'bmw-street-rear';panel.castShadow=true;wrapper.add(panel);owned.push(geometry);
      if(!isFront&&config.exhaust==='stock')for(const x of outlets){
        const pipe=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.09,32,1,true),metal);pipe.rotation.x=Math.PI/2;pipe.position.set(x,mouthY,layout.mouthZ-.045);pipe.name='bmw-stock-exhaust-pipe';wrapper.add(pipe);owned.push(pipe.geometry);
        const hole=new THREE.Mesh(new THREE.CircleGeometry(radius*.82,32),dark);hole.position.set(x,mouthY,layout.mouthZ-.002);hole.name='bmw-stock-exhaust-inner';wrapper.add(hole);owned.push(hole.geometry);
        const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.9,radius*.1,10,32),metal);rim.position.set(x,mouthY,layout.mouthZ);rim.name='bmw-stock-exhaust-rim';wrapper.add(rim);owned.push(rim.geometry);
      }
    };
    if(frontBoundary)make(frontBoundary,true);if(rearBoundary)make(rearBoundary,false);
  }
  return owned;
}
