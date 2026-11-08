import * as THREE from 'three';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';
import { LIVERY_OPTIONS } from './content/cosmetics.mjs';

// Each car gets different stripe widths, placement and flank graphics; these
// are original procedural designs, not imported logos or branded decals.
export const LIVERIES: Record<CarId, { labels:[string,string], stripe:number, offset:number, belt:number, doorZ:number, side:number, roof:number }> = {
  bugatti: { labels:['Grand touring stripes','Hypercar circuit'], stripe:.09, offset:.20, belt:.40, doorZ:0, side:.94, roof:.76 },
  'bmw-m3': { labels:['Circuit stripes','GT racing'], stripe:.10, offset:.20, belt:.40, doorZ:0, side:.85, roof:.85 },
  skyline: { labels:['Street stripes','Touring racing'], stripe:.10, offset:.20, belt:.40, doorZ:0, side:.85, roof:.90 },
  aventador: { labels:['Road stripes','Circuit racing'], stripe:.09, offset:.20, belt:.35, doorZ:0, side:.95, roof:.75 },
  'aventador-game': { labels:['Road stripes','Circuit racing'], stripe:.09, offset:.20, belt:.35, doorZ:0, side:.95, roof:.75 },
  golf: { labels:['Club stripes','Cup rally'], stripe:.105, offset:.17, belt:.43, doorZ:0, side:.79, roof:.92 },
  mercedes: { labels:['Touring pinstripes','Grand touring'], stripe:.065, offset:.22, belt:.39, doorZ:.10, side:.90, roof:.97 },
  audi: { labels:['Avant stripes','Touring circuit'], stripe:.09, offset:.20, belt:.40, doorZ:-.10, side:.90, roof:.98 },
  mustang: { labels:['Heritage stripes','Heritage circuit'], stripe:.14, offset:.19, belt:.39, doorZ:.05, side:.82, roof:.88 },
  ferrari: { labels:['Central stripe','Circuit endurance'], stripe:.09, offset:.12, belt:.32, doorZ:-.05, side:.86, roof:.72 },
  r8: { labels:['Vantage stripes','GT circuit'], stripe:.075, offset:.24, belt:.33, doorZ:-.1, side:.89, roof:.78 },
  challenger: { labels:['Muscle stripes','Drag graphics'], stripe:.16, offset:.20, belt:.43, doorZ:.05, side:.91, roof:.96 },
};

/** Clone per mesh because each imported mesh has a different transform into
 * the car's coordinate system. Shared originals and traffic are untouched. */
