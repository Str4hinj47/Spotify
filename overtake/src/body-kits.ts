import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';
import { createCarbonMaterial } from './livery';
import sillProfiles from './sill-profiles.json';
import { golfExhaustLayout } from './golf-exhaust.mjs';

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
export const BODY_FITS: Partial<Record<CarId, Fit>> = {
  bugatti: { frontZ:-2.16,rearZ:2.17,frontW:.84,rearW:.87,sideX:.95,sillFront:-.90,sillRear:.87,sillY:.20,bumperY:.17,spoilerZ:1.88,spoilerY:.89,spoilerW:.62,tipX:.48,tipY:.24,tipRadius:.07,tipSpacing:.12,character:'midengine',labels:{front:['Road blade','Circuit splitter'],rear:['Road valance','Circuit diffuser'],skirts:['Road sills','Circuit blades'],spoiler:['Deck lip','Circuit wing'],exhaust:['Sport outlets','Quad race']} },
  'bmw-m3': { frontZ:-2.23,rearZ:2.25,frontW:.80,rearW:.83,sideX:.89,sillFront:-.95,sillRear:.90,sillY:.22,bumperY:.17,spoilerZ:1.98,spoilerY:.91,spoilerW:.67,tipX:.52,tipY:.21,tipRadius:.065,tipSpacing:.13,character:'muscle',labels:{front:['GT lip','Race splitter'],rear:['GT valance','Race diffuser'],skirts:['GT sills','Race blades'],spoiler:['Deck lip','GT wing'],exhaust:['Twin outlets','Quad race']} },
  skyline: { frontZ:-2.27,rearZ:2.27,frontW:.83,rearW:.85,sideX:.89,sillFront:-.98,sillRear:.88,sillY:.22,bumperY:.19,spoilerZ:2.04,spoilerY:1.02,spoilerW:.65,tipX:.55,tipY:.25,tipRadius:.065,tipSpacing:.12,character:'classic',labels:{front:['Street lip','Touring splitter'],rear:['Street valance','Touring diffuser'],skirts:['Street sills','Track blades'],spoiler:['Deck lip','Touring wing'],exhaust:['Sport outlets','Quad race']} },
  aventador: { frontZ:-2.27,rearZ:2.27,frontW:.84,rearW:.87,sideX:.95,sillFront:-.85,sillRear:.96,sillY:.22,bumperY:.18,spoilerZ:1.90,spoilerY:.87,spoilerW:.63,tipX:.47,tipY:.25,tipRadius:.07,tipSpacing:.12,character:'midengine',labels:{front:['Road blade','Circuit splitter'],rear:['Road valance','Circuit diffuser'],skirts:['Road sills','Circuit blades'],spoiler:['Deck lip','Circuit wing'],exhaust:['Sport outlets','Quad race']} },
  'aventador-game': { frontZ:-2.28,rearZ:2.28,frontW:.85,rearW:.87,sideX:.95,sillFront:-.86,sillRear:.96,sillY:.22,bumperY:.18,spoilerZ:1.92,spoilerY:.83,spoilerW:.63,tipX:.47,tipY:.25,tipRadius:.07,tipSpacing:.12,character:'midengine',labels:{front:['Road blade','Circuit splitter'],rear:['Road valance','Circuit diffuser'],skirts:['Road sills','Circuit blades'],spoiler:['Deck lip','Circuit wing'],exhaust:['Sport outlets','Quad race']} },
  golf: { frontZ:-2.02,rearZ:2.04,frontW:.77,rearW:.80,sideX:.82,sillFront:-.84,sillRear:.90,sillY:.22,bumperY:.21,spoilerZ:1.61,spoilerY:1.38,spoilerW:.61,tipX:.52,tipY:.21,tipRadius:.055,tipSpacing:.10,character:'compact', labels:{front:['GT lip','Cup splitter'],rear:['Clean valance','Cup diffuser'],skirts:['GT sills','Cup blades'],spoiler:['Roof lip','Cup roof wing'],exhaust:['Twin round','Cup twin']} },
  mercedes: { frontZ:-2.58,rearZ:2.58,frontW:.91,rearW:.88,sideX:.94,sillFront:-1.17,sillRear:1.18,sillY:.19,bumperY:.20,spoilerZ:2.23,spoilerY:1.07,spoilerW:.67,tipX:.62,tipY:.22,tipRadius:.072,tipSpacing:.13,character:'luxury', labels:{front:['Executive lip','Aero splitter'],rear:['Sport valance','Aero diffuser'],skirts:['Executive sills','Aero blades'],spoiler:['Deck lip','Touring wing'],exhaust:['Polished oval','Quad sport']} },
  audi: { frontZ:-2.43,rearZ:2.46,frontW:.93,rearW:.92,sideX:.95,sillFront:-1.10,sillRear:1.08,sillY:.19,bumperY:.20,spoilerZ:1.81,spoilerY:1.39,spoilerW:.70,tipX:.62,tipY:.22,tipRadius:.075,tipSpacing:.13,character:'wagon', labels:{front:['Touring lip','Performance splitter'],rear:['Touring valance','Sport diffuser'],skirts:['Touring sills','Extended blades'],spoiler:['Tailgate lip','Touring roof wing'],exhaust:['Oval outlets','Quad outlets']} },
  mustang: { frontZ:-2.27,rearZ:2.31,frontW:.83,rearW:.82,sideX:.86,sillFront:-.95,sillRear:1.08,sillY:.20,bumperY:.21,spoilerZ:2.12,spoilerY:.958,spoilerW:.69,tipX:.58,tipY:.23,tipRadius:.065,tipSpacing:.12,character:'classic', labels:{front:['Heritage chin','Race chin'],rear:['Heritage valance','Race diffuser'],skirts:['Rocker trim','Race rockers'],spoiler:['Ducktail','Pedestal wing'],exhaust:['Dual round','Side-by-side quad']} },
  ferrari: { frontZ:-2.03,rearZ:2.00,frontW:.74,rearW:.86,sideX:.91,sillFront:-.90,sillRear:.86,sillY:.16,bumperY:.17,spoilerZ:1.80,spoilerY:.84,spoilerW:.53,tipX:.54,tipY:.24,tipRadius:.055,tipSpacing:.10,character:'supercar', labels:{front:['Road blade','Circuit splitter'],rear:['Road diffuser','Circuit diffuser'],skirts:['Road blades','Circuit skirts'],spoiler:['Low deck lip','Circuit wing'],exhaust:['Center round','Center race']} },
  r8: { frontZ:-2.17,rearZ:2.18,frontW:.86,rearW:.91,sideX:.94,sillFront:-.88,sillRear:.93,sillY:.17,bumperY:.19,spoilerZ:1.90,spoilerY:.84,spoilerW:.62,tipX:.65,tipY:.22,tipRadius:.07,tipSpacing:.12,character:'midengine', labels:{front:['Road splitter','GT splitter'],rear:['Road diffuser','GT diffuser'],skirts:['Road blades','GT skirts'],spoiler:['Deck lip','GT wing'],exhaust:['Twin oval','Quad titanium']} },
  challenger: { frontZ:-2.47,rearZ:2.47,frontW:.91,rearW:.89,sideX:.96,sillFront:-1.02,sillRear:1.07,sillY:.22,bumperY:.22,spoilerZ:2.22,spoilerY:1.065,spoilerW:.72,tipX:.61,tipY:.23,tipRadius:.07,tipSpacing:.13,character:'muscle', labels:{front:['Street chin','Wide splitter'],rear:['Street valance','Wide diffuser'],skirts:['Street rockers','Wide rockers'],spoiler:['Ducktail','Drag wing'],exhaust:['Dual round','Quad muscle']} },
};

