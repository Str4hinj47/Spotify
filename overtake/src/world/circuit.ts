import * as THREE from 'three';
import { getTrack, trackPoint, trackSample, type TrackId } from '../circuit.mjs';
import { circuitGroundMaterial, circuitRoadMaterial, circuitSandMaterial, circuitWaterMaterial, createCircuitDetails } from './circuit-details';

// A self-contained venue: nothing from the endless highway is reused here.
function ribbon(inner:number, outer:number, y:number, material:THREE.Material, trackId:TrackId, segments=600) {
  const track=getTrack(trackId), TRACK_LENGTH=track.length; const trackPosition=(s:number,o:number)=>trackPoint(s,o,trackId);
  const positions:number[]=[], indices:number[]=[], uvs:number[]=[];
  for(let i=0;i<=segments;i++) {
    const s=TRACK_LENGTH*i/segments;
    for(const offset of [inner,outer]) {const p=trackPosition(s,offset);positions.push(p.x,y,p.z);uvs.push(offset/6,s/6);}
    if(i<segments) {const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
// Short pieces of surface for the pit lane and concrete safety walls.
function trackStrip(start:number, end:number, a:number, b:number, y:number, material:THREE.Material, trackId:TrackId, count=60) {
  const trackPosition=(s:number,o:number)=>trackPoint(s,o,trackId);
  const positions:number[]=[], indices:number[]=[], uvs:number[]=[];
  for(let i=0;i<=count;i++) {
    const s=start+(end-start)*i/count;
    for(const offset of [a,b]) { const p=trackPosition(s,offset);positions.push(p.x,y,p.z);uvs.push(offset/6,s/6); }
    if(i<count) {const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
function safetyWall(offset:number, material:THREE.Material, trackId:TrackId) {
  const TRACK_LENGTH=getTrack(trackId).length;const trackPosition=(s:number,o:number)=>trackPoint(s,o,trackId);
  const positions:number[]=[],indices:number[]=[],count=600;
  for(let i=0;i<=count;i++) {
    const p=trackPosition(TRACK_LENGTH*i/count,offset);positions.push(p.x,.12,p.z,p.x,1.05,p.z);
    if(i<count) {const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
export function createCircuit(trackId:TrackId='stadium') {
  const track=getTrack(trackId), TRACK_LENGTH=track.length, TRACK_HALF_WIDTH=track.halfWidth;
  const trackPosition=(s:number,o:number)=>trackPoint(s,o,trackId);
  const group=new THREE.Group();group.name='circuit-venue';group.userData.trackId=trackId;
  const grass=circuitGroundMaterial(trackId);
  const road=circuitRoadMaterial();
  const runoff=new THREE.MeshStandardMaterial({color:0x828778,roughness:1,side:THREE.DoubleSide});
  const white=new THREE.MeshStandardMaterial({color:0xf0eee3,roughness:.8,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const red=new THREE.MeshStandardMaterial({color:0xc33836,roughness:.8,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const rail=new THREE.MeshStandardMaterial({color:0xabb7b7,metalness:.35,roughness:.65});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(track.theme==='coast'?875:1500,1500),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.08;if(track.theme==='coast')ground.position.x=-312.5;group.add(ground);
  group.add(ribbon(-TRACK_HALF_WIDTH-4,TRACK_HALF_WIDTH+4,-.01,runoff,trackId));
  const roadSurface=ribbon(-TRACK_HALF_WIDTH,TRACK_HALF_WIDTH,.01,road,trackId);roadSurface.name='circuit-asphalt';group.add(roadSurface);
  for(const side of [-1,1]) {
    group.add(ribbon(side*(TRACK_HALF_WIDTH-.28),side*(TRACK_HALF_WIDTH-.15),.025,white,trackId));
    // Batch the alternating kerbs into two meshes per side.
    const kerbPositions:number[][]=[[],[]];
    for(let i=0;i<Math.ceil(TRACK_LENGTH/5);i++) {
      const s=i*5, e=Math.min(s+5,TRACK_LENGTH), a=trackPosition(s,side*(TRACK_HALF_WIDTH+.05)),b=trackPosition(s,side*(TRACK_HALF_WIDTH+1.1)),c=trackPosition(e,side*(TRACK_HALF_WIDTH+.05)),d=trackPosition(e,side*(TRACK_HALF_WIDTH+1.1));
      // Curbs mark corner entry, apex and exit rather than striping the
      // entire lap, including long straights.
      if(Math.max(...[-15,0,15].map(d=>Math.abs(trackSample(s+d,trackId).curvature)))>.003)
        kerbPositions[i%2].push(a.x,.03,a.z,c.x,.03,c.z,b.x,.03,b.z,b.x,.03,b.z,c.x,.03,c.z,d.x,.03,d.z);
    }
    for(const [i,positions] of kerbPositions.entries()) {const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();group.add(new THREE.Mesh(geo,i?red:white));}
    // Continuous low wall, deliberately outside the driveable surface.
    const wall=ribbon(side*(TRACK_HALF_WIDTH+3),side*(TRACK_HALF_WIDTH+3.45),1.05,rail,trackId);group.add(wall);
    group.add(safetyWall(side*(TRACK_HALF_WIDTH+3),rail,trackId));
  }
  // Chequered start/finish line on the first straight.
  for(let x=0;x<16;x++)for(let z=0;z<2;z++) {
    const box=new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_WIDTH*2/16,.025,1), (x+z)%2?white:new THREE.MeshStandardMaterial({color:0x17191b}));
    const p=trackPosition(z,(x+.5)*TRACK_HALF_WIDTH*2/16-TRACK_HALF_WIDTH);box.position.set(p.x,.04,p.z);box.rotation.y=p.yaw;group.add(box);
  }
  // A dedicated pit lane runs beside the front straight, outside the track.
  group.add(trackStrip(-40,110,TRACK_HALF_WIDTH+4,TRACK_HALF_WIDTH+7,-.005,road,trackId));
  const pitLine=new THREE.MeshStandardMaterial({color:0xf2cf5b,roughness:.85,side:THREE.DoubleSide});
  group.add(trackStrip(-40,110,TRACK_HALF_WIDTH+6.7,TRACK_HALF_WIDTH+6.83,.015,pitLine,trackId));
  // Pit buildings and trackside towers form an identifiable, separate venue.
  const buildingMat=new THREE.MeshStandardMaterial({color:0x53616c,roughness:.8});
  const glassMat=new THREE.MeshStandardMaterial({color:0x253d4d,metalness:.25,roughness:.3});
  for(let i=0;i<(trackId==='stadium'?6:0);i++) {
    const p=trackPosition(-27+i*23,25);const building=new THREE.Mesh(new THREE.BoxGeometry(16,6,21),buildingMat);building.position.set(p.x,3,p.z);building.rotation.y=p.yaw;group.add(building);
    const gp=trackPosition(-27+i*23,16.95);const glass=new THREE.Mesh(new THREE.BoxGeometry(.1,1.4,15),glassMat);glass.position.set(gp.x,4.8,gp.z);glass.rotation.y=gp.yaw;group.add(glass);
    const door=new THREE.Mesh(new THREE.BoxGeometry(.12,2.8,12),glassMat);door.position.set(gp.x,1.45,gp.z);door.rotation.y=gp.yaw;group.add(door);
    const sill=new THREE.Mesh(new THREE.BoxGeometry(.2,.15,14),white);sill.position.set(gp.x,3.1,gp.z);sill.rotation.y=gp.yaw;group.add(sill);
  }
  const tower=new THREE.Mesh(new THREE.BoxGeometry(12,20,12),buildingMat);const towerAt=trackPosition(65,43);tower.position.set(towerAt.x,10,towerAt.z);if(trackId==='stadium')group.add(tower);
  // Grandstands, pit-side gantry and a clear visual start/finish landmark.
  const standMat=new THREE.MeshStandardMaterial({color:0x657782,roughness:.85});
  const seatMat=new THREE.MeshStandardMaterial({color:0xbd4639,roughness:.85});
  for(let i=0;i<(trackId==='stadium'?6:0);i++) {
    const p=trackPosition(-30+i*23,-27);
    const support=new THREE.Mesh(new THREE.BoxGeometry(9,3.6,24),standMat);support.position.set(p.x,1.8,p.z);support.rotation.y=p.yaw;group.add(support);
    for(let row=0;row<4;row++) {
      const step=new THREE.Mesh(new THREE.BoxGeometry(3,1,24),row%2?seatMat:standMat);
      const seat=trackPosition(-30+i*23,-27-row*2);step.position.set(seat.x,1+row,seat.z);step.rotation.y=seat.yaw;group.add(step);
    }
  }
  // Select the strongest well-separated bends from this actual layout. The
  // old fixed stadium distances did not follow the road and other venues had
  // no braking references at all.
  const candidates:{s:number;strength:number}[]=[];
  for(let s=160;s<TRACK_LENGTH-70;s+=10) {
    const strength=(Math.abs(trackSample(s-10,trackId).curvature)+Math.abs(trackSample(s,trackId).curvature)+Math.abs(trackSample(s+10,trackId).curvature))/3;
    if(strength>.008)candidates.push({s,strength});
  }
  candidates.sort((a,b)=>b.strength-a.strength);
  const apexes:number[]=[];
  for(const candidate of candidates) {
    if(apexes.every(s=>Math.min(Math.abs(candidate.s-s),TRACK_LENGTH-Math.abs(candidate.s-s))>150))apexes.push(candidate.s);
    if(apexes.length===5)break;
  }
  const boardMat=new THREE.MeshStandardMaterial({color:0xf2f4ed,roughness:.8,side:THREE.DoubleSide});
  const boardTextures=new Map<number,THREE.Material>();
  for(const corner of apexes) for(const distance of [100,50]) {
    const s=corner-distance,p=trackPosition(s,TRACK_HALF_WIDTH+5.2);
    // The sign must also clear any other nearby part of the circuit.
    let safe=true;
    for(let d=0;d<TRACK_LENGTH;d+=8) {
      const arc=Math.min(Math.abs(d-s),TRACK_LENGTH-Math.abs(d-s));if(arc<50)continue;
      const other=trackPosition(d,0);
      if(Math.hypot(other.x-p.x,other.z-p.z)<TRACK_HALF_WIDTH+3){safe=false;break;}
    }
    if(!safe)continue;
    const board=new THREE.Group();board.name='braking-board';board.position.set(p.x,0,p.z);board.rotation.y=p.yaw;
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,2,.12),rail);post.position.y=1;board.add(post);
    const face=new THREE.Mesh(new THREE.BoxGeometry(1.55,.9,.12),boardMat);face.position.y=2;board.add(face);
    let labelMat=boardTextures.get(distance);
    if(!labelMat) {
      const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d')!;
      ctx.fillStyle='#f2f4ed';ctx.fillRect(0,0,128,64);ctx.fillStyle='#151c23';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(distance),64,33);
      labelMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)});boardTextures.set(distance,labelMat);
    }
    const label=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.82),labelMat);label.position.set(0,2,.065);board.add(label);group.add(board);
  }
  const start=trackPosition(0,0);
  const pillarGeo=new THREE.BoxGeometry(1.1,8,1.1), beamGeo=new THREE.BoxGeometry(25,1.7,1.2);
  const gantry=new THREE.Group();gantry.position.set(start.x,0,start.z);gantry.rotation.y=start.yaw;
  for(const side of [-1,1]) {const post=new THREE.Mesh(pillarGeo,rail);post.position.set(side*(TRACK_HALF_WIDTH+2),4,0);gantry.add(post);}
  const beam=new THREE.Mesh(beamGeo,buildingMat);beam.position.set(0,8,0);beam.scale.x=(TRACK_HALF_WIDTH+2)/12;gantry.add(beam);group.add(gantry);
  const banner=document.createElement('canvas');banner.width=512;banner.height=64;
  const ctx=banner.getContext('2d')!;ctx.fillStyle='#142c42';ctx.fillRect(0,0,512,64);ctx.fillStyle='#eafaff';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(track.name.toUpperCase(),256,32);
  const bannerMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(banner),side:THREE.DoubleSide});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(22,1.35),bannerMat);sign.position.set(0,8,.64);gantry.add(sign);
  if(track.theme==='coast') {
    const water=new THREE.Mesh(new THREE.PlaneGeometry(650,1500),circuitWaterMaterial());water.rotation.x=-Math.PI/2;water.position.set(480,-.08,0);group.add(water);
    const sand=new THREE.Mesh(new THREE.PlaneGeometry(30,1500),circuitSandMaterial());sand.rotation.x=-Math.PI/2;sand.position.set(140,-.08,0);group.add(sand);
  }
  if(track.theme==='neon') {
    const pink=new THREE.MeshBasicMaterial({color:0xf52dc9,side:THREE.DoubleSide});
    const cyan=new THREE.MeshBasicMaterial({color:0x35e5ff,side:THREE.DoubleSide});
    group.add(ribbon(-track.halfWidth-3.3,-track.halfWidth-3.05,1.12,pink,trackId));
    group.add(ribbon(track.halfWidth+3.05,track.halfWidth+3.3,1.12,cyan,trackId));
  }
  const details=createCircuitDetails(trackId);group.add(details);group.userData.circuitExtra=details.userData.extra;
  group.visible=false;return group;
}
