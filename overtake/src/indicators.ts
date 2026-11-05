import * as THREE from 'three';
import type { CarId } from './catalog';

// Coordinates are measured in the car's oriented, ground-level space, not
// world space. The shader runs only on existing lamp meshes and thus follows
// their original lens shapes, depth, occlusion, perspective and animation.
export type IndicatorUniforms = { left: { value: number }; right: { value: number }; viewZ: { value: number } };
type Config = { materials: string[]; x: [number, number]; y: [number, number]; z: number; color: 'amber' | 'red'; ellipse?: [number, number, number, number] };
export const INDICATOR_LAYOUTS: Record<CarId, Config> = {
  golf:       { materials: ['taillight__Rear-lights'], x: [0.50, 0.82], y: [0.80, 0.88], z: 1.63, color: 'amber' },
  mercedes:   { materials: ['photo__W222 - Photo Textures Rough 0'], x: [0.57, 0.86], y: [0.58, 0.72], z: 2.04, color: 'amber' },
  audi:       { materials: ['taillight__Rear_secondary_emission', 'taillight__Rear LIght_clear', 'taillight__Rear_main_emission', 'other__Material.005'], x: [0.35, 0.82], y: [0.86, 0.96], z: 1.95, color: 'amber' },
  mustang:    { materials: ['taillight__M_Tailight1', 'taillight__M_Tailight2'], x: [0.35, 0.72], y: [0.65, 0.78], z: 2.18, color: 'red' },
  ferrari:    { materials: ['taillight__Rear_Light_Cover.000', 'taillight__Rear_Light_RedSide.000', 'taillight__Rear_Light_Tex.000'], x: [0.55, 0.86], y: [0.67, 0.85], z: 1.61, color: 'amber', ellipse: [0.665, 0.75, 0.76, 0.06] },
  r8:         { materials: ['taillight__r8'], x: [0.36, 0.85], y: [0.62, 0.674], z: 1.80, color: 'amber' },
  challenger: { materials: ['taillight__challenger'], x: [0.25, 0.80], y: [0.80, 0.96], z: 2.32, color: 'red' },
};

export function isIndicatorMaterial(id: CarId, material: THREE.Material) {
  return INDICATOR_LAYOUTS[id].materials.includes(material.name);
}

/** Clone one mesh material so its transform, signal and brake state are local. */
export function indicatorMaterial(id: CarId, source: THREE.Material, meshToCar: THREE.Matrix4, state: IndicatorUniforms) {
  const layout = INDICATOR_LAYOUTS[id];
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
  material.onBeforeCompile = shader => {
    shader.uniforms.indicatorToCar = { value: meshToCar };
    shader.uniforms.indicatorLeft = state.left;
    shader.uniforms.indicatorRight = state.right;
    shader.uniforms.indicatorViewZ = state.viewZ;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 indicatorToCar;\nvarying vec3 indicatorPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nindicatorPos = (indicatorToCar * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 indicatorPos;\nuniform float indicatorLeft, indicatorRight, indicatorViewZ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sideState = indicatorPos.x < 0.0 ? indicatorLeft : indicatorRight;
        float ax = abs(indicatorPos.x);
        float zone = step(0.0, indicatorViewZ) * step(${f(layout.x[0])}, ax) * step(ax, ${f(layout.x[1])})
          * step(${f(layout.y[0])}, indicatorPos.y) * step(indicatorPos.y, ${f(layout.y[1])}) * step(${f(layout.z)}, indicatorPos.z);
        ${ellipse}
        float signalOn = zone * step(0.5, sideState);
        float signalOff = ${dark};
        diffuseColor.rgb = mix(diffuseColor.rgb, ${color}, signalOn);
        diffuseColor.rgb *= 1.0 - signalOff * 0.80;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, ${color} * 2.0, signalOn);
        totalEmissiveRadiance *= 1.0 - signalOff * 0.95;
      `);
  };
  material.customProgramCacheKey = () => `rear-indicator-${id}-v2`;
  return material;
}
