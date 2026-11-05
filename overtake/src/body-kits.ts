import * as THREE from 'three';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';
import { createCarbonMaterial } from './livery';

// Individually measured against the normalized, oriented car bodies (not the
// overall bounding boxes, which can include mirrors or detached helpers).
// z is along the car: negative is the nose and positive is the tail.
interface Fit {
  frontZ:number; rearZ:number; frontW:number; rearW:number; sideX:number;
  sillFront:number; sillRear:number; sillY:number; bumperY:number;
  spoilerZ:number; spoilerY:number; spoilerW:number;
  tipX:number; tipY:number; tipRadius:number; tipSpacing:number;
  character:'compact'|'luxury'|'wagon'|'classic'|'supercar'|'midengine'|'muscle';
  labels: Record<'front'|'rear'|'skirts'|'spoiler'|'exhaust', [string,string]>;
}
export const BODY_FITS: Record<CarId, Fit> = {
  golf: { frontZ:-2.02,rearZ:2.04,frontW:.77,rearW:.80,sideX:.82,sillFront:-.84,sillRear:.90,sillY:.22,bumperY:.21,spoilerZ:1.61,spoilerY:1.38,spoilerW:.61,tipX:.52,tipY:.21,tipRadius:.055,tipSpacing:.10,character:'compact', labels:{front:['GT lip','Cup splitter'],rear:['Clean valance','Cup diffuser'],skirts:['GT sills','Cup blades'],spoiler:['Roof lip','Cup roof wing'],exhaust:['Twin round','Cup twin']} },
  mercedes: { frontZ:-2.58,rearZ:2.58,frontW:.91,rearW:.88,sideX:.94,sillFront:-1.17,sillRear:1.18,sillY:.19,bumperY:.20,spoilerZ:2.12,spoilerY:1.08,spoilerW:.79,tipX:.62,tipY:.22,tipRadius:.072,tipSpacing:.13,character:'luxury', labels:{front:['Executive lip','Aero splitter'],rear:['Sport valance','Aero diffuser'],skirts:['Executive sills','Aero blades'],spoiler:['Deck lip','Touring wing'],exhaust:['Polished oval','Quad sport']} },
  audi: { frontZ:-2.43,rearZ:2.46,frontW:.93,rearW:.92,sideX:.95,sillFront:-1.10,sillRear:1.08,sillY:.19,bumperY:.20,spoilerZ:1.81,spoilerY:1.39,spoilerW:.70,tipX:.62,tipY:.22,tipRadius:.075,tipSpacing:.13,character:'wagon', labels:{front:['Touring lip','Performance splitter'],rear:['Touring valance','Sport diffuser'],skirts:['Touring sills','Extended blades'],spoiler:['Tailgate lip','Touring roof wing'],exhaust:['Oval outlets','Quad outlets']} },
  mustang: { frontZ:-2.27,rearZ:2.31,frontW:.83,rearW:.82,sideX:.86,sillFront:-.95,sillRear:1.08,sillY:.20,bumperY:.21,spoilerZ:1.97,spoilerY:1.00,spoilerW:.76,tipX:.58,tipY:.23,tipRadius:.065,tipSpacing:.12,character:'classic', labels:{front:['Heritage chin','Race chin'],rear:['Heritage valance','Race diffuser'],skirts:['Rocker trim','Race rockers'],spoiler:['Ducktail','Pedestal wing'],exhaust:['Dual round','Side-by-side quad']} },
  ferrari: { frontZ:-2.03,rearZ:2.00,frontW:.74,rearW:.86,sideX:.91,sillFront:-.90,sillRear:.86,sillY:.16,bumperY:.17,spoilerZ:1.65,spoilerY:.83,spoilerW:.76,tipX:.54,tipY:.24,tipRadius:.055,tipSpacing:.10,character:'supercar', labels:{front:['Road blade','Circuit splitter'],rear:['Road diffuser','Circuit diffuser'],skirts:['Road blades','Circuit skirts'],spoiler:['Low deck lip','Circuit wing'],exhaust:['Twin titanium','Center triple']} },
  r8: { frontZ:-2.17,rearZ:2.18,frontW:.86,rearW:.91,sideX:.94,sillFront:-.88,sillRear:.93,sillY:.17,bumperY:.19,spoilerZ:1.72,spoilerY:.91,spoilerW:.80,tipX:.65,tipY:.22,tipRadius:.07,tipSpacing:.12,character:'midengine', labels:{front:['Road splitter','GT splitter'],rear:['Road diffuser','GT diffuser'],skirts:['Road blades','GT skirts'],spoiler:['Deck lip','GT wing'],exhaust:['Twin oval','Quad titanium']} },
  challenger: { frontZ:-2.47,rearZ:2.47,frontW:.91,rearW:.89,sideX:.96,sillFront:-1.02,sillRear:1.07,sillY:.22,bumperY:.22,spoilerZ:2.10,spoilerY:1.03,spoilerW:.84,tipX:.61,tipY:.23,tipRadius:.07,tipSpacing:.13,character:'muscle', labels:{front:['Street chin','Wide splitter'],rear:['Street valance','Wide diffuser'],skirts:['Street rockers','Wide rockers'],spoiler:['Ducktail','Drag wing'],exhaust:['Dual round','Quad muscle']} },
};

