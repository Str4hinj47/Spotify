import * as THREE from 'three';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';
import { LIVERY_OPTIONS } from './content/cosmetics.mjs';

// Each car gets different stripe widths, placement and flank graphics; these
// are original procedural designs, not imported logos or branded decals.
export const LIVERIES: Record<CarId, { labels:[string,string], stripe:number, offset:number, belt:number, doorZ:number, side:number, roof:number }> = {
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
  const upper = config.paintScheme === 'upper' ? 1 : config.paintScheme === 'lower' ? 2 : 0;
  const style = LIVERY_OPTIONS.find(option => option.id === config.livery)?.pattern;
  const pattern = style === 'stripe' ? 1 : style === 'race' ? 2 : 0;
  const secondary = new THREE.Color(config.secondaryColor);
  const livery = new THREE.Color(config.liveryColor);
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      kitMatrix:{value:meshToCar}, kitSecondary:{value:secondary}, kitAccent:{value:livery},
      kitScheme:{value:upper}, kitPattern:{value:pattern}, kitCarbon:{value:config.secondaryFinish==='carbon'?1:0},
      kitStripe:{value:d.stripe}, kitOffset:{value:d.offset}, kitBelt:{value:d.belt}, kitDoor:{value:d.doorZ}, kitSide:{value:d.side}, kitRoof:{value:d.roof},
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 kitMatrix; varying vec3 vKitPos;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKitPos = (kitMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vKitPos; uniform vec3 kitSecondary; uniform vec3 kitAccent;
      uniform float kitScheme, kitPattern, kitCarbon, kitStripe, kitOffset, kitBelt, kitDoor, kitSide, kitRoof;
      float kitBand(float d,float w) { return 1.0-smoothstep(w,w+0.018,abs(d)); }
      vec3 kitWeave(vec3 p) {
        vec2 q=vec2(p.x+p.z*.23,p.y+p.z*.30)*115.0;
        float a=step(.5,fract(q.x)), b=step(.5,fract(q.y));
        float weave=mix(.76,1.12,abs(a-b));
        return vec3(.012,.018,.022)*weave;
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float secondaryMask = kitScheme < 0.5 ? 0.0 : (kitScheme < 1.5 ? smoothstep(kitRoof-.025,kitRoof+.025,vKitPos.y) : 1.0-smoothstep(kitBelt-.035,kitBelt+.035,vKitPos.y));
      vec3 second = mix(kitSecondary,kitWeave(vKitPos),kitCarbon);
      diffuseColor.rgb=mix(diffuseColor.rgb,second,secondaryMask);
      float ax=abs(vKitPos.x);
      float upperSurface=smoothstep(kitBelt+.06,kitBelt+.17,vKitPos.y);
      float sideSurface=smoothstep(kitSide*.73,kitSide*.92,ax);
      float stripe=kitBand(ax-kitOffset,kitStripe*.5)*upperSurface*(1.0-sideSurface);
      float belt=kitBand(vKitPos.y-kitBelt,.035)*sideSurface;
      float roundel=(1.0-smoothstep(.20,.22,length(vec2(vKitPos.z-kitDoor,vKitPos.y-(kitBelt+.28)))))*sideSurface;
      float graphics=kitPattern < .5 ? 0.0 : (kitPattern < 1.5 ? stripe : max(stripe,max(belt,roundel)));
      diffuseColor.rgb=mix(diffuseColor.rgb,kitAccent,graphics*.96);`);
  };
  mat.customProgramCacheKey = () => 'overtake-custom-paint-v2';
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
