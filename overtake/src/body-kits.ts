import * as THREE from 'three';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';
import { createCarbonMaterial } from './livery';
import sillProfiles from './sill-profiles.json';

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
  mercedes: { frontZ:-2.58,rearZ:2.58,frontW:.91,rearW:.88,sideX:.94,sillFront:-1.17,sillRear:1.18,sillY:.19,bumperY:.20,spoilerZ:2.23,spoilerY:1.07,spoilerW:.67,tipX:.62,tipY:.22,tipRadius:.072,tipSpacing:.13,character:'luxury', labels:{front:['Executive lip','Aero splitter'],rear:['Sport valance','Aero diffuser'],skirts:['Executive sills','Aero blades'],spoiler:['Deck lip','Touring wing'],exhaust:['Polished oval','Quad sport']} },
  audi: { frontZ:-2.43,rearZ:2.46,frontW:.93,rearW:.92,sideX:.95,sillFront:-1.10,sillRear:1.08,sillY:.19,bumperY:.20,spoilerZ:1.81,spoilerY:1.39,spoilerW:.70,tipX:.62,tipY:.22,tipRadius:.075,tipSpacing:.13,character:'wagon', labels:{front:['Touring lip','Performance splitter'],rear:['Touring valance','Sport diffuser'],skirts:['Touring sills','Extended blades'],spoiler:['Tailgate lip','Touring roof wing'],exhaust:['Oval outlets','Quad outlets']} },
  mustang: { frontZ:-2.27,rearZ:2.31,frontW:.83,rearW:.82,sideX:.86,sillFront:-.95,sillRear:1.08,sillY:.20,bumperY:.21,spoilerZ:2.12,spoilerY:.958,spoilerW:.69,tipX:.58,tipY:.23,tipRadius:.065,tipSpacing:.12,character:'classic', labels:{front:['Heritage chin','Race chin'],rear:['Heritage valance','Race diffuser'],skirts:['Rocker trim','Race rockers'],spoiler:['Ducktail','Pedestal wing'],exhaust:['Dual round','Side-by-side quad']} },
  ferrari: { frontZ:-2.03,rearZ:2.00,frontW:.74,rearW:.86,sideX:.91,sillFront:-.90,sillRear:.86,sillY:.16,bumperY:.17,spoilerZ:1.80,spoilerY:.84,spoilerW:.53,tipX:.54,tipY:.24,tipRadius:.055,tipSpacing:.10,character:'supercar', labels:{front:['Road blade','Circuit splitter'],rear:['Road diffuser','Circuit diffuser'],skirts:['Road blades','Circuit skirts'],spoiler:['Low deck lip','Circuit wing'],exhaust:['Twin titanium','Center triple']} },
  r8: { frontZ:-2.17,rearZ:2.18,frontW:.86,rearW:.91,sideX:.94,sillFront:-.88,sillRear:.93,sillY:.17,bumperY:.19,spoilerZ:1.90,spoilerY:.84,spoilerW:.62,tipX:.65,tipY:.22,tipRadius:.07,tipSpacing:.12,character:'midengine', labels:{front:['Road splitter','GT splitter'],rear:['Road diffuser','GT diffuser'],skirts:['Road blades','GT skirts'],spoiler:['Deck lip','GT wing'],exhaust:['Twin oval','Quad titanium']} },
  challenger: { frontZ:-2.47,rearZ:2.47,frontW:.91,rearW:.89,sideX:.96,sillFront:-1.02,sillRear:1.07,sillY:.22,bumperY:.22,spoilerZ:2.22,spoilerY:1.065,spoilerW:.72,tipX:.61,tipY:.23,tipRadius:.07,tipSpacing:.13,character:'muscle', labels:{front:['Street chin','Wide splitter'],rear:['Street valance','Wide diffuser'],skirts:['Street rockers','Wide rockers'],spoiler:['Ducktail','Drag wing'],exhaust:['Dual round','Quad muscle']} },
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
// Body-surface samples measured from the actual normalized paint meshes at
// y=.30 and .38, on each side. The wheel-to-wheel ranges exclude the tires.
// Each section is a shaped panel, not a box across the wheel opening.
function skirtShell(id:CarId, side:number, track:boolean) {
  const fit=sillProfiles[id], samples=fit.sides[side<0?0:1], n=samples[0].length-1;
  const positions:number[]=[], indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n, taper=Math.pow(Math.sin(Math.PI*t),.6), z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t);
    const rearFlare=(id==='ferrari'||id==='r8') ? Math.pow(t,3)*.035*taper : id==='audi' ? Math.pow(t,2)*.015*taper : 0;
    const top=samples[1][i]+.005, mid=samples[0][i]+.004+(track?.025:.014)*taper+rearFlare*.45;
    const low=samples[0][i]-.025+(track?.045:.028)*taper+rearFlare;
    for(const [x,y] of [[top,.38],[mid,.30],[low,.22],[samples[0][i]-.045,.205],[samples[0][i]-.045,.37]] as const) positions.push(side*x,y,z);
    if(i<n) for(let j=0;j<5;j++) {const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function skirtBlade(id:CarId, side:number) {
  const fit=sillProfiles[id], samples=fit.sides[side<0?0:1][0], n=samples.length-1;
  const positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n,taper=Math.pow(Math.sin(Math.PI*t),.7),z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t),x=samples[i];
    for(const [xx,y] of [[x-.04,.215],[x+.085*taper,.205],[x+.085*taper,.188],[x-.04,.198]] as const)positions.push(side*xx,y,z);
    if(i<n)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Integrated ducktail: leading edge merges into the rear deck, ends taper into
// the shoulders, and a raised trailing edge provides an actual aero section.
function deckLip(f:Fit,id:CarId) {
  const positions:number[]=[],indices:number[]=[], n=32;
  const drop=id==='mercedes'?.045:id==='r8'?.055:id==='ferrari'?.025:.012;
  const rise=id==='mercedes'?.055:id==='ferrari'?.075:.085;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1,edge=t*t, taper=Math.pow(Math.max(0,1-Math.pow(Math.abs(t),5)),.5);
    const x=t*f.spoilerW, y=f.spoilerY-drop*edge, front=f.spoilerZ-.14-.025*edge, back=f.spoilerZ+.13-.10*edge;
    for(const [yy,zz] of [[y-.018,front],[y+.018*taper,f.spoilerZ],[y+rise*taper,back],[y+(rise-.025)*taper-.01,back],[y-.03,front]] as const)positions.push(x,yy,zz);
    if(i<n)for(let j=0;j<5;j++){const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Horizontal aerodynamic plane with a cambered top, swept tips and a closed edge.
function wingProfile(width:number,z:number,y:number,chord:number) {
  const positions:number[]=[],indices:number[]=[], n=32;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=t*t, x=t*width, shift=-.075*edge;
    const c=chord*(1-.14*Math.pow(Math.abs(t),4));
    // Cambered five-point section, rounded leading edge and thin trailing edge.
    for(const [yy,zz] of [[y-.008,z-c*.52+shift],[y+.024,z-c*.30+shift],[y+.035,z+shift],[y+.017,z+c*.49+shift],[y-.008,z+c*.50+shift],[y-.012,z-c*.30+shift]] as const) positions.push(x,yy,zz);
    if(i<n) for(let j=0;j<6;j++) {const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Tapered, swept pedestals with a broad foot buried in the deck and a narrow
// tip reaching the aerofoil. This replaces the previous rectangular posts.
function wingSupport(x:number,y:number,z:number,height:number) {
  const verts:number[]=[],indices:number[]=[];
  const profile=[[-.13,y-.035],[.10,y-.035],[.045,y+height],[ -.055,y+height]];
  for(const dx of [-.027,.027]) for(const [dz,yy] of profile)verts.push(x+dx,yy,z+dz);
  indices.push(0,2,1,0,3,2,4,5,6,4,6,7);
  for(let i=0;i<4;i++){let j=(i+1)%4;indices.push(i,j,i+4,j,j+4,i+4);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
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
    const splitter=new THREE.Mesh(taperedBand(f.frontW*(track?1.04:.99),nose-(track?.10:.06),f.bumperY-.005,track?.46:.35,.028,sweep),carbon);
    splitter.name='front-splitter';a.add(splitter);
    // Keep the track splitter clean: the former floating corner blades did
    // not follow the different bumper surfaces closely enough to look fitted.
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
    const a=reg('skirts'),track=isTrack('skirts'),panel=config.skirtsFinish==='carbon'?woven:body;
    for(const side of [-1,1]) {
      const skirt=new THREE.Mesh(skirtShell(id,side,track),panel);skirt.name='side-skirt';a.add(skirt);
      if(track) {
        const blade=new THREE.Mesh(skirtBlade(id,side),carbon);blade.name='sill-blade';a.add(blade);
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
      const h=f.character==='luxury'?.13:f.character==='classic'?.19:.23;
      const chord=f.character==='luxury'?.24:.34;
      const wingWidth=id==='ferrari'?.82:id==='r8'?.85:id==='challenger'?.85:id==='mustang'?.78:.76;
      for(const side of [-1,1]) {
        const support=new THREE.Mesh(wingSupport(side*f.spoilerW*.62,f.spoilerY,f.spoilerZ-.015,h),panel);
        support.name='wing-pedestal';a.add(support);
      }
      const blade=new THREE.Mesh(wingProfile(wingWidth,f.spoilerZ,f.spoilerY+h,chord),panel);blade.name='wing-blade';a.add(blade);
      if(f.character!=='luxury') for(const side of [-1,1]) {
        const end=box(.018,.085,chord*.90,side*(wingWidth-.012),f.spoilerY+h+.012,f.spoilerZ-.06,carbon,a,'wing-endplate');end.rotation.x=-.08;
      }
    } else {
      const lip=new THREE.Mesh(deckLip(f,id),panel);lip.name='deck-lip';a.add(lip);
    }
  }
  if(config.exhaust!=='stock') {
    const a=reg('exhaust'),track=isTrack('exhaust'), finish=config.exhaustFinish==='carbon'?woven:metal;
    const oval=f.character==='luxury'||f.character==='wagon'||f.character==='midengine';
    // One mouth position is shared by the pipe and flame. The measured rear
    // offsets place the rim just beyond the stock bumper, not inside it.
    const z=f.rearZ-.06, mouthZ=z+.054, y=f.tipY+.08;
    // The exact same outlet descriptions drive rims and flame origins.
    const ferrariFactoryFlame=id==='ferrari' && config.exhaust==='flame';
    const centers=track && id==='ferrari' ? [-.061,.048,.150] : id==='golf'
      ? [-f.tipX-f.tipSpacing*.5,-f.tipX+f.tipSpacing*.5]
      : track ? [-f.tipX-f.tipSpacing*.5,-f.tipX+f.tipSpacing*.5,f.tipX-f.tipSpacing*.5,f.tipX+f.tipSpacing*.5]
      : [-f.tipX,f.tipX];
    const radius=track && id==='ferrari' ? f.tipRadius*.85 : id==='golf'
      ? f.tipRadius*(track?.85:.72) : f.tipRadius*(track?.64:.85);
    if(ferrariFactoryFlame) {
      // The source 458 mesh already contains three outlets. Their centers were
      // measured after its yaw correction; do not layer fake pipes over them.
      for(const x of centers) {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,.334,2.002);a.add(mouth);}
    } else for(const x of centers) tip(a,x,y,z,radius,finish,dark,!track && oval && id!=='golf');
    if (config.exhaust==='flame') {
      const flames=new THREE.Group(); flames.name='exhaust-flames';
      const outerMat=new THREE.MeshBasicMaterial({color:0xff6b16,transparent:true,opacity:.87,depthWrite:false,blending:THREE.AdditiveBlending});
      const innerMat=new THREE.MeshBasicMaterial({color:0xffe196,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
      for (const x of centers) {
        const jet=new THREE.Group(); jet.position.set(x,ferrariFactoryFlame ? .334 : y, ferrariFactoryFlame ? 2.002 : mouthZ);
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
    const ctx=canvas.getContext('2d')!;
    // Soft rounded-rectangle falloff rather than a circular spotlight. The
    // superellipse norm rounds the corners while retaining long straight sides.
    const image=ctx.createImageData(128,128);
    for(let y=0;y<128;y++) for(let x=0;x<128;x++) {
      const dx=Math.abs((x+0.5-64)/64), dy=Math.abs((y+0.5-64)/64);
      const d=Math.pow(Math.pow(dx,4)+Math.pow(dy,4),.25);
      const t=THREE.MathUtils.clamp((1-d)/.70,0,1);
      const alpha=.72*t*t*(3-2*t), i=(y*128+x)*4;
      image.data[i]=image.data[i+1]=image.data[i+2]=255;image.data[i+3]=Math.round(alpha*255);
    }
    ctx.putImageData(image,0,0);
    const texture=new THREE.CanvasTexture(canvas);
    const glow=new THREE.MeshBasicMaterial({color:config.glowColor,map:texture,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(f.sideX*3.6,(f.rearZ-f.frontZ)*1.20,16,24),glow);
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