// Dense lofts use gently rounded cross-section edges. The measured outer
// envelope is retained, so parts continue to fit the same car and wheel wells.
type Point3 = [number,number,number];
const LOFT_SEGMENTS = 96;
const CORNER_STEPS = 4;
function roundedRing(points:Point3[], bevel=.14):Point3[] {
  const ring:Point3[]=[];
  for(let i=0;i<points.length;i++) {
    const prev=points[(i+points.length-1)%points.length], cur=points[i], next=points[(i+1)%points.length];
    const a=cur.map((v,k)=>THREE.MathUtils.lerp(v,prev[k],bevel));
    const b=cur.map((v,k)=>THREE.MathUtils.lerp(v,next[k],bevel));
    for(let j=0;j<=CORNER_STEPS;j++) {
      const t=j/CORNER_STEPS,u=1-t;
      ring.push([u*u*a[0]+2*u*t*cur[0]+t*t*b[0],u*u*a[1]+2*u*t*cur[1]+t*t*b[1],u*u*a[2]+2*u*t*cur[2]+t*t*b[2]]);
    }
  }
  return ring;
}
function loft(sections:Point3[][], reverse=false, bevel=.14) {
  const rings=sections.map(s=>roundedRing(s,bevel)), positions:number[]=[], indices:number[]=[];
  const size=rings[0].length;
  for(const ring of rings) for(const p of ring) positions.push(...p);
  for(let i=0;i<rings.length-1;i++) for(let j=0;j<size;j++) {
    const a=i*size+j,b=i*size+(j+1)%size,c=(i+1)*size+j,d=(i+1)*size+(j+1)%size;
    if(reverse)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
  }
  // Dedicated cap vertices preserve a clean edge rather than averaging the
  // cap's normals into the visible body surface.
  for(const [end,flip] of [[0,true],[rings.length-1,false]] as const) {
    const ring=rings[end], base=positions.length/3;
    const center:Point3=[0,0,0];for(const p of ring){center[0]+=p[0]/size;center[1]+=p[1]/size;center[2]+=p[2]/size;}
    positions.push(...center);for(const p of ring)positions.push(...p);
    for(let j=0;j<size;j++) {
      const a=base,b=base+1+j,c=base+1+(j+1)%size;
      if(flip !== reverse)indices.push(a,c,b);else indices.push(a,b,c);
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Shape-preserving interpolation through measured points: smooth without
// overshooting the body or widening the wheel-to-wheel sill range.
function sampleProfile(xs:readonly number[], ys:readonly number[], x:number, flatStart=false) {
  const n=xs.length;let i=0;while(i<n-2 && x>xs[i+1])i++;
  const slope=(j:number)=>{
    if(j===0)return flatStart?0:(ys[1]-ys[0])/(xs[1]-xs[0]);
    if(j===n-1)return (ys[j]-ys[j-1])/(xs[j]-xs[j-1]);
    const h0=xs[j]-xs[j-1],h1=xs[j+1]-xs[j],d0=(ys[j]-ys[j-1])/h0,d1=(ys[j+1]-ys[j])/h1;
    if(d0*d1<=0)return 0;
    const w0=2*h1+h0,w1=h1+2*h0;
    return (w0+w1)/(w0/d0+w1/d1);
  };
  const h=xs[i+1]-xs[i],t=THREE.MathUtils.clamp((x-xs[i])/h,0,1),t2=t*t,t3=t2*t;
  const v=(2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*slope(i)+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*slope(i+1);
  return THREE.MathUtils.clamp(v,Math.min(ys[i],ys[i+1]),Math.max(ys[i],ys[i+1]));
}
function sampleSill(samples:readonly number[], t:number) {
  const xs=samples.map((_,i)=>i/(samples.length-1));return sampleProfile(xs,samples,t);
}

function taperedBand(width:number, frontZ:number, y:number, depth:number, height:number, sweep:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=i/LOFT_SEGMENTS*2-1,x=t*width,z=frontZ+sweep*t*t;
    sections.push([[x,y,z],[x,y+height,z+depth*.35],[x,y+height,z+depth],[x,y,z+depth]]);
  }
  return loft(sections);
}
function apron(width:number,z:number,y:number,height:number,depth:number,sweep:number,rear=false) {
  const sections:Point3[][]=[],sign=rear?-1:1;
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,x=t*width,face=z+sign*sweep*edge,rise=.018*edge;
    sections.push([[x,y+rise,face-sign*.035],[x,y+height+rise,face+sign*.075],[x,y+height+rise,face+sign*(depth+.18*edge)],[x,y+rise,face+sign*(depth+.18*edge)]]);
  }
  return loft(sections);
}
function roofExtension(width:number,z:number,y:number,track:boolean) {
  const sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,x=t*width,crown=y-.065*edge,sweep=-.09*edge;
    const back=z+(track?.18:.11)+sweep,front=z-.16+sweep*.35;
    sections.push([[x,crown,front],[x,crown+(track?.075:.045),back],[x,crown+(track?.052:.025),back],[x,crown-.025,front]]);
  }
  return loft(sections);
}
function audiRoofExtension(level:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,x=t*.53,front=1.62+.03*edge,back=1.88-.13*edge;
    const frontY=1.415-.055*edge,rearY=1.383-.043*edge,rise=THREE.MathUtils.lerp(.025,.055,level);
    sections.push([[x,frontY-.012,front],[x,frontY+.006,front],[x,rearY+rise,back],[x,rearY+rise-.018,back]]);
  }
  return loft(sections);
}
function golfRoofExtension(level:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,x=t*.51,front=1.40+.015*edge,back=1.65-.07*edge;
    const frontY=1.401-.045*edge,rearY=1.375-.045*edge,rise=THREE.MathUtils.lerp(.022,.050,level);
    sections.push([[x,frontY-.012,front],[x,frontY+.004,front],[x,rearY+rise,back],[x,rearY+rise-.016,back]]);
  }
  return loft(sections);
}
function audiFrontLip(level:number) {
  const xs=[0,.2,.4,.55,.65,.75,.8,.85],zs=[-2.486,-2.479,-2.466,-2.424,-2.343,-2.285,-2.251,-2.191],sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const x=(2*i/LOFT_SEGMENTS-1)*.84,abs=Math.abs(x),z=sampleProfile(xs,zs,abs,true);
    const edge=abs/.84,lead=THREE.MathUtils.lerp(.02,.055,level)*(1-.3*edge);
    sections.push([[x,.211,z+.045],[x,.195,z-lead],[x,.182,z-lead],[x,.183,z+.10]]);
  }
  return loft(sections);
}
function importedFrontLip(id:CarId,level:number) {
  const profiles:Partial<Record<CarId,{y:number,z:number[]}>>={
    bugatti:{y:.15,z:[-2.267,-2.256,-2.212,-2.125,-2.095,-2.073,-2.056,-2.003,-1.915]},
    'bmw-m3':{y:.28,z:[-2.161,-2.156,-2.147,-2.133,-2.103,-2.055,-2.006,-1.954,-1.890]},
    skyline:{y:.23,z:[-2.251,-2.249,-2.243,-2.230,-2.206,-2.172,-2.133,-2.091,-2.005]},
    aventador:{y:.28,z:[-2.289,-2.268,-2.239,-2.195,-2.175,-2.150,-2.100,-2.050,-1.916]},
    'aventador-game':{y:.28,z:[-2.322,-2.293,-2.261,-2.227,-2.154,-2.080,-2.034,-1.980,-1.982]},
  };
  const profile=profiles[id]!,xs=profile.z.map((_,i)=>i/10),sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const x=(2*i/LOFT_SEGMENTS-1)*.79,z=sampleProfile(xs,profile.z,Math.abs(x),true),lead=THREE.MathUtils.lerp(.012,.045,level),y=profile.y;
    sections.push([[x,y+.008,z+.05],[x,y-.012,z-lead],[x,y-.025,z-lead],[x,y-.025,z+.12]]);
  }
  return loft(sections);
}
function mustangChin(level:number) {
  const xs=[0,.2,.4,.55,.65,.75],zs=[-2.324,-2.311,-2.289,-2.231,-2.148,-2.067],sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const x=(i/LOFT_SEGMENTS*2-1)*.75,abs=Math.abs(x),z=sampleProfile(xs,zs,abs,true),y=.305+.026*Math.pow(abs/.75,2);
    sections.push([[x,y+.012,z+.035],[x,y-.054,z-THREE.MathUtils.lerp(.02,.045,level)],[x,y-.065,z+.08],[x,y-.028,z+.13]]);
  }
  return loft(sections);
}
function skirtShell(id:CarId,side:number,level:number) {
  const fit=sillProfiles[id as keyof typeof sillProfiles],samples=fit.sides[side<0?0:1],sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=i/LOFT_SEGMENTS,taper=Math.pow(Math.sin(Math.PI*t),.6),z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t);
    const rearFlare=(id==='ferrari'||id==='r8')?Math.pow(t,3)*.035*taper:id==='audi'?Math.pow(t,2)*.015*taper:0;
    const sample=sampleSill(samples[0],t),top=sampleSill(samples[1],t)+.005,mid=sample+.004+THREE.MathUtils.lerp(.014,.025,level)*taper+rearFlare*.45;
    const low=sample-.025+THREE.MathUtils.lerp(.028,.045,level)*taper+rearFlare;
    sections.push([[side*top,.38,z],[side*mid,.30,z],[side*low,.22,z],[side*(sample-.045),.205,z],[side*(sample-.045),.37,z]]);
  }
  return loft(sections,side>0);
}
function skirtBlade(id:CarId,side:number,level:number) {
  const fit=sillProfiles[id as keyof typeof sillProfiles],samples=fit.sides[side<0?0:1][0],sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=i/LOFT_SEGMENTS,taper=Math.pow(Math.sin(Math.PI*t),.7),z=THREE.MathUtils.lerp(fit.range[0],fit.range[1],t),x=sampleSill(samples,t);
    const outer=x+THREE.MathUtils.lerp(.055,.085,level)*taper;
    sections.push([[side*(x-.04),.215,z],[side*outer,.205,z],[side*outer,.188,z],[side*(x-.04),.198,z]]);
  }
  return loft(sections,side>0);
}
// A radial shell around the outside of the Golf's wheel opening. The inner
// edge clears the tire; the outer edge projects outward as a wide fender flare.
function golfArch(side:number, z:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=64;i++) {
    const angle=-.40+(Math.PI+.80)*i/64, c=Math.cos(angle), sn=Math.sin(angle);
    sections.push([[side*.82,.315+sn*.365,z+c*.365],[side*1.025,.315+sn*.365,z+c*.365],
      [side*1.025,.315+sn*.445,z+c*.445],[side*.82,.315+sn*.445,z+c*.445]]);
  }
  return loft(sections,side>0,.06);
}
function golfWideBlade(side:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=64;i++) {
    const t=i/64,z=THREE.MathUtils.lerp(-.80,.98,t),taper=Math.pow(Math.sin(Math.PI*t),.35),outer=.87+.20*taper;
    sections.push([[side*.76,.22,z],[side*outer,.19,z],[side*outer,.105,z],[side*.76,.105,z]]);
  }
  return loft(sections,side>0,.10);
}
function golfSkirtSpike(side:number,z:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=12;i++) {
    const t=i/12,x=side*(1.045+.18*t),half=.075*(1-t)+.004;
    sections.push([[x,.105,z-half],[x,.15,z-half],[x,.15,z+half],[x,.105,z+half]]);
  }
  return loft(sections,side>0,.10);
}
// Mercedes W222: the long rocker and 0.342m wheels differ from the Golf.
function mercedesWideBlade(side:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=64;i++){const t=i/64,z=THREE.MathUtils.lerp(-1.33,1.02,t),taper=Math.pow(Math.sin(Math.PI*t),.4),outer=.94+.18*taper;
    sections.push([[side*.89,.20,z],[side*outer,.18,z],[side*outer,.105,z],[side*.89,.105,z]]);}
  return loft(sections,side>0,.10);
}
function mercedesArch(side:number,z:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=64;i++){const a=-.35+(Math.PI+.70)*i/64,c=Math.cos(a),s=Math.sin(a);
    sections.push([[side*.94,.342+s*.39,z+c*.39],[side*1.10,.342+s*.39,z+c*.39],[side*1.10,.342+s*.46,z+c*.46],[side*.94,.342+s*.46,z+c*.46]]);}
  return loft(sections,side>0,.06);
}
function mercedesSpike(side:number,z:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=12;i++){const t=i/12,x=side*(1.10+.15*t),half=.065*(1-t)+.004;sections.push([[x,.105,z-half],[x,.15,z-half],[x,.15,z+half],[x,.105,z+half]]);}
  return loft(sections,side>0,.10);
}
// C7 Avant: wider wheels and a shorter sill than the W222.
function audiWideBlade(side:number) {
 const sections:Point3[][]=[];
 for(let i=0;i<=64;i++){const t=i/64,z=THREE.MathUtils.lerp(-1.10,.96,t),outer=.96+.17*Math.pow(Math.sin(Math.PI*t),.4);sections.push([[side*.90,.20,z],[side*outer,.18,z],[side*outer,.105,z],[side*.90,.105,z]]);}
 return loft(sections,side>0,.1);
}
function audiArch(side:number,z:number) {
 const sections:Point3[][]=[];
 for(let i=0;i<=64;i++){const a=-.35+(Math.PI+.70)*i/64,c=Math.cos(a),s=Math.sin(a);sections.push([[side*.97,.368+s*.42,z+c*.42],[side*1.13,.368+s*.42,z+c*.42],[side*1.13,.368+s*.49,z+c*.49],[side*.97,.368+s*.49,z+c*.49]]);}
 return loft(sections,side>0,.06);
}
function audiSpike(side:number,z:number) {
 const sections:Point3[][]=[];
 for(let i=0;i<=12;i++){const t=i/12,x=side*(1.11+.15*t),half=.065*(1-t)+.004;sections.push([[x,.105,z-half],[x,.15,z-half],[x,.15,z+half],[x,.105,z+half]]);}
 return loft(sections,side>0,.1);
}
function supportRod(a:THREE.Vector3,b:THREE.Vector3,mat:THREE.Material,group:THREE.Group) {
  const delta=b.clone().sub(a),rod=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,delta.length(),10),mat);
  rod.name='splitter-support';rod.position.copy(a).add(b).multiplyScalar(.5);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(rod);
}