function taperedBand(width:number, frontZ:number, y:number, depth:number, height:number, sweep:number) {
  // Curved, low bumper add-on: tapered corners wrap back onto the body.
  const geo=new THREE.BufferGeometry(), positions:number[]=[], indices:number[]=[];
  const count=12;
  for(let i=0;i<=count;i++) {
    const t=i/count*2-1, x=t*width, outer=Math.pow(Math.abs(t),2);
    const z=frontZ+sweep*outer;
    for(const [yy,zz] of [[y,z],[y+height,z+depth*.35],[y+height,z+depth],[y,z+depth]] as const) positions.push(x,yy,zz);
    if(i<count) for(let j=0;j<4;j++) {const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// A closed, contoured shell. Cross sections follow each bumper's sweep and
// rake back into the original mesh instead of placing a bar in front of it.
function apron(width:number, z:number, y:number, height:number, depth:number, sweep:number, rear=false) {
  const positions:number[]=[], indices:number[]=[], segments=24, sign=rear ? -1 : 1;
  for(let i=0;i<=segments;i++) {
    const t=2*i/segments-1, edge=Math.pow(Math.abs(t),2), x=t*width;
    const face=z+sign*sweep*edge;
    const rise=.018*edge;
    for(const [yy,zz] of [[y+rise,face-sign*.035],[y+height+rise,face+sign*.075],[y+height+rise,face+sign*(depth+.18*edge)],[y+rise,face+sign*(depth+.18*edge)]] as const) positions.push(x,yy,zz);
    if(i<segments) for(let j=0;j<4;j++) {const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// A roof-edge extension, not a wing on stilts: the leading edge overlaps the
// stock hatch, its trailing edge curls up, and its ends follow the roof crown.
function roofExtension(width:number,z:number,y:number,track:boolean) {
  const positions:number[]=[], indices:number[]=[], n=24;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=Math.pow(Math.abs(t),2), x=t*width;
    const crown=y-.065*edge, sweep=-.09*edge;
    const back=z+(track?.18:.11)+sweep;
    const front=z-.16+sweep*.35;
    for(const [yy,zz] of [[crown,front],[crown+(track?.075:.045),back],[crown+(track?.052:.025),back],[crown-.025,front]] as const) positions.push(x,yy,zz);
    if(i<n) for(let j=0;j<4;j++) {const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Sill shells taper back into the wheel openings and flare outward towards the
// lower edge; the top is buried just inside the original rocker panel.
function skirtShell(side:number, f:Fit, track:boolean) {
  const positions:number[]=[],indices:number[]=[], n=20;
  for(let i=0;i<=n;i++) {
    const t=i/n, end=Math.pow(Math.abs(2*t-1),4), z=THREE.MathUtils.lerp(f.sillFront,f.sillRear,t);
    const inner=side*(f.sideX-.055), outer=side*(f.sideX+(track?.075:.035)*(1-.6*end));
    const bottom=f.sillY+.015+.035*end, top=f.sillY+(track?.19:.14)-.025*end;
    for(const [x,y] of [[inner,bottom],[outer,bottom],[outer-side*.025,top],[inner,top]] as const) positions.push(x,y,z);
    if(i<n) for(let j=0;j<4;j++) {const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Horizontal aerodynamic plane with a cambered top, swept tips and a closed edge.
function wingProfile(width:number,z:number,y:number,chord:number) {
  const positions:number[]=[],indices:number[]=[], n=24;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=t*t, x=t*width, shift=-.045*edge;
    for(const [yy,zz] of [[y,z-chord*.5+shift],[y+.025,z+shift],[y+.012,z+chord*.5+shift],[y-.012,z+chord*.5+shift],[y-.014,z-chord*.5+shift]] as const) positions.push(x,yy,zz);
    if(i<n) for(let j=0;j<5;j++) {const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material, group:THREE.Group, name:string) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); mesh.name=name; mesh.castShadow=true; group.add(mesh);return mesh;
}
function tip(group:THREE.Group, x:number, y:number, z:number, radius:number, metal:THREE.Material, dark:THREE.Material, oval=false) {
  // The dark interior and metal rim make an actual visible exhaust opening.
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.10,16,1,true),metal);
  pipe.name='exhaust-pipe';pipe.rotation.x=Math.PI/2;pipe.position.set(x,y,z);if(oval)pipe.scale.x=1.35;group.add(pipe);
  const hole=new THREE.Mesh(new THREE.CircleGeometry(radius*.77,16),dark);hole.position.set(x,y,z+.052);if(oval)hole.scale.x=1.35;group.add(hole);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.90,radius*.10,6,16),metal);ring.name='exhaust-mouth';ring.position.set(x,y,z+.054);if(oval)ring.scale.x=1.35;group.add(ring);
}

/** A player-only kit. All geometries/materials are owned by the returned group. */
export function createBodyKit(id:CarId, config:Customization, paint:number) {
  const f=BODY_FITS[id], g=new THREE.Group(); g.name='custom-body-kit';
  const body=new THREE.MeshPhysicalMaterial({ color:paint, metalness:.45,roughness:.34,clearcoat:.42,clearcoatRoughness:.22 });
  const carbon=new THREE.MeshStandardMaterial({ color:0x10171c,metalness:.35,roughness:.44 });
  const woven=createCarbonMaterial();
  const metal=new THREE.MeshStandardMaterial({ color:0xb6c7cf,metalness:.9,roughness:.22 });
  const dark=new THREE.MeshBasicMaterial({ color:0x090d10, side:THREE.DoubleSide });
  const reg=(part:string)=>{const partGroup=new THREE.Group();partGroup.name=`custom-${part}`;g.add(partGroup);return partGroup;};
  const isTrack=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>config[part]==='track'||(part==='exhaust' && config.exhaust==='flame');
  if(config.front!=='stock') {
    const a=reg('front'), track=isTrack('front'), panel=config.frontFinish==='carbon'?woven:body;
    const nose=f.frontZ-.015;
    const sweep=f.character==='muscle'?.10:f.character==='classic'?.16:.23;
    const fascia=new THREE.Mesh(apron(f.frontW*(track?1.02:.97),nose,f.bumperY+.015,track?.18:.12,.22,sweep),panel);
    fascia.name='front-fascia';a.add(fascia);
    const splitter=new THREE.Mesh(taperedBand(f.frontW*(track?1.10:1.02),nose-(track?.13:.07),f.bumperY-.005,track?.46:.35,.028,sweep),carbon);
    splitter.name='front-splitter';a.add(splitter);
    // Corner blades are set into the swept bumper, not ahead of its headlights.
    if(track) for(const side of [-1,1]) {
      const canard=box(.20,.018,.13,side*f.frontW*.84,f.bumperY+.145,nose+sweep*.72,carbon,a,'front-canard');
      canard.rotation.y=side*.35;canard.rotation.z=side*.10;
      if(id==='audi'||id==='r8'||id==='ferrari') {
        const second=box(.14,.014,.10,side*f.frontW*.85,f.bumperY+.21,nose+sweep*.76,carbon,a,'upper-canard');
        second.rotation.y=side*.35;second.rotation.z=side*.10;
      }
    }
    if(id==='mercedes') box(f.frontW*1.35,.015,.035,0,f.bumperY+.11,nose+.04,metal,a,'bright-fascia-trim');
  }
  if(config.rear!=='stock') {
    const a=reg('rear'),track=isTrack('rear'), tail=f.rearZ-.035, panel=config.rearFinish==='carbon'?woven:body;
    const valance=new THREE.Mesh(apron(f.rearW*.98,tail,f.bumperY+.005,track?.16:.11,.20,.16,true),panel);
    valance.name='rear-valance';a.add(valance);
    // Keep the diffuser between the exhaust outlets rather than covering them.
    const diffuserWidth=id==='golf'?.39:id==='ferrari'?.70:.48;
    const diffuser=new THREE.Mesh(apron(f.rearW*diffuserWidth,tail+.05,f.bumperY-.005,track?.13:.08,.25,.04,true),carbon);
    diffuser.name='rear-diffuser';a.add(diffuser);
    const finCount=id==='ferrari'?7:id==='golf'?3:5;
    if(track) for(let i=0;i<finCount;i++) {
      const x=(i-(finCount-1)/2)*f.rearW*diffuserWidth*1.6/Math.max(1,finCount-1);
      const fin=box(.016,.09,.24,x,f.bumperY-.015,tail-.025,carbon,a,'diffuser-fin');fin.rotation.x=-.13;
    }
  }
  if(config.skirts!=='stock') {
    const a=reg('skirts'),track=isTrack('skirts'),length=f.sillRear-f.sillFront,panel=config.skirtsFinish==='carbon'?woven:body;
    for(const side of [-1,1]) {
      const skirt=new THREE.Mesh(skirtShell(side,f,track),panel);skirt.name='side-skirt';a.add(skirt);
      if(track) {
        box(.095,.025,length*.91,side*(f.sideX+.045),f.sillY+.025,(f.sillRear+f.sillFront)/2,carbon,a,'sill-blade');
        if(id==='ferrari'||id==='r8'||id==='audi') {
          const fin=box(.018,.14,.19,side*(f.sideX+.06),f.sillY+.10,f.sillRear-.1,carbon,a,'sill-fin');fin.rotation.x=-.2;
        }
      }
    }
  }
  if(config.spoiler!=='stock') {
    const a=reg('spoiler'),track=isTrack('spoiler'),panel=config.spoilerFinish==='carbon'?woven:body;
    const roof=f.character==='compact'||f.character==='wagon';
    if(roof) {
      const lip=new THREE.Mesh(roofExtension(f.spoilerW,f.spoilerZ,f.spoilerY,track),panel);
      lip.name='roof-extension';a.add(lip);
    } else if(track) {
      const h=f.character==='luxury'?.13:f.character==='classic'?.20:.24;
      const chord=f.character==='luxury'?.22:.30;
      for(const side of [-1,1]) {
        const support=box(.055,h,.15,side*f.spoilerW*.59,f.spoilerY+h/2-.015,f.spoilerZ-.035,panel,a,'wing-pedestal');support.rotation.x=-.12;
      }
      const blade=new THREE.Mesh(wingProfile(f.spoilerW*1.05,f.spoilerZ,f.spoilerY+h,chord),panel);blade.name='wing-blade';a.add(blade);
      if(f.character!=='luxury') for(const side of [-1,1]) {
        const end=box(.022,.085,chord*.94,side*f.spoilerW*1.03,f.spoilerY+h+.012,f.spoilerZ,carbon,a,'wing-endplate');end.rotation.x=-.08;
      }
    } else {
      const lip=new THREE.Mesh(apron(f.spoilerW*.94,f.spoilerZ+.045,f.spoilerY-.01,.065,.14,.045,true),panel);lip.name='deck-lip';a.add(lip);
    }
  }
  if(config.exhaust!=='stock') {
    const a=reg('exhaust'),track=isTrack('exhaust'), finish=config.exhaustFinish==='carbon'?woven:metal;
    const oval=f.character==='luxury'||f.character==='wagon'||f.character==='midengine';
    // One mouth position is shared by the pipe and flame. The measured rear
    // offsets place the rim just beyond the stock bumper, not inside it.
    const z=f.rearZ-.06, mouthZ=z+.054, y=f.tipY+.08;
    // The exact same outlet descriptions drive rims and flame origins.
    const centers=track && id==='ferrari' ? [-.11,0,.11] : id==='golf'
      ? [-f.tipX-f.tipSpacing*.5,-f.tipX+f.tipSpacing*.5]
      : track ? [-f.tipX-f.tipSpacing*.5,-f.tipX+f.tipSpacing*.5,f.tipX-f.tipSpacing*.5,f.tipX+f.tipSpacing*.5]
      : [-f.tipX,f.tipX];
    const radius=track && id==='ferrari' ? f.tipRadius*.85 : id==='golf'
      ? f.tipRadius*(track?.85:.72) : f.tipRadius*(track?.64:.85);
    for(const x of centers) tip(a,x,y,z,radius,finish,dark,!track && oval && id!=='golf');
    if (config.exhaust==='flame') {
      const flames=new THREE.Group(); flames.name='exhaust-flames';
      const outerMat=new THREE.MeshBasicMaterial({color:0xff6b16,transparent:true,opacity:.87,depthWrite:false,blending:THREE.AdditiveBlending});
      const innerMat=new THREE.MeshBasicMaterial({color:0xffe196,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
      for (const x of centers) {
        const jet=new THREE.Group(); jet.position.set(x,y,mouthZ);
        for (const [radius,length,mat] of [[f.tipRadius*.72,.34,outerMat],[f.tipRadius*.44,.21,innerMat]] as const) {
          const geo=new THREE.ConeGeometry(radius,length,12);geo.translate(0,length/2,0);geo.rotateX(Math.PI/2);
          jet.add(new THREE.Mesh(geo,mat));
        }
        flames.add(jet);
      }
      flames.userData.flameMaterials=[outerMat,innerMat]; a.add(flames);
    }
  }
  if(config.underglow) {
    const a=reg('underglow'), canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d')!, gradient=ctx.createRadialGradient(64,64,4,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,0.72)');gradient.addColorStop(.45,'rgba(255,255,255,0.38)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const texture=new THREE.CanvasTexture(canvas);
    const glow=new THREE.MeshBasicMaterial({color:config.glowColor,map:texture,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(f.sideX*3.6,(f.rearZ-f.frontZ)*1.20),glow);
    plane.name='underglow-pool';plane.rotation.x=-Math.PI/2;plane.position.set(0,.035,0);plane.renderOrder=2;a.add(plane);
  }
  // Dispose also the unreferenced materials created for the chosen combination.
  g.userData.ownedMaterials=[body,carbon,woven,metal,dark];
  return g;
}
export function disposeBodyKit(group:THREE.Group) {
  const materials=new Set<THREE.Material>(group.userData.ownedMaterials || []);
  group.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]) materials.add(m);});
  for(const m of materials) { const map=(m as THREE.MeshBasicMaterial).map;if(map)map.dispose();m.dispose(); }
}

/** Garage previews the flame; in a run it only fires under acceleration. */
export function updateExhaustFlames(car: THREE.Group | null, time: number, active: boolean) {
  const flames=car?.getObjectByName('exhaust-flames');
  if (!flames) return;
  flames.visible=active;
  if (!active) return;
  flames.children.forEach((jet,i)=>{
    const flicker=.72+.28*(.5+.5*Math.sin(time*26+i*2.7));
    jet.scale.set(1,1,flicker);
  });
}
