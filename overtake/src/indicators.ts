import * as THREE from 'three';
import type { TrafficId } from './catalog';

// Coordinates are measured in the car's oriented, ground-level space, not
// world space. The shader runs only on existing lamp meshes and thus follows
// their original lens shapes, depth, occlusion, perspective and animation.
export type IndicatorUniforms = { left: { value: number }; right: { value: number }; viewZ: { value: number }; brake: { value: number } };
type Config = { materials: string[]; x: [number, number]; y: [number, number]; z: number; color: 'amber' | 'red'; ellipse?: [number, number, number, number] };
export const INDICATOR_LAYOUTS: Partial<Record<TrafficId, Config>> = {
  bugatti: { materials:['taillight__red glass.001'], x:[.20,.68], y:[.57,.66], z:1.90, color:'amber' },
  'mercedes-560': { materials:['taillight__Lights','taillight__Lights_Body'], x:[.54,.81], y:[.63,.79], z:2.25, color:'amber' },
  'range-rover': { materials:['taillight__Material.004','taillight__Light Clear Glass','taillight__Darker Clear Glass'], x:[.48,.90], y:[1.02,1.10], z:1.95, color:'amber' },
  camry: { materials:['taillight__glass.001','taillight__rear lamp glass','other__Material.007'], x:[.42,.84], y:[.64,.80], z:2.07, color:'amber' },
  'bmw-m3': { materials:['taillight__Blinker'], x:[.43,.76], y:[.57,.76], z:1.84, color:'amber' },
  skyline: { materials:['taillight__TailLight.Indicator'], x:[.25,.55], y:[.77,.88], z:2.14, color:'amber' },
  aventador: { materials:['taillight__pharearriere', 'taillight__pharearriere.002'], x:[.38,.90], y:[.70,.87], z:1.90, color:'amber' },
  'aventador-game': { materials:['taillight__Neon Light'], x:[.38,.90], y:[.70,.85], z:2.02, color:'amber' },
  golf:       { materials: ['taillight__Rear-lights'], x: [0.50, 0.82], y: [0.80, 0.88], z: 1.63, color: 'amber' },
  mercedes:   { materials: ['photo__W222 - Photo Textures Rough 0'], x: [0.57, 0.86], y: [0.58, 0.72], z: 2.04, color: 'amber' },
  audi:       { materials: ['taillight__Rear_secondary_emission', 'taillight__Rear LIght_clear', 'taillight__Rear_main_emission', 'other__Material.005'], x: [0.35, 0.82], y: [0.86, 0.96], z: 1.95, color: 'amber' },
  mustang:    { materials: ['taillight__M_Tailight1', 'taillight__M_Tailight2'], x: [0.35, 0.72], y: [0.65, 0.78], z: 2.18, color: 'red' },
  ferrari:    { materials: ['taillight__Rear_Light_Cover.000', 'taillight__Rear_Light_RedSide.000', 'taillight__Rear_Light_Tex.000'], x: [0.55, 0.86], y: [0.67, 0.85], z: 1.61, color: 'amber', ellipse: [0.665, 0.75, 0.76, 0.06] },
  r8:         { materials: ['taillight__r8'], x: [0.36, 0.85], y: [0.62, 0.674], z: 1.80, color: 'amber' },
  challenger: { materials: ['taillight__challenger'], x: [0.25, 0.80], y: [0.80, 0.96], z: 2.32, color: 'red' },
};

export function isIndicatorMaterial(id: TrafficId, material: THREE.Material) {
  return !!INDICATOR_LAYOUTS[id]?.materials.includes(material.name);
}

