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
// RS6 roof was surveyed across the hatch. The outer edge ends before the
// roof rail, while the trailing corners sweep forward with the hatch line.
function audiRoofExtension(level:number) {
  const vertices:number[]=[], indices:number[]=[], n=32, width=.53;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=t*t, x=t*width;
    const front=1.62+.03*edge, back=1.88-.13*edge;
    const frontY=1.415-.055*edge, rearY=1.383-.043*edge;
    const rise=THREE.MathUtils.lerp(.025,.055,level);
    for(const [y,z] of [[frontY-.012,front],[frontY+.006,front],[rearY+rise,back],[rearY+rise-.018,back]] as const) vertices.push(x,y,z);
    if(i<n) for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Surveyed Golf hatch roof; the ends follow its rapidly falling shoulders.
function golfRoofExtension(level:number) {
  const vertices:number[]=[], indices:number[]=[], n=32, width=.51;
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=t*t, x=t*width;
    const front=1.40+.015*edge, back=1.65-.07*edge;
    const frontY=1.401-.045*edge, rearY=1.375-.045*edge;
    const rise=THREE.MathUtils.lerp(.022,.050,level);
    for(const [y,z] of [[frontY-.012,front],[frontY+.004,front],[rearY+rise,back],[rearY+rise-.016,back]] as const) vertices.push(x,y,z);
    if(i<n) for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Follow the measured lower contours instead of placing an apron across the
// bumper's intake or a wide panel beyond the wheel arches.
function golfLowerBumper(rear:boolean,level:number) {
  const xs=[0,.2,.4,.55,.65,.75], zs=rear?[1.984,1.980,1.968,1.940,1.894,1.762]:[-1.966,-1.951,-1.900,-1.836,-1.780,-1.617];
  const vertices:number[]=[],indices:number[]=[],n=32,sign=rear?1:-1;
  for(let i=0;i<=n;i++) {
    const x=(2*i/n-1)*.73,abs=Math.abs(x);let j=0;while(j<xs.length-2&&abs>xs[j+1])j++;
    const z=THREE.MathUtils.lerp(zs[j],zs[j+1],(abs-xs[j])/(xs[j+1]-xs[j]));
    const edge=Math.pow(abs/.73,3),y=rear?.28:.24,drop=THREE.MathUtils.lerp(.035,.055,level);
    for(const [yy,zz] of [[y+.018,z-sign*.02],[y-drop+.015*edge,z+sign*.012],[y-drop-.008+.015*edge,z-sign*.075],[y+.008,z-sign*.12]] as const) vertices.push(x,yy,zz);
    if(i<n)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=(i+1)*4+k,d=(i+1)*4+(k+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// RS6 lower leading edge, sampled at the front bumper's bottom instead of
// spanning the large central grille with a generic box-shaped fascia.
function audiFrontLip(level:number) {
  const xs=[0,.2,.4,.55,.65,.75,.8,.85],zs=[-2.486,-2.479,-2.466,-2.424,-2.343,-2.285,-2.251,-2.191];
  const vertices:number[]=[],indices:number[]=[],n=32;
  for(let i=0;i<=n;i++){
    const x=(2*i/n-1)*.84,abs=Math.abs(x);let j=0;while(j<xs.length-2&&abs>xs[j+1])j++;
    const z=THREE.MathUtils.lerp(zs[j],zs[j+1],(abs-xs[j])/(xs[j+1]-xs[j]));
    const edge=abs/.84,lead=THREE.MathUtils.lerp(.02,.055,level)*(1-.3*edge);
    for(const [y,zz] of [[.196,z+.045],[.18,z-lead],[.167,z-lead],[.168,z+.10]] as const) vertices.push(x,y,zz);
    if(i<n)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=(i+1)*4+k,d=(i+1)*4+(k+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Mustang's chin is a shallow extension of its measured lower nose contour,
// not a generic wide apron underneath the chrome factory bumper.
function mustangChin(level:number) {
  const xs=[0,.2,.4,.55,.65,.75], zs=[-2.324,-2.311,-2.289,-2.231,-2.148,-2.067];
  const vertices:number[]=[], indices:number[]=[], n=30;
  for(let i=0;i<=n;i++) {
    const x=(i/n*2-1)*.75, abs=Math.abs(x);let j=0;
    while(j<xs.length-2 && abs>xs[j+1])j++;
    const t=(abs-xs[j])/(xs[j+1]-xs[j]);
    const z=THREE.MathUtils.lerp(zs[j],zs[j+1],t);
    const y=.305+.026*Math.pow(abs/.75,2);
    for(const [yy,zz] of [[y+.012,z+.035],[y-.054,z-THREE.MathUtils.lerp(.02,.045,level)],[y-.065,z+.08],[y-.028,z+.13]] as const) vertices.push(x,yy,zz);
    if(i<n)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=(i+1)*4+k,d=(i+1)*4+(k+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Body-surface samples measured from the actual normalized paint meshes at
// y=.30 and .38, on each side. The wheel-to-wheel ranges exclude the tires.
// Each section is a shaped panel, not a box across the wheel opening.
function skirtShell(id:CarId, side:number, level:number) {
  const fit=sillProfiles[id], samples=fit.sides[side<0?0:1], n=samples[0].length-1;
  const positions:number[]=[], indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n, taper=Math.pow(Math.sin(Math.PI*t),.6), z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t);
    const rearFlare=(id==='ferrari'||id==='r8') ? Math.pow(t,3)*.035*taper : id==='audi' ? Math.pow(t,2)*.015*taper : 0;
    const top=samples[1][i]+.005, mid=samples[0][i]+.004+THREE.MathUtils.lerp(.014,.025,level)*taper+rearFlare*.45;
    const low=samples[0][i]-.025+THREE.MathUtils.lerp(.028,.045,level)*taper+rearFlare;
    for(const [x,y] of [[top,.38],[mid,.30],[low,.22],[samples[0][i]-.045,.205],[samples[0][i]-.045,.37]] as const) positions.push(side*x,y,z);
    if(i<n) for(let j=0;j<5;j++) {const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function skirtBlade(id:CarId, side:number, level:number) {
  const fit=sillProfiles[id], samples=fit.sides[side<0?0:1][0], n=samples.length-1;
  const positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n,taper=Math.pow(Math.sin(Math.PI*t),.7),z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t),x=samples[i];
    for(const [xx,y] of [[x-.04,.215],[x+THREE.MathUtils.lerp(.055,.085,level)*taper,.205],[x+THREE.MathUtils.lerp(.055,.085,level)*taper,.188],[x-.04,.198]] as const)positions.push(side*xx,y,z);
    if(i<n)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Integrated ducktail: leading edge merges into the rear deck, ends taper into
// the shoulders, and a raised trailing edge provides an actual aero section.
function deckLip(f:Fit,id:CarId,level:number) {
  const positions:number[]=[],indices:number[]=[], n=32;
  const drop=id==='mercedes'?.045:id==='r8'?.055:id==='ferrari'?.025:.012;
  const rise=(id==='mercedes'?.055:id==='ferrari'?.075:.085)*(1+level*.35);
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
  const level=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>({stock:0,street:0,touring:.34,sport:.67,track:1,flame:1}[config[part]]);
  const isTrack=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>config[part]==='track'||(part==='exhaust' && config.exhaust==='flame');
  if(config.front!=='stock') {
    const a=reg('front'), track=isTrack('front'), amount=level('front'), panel=config.frontFinish==='carbon'?woven:body;
    const nose=f.frontZ-.015;
    if(id==='golf') {
      const fascia=new THREE.Mesh(golfLowerBumper(false,amount),panel);fascia.name='front-fascia';a.add(fascia);
    } else if(id==='audi') {
      const lip=new THREE.Mesh(audiFrontLip(amount),panel);lip.name='front-fascia';a.add(lip);
    } else if(id==='mustang') {
      const chin=new THREE.Mesh(mustangChin(amount),panel);chin.name='front-fascia';a.add(chin);
      if(amount>=.67) {
        const blade=new THREE.Mesh(taperedBand(.73,-2.335,.239,THREE.MathUtils.lerp(.12,.16,amount),.012,.26),carbon);
        blade.name='front-splitter';a.add(blade);
      }
    } else {
      const sweep=f.character==='muscle'?.10:.23;
      const fascia=new THREE.Mesh(apron(f.frontW*THREE.MathUtils.lerp(.97,1.02,amount),nose,f.bumperY+.015,THREE.MathUtils.lerp(.12,.18,amount),.22,sweep),panel);
      fascia.name='front-fascia';a.add(fascia);
      const splitter=new THREE.Mesh(taperedBand(f.frontW*THREE.MathUtils.lerp(.99,1.04,amount),nose-THREE.MathUtils.lerp(.06,.10,amount),f.bumperY-.005,THREE.MathUtils.lerp(.35,.46,amount),.028,sweep),carbon);
      splitter.name='front-splitter';a.add(splitter);
    }
    if(id==='mercedes') box(f.frontW*1.35,.015,.035,0,f.bumperY+.11,nose+.04,metal,a,'bright-fascia-trim');
  }
  if(config.rear!=='stock') {
    const a=reg('rear'),track=isTrack('rear'),amount=level('rear'), tail=f.rearZ-.035, panel=config.rearFinish==='carbon'?woven:body;
    if(id==='golf') {
      const valance=new THREE.Mesh(golfLowerBumper(true,amount),panel);valance.name='rear-valance';a.add(valance);
    } else if(id==='ferrari') {
      // Retain the factory diffuser and its fins. A shallow edge extension
      // is tucked into it rather than adding a second, hanging set of fins.
      const blade=new THREE.Mesh(taperedBand(THREE.MathUtils.lerp(.47,.53,amount),1.74,.19,THREE.MathUtils.lerp(.10,.15,amount),.012,0),config.rearFinish==='carbon'?woven:carbon);
      blade.name='rear-diffuser-extension';a.add(blade);
    } else if(id==='mustang') {
      // Tuck a shallow lower valance under the factory bumper and keep it
      // below the four exhaust outlets instead of hanging a slab off the tail.
      const valance=new THREE.Mesh(taperedBand(.68,2.04,.305,.18,THREE.MathUtils.lerp(.045,.060,amount),-.06),panel);
      valance.name='rear-valance';a.add(valance);
      if(amount>=.67) {const diffuser=new THREE.Mesh(taperedBand(THREE.MathUtils.lerp(.40,.46,amount),2.06,.297,.12,.012,0),carbon);diffuser.name='rear-diffuser';a.add(diffuser);}
    } else {
      const valance=new THREE.Mesh(apron(f.rearW*.98,tail,f.bumperY+.005,THREE.MathUtils.lerp(.11,.16,amount),.20,.16,true),panel);
      valance.name='rear-valance';a.add(valance);
      // Keep the diffuser between the exhaust outlets rather than covering them.
      const diffuserWidth=.48;
      const diffuser=new THREE.Mesh(apron(f.rearW*diffuserWidth,tail+.05,f.bumperY-.005,THREE.MathUtils.lerp(.08,.13,amount),.25,.04,true),carbon);
      diffuser.name='rear-diffuser';a.add(diffuser);
      const finCount=amount<1?3:5;
      if(amount>=.67) for(let i=0;i<finCount;i++) {
        const x=(i-(finCount-1)/2)*f.rearW*diffuserWidth*1.6/Math.max(1,finCount-1);
        const fin=box(.016,.09,.24,x,f.bumperY-.015,tail-.025,carbon,a,'diffuser-fin');fin.rotation.x=-.13;
      }
    }
  }
  if(config.skirts!=='stock') {
    const a=reg('skirts'),amount=level('skirts'),panel=config.skirtsFinish==='carbon'?woven:body;
    for(const side of [-1,1]) {
      const skirt=new THREE.Mesh(skirtShell(id,side,amount),panel);skirt.name='side-skirt';a.add(skirt);
      if(amount>=.67) {
        const blade=new THREE.Mesh(skirtBlade(id,side,amount),carbon);blade.name='sill-blade';a.add(blade);
      }
    }
  }
  if(config.spoiler!=='stock') {
    const a=reg('spoiler'),track=isTrack('spoiler'),amount=level('spoiler'),panel=config.spoilerFinish==='carbon'?woven:body;
    const roof=f.character==='compact'||f.character==='wagon';
    if(roof) {
      const lip=new THREE.Mesh(id==='audi'?audiRoofExtension(amount):id==='golf'?golfRoofExtension(amount):roofExtension(f.spoilerW,f.spoilerZ,f.spoilerY,track),panel);
      lip.name='roof-extension';a.add(lip);
    } else if(amount>=.67) {
      const h=(f.character==='luxury'?.13:f.character==='classic'?.19:.23)*(track?1:.72);
      const chord=(f.character==='luxury'?.24:.34)*(track?1:.8);
      const wingWidth=(id==='ferrari'?.82:id==='r8'?.85:id==='challenger'?.85:id==='mustang'?.78:.76)*(track?1:.9);
      for(const side of [-1,1]) {
        const support=new THREE.Mesh(wingSupport(side*f.spoilerW*.62,f.spoilerY,f.spoilerZ-.015,h),panel);
        support.name='wing-pedestal';a.add(support);
      }
      const blade=new THREE.Mesh(wingProfile(wingWidth,f.spoilerZ,f.spoilerY+h,chord),panel);blade.name='wing-blade';a.add(blade);
      if(track && f.character!=='luxury') for(const side of [-1,1]) {
        const end=box(.018,.085,chord*.90,side*(wingWidth-.012),f.spoilerY+h+.012,f.spoilerZ-.06,carbon,a,'wing-endplate');end.rotation.x=-.08;
      }
    } else {
      const lip=new THREE.Mesh(deckLip(f,id,amount),panel);lip.name='deck-lip';a.add(lip);
    }
  }
  if(config.exhaust!=='stock') {
    const a=reg('exhaust'),track=isTrack('exhaust'), amount=level('exhaust'), finish=config.exhaustFinish==='carbon'?woven:metal;
    const oval=f.character==='luxury'||f.character==='wagon'||f.character==='midengine';
    // One mouth position is shared by the pipe and flame. The measured rear
    // offsets place the rim just beyond the stock bumper, not inside it.
    const z=id==='mustang' ? 2.240 : id==='ferrari' ? 1.948 : f.rearZ-.06, mouthZ=z+.054, y=id==='mustang' ? .401 : id==='ferrari' ? .334 : f.tipY+.08;
    // The exact same outlet descriptions drive rims and flame origins.
    const ferrariFactoryFlame=id==='ferrari' && config.exhaust==='flame';
    const mustangFactoryFlame=id==='mustang' && config.exhaust==='flame';
    const centers=mustangFactoryFlame ? [-.598,-.515,.526,.609] : id==='ferrari' ? [-.061,.048,.150] : id==='golf'
      ? config.exhaust==='sport' ? [-f.tipX] : [-f.tipX-f.tipSpacing*(config.exhaust==='touring'?.38:.5),-f.tipX+f.tipSpacing*(config.exhaust==='touring'?.38:.5)]
      : (track||config.exhaust==='sport') ? [-f.tipX-f.tipSpacing*(track?.5:.4),-f.tipX+f.tipSpacing*(track?.5:.4),f.tipX-f.tipSpacing*(track?.5:.4),f.tipX+f.tipSpacing*(track?.5:.4)]
      : [-f.tipX,f.tipX];
    const radius=id==='ferrari' ? f.tipRadius*THREE.MathUtils.lerp(.68,.85,amount) : id==='golf'
      ? f.tipRadius*(config.exhaust==='sport'?1.2:THREE.MathUtils.lerp(.72,.85,amount)) : f.tipRadius*((track||config.exhaust==='sport')?.64:THREE.MathUtils.lerp(.85,1.02,amount));
    if(mustangFactoryFlame) {
      // Four real factory tailpipes, measured from the source mesh.
      for(const x of centers) {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,.401,2.294);a.add(mouth);}
    } else if(ferrariFactoryFlame) {
      // The source 458 mesh already contains three outlets. Their centers were
      // measured after its yaw correction; do not layer fake pipes over them.
      for(const x of centers) {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,.334,2.002);a.add(mouth);}
    } else for(const x of centers) tip(a,x,y,z,radius,finish,dark,!track && (config.exhaust==='touring'||oval) && id!=='golf' && config.exhaust!=='sport');
    if (config.exhaust==='flame') {
      const flames=new THREE.Group(); flames.name='exhaust-flames';
      const flameMaterials:THREE.ShaderMaterial[]=[];
      for (const [i,x] of centers.entries()) {
        const jet=new THREE.Group(); jet.position.set(x,ferrariFactoryFlame ? .334 : y, ferrariFactoryFlame ? 2.002 : mouthZ);
        // Original procedural, animated volume: a noisy, luminous shell rather
        // than the old flat-coloured cones. +Z points out of the tailpipe.
        const length=.35, radius=f.tipRadius*1.25;
        const geo=new THREE.SphereGeometry(1,24,18);geo.scale(radius,radius,length*.5);geo.translate(0,0,length*.5);
        const mat=new THREE.ShaderMaterial({
          uniforms:{uTime:{value:0},uSeed:{value:i*7.31},uLength:{value:length},uRadius:{value:radius}},
          transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.FrontSide,
          vertexShader:`varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
            void main(){vLocal=position;vNormal=normalize(normalMatrix*normal);
              vec4 mv=modelViewMatrix*vec4(position,1.0);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
          fragmentShader:`uniform float uTime,uSeed,uLength,uRadius;varying vec3 vLocal,vNormal,vView;
            float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
            float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
              return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
                         mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
            void main(){float t=clamp(vLocal.z/uLength,0.0,1.0);
              vec3 p=vec3(vLocal.xy/uRadius*2.0,t*5.0-uTime*4.0+uSeed);
              float n=noise3(p)*.7+noise3(p*2.2+9.0)*.3;
              float envelope=(1.0-smoothstep(.70,1.0,t))*smoothstep(.40,.72,n+(.5-t)*.25);
              float facing=pow(abs(dot(normalize(vNormal),normalize(vView))),1.5);
              float heat=clamp((1.0-t)*.85+n*.45,0.0,1.0);
              vec3 col=mix(vec3(.95,.055,.003),vec3(1.0,.43,.025),smoothstep(.25,.65,heat));
              col=mix(col,vec3(1.0,.92,.48),smoothstep(.72,1.0,heat));
              gl_FragColor=vec4(col*1.45,envelope*facing*.7);
            }`,
        });
        const volume=new THREE.Mesh(geo,mat);volume.name='flame-volume';jet.add(volume);
        flameMaterials.push(mat);flames.add(jet);
      }
      flames.userData.flameMaterials=flameMaterials; a.add(flames);
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
  for (const material of (flames.userData.flameMaterials || []) as THREE.ShaderMaterial[]) material.uniforms.uTime.value=time;
  flames.children.forEach((jet,i)=>{
    const flicker=.82+.18*(.5+.5*Math.sin(time*21+i*2.7));
    jet.scale.set(1,1,flicker);
  });
}
