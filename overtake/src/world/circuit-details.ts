import * as THREE from 'three';
import { getTrack, trackPoint, trackSample, type TrackId } from '../circuit.mjs';
import { createTreeGeometries } from './trees';

// Textures already shipped with the game are shared by all five venues.
const textures=new Map<string,THREE.Texture>();
function texture(path:string,repeat=1) {
  const key=`${path}:${repeat}`;let map=textures.get(key);
  if(!map) {
    map=new THREE.TextureLoader().load(`${(import.meta as any).env?.BASE_URL ?? '/'}textures/${path}.jpg`);
    map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeat,repeat);map.anisotropy=4;textures.set(key,map);
  }
  return map;
}
export function circuitRoadMaterial() {
  // Offset the asphalt towards the camera to avoid depth fighting with the
  // runoff on distant corners without changing the physical road height.
  return new THREE.MeshStandardMaterial({map:texture('road/asphalt-albedo'),color:0xb7bdc1,roughness:.93,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
}
export function circuitGroundMaterial(id:TrackId) {
  const theme=getTrack(id).theme,urban=theme==='industrial'||theme==='neon';
  return new THREE.MeshStandardMaterial({map:texture(urban?'road/gravel-albedo':'landscape/grass',95),color:theme==='mountain'?0xc1cbbc:theme==='coast'?0xbec7ac:urban?0x9ba5a9:0xb5c7aa,roughness:1});
}
export function circuitSandMaterial() {
  return new THREE.MeshStandardMaterial({map:texture('landscape/desert-ground',55),color:0xd7c8a8,roughness:1});
}
export function circuitWaterMaterial() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
  c.fillStyle='#6eafba';c.fillRect(0,0,256,256);
  // Staggered, subtle highlights create a water surface without animation or
  // expensive reflections, and wrap cleanly at the texture boundaries.
  for(let i=0;i<85;i++){const x=(i*73)%256,y=(i*41)%256,w=8+(i%5)*5;c.strokeStyle=i%3?'#7cbac0':'#9bcad0';c.globalAlpha=.18+(i%3)*.04;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y+1);c.stroke();}
  c.globalAlpha=1;const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(32,65);map.anisotropy=4;
  return new THREE.MeshStandardMaterial({map,color:0xa8d1d5,metalness:.15,roughness:.5});
}
function makeCanvasMaterial(draw:(ctx:CanvasRenderingContext2D)=>void,emissive=false) {
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d')!;draw(ctx);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  return emissive?new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map,roughness:.8,side:THREE.DoubleSide});
}
/** Decoration remains outside every part of the drivable road, including
 * nearby sections on tight tracks. Geometry is visual-only. */