/** Clone one mesh material so its transform, signal and brake state are local. */
export function indicatorMaterial(id: TrafficId, source: THREE.Material, meshToCar: THREE.Matrix4, state: IndicatorUniforms) {
  const layout = INDICATOR_LAYOUTS[id]!;
  const material = source.clone() as THREE.MeshStandardMaterial;
  const f = (n: number) => n.toFixed(5);
  const ellipse = layout.ellipse ? `
    float cx = indicatorPos.x < 0.0 ? -${f(layout.ellipse[0])} : ${f(layout.ellipse[1])};
    vec2 circle = vec2((indicatorPos.x - cx) / ${f(layout.ellipse[3])}, (indicatorPos.y - ${f(layout.ellipse[2])}) / ${f(layout.ellipse[3])});
    zone *= 1.0 - smoothstep(0.86, 1.0, length(circle));` : '';
  // The Challenger's red mesh is already the rounded LED perimeter. Restrict
  // the signal to that mesh instead of drawing a rectangular mask on the
  // glass cover; the real lens supplies the corners and thickness.
  const color = layout.color === 'red' ? 'vec3(1.0, 0.015, 0.008)' : 'vec3(1.0, 0.30, 0.008)';
  const dark = layout.color === 'red' ? 'step(sideState, -0.5) * zone' : '0.0';
  if (id === 'golf') material.userData.selectiveBrake = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.indicatorToCar = { value: meshToCar };
    shader.uniforms.indicatorLeft = state.left;
    shader.uniforms.indicatorRight = state.right;
    shader.uniforms.indicatorViewZ = state.viewZ;
    shader.uniforms.brakeLevel = state.brake;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 indicatorToCar;\nvarying vec3 indicatorPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nindicatorPos = (indicatorToCar * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 indicatorPos;\nuniform float indicatorLeft, indicatorRight, indicatorViewZ, brakeLevel;\nfloat rearEdge(float a,float b){float d=b-a;float w=max(fwidth(d)*.85,0.00005);return smoothstep(-w,w,d);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sideState = indicatorPos.x < 0.0 ? indicatorLeft : indicatorRight;
        float ax = abs(indicatorPos.x);
        float zone = step(0.0, indicatorViewZ) * rearEdge(${f(layout.x[0])}, ax) * rearEdge(ax, ${f(layout.x[1])})
          * rearEdge(${f(layout.y[0])}, indicatorPos.y) * rearEdge(indicatorPos.y, ${f(layout.y[1])}) * rearEdge(${f(layout.z)}, indicatorPos.z);
        ${ellipse}
        float signalOn = zone * step(0.5, sideState);
        float signalOff = ${dark};
        diffuseColor.rgb = mix(diffuseColor.rgb, ${color}, signalOn);
        diffuseColor.rgb *= 1.0 - signalOff * 0.80;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, ${color} * 2.0, signalOn);
        totalEmissiveRadiance *= 1.0 - signalOff * 0.95;
        ${id === 'golf' ? `
        // Only the red lower lens is a brake lamp. Preserve the amber turn
        // strip and white reversing segment in the original textured lens.
        float redLens = smoothstep(0.06, 0.22, diffuseColor.r - max(diffuseColor.g, diffuseColor.b));
        float lowerLens = 1.0 - smoothstep(0.795, 0.815, indicatorPos.y);
        totalEmissiveRadiance += vec3(1.0, 0.012, 0.006) * brakeLevel * redLens * lowerLens * 0.75;
        ` : ''}
      `);
  };
  material.customProgramCacheKey = () => `rear-indicator-${id}-v4`;
  return material;
}

// Front signal locations follow the represented model's lamp design. All
// masks operate on existing lens/reflector geometry, never floating sprites.
// See FRONT_INDICATOR_REFERENCES.md for factory references and model caveats.
const FRONT_MATERIALS: Partial<Record<TrafficId, string[]>> = {
  bugatti: ['headlight__headlight glass.003','headlight__headlight_square.003','headlight__glass front.003'],
  'mercedes-560': ['headlight__Lights_Body'],
  'range-rover': ['headlight__Front Sig Ligh','headlight__Light Clear Glass'],
  camry: ['headlight__glass.001','other__Material.001','other__Material.002','other__Material.004'],
  'bmw-m3': ['headlight__LIght'],
  skyline: ['other__Indicators.001'],
  aventador: ['headlight__vitrephare','headlight__light'],
  'aventador-game': ['headlight__Light'],
  golf: ['chrome__Chrome', 'headlight__Glass-light-cover', 'headlight__Headlight1'],
  mercedes: ['photo__W222 - Photo Textures', 'photo__W222 - Photo Textures Rough 0'],
  audi: ['headlight__Front DRL', 'headlight__Bright_front_headlight', 'chrome__Chrome_Light', 'other__Material.001'],
  mustang: ['headlight__M_HeadLight2', 'other__M_TurnSignalLight1'],
  ferrari: ['headlight__Main_Light_Cover.000', 'headlight__Front_Light_Covers.000', 'headlight__LEDsOn.000', 'headlight__LEDsOff.000'],
  r8: ['headlight__r8'],
  challenger: ['headlight__challenger'],
};

export function isFrontIndicatorMaterial(id: TrafficId, material: THREE.Material): boolean {
  return !!FRONT_MATERIALS[id]?.includes(material.name);
}

// Each expression is in normalized car coordinates. -Z is the front.
const FRONT_ZONES: Partial<Record<TrafficId, string>> = {
  bugatti: `frontEdge(fP.z,-1.68) * frontEdge(.55,fX) * frontEdge(fX,.86) * frontEdge(.50,fP.y) * frontEdge(fP.y,.62)`,
  'mercedes-560': `frontEdge(fP.z,-2.20) * frontEdge(.56,fX) * frontEdge(fX,.84) * frontEdge(.57,fP.y) * frontEdge(fP.y,.78)`,
  'range-rover': `frontEdge(fP.z,-1.75) * frontEdge(.55,fX) * frontEdge(fX,.89) * frontEdge(.95,fP.y) * frontEdge(fP.y,1.02)`,
  camry: `frontEdge(fP.z,-1.86) * frontEdge(.50,fX) * frontEdge(fX,.85) * frontEdge(.60,fP.y) * frontEdge(fP.y,.79)`,
  'bmw-m3': `frontEdge(fP.z,-1.85) * frontEdge(.48,fX) * frontEdge(fX,.70) * frontEdge(.43,fP.y) * frontEdge(fP.y,.56)`,
  skyline: `frontEdge(fP.z,-2.04) * frontEdge(.38,fX) * frontEdge(fX,.78) * frontEdge(.40,fP.y) * frontEdge(fP.y,.51)`,
  aventador: `frontEdge(fP.z,-1.68) * frontEdge(.56,fX) * frontEdge(fX,.93) * frontEdge(.49,fP.y) * frontEdge(fP.y,.70)`,
  'aventador-game': `frontEdge(fP.z,-1.72) * frontEdge(.56,fX) * frontEdge(fX,.85) * frontEdge(.50,fP.y) * frontEdge(fP.y,.69)`,
  // Outer reflector inside the Mk4 headlamp cluster.
  golf: `frontEdge(fP.z, -1.74) * (1.0 - smoothstep(0.82, 1.0, length(vec2((fX - 0.598) / 0.064, (fP.y - 0.662) / 0.055))))`,
  // The W222 has a photo-textured headlamp, so follow its upper LED contour.
  mercedes: `frontEdge(fP.z, -1.90) * frontEdge(0.52, fX) * frontEdge(fX, 0.89) * frontEdge(0.58, fP.y) * frontEdge(fP.y, 0.84) * smoothstep(0.35, 0.75, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)))`,
  // RS6 C8's turn indicator is in the lower part of the headlamp.
  audi: `frontEdge(fP.z, -1.83) * frontEdge(0.53, fX) * frontEdge(fX, 0.88) * (1.0 - smoothstep(0.008, 0.018, abs(fP.y - (0.575 + fX * 0.12))))`,
  // This asset is a classic Mustang, not an S550: the two little oval
  // parking/turn lamps sit in the front valance, below the bumper.
  mustang: `frontEdge(fP.z, -1.82) * (frontEdge(0.33, fP.y) * frontEdge(fP.y, 0.39) * frontEdge(0.38, fX) * frontEdge(fX, 0.51) + frontEdge(0.39, fP.y) * frontEdge(fP.y, 0.455) * frontEdge(0.79, fX) * frontEdge(fX, 0.84))`,
  // The 458 uses the vertical stack of LEDs above each projector. Its source
  // model has a slight asymmetry, so fit each side separately.
  ferrari: `frontEdge(-1.68, fP.z) * frontEdge(fP.z, -1.37) * frontEdge(0.56, fP.y) * (1.0 - smoothstep(0.014, 0.028, abs(fX - ((fP.x < 0.0 ? 0.67 : 0.71) + (fP.z + 1.63) * 0.17))))`,
  // Second-generation R8: upper light guide, keeping the main beam white.
  r8: `frontEdge(fP.z, -1.67) * frontEdge(0.42, fX) * frontEdge(fX, 0.84) * frontEdge(0.51 + (fX - 0.43) * 0.19, fP.y)`,
  // Challenger's switchback indicators are the rings, not the projectors.
  challenger: `frontEdge(fP.z, -2.20) * frontEdge(0.47, fX) * frontEdge(fX, 0.84) * smoothstep(0.048, 0.057, length(vec2(fX - (fX < 0.655 ? 0.570 : 0.744), fP.y - 0.732))) * (1.0 - smoothstep(0.076, 0.084, length(vec2(fX - (fX < 0.655 ? 0.570 : 0.744), fP.y - 0.732))))`,
};

/** Add a per-instance front signal to a fresh or rear-indicator material. */
export function addFrontIndicator(id: TrafficId, material: THREE.MeshStandardMaterial, meshToCar: THREE.Matrix4, state: IndicatorUniforms): THREE.MeshStandardMaterial {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.frontIndicatorToCar = { value: meshToCar };
    shader.uniforms.frontIndicatorLeft = state.left;
    shader.uniforms.frontIndicatorRight = state.right;
    shader.uniforms.frontIndicatorViewZ = state.viewZ;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 frontIndicatorToCar;\nvarying vec3 frontIndicatorPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfrontIndicatorPos = (frontIndicatorToCar * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 frontIndicatorPos;\nuniform float frontIndicatorLeft, frontIndicatorRight, frontIndicatorViewZ;\nfloat frontEdge(float a,float b){float d=b-a;float w=max(fwidth(d)*.85,0.00005);return smoothstep(-w,w,d);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 fP = frontIndicatorPos;
        float fX = abs(fP.x);
        float fSide = fP.x < 0.0 ? frontIndicatorLeft : frontIndicatorRight;
        float fZone = step(frontIndicatorViewZ, 0.0) * (${FRONT_ZONES[id]});
        float fOn = fZone * step(0.5, fSide);
        float fOff = fZone * step(fSide, -0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.24, 0.004), fOn);
        diffuseColor.rgb *= 1.0 - fOff * 0.72;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(1.0, 0.24, 0.004) * 2.0, fOn);
        totalEmissiveRadiance *= 1.0 - fOff * 0.9;
      `);
  };
  material.customProgramCacheKey = () => `${previousKey}|front-indicator-${id}-v2`;
  return material;
}
