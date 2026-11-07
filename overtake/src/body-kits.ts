import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CarId } from './catalog';
import type { Customization, BodyPart } from './customization.mjs';
import { createCarbonMaterial, LIVERIES } from './livery';
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
  labels: Record<BodyPart, [string,string]>;
}
export const BODY_FITS: Record<CarId, Fit> = {
  golf: { frontZ:-2.02,rearZ:2.04,frontW:.77,rearW:.80,sideX:.82,sillFront:-.84,sillRear:.90,sillY:.22,bumperY:.21,spoilerZ:1.61,spoilerY:1.38,spoilerW:.61,tipX:.52,tipY:.21,tipRadius:.055,tipSpacing:.10,character:'compact', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['GT lip','Cup splitter'],rear:['Clean valance','Cup diffuser'],skirts:['GT sills','Cup blades'],spoiler:['Roof lip','Cup roof wing'],exhaust:['Twin round','Cup twin']} },
  mercedes: { frontZ:-2.58,rearZ:2.58,frontW:.91,rearW:.88,sideX:.94,sillFront:-1.17,sillRear:1.18,sillY:.19,bumperY:.20,spoilerZ:2.23,spoilerY:1.07,spoilerW:.67,tipX:.62,tipY:.22,tipRadius:.072,tipSpacing:.13,character:'luxury', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Executive lip','Aero splitter'],rear:['Sport valance','Aero diffuser'],skirts:['Executive sills','Aero blades'],spoiler:['Deck lip','Touring wing'],exhaust:['Polished oval','Quad sport']} },
  audi: { frontZ:-2.43,rearZ:2.46,frontW:.93,rearW:.92,sideX:.95,sillFront:-1.10,sillRear:1.08,sillY:.19,bumperY:.20,spoilerZ:1.81,spoilerY:1.39,spoilerW:.70,tipX:.62,tipY:.22,tipRadius:.075,tipSpacing:.13,character:'wagon', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Touring lip','Performance splitter'],rear:['Touring valance','Sport diffuser'],skirts:['Touring sills','Extended blades'],spoiler:['Tailgate lip','Touring roof wing'],exhaust:['Oval outlets','Quad outlets']} },
  mustang: { frontZ:-2.27,rearZ:2.31,frontW:.83,rearW:.82,sideX:.86,sillFront:-.95,sillRear:1.08,sillY:.20,bumperY:.21,spoilerZ:2.12,spoilerY:.958,spoilerW:.69,tipX:.58,tipY:.23,tipRadius:.065,tipSpacing:.12,character:'classic', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Heritage chin','Race chin'],rear:['Heritage valance','Race diffuser'],skirts:['Rocker trim','Race rockers'],spoiler:['Ducktail','Pedestal wing'],exhaust:['Dual round','Side-by-side quad']} },
  ferrari: { frontZ:-2.03,rearZ:2.00,frontW:.74,rearW:.86,sideX:.91,sillFront:-.90,sillRear:.86,sillY:.16,bumperY:.17,spoilerZ:1.80,spoilerY:.84,spoilerW:.53,tipX:.54,tipY:.24,tipRadius:.055,tipSpacing:.10,character:'supercar', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Road blade','Circuit splitter'],rear:['Road diffuser','Circuit diffuser'],skirts:['Road blades','Circuit skirts'],spoiler:['Low deck lip','Circuit wing'],exhaust:['Center round','Center race']} },
  r8: { frontZ:-2.17,rearZ:2.18,frontW:.86,rearW:.91,sideX:.94,sillFront:-.88,sillRear:.93,sillY:.17,bumperY:.19,spoilerZ:1.90,spoilerY:.84,spoilerW:.62,tipX:.65,tipY:.22,tipRadius:.07,tipSpacing:.12,character:'midengine', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Road splitter','GT splitter'],rear:['Road diffuser','GT diffuser'],skirts:['Road blades','GT skirts'],spoiler:['Deck lip','GT wing'],exhaust:['Twin oval','Quad titanium']} },
  challenger: { frontZ:-2.47,rearZ:2.47,frontW:.91,rearW:.89,sideX:.96,sillFront:-1.02,sillRear:1.07,sillY:.22,bumperY:.22,spoilerZ:2.22,spoilerY:1.065,spoilerW:.72,tipX:.61,tipY:.23,tipRadius:.07,tipSpacing:.13,character:'muscle', labels:{roof:['Roof panel','Roof scoop'],hood:['Hood vents','Vented power dome'],front:['Street chin','Wide splitter'],rear:['Street valance','Wide diffuser'],skirts:['Street rockers','Wide rockers'],spoiler:['Ducktail','Drag wing'],exhaust:['Dual round','Quad muscle']} },
};

function taperedBand(width:number, frontZ:number, y:number, depth:number, height:number, sweep:number) {
  // Curved, low bumper add-on: tapered corners wrap back onto the body.
  const geo=new THREE.BufferGeometry(), positions:number[]=[], indices:number[]=[];
  const count=40;
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
  const positions:number[]=[], indices:number[]=[], segments=60, sign=rear ? -1 : 1;
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
  const positions:number[]=[], indices:number[]=[], n=40;
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
  const vertices:number[]=[], indices:number[]=[], n=48, width=.53;
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
  const vertices:number[]=[], indices:number[]=[], n=48, width=.51;
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
  const vertices:number[]=[],indices:number[]=[],n=48,sign=rear?1:-1;
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
  const vertices:number[]=[],indices:number[]=[],n=48;
  for(let i=0;i<=n;i++){
    const x=(2*i/n-1)*.84,abs=Math.abs(x);let j=0;while(j<xs.length-2&&abs>xs[j+1])j++;
    const z=THREE.MathUtils.lerp(zs[j],zs[j+1],(abs-xs[j])/(xs[j+1]-xs[j]));
    const edge=abs/.84,lead=THREE.MathUtils.lerp(.02,.055,level)*(1-.3*edge);
    for(const [y,zz] of [[.211,z+.045],[.195,z-lead],[.182,z-lead],[.183,z+.10]] as const) vertices.push(x,y,zz);
    if(i<n)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=(i+1)*4+k,d=(i+1)*4+(k+1)%4;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Mustang's chin is a shallow extension of its measured lower nose contour,
// not a generic wide apron underneath the chrome factory bumper.
function mustangChin(level:number) {
  const xs=[0,.2,.4,.55,.65,.75], zs=[-2.324,-2.311,-2.289,-2.231,-2.148,-2.067];
  const vertices:number[]=[], indices:number[]=[], n=44;
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
function denseSamples(row:number[]) { // x3 linear subdivision of sill samples
  const out:number[]=[];
  for(let i=0;i<row.length-1;i++) for(let k=0;k<3;k++) out.push(row[i]+(row[i+1]-row[i])*k/3);
  out.push(row[row.length-1]); return out;
}
function skirtShell(id:CarId, side:number, level:number) {
  const fit=sillProfiles[id], raw=fit.sides[side<0?0:1], samples=[denseSamples(raw[0]),denseSamples(raw[1])], n=samples[0].length-1;
  const positions:number[]=[], indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n, taper=Math.pow(Math.sin(Math.PI*t),.6), z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t);
    const rearFlare=(id==='ferrari'||id==='r8') ? Math.pow(t,3)*.035*taper : id==='audi' ? Math.pow(t,2)*.015*taper : 0;
    const top=samples[1][i]+.005, mid=samples[0][i]+.004+THREE.MathUtils.lerp(.008,.016,level)*taper+rearFlare*.45;
    const low=samples[0][i]-.025+THREE.MathUtils.lerp(.016,.030,level)*taper+rearFlare;
    const crease=samples[0][i]-.002+THREE.MathUtils.lerp(.006,.012,level)*taper+rearFlare*.3;
    for(const [x,y] of [[top,.38],[mid,.30],[crease,.262],[low,.22],[samples[0][i]-.045,.205],[samples[0][i]-.045,.37]] as const) positions.push(side*x,y,z);
    if(i<n) for(let j=0;j<6;j++) {const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function skirtBlade(id:CarId, side:number, level:number) {
  const fit=sillProfiles[id], samples=denseSamples(fit.sides[side<0?0:1][0]), n=samples.length-1;
  const positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++) {
    const t=i/n,taper=Math.pow(Math.sin(Math.PI*t),.7),z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t),x=samples[i];
    for(const [xx,y] of [[x-.04,.215],[x+THREE.MathUtils.lerp(.032,.050,level)*taper,.205],[x+THREE.MathUtils.lerp(.032,.050,level)*taper,.188],[x-.04,.198]] as const)positions.push(side*xx,y,z);
    if(i<n)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Integrated ducktail: leading edge merges into the rear deck, ends taper into
// the shoulders, and a raised trailing edge provides an actual aero section.
function deckLip(f:Fit,id:CarId,level:number) {
  const positions:number[]=[],indices:number[]=[], n=48;
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
function wingProfile(width:number,z:number,y:number,chord:number, pitch=.16) {
  const positions:number[]=[],indices:number[]=[], n=64;
  const cos=Math.cos(pitch), sin=Math.sin(pitch);
  for(let i=0;i<=n;i++) {
    const t=2*i/n-1, edge=t*t, x=t*width, shift=-.075*edge;
    const c=chord*(1-.14*Math.pow(Math.abs(t),4));
    // Cambered section pitched nose-down/back around the blade centre.
    for(const [yy,zz] of [[y-.008,z-c*.52+shift],[y+.024,z-c*.30+shift],[y+.035,z+shift],[y+.017,z+c*.49+shift],[y-.008,z+c*.50+shift],[y-.012,z-c*.30+shift]] as const)
      positions.push(x, y+(yy-y)*cos-(zz-z)*sin, z+(yy-y)*sin+(zz-z)*cos);
    if(i<n) for(let j=0;j<6;j++) {const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Tapered, swept pedestals with a broad foot buried in the deck and a narrow
// tip reaching the aerofoil. This replaces the previous rectangular posts.
function wingSupport(x:number,y:number,z:number,height:number, lean=.05) {
  const verts:number[]=[],indices:number[]=[];
  const profile=[[-.105,y-.035],[.085,y-.035],[.038+lean,y+height],[-.048+lean,y+height]];
  for(const dx of [-.019,.019]) for(const [dz,yy] of profile)verts.push(x+dx,yy,z+dz);
  indices.push(0,2,1,0,3,2,4,5,6,4,6,7);
  for(let i=0;i<4;i++){let j=(i+1)%4;indices.push(i,j,i+4,j,j+4,i+4);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
/** Measured wheel arch: centre, tyre radius, and the paint surface
 * half-width sampled every 10 degrees (key = degrees, atan2(dy, dz)). */
export interface WheelArch { x:number; y:number; z:number; r:number; profile: Map<number, number> }
export interface TopLine { z:number; y:number }
export interface BumperRow { y:number; points:{x:number;z:number}[] }
export interface BumperSet { front: BumperRow[]; rear: BumperRow[] }

/** Lofted overfender: a closed 5-point section swept around the measured
 * arch. Inner edge tucks under the stock lip, crown stands proud of the
 * panel, outer edge rolls back onto the body — like a real bolt-on flare. */
function archFlareGeometry(side:number, arch:WheelArch, fallbackX:number, protrusion:number) {
  const positions:number[]=[], indices:number[]=[], steps=48;
  const bodyX=(deg:number)=>{ // nearest sampled bins, smoothed
    let best=fallbackX, weight=0, sum=0;
    for(const [bin,x] of arch.profile) { const d=Math.abs(bin-deg); if(d<=20) { const w=21-d; sum+=x*w; weight+=w; } }
    if(weight>0) best=sum/weight;
    return best;
  };
  for(let i=0;i<=steps;i++) {
    const t=i/steps, angle=.14+t*(Math.PI-.28); // arch skirt: ends taper at sill height, never under the car
    const taper=Math.pow(Math.sin(Math.PI*t),.55);
    const out=protrusion*(.25+.75*taper);
    const bx=bodyX(Math.round(angle*180/Math.PI));
    const R=arch.r+.012;
    const dy=Math.sin(angle), dz=Math.cos(angle);
    // [radial offset, outward offset] closed section, panel-hugging to proud
    const section:[number,number][]=[[-.075,-.012],[ -.012,out*.45],[.030,out],[.082,out*.30],[.088,-.014]];
    for(const [dr,o] of section) positions.push(side*(bx+o), arch.y+dy*(R+dr), arch.z+dz*(R+dr));
    if(i<steps) for(let j=0;j<5;j++){const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;
      if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
/** Replacement bumper shell: lofted over the measured stock surface,
 * offset 12 mm proud, wrapping back around both corners. The stock bumper
 * stays underneath but is fully covered — no floating panel, no gap. */
function bumperCoverGeometry(rows: BumperRow[], rear: boolean, offMag = .012, wrapMag = .11, maxTailX = Infinity) {
  const positions:number[]=[], indices:number[]=[];
  const grid = rows.map(row => {
    const pts = row.points.filter(pt => Number.isFinite(pt.z));
    const first = pts[0], last = pts[pts.length-1];
    const wrap = (rear ? -1 : 1) * wrapMag; // corners sweep back along the flanks
    // Two-step wrap tail: each step sweeps further along the flank and tucks
    // inward, so the shell edge disappears into the bodywork ahead of the
    // wheel instead of ending in a cut corner with stock paint showing.
    let wf = row.y < .30 ? 1.0 : row.y > .50 ? .6 : .85; // tails stop at the arch lip
    const tuck = row.y < .30 ? .02 : .09, tuck1 = row.y < .30 ? .01 : .035;
    // Bumpers much wider than the flank (classic chrome) get shorter,
    // tighter tails, otherwise the loft hangs in the air beside the arch.
    const excess = Math.abs(first.x) - (maxTailX + .005);
    if(excess > .03) wf *= Math.max(.45, 1 - (excess - .03) * 5);
    // Wrap tails never stick out past the flank (some bumpers are wider
    // than the body behind them, e.g. classic chrome bumpers).
    const tailLim = excess > .03 ? maxTailX - .025 : maxTailX;
    const tailL=-Math.min(Math.abs(first.x+tuck),tailLim), tailR=Math.min(Math.abs(last.x-tuck),tailLim);
    const midL=-Math.min(Math.abs(first.x+tuck1),maxTailX), midR=Math.min(Math.abs(last.x-tuck1),maxTailX);
    return wrapMag > 0
      ? [{x:tailL, y:row.y, z:first.z+wrap*2.1*wf}, {x:midL, y:row.y, z:first.z+wrap*1.15*wf},
         ...pts.map(pt=>({x:pt.x, y:row.y, z:pt.z})),
         {x:midR, y:row.y, z:last.z+wrap*1.15*wf}, {x:tailR, y:row.y, z:last.z+wrap*2.1*wf}]
      : pts.map(pt=>({x:pt.x, y:row.y, z:pt.z}));
  });
  // Taper: as a row's surface curves back from the bumper face, pull any
  // width beyond the flank in to flank width, so the shell flows from
  // bumper width into the fender instead of hanging outboard of the arch.
  if(Number.isFinite(maxTailX)) for(const row of grid) {
    const extreme = rear ? Math.max(...row.map(pt=>pt.z)) : Math.min(...row.map(pt=>pt.z));
    for(const pt of row) { const travel = rear ? extreme-pt.z : pt.z-extreme;
      const k = Math.min(1, Math.max(0, travel/.35));
      if(Math.abs(pt.x) > maxTailX) pt.x = Math.sign(pt.x) * (Math.abs(pt.x) + (maxTailX-Math.abs(pt.x))*k*.85); } }
  const cols = grid[0].length, off = (rear ? 1 : -1) * offMag;
  // Wrap-tail columns also dive to near-flush, so the shell edge vanishes
  // into the flank instead of leaving a seam ahead of the wheel.
  const colF = grid[0].map((_,j)=> wrapMag>0 ? (j===0||j===cols-1 ? .15 : j===1||j===cols-2 ? .55 : 1) : (j===0||j===cols-1 ? .3 : 1));
  // Feather rows above/below: the shell edge dives back to near-flush with
  // the stock panel, so there is no hard "wrapped band" seam.
  const feather=(row:{x:number;y:number;z:number}[], dy:number)=>row.map(pt=>({x:pt.x, y:pt.y+dy, z:pt.z}));
  const fullGrid = [feather(grid[0],-.045), ...grid, feather(grid[grid.length-1],.045)];
  const offFactors = fullGrid.map((_,i)=> (i===0||i===fullGrid.length-1) ? .12 : 1);
  fullGrid.forEach((row,i)=> row.forEach((pt,j)=> {
    positions.push(pt.x, pt.y, pt.z+off*offFactors[i]*colF[j]);
    if(i<fullGrid.length-1 && j<cols-1) { const a=i*cols+j,b=a+1,c=a+cols,d=c+1;
      if(rear) indices.push(a,b,c,b,d,c); else indices.push(a,c,b,b,c,d); }
  }));
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
/** A surface patch (intakes, surrounds) lofted on the measured bumper. */
function bumperPatchGeometry(allRows: BumperRow[], yLo: number, yHi: number, xLo: number, xHi: number, rear: boolean, offMag: number) {
  const pick = (y:number) => { // interpolate z between the bracketing rows
    let lo = allRows[0], hi = allRows[allRows.length-1];
    for(const r of allRows) { if(r.y<=y) lo=r; if(r.y>=y) { hi=r; break; } }
    const t = hi.y===lo.y ? 0 : (y-lo.y)/(hi.y-lo.y);
    const byX = new Map(hi.points.map(pt=>[Math.round(pt.x*1000), pt.z]));
    return { y, points: lo.points.filter(pt => pt.x>=xLo && pt.x<=xHi)
      .map(pt => ({ x:pt.x, z: pt.z + ((byX.get(Math.round(pt.x*1000)) ?? pt.z) - pt.z)*t })) }; };
  return bumperCoverGeometry([pick(yLo), pick(yHi)], rear, offMag, 0);
}
function bumperZ(rows: BumperRow[], x:number, y:number, rear:boolean) {
  let row = rows[0], rd = 1e9;
  for(const r of rows) if(Math.abs(r.y-y)<rd) { rd=Math.abs(r.y-y); row=r; }
  let best = row.points[0], bd = 1e9;
  for(const pt of row.points) if(Number.isFinite(pt.z) && Math.abs(pt.x-x)<bd) { bd=Math.abs(pt.x-x); best=pt; }
  return best.z + (rear ? .016 : -.016);
}
/** Thin shaped plate (canards, fins, endplates, flaps) with a bevelled edge. */
function plateGeometry(points:[number,number][], thickness:number, bevel=.0025) {
  const shape=new THREE.Shape();
  points.forEach(([x,y],i)=> i===0?shape.moveTo(x,y):shape.lineTo(x,y));
  shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:20});
  geo.translate(0,0,-thickness/2); return geo;
}
function rodBetween(a:THREE.Vector3, b:THREE.Vector3, r:number, mat:THREE.Material, name:string) {
  const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,14),mat);
  mesh.name=name; mesh.position.copy(a).addScaledVector(dir,.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  return mesh;
}
function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material, group:THREE.Group, name:string) {
  const radius=Math.min(.012, Math.min(w,h,d)*.32);
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,radius),mat); mesh.position.set(x,y,z); mesh.name=name; mesh.castShadow=true; group.add(mesh);return mesh;
}
function tip(group:THREE.Group, x:number, y:number, z:number, radius:number, metal:THREE.Material, dark:THREE.Material, oval=false) {
  // The dark interior and metal rim make an actual visible exhaust opening.
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.10,36,1,true),metal);
  pipe.name='exhaust-pipe';pipe.rotation.x=Math.PI/2;pipe.position.set(x,y,z);if(oval)pipe.scale.x=1.35;group.add(pipe);
  const hole=new THREE.Mesh(new THREE.CircleGeometry(radius*.77,36),dark);hole.position.set(x,y,z+.052);if(oval)hole.scale.x=1.35;group.add(hole);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.90,radius*.10,10,36),metal);ring.name='exhaust-mouth';ring.position.set(x,y,z+.054);if(oval)ring.scale.x=1.35;group.add(ring);
}

/** A player-only kit. All geometries/materials are owned by the returned group. */
export function createBodyKit(id:CarId, config:Customization, paint:number, arches: WheelArch[] = [], topLine: TopLine[] = [], bumpers?: BumperSet) {
  const f=BODY_FITS[id], g=new THREE.Group(); g.name='custom-body-kit';
  const body=new THREE.MeshPhysicalMaterial({ color:paint, metalness:.45,roughness:.36,clearcoat:.4,clearcoatRoughness:.22, envMapIntensity:.9 });
  const carbon=new THREE.MeshStandardMaterial({ color:0x141a20,metalness:.35,roughness:.38, envMapIntensity:.9 });
  const woven=createCarbonMaterial();
  const metal=new THREE.MeshStandardMaterial({ color:0xb6c7cf,metalness:.9,roughness:.22 });
  const dark=new THREE.MeshBasicMaterial({ color:0x090d10, side:THREE.DoubleSide });
  const reg=(part:string)=>{const partGroup=new THREE.Group();partGroup.name=`custom-${part}`;g.add(partGroup);return partGroup;};
  const level=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust'|'hood')=>({stock:0,street:0,touring:.34,sport:.67,rally:.5,gt:.82,track:1,wide:1,titanium:1,flame:1,quadflame:1}[config[part]]);
  const isTrack=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>config[part]==='track'||config[part]==='wide'||config[part]==='gt'||config[part]==='titanium'||(part==='exhaust' && (config.exhaust==='flame'||config.exhaust==='quadflame'));
  const burnt=new THREE.MeshStandardMaterial({ color:0x8a7cff, metalness:.95, roughness:.18 }); // heat-blued titanium
  g.userData.titaniumMaterial=burnt;
  const lampMat=new THREE.MeshStandardMaterial({ color:0xfff6d8, emissive:0xffedb8, emissiveIntensity:2.4, roughness:.3 });
  const rubber=new THREE.MeshStandardMaterial({ color:0x14171a, roughness:.95, metalness:0 });
  const archFor=(side:number, front:boolean)=>arches.find(a=>(a.x>0)===(side>0) && (front ? a.z<0 : a.z>0));
  // Bolt-on overfender lofted onto the measured arch, rivets seated on its crown.
  const flare=(group:THREE.Group, side:number, front:boolean, mat:THREE.Material)=>{
    const arch=archFor(side,front);
    const wheelZ=arch?arch.z:(front?f.sillFront-.30:f.sillRear+.30);
    const geo=arch?archFlareGeometry(side,arch,f.sideX,.058)
      :archFlareGeometry(side,{x:side*f.sideX,y:.36,z:wheelZ,r:.35,profile:new Map()},f.sideX,.058);
    const mesh=new THREE.Mesh(geo,mat); mesh.name='fender-flare'; mesh.castShadow=true; group.add(mesh);
    const R=(arch?arch.r:.35)+.045, cy=arch?arch.y:.36;
    const crownX=(deg:number)=>{ let best=f.sideX, weight=0, sum=0;
      if(arch) for(const [bin,x] of arch.profile) { const d=Math.abs(bin-deg); if(d<=20) { const w=21-d; sum+=x*w; weight+=w; } }
      if(weight>0) best=sum/weight; return best+.052; };
    for(let i=1;i<7;i++){ const a=.25+(Math.PI-.5)*(i/7), rivet=new THREE.Mesh(new THREE.SphereGeometry(.0125,12,10),metal);
      rivet.name='flare-rivet'; rivet.position.set(side*crownX(Math.round(a*180/Math.PI)),cy+Math.sin(a)*R,wheelZ+Math.cos(a)*R); group.add(rivet); }
  };
  // Shaped rally flap: wide at the top, tapered foot, extruded with a bevel.
  const mudflap=(group:THREE.Group, side:number, front:boolean)=>{
    const arch=archFor(side,front), wheelZ=arch?arch.z:(front?f.sillFront-.30:f.sillRear+.30);
    const wheelX=arch?arch.x:side*f.sideX;
    const geo=plateGeometry([[-.12,.16],[.12,.16],[.095,-.15],[-.095,-.15]],.018);
    const flap=new THREE.Mesh(geo,rubber); flap.name='mud-flap';
    // Transverse flap hanging just behind the tire, like a real rally flap.
    flap.position.set(wheelX,(arch?arch.y:.36)-.10,wheelZ+(arch?arch.r:.35)+.045);
    flap.rotation.x=.05; flap.castShadow=true; group.add(flap);
  };
  // Centreline surface height, interpolated from the measured top line.
  const surfaceY=(z:number)=>{ if(!topLine.length) return f.spoilerY;
    let lo=topLine[0], hi=topLine[topLine.length-1];
    for(const pt of topLine) { if(pt.z<=z) lo=pt; if(pt.z>=z) { hi=pt; break; } }
    return hi.z===lo.z ? lo.y : lo.y+(hi.y-lo.y)*((z-lo.z)/(hi.z-lo.z)); };
  // A sheet hugging the measured hood/roof surface (cx/hw in metres, lift off it).
  const surfaceSheet=(group:THREE.Group, name:string, z0:number, z1:number, cx:number, hw:number, lift:number, bump:number, mat:THREE.Material, taperBump=false, crown=.012)=>{
    const positions:number[]=[], indices:number[]=[], rows=26, cols=12;
    for(let i=0;i<=rows;i++) { const z=z0+(z1-z0)*(i/rows), base=surfaceY(z)+lift;
      const zTaper=taperBump?Math.pow(Math.sin(Math.PI*(i/rows)),.7):1;
      for(let j=0;j<=cols;j++) { const t=j/cols*2-1, x=cx+t*hw;
        positions.push(x, base+(bump*zTaper)*(1-t*t)-crown*t*t, z); }
      if(i<rows) for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+1,c=a+cols+1,d=c+1;indices.push(a,c,b,b,c,d);} }
    const uvs:number[]=[]; for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++) uvs.push(j/cols, i/rows);
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(indices); geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mat); mesh.name=name; mesh.castShadow=true; group.add(mesh); return mesh; };

  // Hood span: ends where the measured centreline reaches the windshield.
  // The centreline has a data gap over the glass (no paint there), so stop
  // at the gap/climb instead of interpolating sheets up the windshield.
  const hoodSpan=()=>{ const len=f.rearZ-f.frontZ, hz0=f.frontZ+len*.07; let hz1=f.frontZ+len*.35;
    if(topLine.length) { const baseY=surfaceY(hz0+.3); let prev:TopLine|undefined;
      for(const pt of topLine) { if(pt.z>hz0+.25) {
        if(prev && pt.z-prev.z>.16) { hz1=Math.min(hz1,prev.z-.03); break; }
        if(pt.z>hz0+.55 && pt.y>baseY+.30) { hz1=Math.min(hz1,pt.z-.10); break; } }
        if(pt.z>hz0) prev=pt; } }
    return [hz0,hz1] as const; };
  if(config.hood!=='stock') {
    const a=reg('hood'), panel=config.hoodFinish==='carbon'?woven:body, len=f.rearZ-f.frontZ;
    const [hz0,hz1]=hoodSpan();
    const darkSheet=new THREE.MeshStandardMaterial({ color:0x0b0e11, roughness:.6, metalness:.3 });
    (g.userData.extraMaterials ??= []).push(darkSheet);
    const extractors=()=>{ // short extractor vents at the rear of the bonnet
      for(const side of [-1,1]) {
        surfaceSheet(a,'hood-vent',hz1-.40,hz1-.14,side*f.frontW*.38,.085,.004,0,darkSheet);
        for(const zz of [hz1-.34,hz1-.25,hz1-.16]) { const slat=box(.17,.008,.028,side*f.frontW*.38,surfaceY(zz)+.010,zz,darkSheet,a,'vent-slat');
          slat.rotation.x=Math.atan((surfaceY(zz+.06)-surfaceY(zz-.06))/.12)*.6; }
      } };
    if(config.hood==='street') { extractors();
    } else if(config.hood==='touring') { // chrome centre spear
      surfaceSheet(a,'hood-spear',hz0+.05,hz1,0,.030,.006,0,metal);
    } else if(config.hood==='sport') { // power dome (tapered) with a dark scoop mouth
      surfaceSheet(a,'power-dome',hz0+.02,hz1,0,f.frontW*.34,.004,.030,panel,true,.010);
      surfaceSheet(a,'scoop-mouth',hz0+.10,hz0+.30,0,f.frontW*.22,.030,0,darkSheet);
    } else if(config.hood==='rally') { extractors(); // bonnet vents (roof scoop lives in Roof)
    } else if(config.hood==='gt') { // full carbon bonnet
      surfaceSheet(a,'carbon-hood',hz0,hz1,0,f.frontW*.74,.005,0,woven,false,.034);
    } else if(config.hood==='track') { // louvred bonnet
      for(let i=0;i<6;i++) { const z=hz0+.14+i*((hz1-hz0-.24)/5), slat=new THREE.Mesh(new RoundedBoxGeometry(f.frontW*.56,.011,.068,2,.004),darkSheet);
        slat.name='hood-louvre'; slat.position.set(0,surfaceY(z)+.004,z); slat.rotation.x=Math.atan((surfaceY(z+.06)-surfaceY(z-.06))/.12)*.6-.12; a.add(slat); }
    } else if(config.hood==='wide') { // broad show-car power dome
      surfaceSheet(a,'power-dome',hz0,hz1,0,f.frontW*.55,.004,.05,panel,false,.020);
      surfaceSheet(a,'hood-vent',hz0+.20,hz1-.04,-f.frontW*.52,.10,.006,0,darkSheet);
      surfaceSheet(a,'hood-vent',hz0+.20,hz1-.04, f.frontW*.52,.10,.006,0,darkSheet);
    }
  }
  if(config.roof!=='stock') {
    const a=reg('roof'), panel=config.roofFinish==='carbon'?woven:body, len=f.rearZ-f.frontZ;
    let rz0=f.frontZ+len*.45, rz1=f.frontZ+len*.68;
    // Roof = the measured high plateau of the centreline, windshield to hatch.
    if(topLine.length) { const maxY=Math.max(...topLine.map(pt=>pt.y));
      const plat=topLine.filter(pt=>pt.y>=maxY-.09 && pt.z>f.frontZ+len*.30 && pt.z<f.frontZ+len*.85);
      if(plat.length>2) { rz0=plat[0].z+.04; rz1=plat[plat.length-1].z-.04; } }
    const darkSheet=new THREE.MeshStandardMaterial({ color:0x0b0e11, roughness:.55, metalness:.3 });
    const glossBlack=new THREE.MeshPhysicalMaterial({ color:0x0d1117, roughness:.22, metalness:.35, clearcoat:.8, envMapIntensity:1.1 });
    (g.userData.extraMaterials ??= []).push(darkSheet, glossBlack);
    const mid=(rz0+rz1)/2, scoop=(tall:boolean)=>{
      const mesh=new THREE.Mesh(plateGeometry(tall?[[-.25,0],[.25,0],[.17,.105],[-.15,.082]]:[[-.23,0],[.23,0],[.16,.078],[-.14,.064]],.30,.006),panel);
      mesh.name='roof-scoop'; mesh.rotation.y=Math.PI/2; mesh.position.set(0,surfaceY(mid)-.014,mid); a.add(mesh);
      const mouth=new THREE.Mesh(plateGeometry([[-.125,0],[.125,0],[.11,.042],[-.11,.042]],.012),darkSheet);
      mouth.name='scoop-mouth'; mouth.rotation.x=-.5; mouth.position.set(0,surfaceY(mid)+.046,mid-.226); a.add(mouth); };
    const fin=()=>{ const mesh=new THREE.Mesh(plateGeometry([[-.16,0],[.14,0],[.05,.085],[-.06,.075]],.016),panel);
      mesh.name='roof-fin'; mesh.rotation.y=Math.PI/2; mesh.position.set(0,surfaceY(rz1-.12)-.005,rz1-.12); a.add(mesh); };
    if(config.roof==='street') surfaceSheet(a,'black-roof',rz0,rz1,0,f.frontW*.60,.005,0,glossBlack,false,.042);
    else if(config.roof==='touring') { surfaceSheet(a,'roof-rail',rz0,rz1,-f.frontW*.44,.022,.006,0,metal); surfaceSheet(a,'roof-rail',rz0,rz1,f.frontW*.44,.022,.006,0,metal); }
    else if(config.roof==='sport') surfaceSheet(a,'carbon-roof',rz0,rz1,0,f.frontW*.62,.005,0,panel,false,.042);
    else if(config.roof==='rally') scoop(false);
    else if(config.roof==='gt') { surfaceSheet(a,'carbon-roof',rz0,rz1,0,f.frontW*.62,.005,0,woven,false,.042); fin(); }
    else if(config.roof==='track') { scoop(true); fin(); }
    else if(config.roof==='wide') { surfaceSheet(a,'black-roof',rz0,rz1,0,f.frontW*.66,.005,0,glossBlack,false,.046); fin(); }
  }
  if(config.paintScheme!=='single' || config.livery!=='none') {
    const a=reg('livery'), d=LIVERIES[id], len=f.rearZ-f.frontZ;
    const accent=new THREE.MeshPhysicalMaterial({ color:config.liveryColor, metalness:.3, roughness:.42, clearcoat:.5, envMapIntensity:1.0 });
    const second=new THREE.MeshPhysicalMaterial({ color:config.secondaryColor, metalness:.3, roughness:.42, clearcoat:.5, envMapIntensity:1.0 });
    const secondMat=config.secondaryFinish==='carbon'?woven:second;
    (g.userData.extraMaterials ??= []).push(accent, second);
    // measured hood / roof / trunk spans along the centreline
    const [hz0,hz1]=hoodSpan();
    let rz0=f.frontZ+len*.45, rz1=f.frontZ+len*.68;
    if(topLine.length) { const maxY=Math.max(...topLine.map(pt=>pt.y));
      const plat=topLine.filter(pt=>pt.y>=maxY-.09 && pt.z>f.frontZ+len*.30 && pt.z<f.frontZ+len*.85);
      if(plat.length>2) { rz0=plat[0].z+.04; rz1=plat[plat.length-1].z-.04; } }
    const topSpans:[number,number][]=[[hz0,hz1],[rz0,rz1],[rz1+.06,f.rearZ-len*.04]];
    const doorY=f.sillY+.52, doorX=f.sideX+.006;
    if(config.paintScheme==='upper') for(const [z0,z1] of topSpans) surfaceSheet(a,'two-tone-top',z0,z1,0,f.frontW*.60,.006,0,secondMat,false,.034);
    if(config.paintScheme==='lower') for(const side of [-1,1]) { const m=new THREE.Mesh(skirtShell(id,side,.55),secondMat); m.name='two-tone-sill'; a.add(m); }
    if(config.livery==='stripe' || config.livery==='race') {
      for(const [z0,z1] of topSpans) for(const side of [-1,1])
        surfaceSheet(a,'livery-stripe',z0,z1,side*d.offset,d.stripe*.5,.006,0,accent);
    }
    if(config.livery==='race') for(const side of [-1,1]) {
      const ring=new THREE.Mesh(new THREE.RingGeometry(.145,.185,28),accent);
      ring.name='race-roundel'; ring.rotation.y=side*Math.PI/2; ring.position.set(side*doorX,doorY,d.doorZ); a.add(ring);
      const dot=new THREE.Mesh(new THREE.CircleGeometry(.05,20),second);
      dot.name='race-dot'; dot.rotation.y=side*Math.PI/2; dot.position.set(side*(doorX+.002),doorY,d.doorZ); a.add(dot);
      const slash=new THREE.Mesh(plateGeometry([[-.26,-.030],[.26,-.018],[.26,.030],[-.26,.018]],.008),accent);
      slash.name='race-slash'; slash.rotation.y=Math.PI/2; slash.rotation.z=side*.0; slash.rotation.x=0; slash.rotation.set(0,Math.PI/2,-.55);
      slash.position.set(side*doorX,f.sillY+.30,d.doorZ+.05); a.add(slash);
    }
    if(config.livery==='camo') { // deterministic blobs on flanks + roof
      let seed=[...id].reduce((n,c)=>n+c.charCodeAt(0),7);
      const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
      for(let i=0;i<10;i++) { const side=i%2?1:-1, blob=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),i%3?accent:second);
        blob.name='camo-blob'; blob.scale.set(.16,.75+rnd()*.5,1.1+rnd()*.9);
        blob.position.set(side*doorX, f.sillY+.25+rnd()*.55, -1.2+rnd()*2.4); blob.rotation.y=side*Math.PI/2; a.add(blob); }
      for(let i=0;i<4;i++) { const blob=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),i%2?second:accent);
        blob.name='camo-blob'; blob.scale.set(1+rnd()*.7,.14,1.2+rnd()*.8);
        blob.position.set((rnd()-.5)*.7, surfaceY(rz0+rnd()*(rz1-rz0))+.01, rz0+rnd()*(rz1-rz0)); a.add(blob); }
    }
    if(config.livery==='fade') { // segmented gradient wash over hood + roof
      for(let i=0;i<6;i++) { const col=new THREE.Color(config.liveryColor).lerp(new THREE.Color(config.secondaryColor), i/5);
        const mat=new THREE.MeshPhysicalMaterial({ color:col, metalness:.3, roughness:.42, clearcoat:.5 });
        (g.userData.extraMaterials as THREE.Material[]).push(mat);
        const z0=hz0+(rz1-hz0)*(i/6), z1=hz0+(rz1-hz0)*((i+1)/6);
        surfaceSheet(a,'fade-wash',z0,z1,0,f.frontW*.58,.006,0,mat); }
    }
    if(config.livery==='checker') { // flag squares on the roof span
      const cv=document.createElement('canvas'); cv.width=cv.height=128;
      const cx2=cv.getContext('2d')!; for(let y=0;y<8;y++) for(let x=0;x<8;x++) { cx2.fillStyle=(x+y)%2?'#0c0e11':'#eef2f5'; cx2.fillRect(x*16,y*16,16,16); }
      const tex=new THREE.CanvasTexture(cv); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(3,3);
      const mat=new THREE.MeshStandardMaterial({ map:tex, roughness:.5, metalness:.2 });
      (g.userData.extraMaterials as THREE.Material[]).push(mat);
      surfaceSheet(a,'checker-roof',rz0,rz1,0,f.frontW*.58,.006,0,mat,false,.040);
    }
    if(config.livery==='slash') for(const side of [-1,1]) for(let i=0;i<3;i++) {
      const blade=new THREE.Mesh(plateGeometry([[-.20,-.026],[.20,-.014],[.20,.026],[-.20,.014]],.008),accent);
      blade.name='slash-blade'; blade.rotation.set(0,Math.PI/2,-.5);
      blade.position.set(side*doorX, f.sillY+.28+i*.13, d.doorZ-.25+i*.22); a.add(blade); }
  }
  if(config.front!=='stock') {
    const a=reg('front'), track=isTrack('front'), amount=level('front'), panel=config.frontFinish==='carbon'?woven:body;
    const nose=f.frontZ-.015;
    if(bumpers) { // full replacement shell over the measured stock bumper
      const shell=new THREE.Mesh(bumperCoverGeometry(bumpers.front,false,.016,.11,f.sideX-.005),panel);
      shell.name='front-bumper'; shell.castShadow=true; a.add(shell);
    } else if(id==='golf') {
      const fascia=new THREE.Mesh(golfLowerBumper(false,amount),panel);fascia.name='front-fascia';a.add(fascia);
    } else {
      const sweep=f.character==='muscle'?.10:.23;
      const fascia=new THREE.Mesh(apron(f.frontW*THREE.MathUtils.lerp(.97,1.05,amount),nose,f.bumperY+.015,THREE.MathUtils.lerp(.10,.25,amount),.22,sweep),panel);
      fascia.name='front-fascia';a.add(fascia);
    }
    { const sweep=f.character==='muscle'?.10:.23;
      const splitter=new THREE.Mesh(taperedBand(f.frontW*THREE.MathUtils.lerp(.96,1.01,amount),nose-THREE.MathUtils.lerp(.06,.13,amount),f.bumperY-.005,THREE.MathUtils.lerp(.30,.58,amount),.028,sweep),carbon);
      splitter.name='front-splitter';a.add(splitter); }
    if(id==='mercedes') box(f.frontW*1.35,.015,.035,0,f.bumperY+.11,nose+.04,metal,a,'bright-fascia-trim');
    if(config.front==='touring') { // chrome strip follows the shell surface
      if(bumpers) { const strip=new THREE.Mesh(bumperPatchGeometry(bumpers.front,.262,.290,-f.frontW*.52,f.frontW*.52,false,.021),metal);
        strip.name='touring-chrome-strip'; a.add(strip); }
      else { const strip=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,f.frontW*1.25,16),metal);
        strip.name='touring-chrome-strip'; strip.rotation.z=Math.PI/2; strip.position.set(0,f.bumperY+.17,nose-.01); strip.scale.set(1,1,.55); a.add(strip); }
    }
    if(config.front==='rally') { // rally signature: light pod + skid plate + front mud flaps
      // Pod front face sits just proud of the measured shell, lamps in it.
      const podZ=bumpers?bumperZ(bumpers.front,0,f.bumperY+.31,false)-.004:nose-.045;
      const pod=new THREE.Mesh(plateGeometry([[-f.frontW*.52,-.055],[-f.frontW*.44,.055],[f.frontW*.44,.055],[f.frontW*.52,-.055]],.075),carbon);
      pod.name='rally-light-pod'; // shape is width x height, extruded back into the shell
      pod.position.set(0,f.bumperY+.31,podZ); a.add(pod);
      for(const lx of [-.30,-.10,.10,.30]) { const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.047,.047,.028,24),lampMat);
        lamp.name='rally-lamp'; lamp.rotation.x=Math.PI/2; lamp.position.set(lx*f.frontW*1.4,f.bumperY+.31,podZ+.004); a.add(lamp);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.049,.007,8,24),metal); ring.name='rally-lamp-ring'; ring.position.copy(lamp.position); a.add(ring); }
      const skid=box(f.frontW*1.02,.018,.26,0,f.bumperY-.04,nose+.05,metal,a,'rally-skid-plate'); skid.rotation.x=.06;
      for(const side of [-1,1]) mudflap(a,side,true);
    }
    if(config.front==='track') { // time-attack: splitter tie rods + stacked dive planes
      for(const side of [-1,1]) { const topZ=bumpers?bumperZ(bumpers.front,side*f.frontW*.52,f.bumperY+.075,false)+.004:nose+.02;
        a.add(rodBetween(new THREE.Vector3(side*f.frontW*.52,f.bumperY+.075,topZ),new THREE.Vector3(side*f.frontW*.55,f.bumperY+.008,nose-.115),.0068,metal,'splitter-rod'));
        const dive=new THREE.Mesh(plateGeometry([[0,0],[.20,.015],[.16,.075],[.02,.055]],.010),carbon); dive.name='dive-plane';
        const diveZ=bumpers?bumperZ(bumpers.front,side*f.frontW*.82,f.bumperY+.20,false)+.02:nose+.05;
        dive.position.set(side*(f.frontW*.88),f.bumperY+.20,diveZ); dive.rotation.set(-.12,side*-.5,-side*.28); a.add(dive); }
    }
    if(config.front==='wide' && config.skirts!=='wide') for(const side of [-1,1]) flare(a,side,true,panel);
    if(amount>=.8) for(const side of [-1,1]) { // GT/wide/track swept canard fins
      const canard=new THREE.Mesh(plateGeometry([[0,0],[.17,.01],[.13,.06],[.015,.045]],.009),carbon);
      canard.name='front-canard';
      const cz=bumpers?bumperZ(bumpers.front,side*f.frontW*.86,f.bumperY+.11,false)+.05:nose+(id==='golf'||id==='audi'||id==='mustang'?.10:.02);
      canard.position.set(side*(f.frontW*.90),f.bumperY+.11,cz);
      canard.rotation.set(-.06,side*-.42,-side*.20); canard.castShadow=true; a.add(canard); }
  }
  if(config.front!=='stock' && level('front')>=.67) {
    const a=g.getObjectByName('custom-front') as THREE.Group;
    if(a) { const nose=f.frontZ-.015;
      if(bumpers) { // intakes are surface patches on the shell, never floating plates
        const intake=new THREE.Mesh(bumperPatchGeometry(bumpers.front,.235,.355,-.44,.44,false,.0205),dark);
        intake.name='front-intake'; a.add(intake);
        for(const yy of [.275,.315]) { const slat=new THREE.Mesh(bumperPatchGeometry(bumpers.front,yy-.012,yy+.012,-.40,.40,false,.0235),carbon);
          slat.name='intake-slat'; a.add(slat); }
        for(const side of [-1,1]) { const corner=new THREE.Mesh(bumperPatchGeometry(bumpers.front,.24,.36, side<0?-f.frontW*.96:-f.frontW*.64, side<0?-f.frontW*.64:f.frontW*.96, false,.0205),dark);
          corner.name='front-corner-intake'; a.add(corner); }
      } else {
        const intake=box(f.frontW*1.02,.12,.025,0,f.bumperY+.09,nose-.01,dark,a,'front-intake'); intake.rotation.x=.06;
      }
      if(config.front==='wide') for(const side of [-1,1]) { const blade=new THREE.Mesh(plateGeometry([[0,-.02],[.22,-.03],[.20,.035],[0,.03]],.012),carbon);
        blade.name='bumper-blade'; blade.position.set(side*f.frontW*.92,f.bumperY+.03,nose+.06); blade.rotation.y=side*-.5; a.add(blade); }
    }
  }
  if(config.rear!=='stock') {
    const a=reg('rear'),track=isTrack('rear'),amount=level('rear'), tail=f.rearZ-.035, panel=config.rearFinish==='carbon'?woven:body;
    if(bumpers) { // full replacement shell over the measured stock bumper
      const shell=new THREE.Mesh(bumperCoverGeometry(bumpers.rear,true,.016,.11,f.sideX-.005),panel);
      shell.name='rear-bumper'; shell.castShadow=true; a.add(shell);
    }
    if(id==='golf' && !bumpers) {
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
      if(!bumpers) { const valance=new THREE.Mesh(apron(f.rearW*.98,tail,f.bumperY+.005,THREE.MathUtils.lerp(.11,.16,amount),.20,.16,true),panel);
        valance.name='rear-valance';a.add(valance); }
      // Keep the diffuser between the exhaust outlets rather than covering them.
      const diffuserWidth=.48;
      const diffuser=new THREE.Mesh(apron(f.rearW*diffuserWidth,tail+.05,f.bumperY-.005,THREE.MathUtils.lerp(.08,.13,amount),.25,.04,true),carbon);
      diffuser.name='rear-diffuser';a.add(diffuser);
      const finCount=config.rear==='wide'?7:amount<1?3:5;
            if(amount>=.67) for(let i=0;i<finCount;i++) {
        const x=(i-(finCount-1)/2)*f.rearW*diffuserWidth*1.5/Math.max(1,finCount-1);
        const fin=new THREE.Mesh(plateGeometry([[-.085,-.035],[.075,-.042],[.085,.028],[-.075,.035]],.011),carbon);
        fin.name='diffuser-fin'; fin.rotation.y=Math.PI/2; fin.position.set(x,f.bumperY-.01,tail+.01); fin.rotation.x=-.10; a.add(fin); }
    }
  }
  if(config.rear==='rally') { // rear mud flaps behind the driven wheels
    const a=g.getObjectByName('custom-rear') as THREE.Group;
    if(a) for(const side of [-1,1]) mudflap(a,side,false);
  }
  if(config.rear==='touring') {
    const a=g.getObjectByName('custom-rear') as THREE.Group;
    if(a) { if(bumpers) { const strip=new THREE.Mesh(bumperPatchGeometry(bumpers.rear,.262,.290,-f.rearW*.52,f.rearW*.52,true,.021),metal);
        strip.name='touring-chrome-strip'; a.add(strip); }
      else { const strip=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,f.rearW*1.25,16),metal);
        strip.name='touring-chrome-strip'; strip.rotation.z=Math.PI/2; strip.position.set(0,f.bumperY+.17,f.rearZ+.02); strip.scale.set(1,1,.55); a.add(strip); } }
  }
  if(config.rear==='track') {
    const a=g.getObjectByName('custom-rear') as THREE.Group;
    if(a) for(const side of [-1,1]) { const plate=new THREE.Mesh(plateGeometry([[-.15,-.07],[.15,-.085],[.13,.075],[-.13,.06]],.014),carbon);
      plate.name='diffuser-endplate'; plate.rotation.y=Math.PI/2; plate.position.set(side*f.rearW*.26,f.bumperY,f.rearZ-.14); a.add(plate); }
  }
  if(config.rear==='wide' && config.skirts!=='wide') {
    const a=g.getObjectByName('custom-rear') as THREE.Group;
    if(a) for(const side of [-1,1]) flare(a,side,false,config.rearFinish==='carbon'?woven:body);
  }
  if(config.rear!=='stock' && level('rear')>=.67) {
    const a=g.getObjectByName('custom-rear') as THREE.Group;
    if(a) { const tail=f.rearZ-.035;
      if(bumpers) {
        const surround=new THREE.Mesh(bumperPatchGeometry(bumpers.rear,.215,.345,-.60,.60,true,.0205),carbon);
        surround.name='exhaust-surround'; a.add(surround);
        for(const side of [-1,1]) { const vent=new THREE.Mesh(bumperPatchGeometry(bumpers.rear,.25,.37, side<0?-f.rearW*.94:-f.rearW*.62, side<0?-f.rearW*.62:f.rearW*.94, true,.0205),dark);
          vent.name='rear-corner-vent'; a.add(vent); }
      } else {
        const surround=box(f.rearW*.86,.17,.02,0,f.tipY+.08,tail+.035,carbon,a,'exhaust-surround'); surround.rotation.x=-.05;
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
      if(config.skirts==='wide') { flare(a,side,true,panel); flare(a,side,false,panel); }
    }
  }
  if(config.spoiler!=='stock') {
    const a=reg('spoiler'),track=isTrack('spoiler'),amount=level('spoiler'),panel=config.spoilerFinish==='carbon'?woven:body;
    const roof=f.character==='compact'||f.character==='wagon';
    if(roof && (config.spoiler==='gt'||config.spoiler==='track')) { // hatch GT wing on pedestals
      const h=config.spoiler==='track'?.20:.15, chord=config.spoiler==='track'?.26:.22, w=f.spoilerW*1.02;
      for(const side of [-1,1]) { const support=new THREE.Mesh(wingSupport(side*f.spoilerW*.55,f.spoilerY,f.spoilerZ-.02,h),panel);
        support.name='wing-pedestal'; a.add(support); }
      const blade=new THREE.Mesh(wingProfile(w,f.spoilerZ,f.spoilerY+h,chord),panel); blade.name='roof-gt-wing'; a.add(blade);
      for(const side of [-1,1]) { const end=new THREE.Mesh(plateGeometry([[-chord*.48,-.05],[chord*.46,-.06],[chord*.40,.055],[-chord*.42,.06]],.013),carbon);
        end.name='wing-endplate'; end.rotation.y=Math.PI/2; end.position.set(side*(w-.012),f.spoilerY+h+.008,f.spoilerZ-.05); a.add(end); }
    } else if(roof) {
      const lip=new THREE.Mesh(id==='audi'?audiRoofExtension(amount):id==='golf'?golfRoofExtension(amount):roofExtension(f.spoilerW,f.spoilerZ,f.spoilerY,track),panel);
      lip.name='roof-extension';a.add(lip);
      if(amount>=.5) for(const side of [-1,1]) { const fin=new THREE.Mesh(plateGeometry([[-.09,-.005],[.09,-.01],[.07,.028],[-.07,.022]],.011),panel);
        fin.name='roof-spoiler-fin'; fin.rotation.y=Math.PI/2; fin.position.set(side*f.spoilerW*.90,f.spoilerY-.002,f.spoilerZ+.02); a.add(fin); }
    } else if(config.spoiler==='wide') { // Liberty Walk ducktail, not a wing
      const lip=new THREE.Mesh(deckLip(f,id,1),panel); lip.name='ducktail'; a.add(lip);
    } else if(amount>=.67 || config.spoiler==='rally') {
      const h=(f.character==='luxury'?.13:f.character==='classic'?.19:.23)*(config.spoiler==='rally'?.62:config.spoiler==='sport'?.72:1);
      const chord=(f.character==='luxury'?.24:.34)*(track?1:.8);
      const wingWidth=(id==='ferrari'?.68:id==='r8'?.70:id==='challenger'?.70:id==='mustang'?.64:.63)*(track?1:.9);
      for(const side of [-1,1]) {
        const support=new THREE.Mesh(wingSupport(side*f.spoilerW*.62,f.spoilerY,f.spoilerZ-.015,h),panel);
        support.name='wing-pedestal';a.add(support);
      }
      const blade=new THREE.Mesh(wingProfile(wingWidth,f.spoilerZ,f.spoilerY+h,chord),panel);blade.name='wing-blade';a.add(blade);
      if(track && f.character!=='luxury') for(const side of [-1,1]) {
        const end=new THREE.Mesh(plateGeometry([[-chord*.48,-.045],[chord*.46,-.055],[chord*.40,.05],[-chord*.42,.055]],.013),carbon);
        end.name='wing-endplate'; end.rotation.y=Math.PI/2; end.position.set(side*(wingWidth-.012),f.spoilerY+h+.008,f.spoilerZ-.05); end.rotation.x=-.06; a.add(end);
      }
    } else {
      const lip=new THREE.Mesh(deckLip(f,id,amount),panel);lip.name='deck-lip';a.add(lip);
    }
  }
  if(config.exhaust!=='stock') {
    const a=reg('exhaust'),track=isTrack('exhaust'), amount=level('exhaust'), finish=config.exhaustFinish==='carbon'?woven:metal;
    const oval=f.character==='luxury'||f.character==='wagon'||f.character==='midengine';
    const tipMetal=config.exhaust==='titanium'?burnt:finish;
    // One mouth position is shared by the pipe and flame. The measured rear
    // offsets place the rim just beyond the stock bumper, not inside it.
    const z=id==='mustang' ? 2.240 : id==='ferrari' ? 1.948 : f.rearZ-.06, mouthZ=z+.054, y=id==='mustang' ? .401 : id==='ferrari' ? .334 : f.tipY+.08;
    // Seat every outlet on the measured rear surface: mouth target is the
    // stock surface (+ the shell skin when a rear bumper is fitted), so tips
    // can never end up buried inside the bumper shell.
    const shellSurf=(x:number)=>bumpers?bumperZ(bumpers.rear,x,y,true)-.016:undefined;
    const tipZ=(x:number)=>{ const sz=shellSurf(x); if(sz===undefined) return z;
      return sz + (config.rear!=='stock' ? .036 : .02) - .054; };
    const mouthAt=(x:number)=>{ const sz=shellSurf(x); return sz===undefined?mouthZ:sz+(config.rear!=='stock'?.036:.02); };
    // The exact same outlet descriptions drive rims and flame origins.
    const ferrariFactoryFlame=id==='ferrari' && config.exhaust==='flame';
    const mustangFactoryFlame=id==='mustang' && config.exhaust==='flame';
    const centers=config.exhaust==='quadflame' ? [-f.tipX-f.tipSpacing*.55,-f.tipX+f.tipSpacing*.55,f.tipX-f.tipSpacing*.55,f.tipX+f.tipSpacing*.55] : mustangFactoryFlame ? [-.598,-.515,.526,.609] : id==='ferrari' ? [-.061,.048,.150] : id==='golf'
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
    } else for(const x of centers) tip(a,x,y,tipZ(x),radius,tipMetal,dark,!track && (config.exhaust==='touring'||oval) && id!=='golf' && config.exhaust!=='sport');
    if (config.exhaust==='flame'||config.exhaust==='quadflame') {
      const flames=new THREE.Group(); flames.name='exhaust-flames';
      const flameMaterials:THREE.ShaderMaterial[]=[];
      for (const [i,x] of centers.entries()) {
        const jet=new THREE.Group(); jet.position.set(x,ferrariFactoryFlame ? .334 : y, ferrariFactoryFlame ? mouthAt(x) : mouthAt(x));
        // Three intersecting, soft turbulent sheets make a tapered jet rather
        // than a glowing sphere. Geometry starts exactly at the real pipe mouth.
        const length=.34, jetRadius=radius*1.18;
        const mat=new THREE.ShaderMaterial({
          uniforms:{uTime:{value:0},uSeed:{value:i*7.31}},
          transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`uniform float uTime,uSeed;varying vec2 vUv;
            float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
            float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
            void main(){float t=vUv.y;float x=abs(vUv.x-.5)*2.0;
              float n=noise(vec2(vUv.x*4.0+uSeed,t*7.0-uTime*5.5));
              float ripple=noise(vec2(vUv.x*8.0-uTime*1.5,t*15.0-uTime*9.0+uSeed));
              float taper=mix(.85,.06,pow(t,.72))*(.75+.38*n);
              float edge=1.0-smoothstep(taper*.55,taper,x);
              float tail=1.0-smoothstep(.65,1.0,t+.11*(ripple-.5));
              float core=1.0-smoothstep(.0,taper*.62,x);
              vec3 blue=vec3(.13,.36,1.0), hot=vec3(1.0,.78,.42), orange=vec3(1.0,.20,.015);
              vec3 col=mix(blue,hot,smoothstep(.02,.22,t));col=mix(col,orange,smoothstep(.25,.85,t)*(1.0-core*.45));
              gl_FragColor=vec4(col,edge*tail*(.22+.30*core)*(.72+.28*ripple));
            }`,
        });
        for (const angle of [0,Math.PI/3,-Math.PI/3]) {
          const geo=new THREE.PlaneGeometry(jetRadius*2,length,1,1);geo.translate(0,length/2,0);geo.rotateX(Math.PI/2);geo.rotateZ(angle);
          const sheet=new THREE.Mesh(geo,mat);sheet.name='flame-volume';sheet.frustumCulled=false;jet.add(sheet);
        }
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
  g.userData.ownedMaterials=[body,carbon,woven,metal,dark,burnt,lampMat,rubber,...(g.userData.extraMaterials||[])];
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
    const flicker=.55+.45*(.5+.5*Math.sin(time*19+i*2.7)*Math.sin(time*7.7+i));
    jet.scale.set(.8+flicker*.2,.8+flicker*.2,flicker);
  });
}
