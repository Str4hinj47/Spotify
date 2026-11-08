import * as THREE from 'three';
import type { Customization } from './customization.mjs';
import { golfExhaustLayout } from './golf-exhaust.mjs';

// Golf IV's bumper covers and rockers are merged into the painted GLB
// primitive. Split its triangles on the actual seam planes, rather than
// laying another surface over the factory one. All coordinates below are in
// the normalized car frame (front is -Z). The clipping/interpolation preserves
// every original vertex attribute at the shared seam.
type Vertex = { p: THREE.Vector3; a: number[][] };
type Plane = (p: THREE.Vector3) => number;
type Region = { part:'front'|'rear'|'skirts'; side?:number; planes:Plane[] };
const smooth = (a:number,b:number,x:number) => { const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
function mix(a:Vertex,b:Vertex,t:number):Vertex {
  return {p:a.p.clone().lerp(b.p,t),a:a.a.map((v,i)=>v.map((x,j)=>THREE.MathUtils.lerp(x,b.a[i][j],t)))};
}
function split(poly:Vertex[], plane:Plane):[Vertex[],Vertex[]] {
  const inside:Vertex[]=[],outside:Vertex[]=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a.p),db=plane(b.p),ina=da>=0,inb=db>=0;
    (ina?inside:outside).push(a);
    if(ina!==inb) { const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v); }
  }
  return [inside,outside];
}
function triangles(poly:Vertex[], out:Vertex[][]) {
  for(let i=1;i+1<poly.length;i++) out.push([poly[0],poly[i],poly[i+1]]);
}
function subdivide(t:Vertex[],depth:number,out:Vertex[][]) {
  if(!depth){out.push(t);return;}
  const [a,b,c]=t,ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);
  for(const next of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]) subdivide(next,depth-1,out);
}
function regions(config:Customization):Region[] {
  const r:Region[]=[];
  if(config.rear!=='stock'||config.exhaust==='golf-quad-flame') r.push({part:'rear',planes:[p=>(config.rear==='golf-r32'||config.rear==='golf-clean'?.62:.39)-p.y,p=>p.z-1.55]});
  if(config.front!=='stock') r.push({part:'front',planes:[p=>.36-p.y,p=>-1.49-p.z]});
  if(config.skirts!=='stock') for(const side of [-1,1]) r.push({part:'skirts',side,planes:[p=>.38-p.y,p=>p.z+.8,p=>.98-p.z,p=>side*p.x-.68]});
  return r;
}
function shape(p:THREE.Vector3, region:Region, config:Customization):THREE.Vector3 {
  const result=p.clone(), level={street:0,touring:1,sport:2,track:3,stock:0,flame:3,'golf-r32':2,'golf-clean':1,'golf-diffuser':3,'golf-wide':3,'golf-splitter':3,'golf-superwide':3,'mercedes-aero':1,'mercedes-splitter':3,'mercedes-clean':1,'mercedes-diffuser':3,'mercedes-wide':3,'audi-aero':1,'audi-splitter':3,'audi-clean':1,'audi-diffuser':3,'audi-wide':3}[config[region.part]];
  if(region.part==='rear') {
    const w=smooth(0,.15,.39-p.y)*smooth(0,.22,p.z-1.55);
    if(config.rear!=='stock') {result.y-=(.035+level*.011)*w;result.z+=(.015+level*.012)*w;}
    if(config.rear!=='stock')result.x+=Math.sign(p.x)*(.005+level*.005)*w*smooth(.4,.8,Math.abs(p.x));
  } else if(region.part==='front') {
    const w=smooth(0,.13,.36-p.y)*smooth(0,.22,-1.49-p.z);
    result.y-=(.025+level*.008)*w;result.z-=(config.front==='golf-wide'?.16:(.01+level*.008))*w;
  } else {
    const w=smooth(0,.12,.38-p.y)*smooth(0,.16,p.z+.8)*smooth(0,.16,.98-p.z)*smooth(0,.08,Math.abs(p.x)-.68);
    result.y-=(.022+level*.009)*w;result.x+=region.side!*(.012+level*.009)*w;
  }
  return result;
}
/** Cut and replace only the configured sections of a player clone. */
export function fitGolfBodywork(inner:THREE.Group,wrapper:THREE.Group,kit:THREE.Group,config:Customization):THREE.BufferGeometry[] {
  const areas=regions(config); if(!areas.length) return [];
  const mesh=inner.getObjectByName('golf_mesh_3') as THREE.Mesh | undefined;
  if(!mesh?.isMesh || !mesh.geometry.getAttribute('position')) return [];
  wrapper.updateMatrixWorld(true);
  const geo=mesh.geometry,index=geo.index,attrs=Object.entries(geo.attributes),posIndex=attrs.findIndex(([name])=>name==='position');
  const matrix=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld), inverse=matrix.clone().invert();
  const count=index?index.count:geo.getAttribute('position').count;
  const stock:Vertex[][]=[], fitted=areas.map(()=>[] as Vertex[][]);
  const vertex=(i:number):Vertex=>{
    const a=attrs.map(([,attr])=>Array.from({length:attr.itemSize},(_,j)=>attr.getComponent(i,j)));
    return {p:new THREE.Vector3(...(a[posIndex] as [number,number,number])).applyMatrix4(matrix),a};
  };
  for(let i=0;i+2<count;i+=3) {
    let remaining:Vertex[][]=[[vertex(index?index.getX(i):i),vertex(index?index.getX(i+1):i+1),vertex(index?index.getX(i+2):i+2)]];
    for(let r=0;r<areas.length;r++) {
      const next:Vertex[][]=[];
      for(const tri of remaining) {
        let inside=tri;
        for(const plane of areas[r].planes) {
          if(!inside.length)break;
          const [yes,no]=split(inside,plane);triangles(no,next);inside=yes;
        }
        if(inside.length) triangles(inside,fitted[r]);
      }
      remaining=next;
    }
    stock.push(...remaining);
  }
  const build=(faces:Vertex[][],region?:Region)=>{
    const arrays=attrs.map(()=>[] as number[]),groups:number[]=[];
    const detail: {face:Vertex[]; dark:boolean}[]=[];
    for(const face of faces) {
      const variant=region && config[region.part];
      const width=variant==='track'?.49:(variant==='golf-clean'||variant==='golf-diffuser')?.55:variant==='sport'?.43:.34;
      const top=variant==='track'?.365:variant==='golf-diffuser'?.365:variant==='golf-clean'?.33:variant==='sport'?.34:.30;
      const planes:Plane[]=region?.part==='rear' && (variant==='touring'||variant==='sport'||variant==='track'||variant==='golf-clean'||variant==='golf-diffuser')
        ? [p=>width-p.x-.55*(.39-p.y),p=>width+p.x-.55*(.39-p.y),p=>top-p.y,p=>p.z-1.76] : [];
      let inside=face;
      for(const plane of planes) {
        if(!inside.length)break;
        const [yes,no]=split(inside,plane);const outside:Vertex[][]=[];triangles(no,outside);
        for(const tri of outside) {const fine:Vertex[][]=[];subdivide(tri,1,fine);detail.push(...fine.map(face=>({face,dark:false})));}
        inside=yes;
      }
      const rest:Vertex[][]=[];triangles(inside,rest);
      for(const tri of rest) {const fine:Vertex[][]=[];if(region)subdivide(tri,1,fine);else fine.push(tri);detail.push(...fine.map(face=>({face,dark:planes.length>0})));}
    }
    // Bore the outlet openings in the replacement surface itself. Their
    // positions/radii follow the separately selectable exhaust tune.
    let final=detail;
    if(region?.part==='rear' && (config.exhaust!=='stock' || config.rear==='golf-r32')) {
      const layout=golfExhaustLayout(config), centers=layout.centers, radius=layout.radius*1.06;
      for(const x of centers) {
        const planes:Plane[]=[p=>p.z-1.72];
        for(let j=0;j<20;j++) {
          const angle=2*Math.PI*j/20, nx=Math.cos(angle),ny=Math.sin(angle);
          planes.push(p=>{const q=shape(p,region,config);return radius-((q.x-x)*nx+(q.y-layout.y)*ny);});
        }
        const next:typeof detail=[];
        for(const item of final) {
          let inside=item.face;
          for(const plane of planes) {
            if(!inside.length)break;
            const [yes,no]=split(inside,plane);const outside:Vertex[][]=[];triangles(no,outside);
            next.push(...outside.map(face=>({face,dark:item.dark})));inside=yes;
          }
          // discard inside: the pipe occupies this opening
        }
        final=next;
      }
    }
    for(const {face,dark} of final) {
      groups.push(dark?1:0);
      for(const v of face) {
        const p=region?shape(v.p,region,config).applyMatrix4(inverse):null;
        attrs.forEach(([,attr],j)=>arrays[j].push(...(j===posIndex&&p?[p.x,p.y,p.z]:v.a[j].slice(0,attr.itemSize))));
      }
    }
    const result=new THREE.BufferGeometry();
    attrs.forEach(([name,attr],i)=>result.setAttribute(name,new THREE.Float32BufferAttribute(arrays[i],attr.itemSize,attr.normalized)));
    if(region) {
      // Matching vertices on the seams stay at the unmodified body.
      // Preserve interpolated source normals. Non-indexed recomputation would
      // create a hard facet at every triangle and destroy the OEM curvature.
      let start=0,last=groups[0];for(let i=1;i<=groups.length;i++) if(i===groups.length||groups[i]!==last){result.addGroup(start*3,(i-start)*3,last);start=i;last=groups[i];}
    }
    return result;
  };
  if(config.front==='golf-splitter') {
    // Replace the entire grille area, including the painted bars between the
    // openings, so the new smooth panel never overlays the factory surface.
    const cut=(faces:Vertex[][]) => {
      const keep:Vertex[][]=[];
      const planes:Plane[]=[p=>p.y-.205,p=>.405-p.y,p=>p.x+.675,p=>.675-p.x,p=>-1.70-p.z];
      for(const face of faces) {
        let inside=face;
        for(const plane of planes) {
          if(!inside.length)break;
          const [yes,no]=split(inside,plane);triangles(no,keep);inside=yes;
        }
      }
      return keep;
    };
    stock.splice(0,stock.length,...cut(stock));
    for(let i=0;i<areas.length;i++) if(areas[i].part==='front') fitted[i]=cut(fitted[i]);
  }
  const trimmed=build(stock);mesh.geometry=trimmed;
  const owned=[trimmed];
  if(config.rear==='golf-r32'||config.rear==='golf-clean') {
    // The separate black plastic primitive contains the factory rubbing strip.
    // Remove only the part on the replacement rear, not the door mouldings or
    // tailgate handle. Exact clipping avoids fragments at the body seam.
    const trim=inner.getObjectByName('golf_mesh') as THREE.Mesh | undefined;
    if(trim?.isMesh) {
      const source=trim.geometry, attr=Object.entries(source.attributes), idx=source.index;
      const pos=attr.findIndex(([name])=>name==='position');
      const toCar=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(trim.matrixWorld);
      const v=(i:number):Vertex=>{const a=attr.map(([,b])=>Array.from({length:b.itemSize},(_,j)=>b.getComponent(i,j)));return {a,p:new THREE.Vector3(...(a[pos] as [number,number,number])).applyMatrix4(toCar)};};
      const keep:Vertex[][]=[], n=idx?idx.count:source.getAttribute('position').count;
      for(let i=0;i+2<n;i+=3) {
        let inside=[v(idx?idx.getX(i):i),v(idx?idx.getX(i+1):i+1),v(idx?idx.getX(i+2):i+2)];
        for(const plane of [((p:THREE.Vector3)=>.62-p.y),((p:THREE.Vector3)=>p.z-1.55)]) {
          if(!inside.length)break;const [yes,no]=split(inside,plane);triangles(no,keep);inside=yes;
        }
      }
      const arrays=attr.map(()=>[] as number[]);for(const face of keep)for(const v of face)attr.forEach(([,b],j)=>arrays[j].push(...v.a[j].slice(0,b.itemSize)));
      const geometry=new THREE.BufferGeometry();attr.forEach(([name,b],i)=>geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[i],b.itemSize,b.normalized)));
      trim.geometry=geometry;owned.push(geometry);
    }
  }
  if(config.front==='golf-splitter') {
    // Remove only the lower factory grille slats. Preserve the upper rubbing
    // strip and all other trim, then close the original openings with a
    // body-colored surface recessed behind the surrounding painted bumper.
    const trim=inner.getObjectByName('golf_mesh') as THREE.Mesh | undefined;
    if(trim?.isMesh) {
      const source=trim.geometry,attr=Object.entries(source.attributes),idx=source.index,pos=attr.findIndex(([name])=>name==='position');
      const toCar=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(trim.matrixWorld);
      const vertex=(i:number):Vertex=>{const a=attr.map(([,b])=>Array.from({length:b.itemSize},(_,j)=>b.getComponent(i,j)));return {a,p:new THREE.Vector3(...(a[pos] as [number,number,number])).applyMatrix4(toCar)};};
      const keep:Vertex[][]=[],n=idx?idx.count:source.getAttribute('position').count;
      for(let i=0;i+2<n;i+=3) {
        let inside=[vertex(idx?idx.getX(i):i),vertex(idx?idx.getX(i+1):i+1),vertex(idx?idx.getX(i+2):i+2)];
        for(const plane of [((p:THREE.Vector3)=>p.y-.285),((p:THREE.Vector3)=>.405-p.y),((p:THREE.Vector3)=>-1.70-p.z)]) {
          if(!inside.length)break;const [yes,no]=split(inside,plane);triangles(no,keep);inside=yes;
        }
      }
      const arrays=attr.map(()=>[] as number[]);for(const face of keep)for(const v of face)attr.forEach(([,b],j)=>arrays[j].push(...v.a[j].slice(0,b.itemSize)));
      const geometry=new THREE.BufferGeometry();attr.forEach(([name,b],i)=>geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[i],b.itemSize,b.normalized)));trim.geometry=geometry;owned.push(geometry);
    }
    const section=kit.getObjectByName('custom-front');
    if(section) {
      const positions:number[]=[],indices:number[]=[];const columns=64;
      for(let i=0;i<=columns;i++) for(const y of [.205,.405]) {
        const x=(i/columns*2-1)*.675,z=-2.04+.47*x*x-.24*(y-.34);
        positions.push(x,y,z);
      }
      for(let i=0;i<columns;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,b,c,b,d,c);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const cover=new THREE.Mesh(geometry,(kit.userData.ownedMaterials as THREE.Material[])[0]);cover.name='golf-filled-front-grille';section.add(cover);
    }
  }
  const materials=kit.userData.ownedMaterials as THREE.Material[];
  const diffuser=new THREE.MeshStandardMaterial({color:config.rearDiffuserColor || 0x4b5357,metalness:.25,roughness:.58,emissive:config.rearDiffuserColor ? 0x000000 : 0x182024,emissiveIntensity:.5});
  diffuser.name='golf-rear-diffuser-color';
  materials.push(diffuser);
  areas.forEach((area,i)=>{
    const group=kit.getObjectByName(`custom-${area.part}`);if(!group||!fitted[i].length)return;
    const finish=config[`${area.part}Finish`]==='carbon' ? materials[2] : area.part==='skirts' && config.skirts==='golf-superwide' ? materials[1] : materials[0];
    const replacement=new THREE.Mesh(build(fitted[i],area),[finish,diffuser]);
    replacement.name=area.part==='skirts'?'side-skirt':area.part==='rear'?'rear-valance':'front-fascia';
    replacement.matrix.copy(matrix);replacement.matrixAutoUpdate=false;replacement.castShadow=true;group.add(replacement);
  });
  return owned;
}