export function createCircuitDetails(id:TrackId) {
  const track=getTrack(id), root=new THREE.Group();root.name='circuit-details';
  const extra=new THREE.Group();extra.name='circuit-extra-detail';root.add(extra);
  root.userData.extra=extra;
  const samples=Array.from({length:Math.ceil(track.length/8)},(_,i)=>trackPoint(i*track.length/Math.ceil(track.length/8),0,id));
  function clear(x:number,z:number,radius:number) { return samples.every(p=>Math.hypot(p.x-x,p.z-z)>track.halfWidth+radius+5); }
  const metal=new THREE.MeshStandardMaterial({color:0x8e9ba0,metalness:.35,roughness:.65});
  const dark=new THREE.MeshStandardMaterial({color:0x25303a,roughness:.9});
  const white=new THREE.MeshStandardMaterial({color:0xe8e9dd,roughness:.8});
  const neonPink=new THREE.MeshBasicMaterial({color:0xff4dc7});
  const neonBlue=new THREE.MeshBasicMaterial({color:0x53dcf5});
  const accent=new THREE.MeshStandardMaterial({color:track.theme==='industrial'?0xc67932:track.theme==='coast'?0x579bac:track.theme==='neon'?0xd435a2:0x53758b,roughness:.75});
  const dummy=new THREE.Object3D();

  // Catch fences: one batched line mesh rather than hundreds of draw calls.
  const wire:number[]=[];
  for(const side of [-1,1]) {
    const offset=side*(track.halfWidth+4.4),count=Math.ceil(track.length/12);
    for(let i=0;i<count;i++) {
      const a=trackPoint(i*track.length/count,offset,id),b=trackPoint((i+1)*track.length/count,offset,id);
      wire.push(a.x,1.1,a.z,a.x,3.5,a.z);
      for(const y of [1.3,2.4,3.5])wire.push(a.x,y,a.z,b.x,y,b.z);
    }
  }
  const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));
  const fence=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:0x91a0a0,transparent:true,opacity:.7}));fence.name='catch-fence';root.add(fence);

  // Lightweight track furniture and sponsor boards. Textures are procedural
  // fictional branding, and all boards are beyond the safety wall.
  const board=makeCanvasMaterial(ctx=>{ctx.fillStyle='#122d43';ctx.fillRect(0,0,512,256);ctx.fillStyle='#b7ef65';ctx.fillRect(0,0,18,256);ctx.fillRect(0,232,512,24);ctx.fillStyle='#ffffff';ctx.font='italic 900 61px sans-serif';ctx.textAlign='center';ctx.fillText('OVERTAKE',269,112);ctx.fillStyle='#add0df';ctx.font='bold 27px sans-serif';ctx.fillText('RACE SERIES',270,163);},track.theme==='neon');
  const signGeometry=new THREE.PlaneGeometry(8,4),postGeometry=new THREE.BoxGeometry(.16,2.2,.16);
  for(let i=0;i<12;i++) {
    const side=i%2?1:-1,p=trackPoint((i+.42)*track.length/12,side*(track.halfWidth+11.5),id);if(!clear(p.x,p.z,5))continue;
    const unit=new THREE.Group();unit.position.set(p.x,0,p.z);unit.rotation.y=p.yaw;
    const face=new THREE.Mesh(signGeometry,board);face.position.y=4.2;unit.add(face);
    for(const x of [-3.2,3.2]) {const post=new THREE.Mesh(postGeometry,metal);post.position.set(x,1.1,0);unit.add(post);}root.add(unit);
  }
  // Grid-box markings are flat decals and do not interfere with driving.
  const gridGeo=new THREE.BoxGeometry(2.5,.012,.12),gridMat=new THREE.MeshBasicMaterial({color:0xe0e5de});
  const grid=new THREE.InstancedMesh(gridGeo,gridMat,10);
  for(let i=0;i<10;i++){const p=trackPoint(-10-i*6,i%2?3:-3,id);dummy.position.set(p.x,.028,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();grid.setMatrixAt(i,dummy.matrix);}grid.name='starting-grid';root.add(grid);

  // Worn rubber follows corners, especially on the two drift layouts. All
  // strips are combined into one mesh and sit just above the asphalt.
  const rubber:number[]=[];
  for(let s=20;s<track.length-20;s+=9) {
    const bend=Math.abs(trackSample(s,id).curvature);if(bend<.0035)continue;
    for(const offset of [-2.6,2.6]) {
      const width=track.kind==='drift'?.30:.16, length=track.kind==='drift'?6:4;
      const a=trackPoint(s,offset-width,id),b=trackPoint(s,offset+width,id),c=trackPoint(s+length,offset-width,id),d=trackPoint(s+length,offset+width,id);
      rubber.push(a.x,.019,a.z,c.x,.019,c.z,b.x,.019,b.z,b.x,.019,b.z,c.x,.019,c.z,d.x,.019,d.z);
    }
  }
  const rubberGeo=new THREE.BufferGeometry();rubberGeo.setAttribute('position',new THREE.Float32BufferAttribute(rubber,3));rubberGeo.computeVertexNormals();
  const rubberMesh=new THREE.Mesh(rubberGeo,new THREE.MeshBasicMaterial({color:0x10171b,transparent:true,opacity:track.kind==='drift'?.32:.19,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));rubberMesh.name='rubber-marks';root.add(rubberMesh);

  // Tyre barriers and distance markers at bends, kept behind the wall.
  const tireGeo=new THREE.TorusGeometry(.48,.16,6,10),tireMat=new THREE.MeshStandardMaterial({color:0x1b2326,roughness:1});
  const tires=new THREE.InstancedMesh(tireGeo,tireMat,120);let tireCount=0;
  for(let i=0;i<20;i++) {
    const s=i*track.length/20;if(Math.abs(trackSample(s+25,id).curvature)<.004)continue;
    const side=i%2?1:-1,p=trackPoint(s,side*(track.halfWidth+6.5),id);if(!clear(p.x,p.z,1))continue;
    for(let row=0;row<3;row++)for(let level=0;level<2;level++) {
      dummy.position.set(p.x+Math.sin(p.yaw)*row*.95,.18+level*.31,p.z+Math.cos(p.yaw)*row*.95);dummy.rotation.set(Math.PI/2,0,p.yaw);dummy.scale.set(1,1,1);dummy.updateMatrix();tires.setMatrixAt(tireCount++,dummy.matrix);
    }
  }
  tires.count=tireCount;tires.name='tire-barriers';extra.add(tires);

  // Spectator stand and canopy at the stadium start straight. The crowd is
  // represented by one painted texture, not hundreds of animated objects.
  if(id==='stadium') {
    const crowd=makeCanvasMaterial(ctx=>{
      ctx.fillStyle='#303e46';ctx.fillRect(0,0,512,256);
      const shirts=['#d8d2bd','#a24a3c','#76969a','#d2ad65','#445d6c','#a2b5ad'];
      for(let row=0;row<6;row++) {const y=24+row*38;ctx.fillStyle='#819099';ctx.fillRect(0,y+27,512,5);
        for(let col=0;col<36;col++){const x=col*15+(row%2)*7;ctx.fillStyle=shirts[(col*7+row*5)%shirts.length];ctx.fillRect(x,y+11,9,15);ctx.fillStyle='#c2ab93';ctx.beginPath();ctx.arc(x+4.5,y+7,4,0,Math.PI*2);ctx.fill();}}
    });
    const p=trackPoint(35,-34,id),stand=new THREE.Group();stand.position.set(p.x,0,p.z);stand.rotation.y=p.yaw;
    const crowdFace=new THREE.Mesh(new THREE.PlaneGeometry(150,6.5),crowd);crowdFace.rotation.y=Math.PI/2;crowdFace.position.set(0,6.6,0);stand.add(crowdFace);
    const canopy=new THREE.Mesh(new THREE.BoxGeometry(15,.5,155),metal);canopy.position.set(-4,10.5,0);stand.add(canopy);
    for(let z=-70;z<=70;z+=20){const pole=new THREE.Mesh(new THREE.BoxGeometry(.35,10,.35),metal);pole.position.set(-9,5,z);stand.add(pole);}
    root.add(stand);
    // Garage fronts sit on the existing pit-building walls, with shutters,
    // glazing and a high-contrast pit-lane header.
    const pitFacade=makeCanvasMaterial(ctx=>{
      ctx.fillStyle='#5e7079';ctx.fillRect(0,0,512,256);ctx.fillStyle='#1c303d';ctx.fillRect(0,0,512,54);
      ctx.fillStyle='#edf1e7';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.fillText('OVERTAKE  /  PIT LANE',256,36);
      for(let x=20;x<490;x+=118){ctx.fillStyle='#293e4b';ctx.fillRect(x,65,96,39);ctx.fillStyle='#91b6c0';ctx.fillRect(x+4,68,88,4);}
      ctx.fillStyle='#aeb7b1';ctx.fillRect(24,116,464,127);ctx.strokeStyle='#667779';ctx.lineWidth=4;
      for(let y=128;y<245;y+=17){ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(488,y);ctx.stroke();}
      ctx.fillStyle='#e1b958';ctx.fillRect(24,240,464,8);
    });
    const garageFaceGeo=new THREE.PlaneGeometry(20.5,5.4);
    for(let i=0;i<6;i++){const p=trackPoint(-27+i*23,16.91,id);const face=new THREE.Mesh(garageFaceGeo,pitFacade);face.position.set(p.x,3,p.z);face.rotation.y=p.yaw-Math.PI/2;root.add(face);}
  }
  // Venue-specific building silhouettes with window/door detail.
  if(id!=='stadium') {
    const buildingGeo=new THREE.BoxGeometry(10,1,15),roofGeo=new THREE.ConeGeometry(8.6,3,4);
    const windows=makeCanvasMaterial(ctx=>{
      ctx.fillStyle=track.theme==='neon'?'#202b43':track.theme==='industrial'?'#6a7779':track.theme==='coast'?'#ede7d2':'#83786a';ctx.fillRect(0,0,512,256);
      ctx.fillStyle=track.theme==='neon'?'#3dc3e4':'#354d57';for(let x=26;x<480;x+=112)for(let y=30;y<230;y+=96){ctx.fillRect(x,y,74,55);ctx.fillStyle=track.theme==='neon'?'#f06ed1':'#a8c0bd';ctx.fillRect(x+32,y,5,55);ctx.fillStyle=track.theme==='neon'?'#3dc3e4':'#354d57';}
    },track.theme==='neon');
    const structure=new THREE.MeshStandardMaterial({color:track.theme==='neon'?0x27364f:track.theme==='industrial'?0x627073:track.theme==='coast'?0xd9d4c0:0x867d72,roughness:.9});
    const roof=new THREE.MeshStandardMaterial({color:track.theme==='coast'?0x9e6c50:track.theme==='mountain'?0x4d626b:0x344954,roughness:.9});
    for(let i=0;i<18;i++) {
      const side=track.theme==='coast'&&i%2===0?-1:1;
      const p=trackPoint(i*track.length/18,side*(track.halfWidth+22+(i%3)*7),id);
      if(!clear(p.x,p.z,10)||(id==='coast'&&p.x>125))continue;
      const height=track.theme==='neon'?11+(i%4)*7:track.theme==='industrial'?5+(i%3)*2:5+(i%2)*3;
      const building=new THREE.Group();building.position.set(p.x,0,p.z);building.rotation.y=p.yaw;
      const body=new THREE.Mesh(buildingGeo,structure);body.scale.y=height;body.position.y=height/2;building.add(body);
      const facade=new THREE.Mesh(new THREE.PlaneGeometry(14,height*.72),windows);facade.rotation.y=-Math.PI/2;facade.position.set(-5.04,height*.52,0);building.add(facade);
      if(track.theme==='coast'||track.theme==='mountain') {const top=new THREE.Mesh(roofGeo,roof);top.rotation.y=Math.PI/4;top.scale.z=1.5;top.position.y=height+1.5;building.add(top);}
      else {const trim=new THREE.Mesh(new THREE.BoxGeometry(10.3,.45,15.3),track.theme==='neon'?(i%2?neonPink:neonBlue):accent);trim.position.y=height-.2;building.add(trim);}
      root.add(building);
    }
  }
  if(track.theme==='mountain') {
    // Distant transparent mountain panoramas, kept well beyond the venue.
    const panorama=new THREE.TextureLoader().load(`${(import.meta as any).env?.BASE_URL ?? '/'}textures/landscape/mountain-panorama.png`);
    panorama.colorSpace=THREE.SRGBColorSpace;panorama.anisotropy=4;
    const backdrop=new THREE.MeshStandardMaterial({map:panorama,transparent:true,alphaTest:.1,side:THREE.DoubleSide,roughness:1});
    const panoGeo=new THREE.PlaneGeometry(1080,225);
    for(let i=0;i<4;i++){const a=i*Math.PI/2,mesh=new THREE.Mesh(panoGeo,backdrop);mesh.position.set(Math.sin(a)*530,102,Math.cos(a)*530);mesh.rotation.y=a;mesh.name='mountain-backdrop';root.add(mesh);}
    const rockGeo=new THREE.IcosahedronGeometry(1,1),rockMat=new THREE.MeshStandardMaterial({color:0x778078,roughness:1,flatShading:true});
    const rocks=new THREE.InstancedMesh(rockGeo,rockMat,28);let n=0;
    for(let i=0;i<28;i++){const side=i%2?1:-1,p=trackPoint(i*track.length/28,side*(track.halfWidth+34+(i%3)*7),id),radius=3+(i%3);if(!clear(p.x,p.z,radius))continue;
      dummy.position.set(p.x,radius*.45,p.z);dummy.rotation.set(0,i*1.7,0);dummy.scale.set(radius,radius*.55,radius*.8);dummy.updateMatrix();rocks.setMatrixAt(n++,dummy.matrix);}
    rocks.count=n;extra.add(rocks);
  }
  if(track.theme==='coast') {
    // Sailboats sit on the water, not on the grass or circuit.
    const sailMat=new THREE.MeshStandardMaterial({color:0xf2eee1,side:THREE.DoubleSide,roughness:.8});
    for(let i=0;i<5;i++) {const x=230+i*48,z=-260+i*145;if(!clear(x,z,14))continue;
      const boat=new THREE.Group();boat.position.set(x,.15,z);boat.rotation.y=(i%3-1)*.35;
      const hull=new THREE.Mesh(new THREE.BoxGeometry(3,.8,10),white);hull.position.y=.4;boat.add(hull);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,13,6),dark);mast.position.y=6.9;boat.add(mast);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,2,0,0,12,0,0,2,5],3));geo.computeVertexNormals();boat.add(new THREE.Mesh(geo,sailMat));root.add(boat);
    }
    // A lighthouse is a recognisable landmark on dry ground, outside the road.
    const p=trackPoint(0,-50,id);
    if(clear(p.x,p.z,6)&&p.x<125) {const lighthouse=new THREE.Group();lighthouse.position.set(p.x,0,p.z);
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.3,3.8,23,12),white);tower.position.y=11.5;lighthouse.add(tower);
      for(const y of [5,14]){const band=new THREE.Mesh(new THREE.CylinderGeometry(3.2-y*.03,3.5-y*.03,3,12),accent);band.position.y=y;lighthouse.add(band);}
      const lamp=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,3,12),new THREE.MeshBasicMaterial({color:0xffe8aa}));lamp.position.y=24.5;lighthouse.add(lamp);root.add(lighthouse);}
  }
  if(track.theme==='industrial') {
    const steel=new THREE.MeshStandardMaterial({color:0xd08d35,metalness:.3,roughness:.65});
    const crates=[0x587c91,0xa8553e,0xb49e70,0x376465].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
    const boxGeo=new THREE.BoxGeometry(4,2.6,9),ribGeo=new THREE.BoxGeometry(.05,2.3,.08),cableGeo=new THREE.CylinderGeometry(.045,.045,12,4);
    for(let i=0;i<7;i++){const p=trackPoint(i*track.length/7,track.halfWidth+50,id);if(!clear(p.x,p.z,20))continue;
      const yard=new THREE.Group();yard.position.set(p.x,0,p.z);yard.rotation.y=p.yaw;
      for(let row=0;row<3;row++)for(let level=0;level<2;level++){const box=new THREE.Mesh(boxGeo,crates[(i+row+level)%4]);box.position.set(row*4.3,1.3+level*2.65,0);yard.add(box);
        for(let z=-3.5;z<4;z+=1.4){const rib=new THREE.Mesh(ribGeo,dark);rib.position.set(row*4.3-2.03,1.3+level*2.65,z);yard.add(rib);}}
      const mast=new THREE.Mesh(new THREE.BoxGeometry(2,25,2),steel);mast.position.set(16,12.5,0);yard.add(mast);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(19,1.4,1.5),steel);arm.position.set(8,24,0);yard.add(arm);
      const cable=new THREE.Mesh(cableGeo,dark);cable.position.set(1,17.5,0);yard.add(cable);
      const hook=new THREE.Mesh(new THREE.TorusGeometry(.5,.1,6,12,Math.PI*1.4),dark);hook.position.set(1,11.3,0);yard.add(hook);root.add(yard);
    }
  }
  if(track.theme==='neon') {
    const neonSign=makeCanvasMaterial(ctx=>{ctx.fillStyle='#131d39';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#50e2ff';ctx.lineWidth=9;ctx.strokeRect(8,8,496,240);ctx.fillStyle='#ff70d6';ctx.textAlign='center';ctx.font='italic 900 75px sans-serif';ctx.fillText('NEON',256,105);ctx.fillStyle='#d1f9ff';ctx.font='bold 56px sans-serif';ctx.fillText('SLIDE',256,180);},true);
    for(let i=0;i<8;i++){const p=trackPoint((i+.5)*track.length/8,track.halfWidth+34,id);if(!clear(p.x,p.z,9))continue;const unit=new THREE.Group();unit.position.set(p.x,0,p.z);unit.rotation.y=p.yaw;const face=new THREE.Mesh(new THREE.PlaneGeometry(10,5),neonSign);face.position.y=9;unit.add(face);for(const x of [-4,4]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.25,6.5,.25),metal);pole.position.set(x,3.25,0);unit.add(pole);}root.add(unit);}
  }

  // Instanced trees make the surroundings richer without per-tree draw calls.
  // Coastal trees never spawn under the ocean plane; industrial/urban tracks
  // get fewer trees so their environments retain their own character.
  const geo=createTreeGeometries(),pine=track.theme==='mountain',count=track.theme==='industrial'||track.theme==='neon'?45:115;
  if(pine){geo.broadWood.dispose();geo.broadCrown.dispose();}else{geo.pineWood.dispose();geo.pineCrown.dispose();}
  const wood=new THREE.InstancedMesh(pine?geo.pineWood:geo.broadWood,new THREE.MeshStandardMaterial({color:0x6e5841}),count);
  const crown=new THREE.InstancedMesh(pine?geo.pineCrown:geo.broadCrown,new THREE.MeshStandardMaterial({color:pine?0x446c50:0x5b8756,vertexColors:true}),count);let n=0;
  for(let i=0;i<count;i++){const side=i%2?1:-1,p=trackPoint(i*track.length/count,side*(48+(i*17%65)),id);if(!clear(p.x,p.z,4)||(id==='coast'&&p.x>120))continue;
    dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.setScalar(.9+(i%5)*.14);dummy.updateMatrix();wood.setMatrixAt(n,dummy.matrix);crown.setMatrixAt(n,dummy.matrix);n++;}
  wood.count=crown.count=n;wood.name='venue-trees';extra.add(wood,crown);
  return root;
}