export function customPaintMaterial(source: THREE.MeshStandardMaterial, meshToCar: THREE.Matrix4, id: CarId, config: Customization) {
  const mat = source.clone();
  const d = LIVERIES[id];
  const upper = config.paintScheme === 'upper' ? 1 : config.paintScheme === 'lower' ? 2 : config.paintScheme === 'roof-only' ? 3 : 0;
  const style = LIVERY_OPTIONS.find(option => option.id === config.livery)?.pattern;
  const pattern = ({ none:0, stripe:1, race:2, center:3, sprint:4, velocity:5, heritage:6, apex:7, flames:8 } as const)[style ?? 'none'];
  // Bounds are in normalized car space. Secondary paint is limited to the
  // top-facing hood and roof panels, never a height cut across the doors.
  const hoodBounds: Partial<Record<CarId,[number,number,number]>> = {
    golf:[-2.02,-.92,.58], challenger:[-2.28,-.96,.73], mustang:[-2.10,-.93,.68],
    skyline:[-2.10,-.94,.64], 'bmw-m3':[-1.95,-.91,.63],
    mercedes:[-2.35,-1.02,.64], audi:[-2.15,-.97,.66],
    ferrari:[-1.76,-.72,.62], r8:[-1.90,-.75,.62],
    aventador:[-2.04,-.76,.62], 'aventador-game':[-2.04,-.76,.62], bugatti:[-1.90,-.75,.62],
  };
  const hood=hoodBounds[id] ?? [-2,-.9,.6];
  const secondary = new THREE.Color(config.secondaryColor);
  const livery = new THREE.Color(config.liveryColor);
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      kitMatrix:{value:meshToCar}, kitNormalMatrix:{value:new THREE.Matrix3().getNormalMatrix(meshToCar)}, kitSecondary:{value:secondary}, kitAccent:{value:livery},
      kitHoodColor:{value:new THREE.Color(config.hoodColor || '#ffffff')}, kitRoofColor:{value:new THREE.Color(config.roofColor || '#ffffff')},
      kitHoodEnabled:{value:config.hoodColor?1:0}, kitRoofEnabled:{value:config.roofColor?1:0},
      kitScheme:{value:upper}, kitPattern:{value:pattern}, kitCarbon:{value:config.secondaryFinish==='carbon'?1:0},
      kitHood:{value:new THREE.Vector3(...hood)}, kitStripe:{value:d.stripe}, kitOffset:{value:d.offset}, kitBelt:{value:d.belt}, kitDoor:{value:d.doorZ}, kitSide:{value:d.side}, kitRoof:{value:d.roof},
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 kitMatrix; uniform mat3 kitNormalMatrix; varying vec3 vKitPos; varying vec3 vKitNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvKitNormal = normalize(kitNormalMatrix * objectNormal);');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKitPos = (kitMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vKitPos; varying vec3 vKitNormal; uniform vec3 kitSecondary; uniform vec3 kitAccent; uniform vec3 kitHoodColor, kitRoofColor; uniform float kitHoodEnabled, kitRoofEnabled;
      uniform float kitScheme, kitPattern, kitCarbon, kitStripe, kitOffset, kitBelt, kitDoor, kitSide, kitRoof; uniform vec3 kitHood;
      float kitBand(float d,float w) { return 1.0-smoothstep(w,w+0.008,abs(d)); }
      float kitBox(vec2 p,vec2 b,float r) {
        vec2 q=abs(p)-b+vec2(r);
        return 1.0-smoothstep(-.004,.004,length(max(q,0.0))+min(max(q.x,q.y),0.0)-r);
      }
      // Simple inset number 07; no external logos or decal textures.
      float kitDigitZero(vec2 p) {
        return max(max(kitBox(p-vec2(-.045,0.0),vec2(.012,.075),.004), kitBox(p-vec2(.045,0.0),vec2(.012,.075),.004)),
                   max(kitBox(p-vec2(0.0,.066),vec2(.045,.012),.004),kitBox(p-vec2(0.0,-.066),vec2(.045,.012),.004)));
      }
      float kitDigitSeven(vec2 p) {
        return max(kitBox(p-vec2(0.0,.066),vec2(.050,.012),.004),kitBand(p.x - (.02 + p.y*.42),.012)*step(abs(p.y),.075));
      }
      // Rounded, swept pinstripe tongues with a tapered tip. The curvature
      // changes along each stroke rather than making angular wedges.
      float kitTongue(vec2 p, vec2 a, vec2 b, float width, float bend) {
        float t=clamp((p.x-a.x)/(b.x-a.x),0.0,1.0);
        float ease=t*t*(3.0-2.0*t);
        float cy=mix(a.y,b.y,ease)+bend*sin(3.14159265*t);
        float radius=width*pow(1.0-t,.72)*(0.86+0.14*sin(t*3.14159));
        float dx=max(max(a.x-p.x,p.x-b.x),0.0);
        return 1.0-smoothstep(max(0.0,radius-.004),radius+.004,length(vec2(dx,p.y-cy)));
      }
      vec3 kitWeave(vec3 p) {
        vec2 q=vec2(p.x+p.z*.23,p.y+p.z*.30)*115.0;
        float a=step(.5,fract(q.x)), b=step(.5,fract(q.y));
        float weave=mix(.76,1.12,abs(a-b));
        return vec3(.012,.018,.022)*weave;
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float ax=abs(vKitPos.x);
      vec3 n=normalize(vKitNormal);
      float hoodPanel = smoothstep(kitHood.x,kitHood.x+.025,vKitPos.z) * (1.0-smoothstep(kitHood.y-.025,kitHood.y,vKitPos.z)) * (1.0-smoothstep(kitHood.z-.02,kitHood.z,ax)) * smoothstep(.55,.80,n.y) * smoothstep(kitBelt+.2,kitBelt+.3,vKitPos.y);
      float roofPanel = smoothstep(kitRoof+.22,kitRoof+.28,vKitPos.y)*smoothstep(.55,.80,n.y);
      float secondaryMask = kitScheme < .5 ? 0.0 : (kitScheme < 1.5 ? max(hoodPanel,roofPanel) : kitScheme < 2.5 ? hoodPanel : roofPanel);
      vec3 second = mix(kitSecondary,kitWeave(vKitPos),kitCarbon);
      diffuseColor.rgb=mix(diffuseColor.rgb,second,secondaryMask);
      diffuseColor.rgb=mix(diffuseColor.rgb,kitHoodColor,hoodPanel*kitHoodEnabled);
      diffuseColor.rgb=mix(diffuseColor.rgb,kitRoofColor,roofPanel*kitRoofEnabled);
      float top=smoothstep(.42,.72,abs(n.y))*smoothstep(kitBelt+.08,kitBelt+.20,vKitPos.y);
      float side=smoothstep(.45,.8,abs(n.x))*smoothstep(kitSide*.65,kitSide*.88,ax);
      float stripe=kitBand(ax-kitOffset,kitStripe*.5)*top;
      float oldUpper=smoothstep(kitBelt+.06,kitBelt+.17,vKitPos.y);
      float oldSide=smoothstep(kitSide*.73,kitSide*.92,ax);
      float legacyStripe=kitBand(ax-kitOffset,kitStripe*.5)*oldUpper*(1.0-oldSide);
      float centerStripe=kitBand(vKitPos.x,kitStripe)*oldUpper*(1.0-oldSide);
      float z=vKitPos.z-kitDoor;
      float flank=side*step(kitBelt-.04,vKitPos.y)*step(vKitPos.y,kitBelt+.48);
      float lower=kitBand(vKitPos.y-(kitBelt+.08),.025)*flank;
      float slash=kitBand(vKitPos.y-(kitBelt+.17+z*.25),.032)*flank*step(abs(z-.42),.75);
      float graphics=0.0, panel=0.0, number=0.0, flameCore=0.0;
      if(kitPattern > .5 && kitPattern < 1.5) graphics=legacyStripe;
      else if(kitPattern < 2.5 && kitPattern > 1.5) {
        // Clean GT stripes plus a numbered door plate and a restrained rocker line.
        graphics=max(stripe*.8, max(lower,slash));
        vec2 platePos=vec2(-(z+.30)*sign(vKitPos.x),vKitPos.y-(kitBelt+.27));
        panel=kitBox(platePos,vec2(.265,.142),.035)*side;
        number=max(kitDigitZero(platePos-vec2(-.075,0.0)),kitDigitSeven(platePos-vec2(.075,0.0)))*panel;
        graphics=max(graphics,panel);
      }
      else if(kitPattern > 2.5 && kitPattern < 3.5) graphics=centerStripe;
      else if(kitPattern > 3.5 && kitPattern < 4.5) {
        graphics=max(kitBand(vKitPos.x-kitOffset,kitStripe*.75), kitBand(vKitPos.x-kitOffset-kitStripe*1.6,.012))*top;
      } else if(kitPattern > 4.5 && kitPattern < 5.5) {
        float blade=kitBand(vKitPos.y-(kitBelt+.12+z*.21),.045)*flank*step(abs(z),1.05);
        float fine=kitBand(vKitPos.y-(kitBelt+.22+z*.21),.013)*flank*step(abs(z),.9);
        graphics=max(max(blade,fine),kitBand(vKitPos.x,kitStripe*.18)*top);
      } else if(kitPattern > 5.5 && kitPattern < 6.5) {
        float twin=max(kitBand(vKitPos.y-(kitBelt+.04),.024),kitBand(vKitPos.y-(kitBelt+.12),.012))*flank;
        graphics=max(centerStripe,twin);
      } else if(kitPattern > 6.5 && kitPattern < 7.5) {
        float upper=max(kitBand(vKitPos.x-kitOffset,kitStripe*.65),kitBand(vKitPos.x-kitOffset-kitStripe*1.8,.018))*top;
        float spear=kitBand(vKitPos.y-(kitBelt+.15+z*.12),.055)*flank*step(abs(z+.05),.95);
        graphics=max(upper,spear);
      } else if(kitPattern > 7.5) {
        vec2 f=vec2(z,vKitPos.y-kitBelt);
        // Classic swept flames: a compact rounded root with individual,
        // curved tongues and separate warm inner strokes. No square clipping.
        float root=kitBox(f-vec2(-1.10,.11),vec2(.19,.13),.12);
        float outer=max(root,kitTongue(f,vec2(-1.13,.12),vec2(.64,.20),.115,-.055));
        outer=max(outer,kitTongue(f,vec2(-1.10,.17),vec2(.39,.43),.082,.085));
        outer=max(outer,kitTongue(f,vec2(-1.04,.08),vec2(.32,-.025),.071,-.06));
        outer=max(outer,kitTongue(f,vec2(-1.03,.20),vec2(-.07,.47),.050,.065));
        float inner=kitTongue(f,vec2(-1.16,.12),vec2(.30,.19),.048,-.040);
        inner=max(inner,kitTongue(f,vec2(-1.11,.16),vec2(.04,.36),.034,.06));
        inner=max(inner,kitTongue(f,vec2(-1.10,.08),vec2(-.02,.015),.025,-.045));
        graphics=outer*side;
        flameCore=inner*side;

      }
      diffuseColor.rgb=mix(diffuseColor.rgb,kitAccent,graphics*.96);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(kitAccent,vec3(1.0),.5),flameCore*.8);
      // Legible number contrast follows the chosen livery color.
      float lightness=dot(kitAccent,vec3(.2126,.7152,.0722));
      vec3 ink=lightness > .35 ? vec3(.015,.02,.025) : vec3(.96,.97,.98);
      diffuseColor.rgb=mix(diffuseColor.rgb,ink,number);`);
  };
  mat.customProgramCacheKey = () => 'overtake-custom-paint-v8';
  mat.name = `custom-paint-${id}`;
  return mat;
}

/** Subtle dark woven composite for removable bodywork. */
export function createCarbonMaterial() {
  const material = new THREE.MeshStandardMaterial({ color:0x252b31, metalness:.28, roughness:.3 });
  material.name='custom-carbon';
  material.onBeforeCompile = shader => {
    shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarbonPos;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarbonPos = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarbonPos;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 q=vec2(vCarbonPos.x+vCarbonPos.z*.3,vCarbonPos.y+vCarbonPos.z*.23)*140.0;
      float weave=abs(step(.5,fract(q.x))-step(.5,fract(q.y)));
      diffuseColor.rgb*=mix(.70,1.12,weave);`);
  };
  material.customProgramCacheKey=()=> 'overtake-carbon-weave-v1';
  return material;
}
