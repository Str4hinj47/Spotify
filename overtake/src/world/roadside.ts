import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Generic caution signs: a galvanized pole and a bordered diamond with a
// simple symbol. Shared geometry is instanced along the road in both directions.
export function createRoadsideSignGeometry() {
  const pole = new THREE.CylinderGeometry(0.045, 0.065, 2.8, 8);
  pole.translate(0, 1.4, 0);
  const diamond = (size: number, depth: number, z: number) => {
    const g = new THREE.BoxGeometry(size, size, depth);
    g.rotateZ(Math.PI / 4); g.translate(0, 2.55, z); return g;
  };
  const border = diamond(0.94, 0.07, 0);
  const face = diamond(0.82, 0.012, 0.042);
  const stroke = new THREE.BoxGeometry(0.09, 0.38, 0.012);
  stroke.translate(0, 2.62, 0.054);
  const dot = new THREE.BoxGeometry(0.10, 0.10, 0.012);
  dot.translate(0, 2.32, 0.054);
  const symbol = mergeGeometries([stroke, dot], false)!;
  stroke.dispose(); dot.dispose();
  return { pole, border, face, symbol };
}

// Snow catches upward-facing needles and leaves instead of bleaching the
// entire crown uniformly. Local coordinates stay fixed on instanced trees.
export function addFoliageSnow(material: THREE.MeshStandardMaterial, snow: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.foliageSnow = snow;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float foliageUp; varying vec3 foliageLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfoliageUp = normal.y; foliageLocal = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float foliageSnow; varying float foliageUp; varying vec3 foliageLocal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float variation = 0.82 + 0.18 * sin(foliageLocal.x * 2.7 + foliageLocal.z * 3.1);
        float cap = smoothstep(0.18, 0.65, foliageUp) * foliageSnow * variation;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.89, 0.92), cap * 0.78);`);
  };
  material.customProgramCacheKey = () => 'foliage-snow-caps-v1';
}
