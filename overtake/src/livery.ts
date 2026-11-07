import * as THREE from 'three';
import type { CarId } from './catalog';
import type { Customization } from './customization.mjs';

// Each car gets different stripe widths, placement and flank graphics; these
// are original procedural designs, not imported logos or branded decals.
export const LIVERIES: Record<CarId, { labels:string[], stripe:number, offset:number, belt:number, doorZ:number, side:number, roof:number }> = {
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
  const pattern = config.livery === 'stripe' ? 1 : config.livery === 'race' ? 2
    : config.livery === 'camo' ? 3 : config.livery === 'fade' ? 4
    : config.livery === 'checker' ? 5 : config.livery === 'slash' ? 6 : 0;
  const secondary = new THREE.Color(config.secondaryColor);
  const livery = new THREE.Color(config.liveryColor);
  // Paint finish PBR (MeshPhysicalMaterial carries clearcoat/iridescence).
  const phys = mat as THREE.MeshPhysicalMaterial;
  // NOTE: metalness near 1.0 erases the diffuse paint colour and leaves only
  // env reflections — in a dim garage the car reads as black/transparent.
  // Real metallic paint is a coloured base with flake: keep metalness moderate.
  if (config.paintFinish === 'metallic') { mat.metalness = .5; mat.roughness = .3; mat.envMapIntensity = 1.6; if ('clearcoat' in phys) { phys.clearcoat = .9; phys.clearcoatRoughness = .1; } }
  else if (config.paintFinish === 'pearlescent') {
    mat.metalness = .3; mat.roughness = .3; mat.envMapIntensity = 1.35;
    if ('clearcoat' in phys) { phys.clearcoat = 1; phys.clearcoatRoughness = .06; }
    if ('iridescence' in phys) { phys.iridescence = .55; phys.iridescenceIOR = 1.6; }
    // Pearlescent accent: the livery/secondary tones shift toward the pearl tint.
    livery.lerp(new THREE.Color(config.pearlColor), .45);
    secondary.lerp(new THREE.Color(config.pearlColor), .3);
  }
  else if (config.paintFinish === 'matte') { mat.metalness = 0; mat.roughness = .88; mat.envMapIntensity = .65; if ('clearcoat' in phys) phys.clearcoat = 0; }
  else if (config.paintFinish === 'satin') { mat.metalness = .2; mat.roughness = .5; mat.envMapIntensity = 1.0; if ('clearcoat' in phys) { phys.clearcoat = .3; phys.clearcoatRoughness = .35; } }
  else { mat.envMapIntensity = 1.15; }
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
      float kitHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
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
      // Racing (fixed): twin stripes + diagonal door slash + OUTLINE roundel
      // with a small centre dot — the old filled white disc read as a sticker blob.
      float doorDist=length(vec2(vKitPos.z-kitDoor,vKitPos.y-(kitBelt+.30)));
      float ring=(1.0-smoothstep(.028,.045,abs(doorDist-.19)))*sideSurface;
      float dot=(1.0-smoothstep(.045,.06,doorDist))*sideSurface;
      float slash=kitBand((vKitPos.y-kitBelt-.22)+(vKitPos.z-kitDoor)*.55,.075)*sideSurface;
      float race=max(stripe, max(belt, max(ring*.95, max(dot*.9, slash))));
      // Camo: chunky two-cell procedural blobs across every panel.
      vec2 cell=floor(vec2(vKitPos.z*3.1+vKitPos.x*1.7, vKitPos.y*4.3));
      float camo=step(.62,kitHash(cell))*.9 + step(.82,kitHash(cell+7.0))*.5;
      // Fade: accent washes from nose to tail over the flanks + roof edge.
      float fade=(smoothstep(-2.2,2.2,vKitPos.z)*.75+.25)*max(sideSurface,upperSurface*.7);
      // Checker: flag squares confined to the belt line and roof stripe.
      float sq=mod(floor(vKitPos.x*16.0)+floor(vKitPos.z*16.0),2.0);
      float checker=max(kitBand(vKitPos.y-kitBelt,.055),stripe)*step(.5,sq);
      // Slash pack: three rising diagonal blades on each flank.
      float blades=kitBand(fract((vKitPos.z-kitDoor)*.9+(vKitPos.y-kitBelt)*1.4)-.5,.13)*sideSurface*smoothstep(.05,.25,vKitPos.y-kitBelt);
      float graphics = kitPattern < .5 ? 0.0
        : kitPattern < 1.5 ? stripe
        : kitPattern < 2.5 ? race
        : kitPattern < 3.5 ? clamp(camo,0.0,1.0)
        : kitPattern < 4.5 ? fade
        : kitPattern < 5.5 ? checker : blades;
      vec3 graphicColor = kitPattern > 3.5 && kitPattern < 4.5
        ? mix(kitAccent, kitSecondary, smoothstep(-2.2,2.2,vKitPos.z)) : kitAccent;
      diffuseColor.rgb=mix(diffuseColor.rgb,graphicColor,graphics*.96);`);
  };
  mat.customProgramCacheKey = () => `overtake-custom-paint-v3-${config.paintFinish}-${config.livery}`;
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