function deckLip(f:Fit,id:CarId,level:number) {
  const sections:Point3[][]=[],drop=id==='mercedes'?.045:id==='r8'?.055:id==='ferrari'?.025:.012;
  const rise=(id==='mercedes'?.055:id==='ferrari'?.075:.085)*(1+level*.35);
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,taper=Math.pow(Math.max(0,1-Math.pow(Math.abs(t),5)),.5);
    const x=t*f.spoilerW,y=f.spoilerY-drop*edge,front=f.spoilerZ-.14-.025*edge,back=f.spoilerZ+.13-.10*edge;
    sections.push([[x,y-.018,front],[x,y+.018*taper,f.spoilerZ],[x,y+rise*taper,back],[x,y+(rise-.025)*taper-.01,back],[x,y-.03,front]]);
  }
  return loft(sections);
}
function wingProfile(width:number,z:number,y:number,chord:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=LOFT_SEGMENTS;i++) {
    const t=2*i/LOFT_SEGMENTS-1,edge=t*t,x=t*width,shift=-.075*edge,c=chord*(1-.14*Math.pow(Math.abs(t),4));
    sections.push([[x,y-.008,z-c*.52+shift],[x,y+.024,z-c*.30+shift],[x,y+.035,z+shift],[x,y+.017,z+c*.49+shift],[x,y-.008,z+c*.50+shift],[x,y-.012,z-c*.30+shift]]);
  }
  return loft(sections,false,.22);
}
function wingSupport(x:number,y:number,z:number,height:number,lean=0) {
  const sections:Point3[][]=[];
  for(let i=0;i<=12;i++) {
    const dx=THREE.MathUtils.lerp(-.027,.027,i/12);
    sections.push([[x+dx,y-.035,z-.13],[x+dx,y-.035,z+.10],[x+dx,y+height,z+.045+lean],[x+dx,y+height,z-.055+lean]]);
  }
  return loft(sections,false,.10);
}
function box(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,group:THREE.Group,name:string) {
  const radius=Math.min(w,h,d)*.2;
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,radius),mat);mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=true;group.add(mesh);return mesh;
}
function tip(group:THREE.Group,x:number,y:number,z:number,radius:number,metal:THREE.Material,dark:THREE.Material,oval=false) {
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.10,48,1,true),metal);
  pipe.name='exhaust-pipe';pipe.rotation.x=Math.PI/2;pipe.position.set(x,y,z);if(oval)pipe.scale.x=1.35;group.add(pipe);
  const hole=new THREE.Mesh(new THREE.CircleGeometry(radius*.77,48),dark);hole.position.set(x,y,z+.052);if(oval)hole.scale.x=1.35;group.add(hole);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.90,radius*.10,12,48),metal);ring.name='exhaust-mouth';ring.position.set(x,y,z+.054);if(oval)ring.scale.x=1.35;group.add(ring);
}

// Hood and roof anchor points sampled from each model's paint surfaces in
// normalized car space. Accessories are small surface-mounted pieces, not
// replacement boxes that obscure the vehicle or its windshield.
const TOP_FITS:Record<CarId,{hoodZ:number;hoodY:number;hoodSlope:number;roofZ:number;roofY:number;roofSlope:number}> = {
  bugatti:{hoodZ:-1.53,hoodY:.812,hoodSlope:.13,roofZ:.1,roofY:1.14,roofSlope:0},
  golf:{hoodZ:-1.60,hoodY:.849,hoodSlope:.24,roofZ:.4,roofY:1.424,roofSlope:.02},
  mercedes:{hoodZ:-1.60,hoodY:.977,hoodSlope:.12,roofZ:.3,roofY:1.481,roofSlope:0},
  audi:{hoodZ:-1.60,hoodY:.952,hoodSlope:.12,roofZ:.4,roofY:1.463,roofSlope:.02},
  mustang:{hoodZ:-1.65,hoodY:.955,hoodSlope:.10,roofZ:.2,roofY:1.335,roofSlope:0},
  ferrari:{hoodZ:-1.60,hoodY:.666,hoodSlope:.31,roofZ:.1,roofY:1.115,roofSlope:0},
  r8:{hoodZ:-1.65,hoodY:.735,hoodSlope:.22,roofZ:.1,roofY:1.202,roofSlope:0},
  challenger:{hoodZ:-1.65,hoodY:1.083,hoodSlope:.04,roofZ:.35,roofY:1.473,roofSlope:.01},
  'bmw-m3':{hoodZ:-1.65,hoodY:.736,hoodSlope:.24,roofZ:.35,roofY:1.228,roofSlope:.02},
  skyline:{hoodZ:-1.60,hoodY:.866,hoodSlope:.16,roofZ:.3,roofY:1.303,roofSlope:0},
  aventador:{hoodZ:-1.73,hoodY:.72,hoodSlope:.27,roofZ:.2,roofY:1.15,roofSlope:0},
  'aventador-game':{hoodZ:-1.73,hoodY:.73,hoodSlope:.22,roofZ:.2,roofY:1.137,roofSlope:0},
};
// Closed wedge with a tapered, angled top and an embedded base.
function aeroWedge(width:number,length:number,height:number) {
  const sections:Point3[][]=[];
  for(let i=0;i<=48;i++) {
    const t=i/48,z=THREE.MathUtils.lerp(-length/2,length/2,t),x=width/2;
    const rise=.012+(height-.012)*(t*t*(3-2*t));
    const topX=x*THREE.MathUtils.lerp(.62,.75,t);
    // Winding matches the original wedge, with a curved upper surface.
    sections.push([[-x,-.012,z],[x,-.012,z],[topX,rise,z],[-topX,rise,z]]);
  }
  return loft(sections,false,.16);
}

let sharedFlameTexture:THREE.Texture | undefined;
function flameTexture() {
  if(!sharedFlameTexture) {sharedFlameTexture=new THREE.TextureLoader().load(`${(import.meta as any).env?.BASE_URL ?? '/'}textures/effects/kenney-flame.png`);sharedFlameTexture.colorSpace=THREE.SRGBColorSpace;}
  return sharedFlameTexture;
}

/** A player-only kit. All geometries/materials are owned by the returned group. */
export function createBodyKit(id:CarId, config:Customization, paint:number) {
  const f=BODY_FITS[id], g=new THREE.Group(); g.name='custom-body-kit';
  if (!f) return g;
  const body=new THREE.MeshPhysicalMaterial({ color:paint, metalness:.45,roughness:.34,clearcoat:.42,clearcoatRoughness:.22 });
  const carbon=new THREE.MeshStandardMaterial({ color:0x10171c,metalness:.35,roughness:.44 });
  const woven=createCarbonMaterial();
  const metal=new THREE.MeshStandardMaterial({ color:0xb6c7cf,metalness:.9,roughness:.22 });
  const dark=new THREE.MeshBasicMaterial({ color:0x090d10, side:THREE.DoubleSide });
  const reg=(part:string)=>{const partGroup=new THREE.Group();partGroup.name=`custom-${part}`;g.add(partGroup);return partGroup;};
  const level=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>({stock:0,street:0,touring:.34,sport:.67,track:1,flame:1,'golf-r32':.67,'golf-clean':.34,'golf-diffuser':1,'golf-wide':1,'golf-splitter':1,'golf-superwide':1,'golf-wing':1,'golf-quad-flame':1,'mercedes-aero':.34,'mercedes-splitter':1,'mercedes-clean':.34,'mercedes-diffuser':1,'mercedes-wide':1,'audi-aero':.34,'audi-splitter':1,'audi-clean':.34,'audi-diffuser':1,'audi-wide':1}[config[part]]);
  const isTrack=(part:'front'|'rear'|'skirts'|'spoiler'|'exhaust')=>config[part]==='track'||(part==='exhaust' && (config.exhaust==='flame'||config.exhaust==='golf-quad-flame'));
  const top=TOP_FITS[id];
  if(config.hood!=='stock') {
    const a=reg('hood'), mount=new THREE.Group();a.add(mount);mount.position.set(0,top.hoodY,top.hoodZ);mount.rotation.x=-Math.atan(top.hoodSlope);
    const finish=config.hoodFinish==='carbon'?woven:body;
    if(id==='golf' && config.hood==='golf-vented') {
      for(const side of [-1,1]) {
        box(.20,.012,.39,side*.26,.015,-.04,carbon,mount,'hood-vent');
        for(let i=-2;i<=2;i++)box(.17,.012,.018,side*.26,.025,i*.068-.04,finish,mount,'hood-vent-slat');
      }
    } else if(id==='golf' && config.hood==='golf-rally') {
      const scoop=new THREE.Mesh(aeroWedge(.48,.43,.12),finish);scoop.name='hood-scoop';mount.add(scoop);
      box(.31,.018,.08,0,.035,-.13,dark,mount,'hood-scoop-intake');
    } else if(config.hood==='street'||config.hood==='touring') {
      for(const side of [-1,1]) {
        const len=config.hood==='touring'?.34:.23;
        box(.15,.008,len+.04,side*.24,.008,0,finish,mount,'hood-vent-surround');
        box(.12,.014,len,side*.24,.014,0,dark,mount,'hood-vent');
        if(config.hood==='touring') for(let i=-1;i<=1;i++)box(.105,.007,.012,side*.24,.02,i*.08,finish,mount,'hood-vent-slat');
      }
    } else {
      const scoop=new THREE.Mesh(aeroWedge(config.hood==='track'?.48:.36,.38,config.hood==='track'?.095:.065),finish);
      scoop.name='hood-scoop';mount.add(scoop);
      box(config.hood==='track'?.30:.22,.014,.06,0,.022,-.105,dark,mount,'hood-scoop-intake');
    }
  }
  if(config.roof!=='stock') {
    const a=reg('roof'), mount=new THREE.Group();a.add(mount);mount.position.set(0,top.roofY,top.roofZ);mount.rotation.x=-Math.atan(top.roofSlope);
    const finish=config.roofFinish==='carbon'?woven:body;
    if(id==='golf' && config.roof==='golf-roof-scoop') {
      const scoop=new THREE.Mesh(aeroWedge(.43,.55,.14),finish);scoop.name='roof-scoop';mount.add(scoop);
      box(.27,.02,.08,0,.035,-.17,dark,mount,'roof-intake');
    } else if(id==='golf' && config.roof==='golf-roof-vents') {
      for(const side of [-1,1]) {box(.13,.012,.30,side*.21,.02,0,carbon,mount,'roof-vent');for(let i=-1;i<=1;i++)box(.11,.014,.018,side*.21,.028,i*.075,finish,mount,'roof-vent-slat');}
    } else if(config.roof==='sport') {
      const scoop=new THREE.Mesh(aeroWedge(.30,.38,.10),finish);scoop.name='roof-scoop';mount.add(scoop);
      box(.19,.015,.07,0,.025,-.10,dark,mount,'roof-intake');
    } else {
      const positions=config.roof==='street'?[0]:config.roof==='touring'?[-.16,.16]:[-.22,0,.22];
      for(const x of positions) {
        const fin=new THREE.Mesh(aeroWedge(.035,.31,config.roof==='track'?.13:.09),finish);
        fin.name='roof-fin';fin.position.set(x,-Math.abs(x)*.025,0);mount.add(fin);
      }
    }
  }
  if(config.front!=='stock') {
    const a=reg('front'), track=isTrack('front'), amount=level('front'), panel=config.frontFinish==='carbon'?woven:body;
    const nose=f.frontZ-.015;
    if(id==='golf') {
      // The fitted lower fascia is created by fitGolfBodywork; accessories
      // remain below the bumper seam and well clear of the headlights.
      if(config.front==='golf-splitter') {
        const blade=new THREE.Mesh(taperedBand(.83,-2.25,.145,.36,.018,.24),carbon);blade.name='front-splitter';a.add(blade);
        for(const side of [-1,1]) {
          supportRod(new THREE.Vector3(side*.43,.31,-2.03),new THREE.Vector3(side*.49,.16,-2.20),metal,a);
          for(let i=0;i<3;i++){const fin=box(.18,.014,.17,side*(.61+i*.008),.24+i*.045,-1.88+i*.025,carbon,a,'front-canard');fin.rotation.y=side*.22;}
        }
      }
    } else if(id==='mercedes' && (config.front==='mercedes-aero'||config.front==='mercedes-splitter')) {
      // The replacement itself is cut from the player body in fitMercedesBodywork.
      const blade=new THREE.Mesh(taperedBand(.91,config.front==='mercedes-splitter'?-2.75:-2.68,.115,.27,.018,.23),config.frontFinish==='carbon'?woven:carbon);blade.name='front-splitter';a.add(blade);
      if(config.front==='mercedes-splitter')for(const side of [-1,1]){
        supportRod(new THREE.Vector3(side*.52,.31,-2.60),new THREE.Vector3(side*.55,.135,-2.72),metal,a);
        for(let i=0;i<2;i++){const fin=box(.15,.012,.14,side*.75,.19+i*.055,-2.49+i*.04,carbon,a,'front-canard');fin.rotation.y=side*.18;}
      }
    } else if(id==='audi' && (config.front==='audi-aero'||config.front==='audi-splitter')) {
      const blade=new THREE.Mesh(taperedBand(.94,config.front==='audi-splitter'?-2.61:-2.54,.105,.28,.018,.20),config.frontFinish==='carbon'?woven:carbon);blade.name='front-splitter';a.add(blade);
      if(config.front==='audi-splitter')for(const side of [-1,1]){
        supportRod(new THREE.Vector3(side*.52,.29,-2.45),new THREE.Vector3(side*.55,.12,-2.58),metal,a);
        for(let i=0;i<2;i++){const fin=box(.15,.012,.14,side*.76,.19+i*.055,-2.33+i*.04,carbon,a,'front-canard');fin.rotation.y=side*.18;}
      }
    } else if(id==='audi') {
      const lip=new THREE.Mesh(audiFrontLip(amount),config.frontFinish==='carbon'?woven:carbon);lip.name='front-fascia';a.add(lip);
    } else if(id==='bmw-m3'||id==='skyline'||id==='aventador'||id==='aventador-game'||id==='bugatti') {
      const lip=new THREE.Mesh(importedFrontLip(id,amount),config.frontFinish==='carbon'?woven:carbon);lip.name='front-fascia';a.add(lip);
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
    if(id==='mercedes' && config.front!=='mercedes-aero' && config.front!=='mercedes-splitter') box(f.frontW*1.35,.015,.035,0,f.bumperY+.11,nose+.04,metal,a,'bright-fascia-trim');
  }
  if(config.rear!=='stock' || (id==='golf' && config.exhaust==='golf-quad-flame')) {
    const a=reg('rear'),track=isTrack('rear'),amount=level('rear'), tail=f.rearZ-.035, panel=config.rearFinish==='carbon'?woven:body;
    if(id==='golf') {
      // Fitted against the source mesh in fitGolfBodywork after this group is created.
      // These short vertical strakes belong to the replacement's diffuser;
      // they do not sit over any retained factory bumper surface.
      if(amount>=.67 && config.rear!=='golf-r32') for(const x of (config.rear==='golf-diffuser' ? [-.36,-.24,-.12,0,.12,.24,.36] : track ? [-.29,-.10,.10,.29] : [-.23,0,.23])) {
        const fin=box(.012,.075,.10,x,.245,1.98,carbon,a,'diffuser-fin');fin.rotation.x=-.18;
      }
    } else if(id==='mercedes' && (config.rear==='mercedes-clean'||config.rear==='mercedes-diffuser')) {
      if(config.rear==='mercedes-diffuser') {
        const diffuser=new THREE.Mesh(taperedBand(.45,2.46,.275,.17,.018,-.025),config.rearFinish==='carbon'?woven:carbon);diffuser.name='rear-diffuser';a.add(diffuser);
        for(const x of [-.35,-.175,0,.175,.35]) {const fin=box(.014,.07,.16,x,.255,2.53,carbon,a,'diffuser-fin');fin.rotation.x=-.1;}
      }
    } else if(id==='audi' && (config.rear==='audi-clean'||config.rear==='audi-diffuser')) {
      if(config.rear==='audi-diffuser') {
        const diffuser=new THREE.Mesh(taperedBand(.44,2.34,.275,.16,.018,-.02),config.rearFinish==='carbon'?woven:carbon);diffuser.name='rear-diffuser';a.add(diffuser);
        for(const x of [-.33,-.165,0,.165,.33]){const fin=box(.014,.06,.14,x,.26,2.42,carbon,a,'diffuser-fin');fin.rotation.x=-.1;}
      }
    } else if(id==='bugatti') {
      const blade=new THREE.Mesh(taperedBand(.58,2.02,.23,THREE.MathUtils.lerp(.08,.13,amount),.015,-.04),config.rearFinish==='carbon'?woven:carbon);
      blade.name='rear-diffuser-extension';a.add(blade);
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
    const wideFinish=config.skirtsFinish==='carbon'?woven:carbon;
    if(id==='golf' && config.skirts==='golf-superwide') for(const side of [-1,1]) {
      const blade=new THREE.Mesh(golfWideBlade(side),wideFinish);blade.name='superwide-skirt';a.add(blade);
      for(const z of [-1.182,1.347]) {const arch=new THREE.Mesh(golfArch(side,z),wideFinish);arch.name='wheel-arch-flare';a.add(arch);}
      for(const z of [-.57,-.20,.17,.54,.84]) {const spike=new THREE.Mesh(golfSkirtSpike(side,z),wideFinish);spike.name='skirt-spike';a.add(spike);}
    }
    if(id==='mercedes' && config.skirts==='mercedes-wide')for(const side of [-1,1]){
      const blade=new THREE.Mesh(mercedesWideBlade(side),wideFinish);blade.name='superwide-skirt';a.add(blade);
      for(const z of [-1.739,1.422]){const arch=new THREE.Mesh(mercedesArch(side,z),wideFinish);arch.name='wheel-arch-flare';a.add(arch);}
      for(const z of [-.94,-.52,-.10,.32,.74]){const spike=new THREE.Mesh(mercedesSpike(side,z),wideFinish);spike.name='skirt-spike';a.add(spike);}
    }
    if(id==='audi' && config.skirts==='audi-wide')for(const side of [-1,1]){
      const blade=new THREE.Mesh(audiWideBlade(side),wideFinish);blade.name='superwide-skirt';a.add(blade);
      for(const z of [-1.537,1.386]){const arch=new THREE.Mesh(audiArch(side,z),wideFinish);arch.name='wheel-arch-flare';a.add(arch);}
      for(const z of [-.8,-.43,-.06,.31,.68]){const spike=new THREE.Mesh(audiSpike(side,z),wideFinish);spike.name='skirt-spike';a.add(spike);}
    }
    for(const side of id==='golf' || (id==='mercedes' && config.skirts==='mercedes-wide') || (id==='audi' && config.skirts==='audi-wide') ? [] : [-1,1]) {
      const skirt=new THREE.Mesh(skirtShell(id,side,amount),panel);skirt.name='side-skirt';a.add(skirt);
      if(amount>=.67) {
        const blade=new THREE.Mesh(skirtBlade(id,side,amount),carbon);blade.name='sill-blade';a.add(blade);
      }
    }
  }
  if(config.spoiler!=='stock') {
    const a=reg('spoiler'),track=isTrack('spoiler'),amount=level('spoiler'),panel=config.spoilerFinish==='carbon'?woven:body;
    const roof=f.character==='compact'||f.character==='wagon';
    if(id==='golf' && config.spoiler==='golf-wing') {
      for(const side of [-1,1]) {const support=new THREE.Mesh(wingSupport(side*.39,1.385,1.54,.30,.33),panel);support.name='wing-pedestal';a.add(support);}
      const wing=new THREE.Mesh(wingProfile(.80,1.90,1.685,.40),panel);wing.name='wing-blade';a.add(wing);
      for(const side of [-1,1])box(.018,.12,.36,side*.785,1.70,1.88,carbon,a,'wing-endplate');
    } else if(roof) {
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
  if(config.exhaust!=='stock' || (id==='golf' && config.rear==='golf-r32') || config.afterfire) {
    const a=reg('exhaust'),track=isTrack('exhaust'), amount=level('exhaust'), finish=config.exhaustFinish==='carbon'?woven:metal;
    const oval=f.character==='luxury'||f.character==='wagon'||f.character==='midengine';
    // One mouth position is shared by the pipe and flame. The measured rear
    // offsets place the rim just beyond the stock bumper, not inside it.
    const z=id==='mustang' ? 2.240 : id==='ferrari' ? 1.948 : f.rearZ-.06, mouthZ=z+.054, y=id==='mustang' ? .401 : id==='ferrari' ? .334 : f.tipY+.08;
    // The exact same outlet descriptions drive rims and flame origins.
    const factory=config.exhaust==='stock' && !(id==='golf' && config.rear==='golf-r32');
    const ferrariFactoryFlame=id==='ferrari' && (factory || config.exhaust==='flame');
    const mustangFactoryFlame=id==='mustang' && (factory || config.exhaust==='flame');
    const factoryOutlets:Partial<Record<CarId,{x:number[];y:number;z:number;r:number}>>={
      golf:{x:[-.52],y:.20,z:2.04,r:.04},mercedes:{x:[-.68,.68],y:.26,z:2.51,r:.07},audi:{x:[-.71,.71],y:.28,z:2.35,r:.075},
      r8:{x:[-.70,-.61,.61,.70],y:.268,z:2.155,r:.04},challenger:{x:[-.60,-.49,.49,.60],y:.319,z:2.442,r:.045},
      'bmw-m3':{x:[-.55,-.46,.46,.55],y:.28,z:2.23,r:.04},skyline:{x:[-.414],y:.33,z:2.258,r:.07},
      'aventador-game':{x:[-.14,-.05,.05,.14],y:.29,z:2.25,r:.04},aventador:{x:[-.14,-.05,.05,.14],y:.29,z:2.25,r:.04},
      bugatti:{x:[-.16,-.05,.05,.16],y:.25,z:2.14,r:.04},
    };
    const stock=factory ? factoryOutlets[id] : undefined;
    const centers=stock ? stock.x : mustangFactoryFlame ? [-.598,-.515,.526,.609] : id==='ferrari' ? [-.061,.048,.150] : id==='golf'
      ? golfExhaustLayout(config).centers
      : (track||config.exhaust==='sport') ? [-f.tipX-f.tipSpacing*(track?.5:.4),-f.tipX+f.tipSpacing*(track?.5:.4),f.tipX-f.tipSpacing*(track?.5:.4),f.tipX+f.tipSpacing*(track?.5:.4)]
      : [-f.tipX,f.tipX];
    const radius=stock ? stock.r : id==='ferrari' ? f.tipRadius*THREE.MathUtils.lerp(.68,.85,amount) : id==='golf'
      ? golfExhaustLayout(config).radius : f.tipRadius*((track||config.exhaust==='sport')?.64:THREE.MathUtils.lerp(.85,1.02,amount));
    if(mustangFactoryFlame) {
      // Four real factory tailpipes, measured from the source mesh.
      for(const x of centers) {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,.401,2.294);a.add(mouth);}
    } else if(ferrariFactoryFlame) {
      // The source 458 mesh already contains three outlets. Their centers were
      // measured after its yaw correction; do not layer fake pipes over them.
      for(const x of centers) {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,.334,2.002);a.add(mouth);}
    } else if(!factory) for(const x of centers) tip(a,x,y,z,radius,finish,dark,!track && (config.exhaust==='touring'||oval) && id!=='golf' && config.exhaust!=='sport');
    else if(stock) for(const x of centers) {
      // Golf's factory outlet is recessed out of sight; add a discreet tip
      // below the bumper so the optional flame has an actual visible source.
      if(id==='golf') tip(a,x,stock.y,stock.z-.054,radius,finish,dark);
      else {const mouth=new THREE.Object3D();mouth.name='exhaust-mouth';mouth.position.set(x,stock.y,stock.z);a.add(mouth);}
    }
    if (config.afterfire || config.exhaust==='flame' || (id==='golf' && (config.exhaust==='golf-quad-flame' || config.exhaust==='sport'))) {
      const flames=new THREE.Group(); flames.name='exhaust-flames';
      const flameMaterials:THREE.ShaderMaterial[]=[];
      for (const [i,x] of centers.entries()) {
        const jet=new THREE.Group(); jet.position.set(x,stock ? stock.y : ferrariFactoryFlame ? .334 : y, stock ? stock.z : ferrariFactoryFlame ? 2.002 : mouthZ);
        // CC0 Kenney flame sprite, stretched along the exhaust axis and
        // colored by a hot inner core. Crossed sheets remain visible from all
        // camera directions, while gentle UV motion and scaling animate it.
        const length=id==='golf'?.58:.42, jetRadius=radius*1.7;
        const mat=new THREE.ShaderMaterial({
          uniforms:{uTime:{value:0},uSeed:{value:i*7.31},uFlameColor:{value:new THREE.Color(config.flameColor)},uFlame:{value:flameTexture()}},
          transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
          vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader:`uniform float uTime,uSeed;uniform vec3 uFlameColor;uniform sampler2D uFlame;varying vec2 vUv;
            void main(){float t=vUv.y;float wave=sin(t*12.0-uTime*12.0+uSeed)*.018*t;
              vec2 uv=vec2(.408+(vUv.x+wave)*.196,.254+t*.528);vec4 tex=texture2D(uFlame,uv);
              float strength=tex.a*max(tex.r,tex.g);float core=pow(max(0.0,1.0-abs(vUv.x-.5)*2.0),2.5)*(1.0-smoothstep(.05,.65,t));
              vec3 color=mix(uFlameColor,vec3(1.0,.92,.75),core*.75);
              gl_FragColor=vec4(color,strength*.65*(1.0-smoothstep(.85,1.0,t)));
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
  if(id==='golf' && config.mirrors!=='stock') {
    const a=reg('mirrors'),finish=config.mirrors==='carbon'?woven:body;
    const glass=new THREE.MeshStandardMaterial({color:0x607681,metalness:.7,roughness:.14});g.userData.ownedMaterials ??=[];
    for(const side of [-1,1]) {
      const stem=box(.11,.038,.075,side*.79,.947,-.47,carbon,a,'mirror-stem');stem.rotation.z=side*.12;
      const housing=box(.19,.095,.16,side*.875,.96,-.46,finish,a,'mirror-housing');housing.rotation.y=side*.16;
      const face=box(.15,.065,.009,side*.88,.96,-.375,glass,a,'mirror-glass');face.rotation.y=side*.16;
    }
  }
  if(id==='golf' && config.headlights==='halo') {
    const a=reg('headlights'),halo=new THREE.MeshBasicMaterial({color:0xa9e7ff});
    for(const side of [-1,1]) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.046,.004,8,40),halo);ring.name='headlight-halo';
      ring.position.set(side*.48,.665,-1.928);ring.rotation.set(.55,-side*.48,0);a.add(ring);
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
    const flicker=.55+.45*(.5+.5*Math.sin(time*19+i*2.7)*Math.sin(time*7.7+i));
    jet.scale.set(.8+flicker*.2,.8+flicker*.2,flicker);
  });
}
