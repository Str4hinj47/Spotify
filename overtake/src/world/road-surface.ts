import * as THREE from 'three';

/** Shared, continuously varying weather uniforms for the road shaders. */
export interface RoadSurfaceUniforms {
  wet: { value: number };
  snow: { value: number };
  rain: { value: number };
  time: { value: number };
}

// Road UVs are across-width 0..1 and longitudinal distance in metres. Keeping
// texture repeat in metres prevents the asphalt from swimming as road moves.
function loadTexture(name: string, acrossMetres: number, tileMetres: number, color: boolean, anisotropy: number) {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const texture = new THREE.TextureLoader().load(`${base}textures/road/${name}.jpg`);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(acrossMetres / tileMetres, 1 / tileMetres);
  texture.anisotropy = anisotropy;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const ROAD_NOISE = `
  float surfaceHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float surfaceNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(surfaceHash(i), surfaceHash(i + vec2(1.0, 0.0)), f.x),
               mix(surfaceHash(i + vec2(0.0, 1.0)), surfaceHash(i + vec2(1.0)), f.x), f.y);
  }
  float surfaceFbm(vec2 p) {
    return surfaceNoise(p) * 0.58 + surfaceNoise(p * 2.03 + 13.7) * 0.28 + surfaceNoise(p * 4.07 - 4.3) * 0.14;
  }
`;

function uniforms(shader: THREE.WebGLProgramParametersWithUniforms, values: RoadSurfaceUniforms) {
  shader.uniforms.roadWet = values.wet;
  shader.uniforms.roadSnow = values.snow;
  shader.uniforms.roadRain = values.rain;
  shader.uniforms.roadTime = values.time;
}

/** Photographed asphalt + normal map, with wet film and irregular puddles. */
export function createAsphaltMaterial(roadWidth: number, aniso: number, values: RoadSurfaceUniforms) {
  const material = new THREE.MeshStandardMaterial({
    map: loadTexture('asphalt-albedo', roadWidth, 3.2, true, aniso),
    normalMap: loadTexture('asphalt-normal', roadWidth, 3.2, false, aniso),
    normalScale: new THREE.Vector2(0.58, 0.58),
    color: 0xb2b5ba, roughness: 0.94, metalness: 0.02,
  });
  material.onBeforeCompile = (shader) => {
    uniforms(shader, values);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 roadUV;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nroadUV = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 roadUV;
      uniform float roadWet, roadRain, roadTime, roadSnow;
      ${ROAD_NOISE}
      vec2 roadMetres() { return vec2((roadUV.x - 0.5) * ${roadWidth.toFixed(3)}, roadUV.y); }
      float puddleAt(vec2 p) {
        // Large, connected shallow depressions with irregular shorelines.
        float basin = surfaceFbm(p * vec2(0.34, 0.20) + 5.6);
        return smoothstep(0.52, 0.63, basin) * smoothstep(0.18, 0.75, roadWet);
      }
    `).replace('#include <color_fragment>', `#include <color_fragment>
      vec2 roadPos = roadMetres();
      float puddle = puddleAt(roadPos);
      // Two subtle, worn wheel paths per lane, not alternating rectangles.
      float tracks = 0.0;
      for (int i = 0; i < 4; i++) {
        float x = (i == 0) ? -2.95 : (i == 1) ? -1.25 : (i == 2) ? 1.25 : 2.95;
        tracks = max(tracks, 1.0 - smoothstep(0.20, 0.42, abs(roadPos.x - x)));
      }
      diffuseColor.rgb *= mix(1.0, 0.89, tracks * 0.42);
      diffuseColor.rgb *= 1.0 - roadWet * 0.20;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.075, 0.095), puddle * 0.36);
      // A broken film of compacted, dirty slush remains in cleared tracks.
      float slush = surfaceFbm(roadPos * vec2(1.6, 0.9) + 21.0) * roadSnow;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.25, 0.28, 0.30), slush * mix(0.12, 0.42, tracks));
      // Tiny animated ringlets reveal standing water when rain is falling.
      vec2 cell = roadPos * 1.5;
      vec2 cellID = floor(cell);
      vec2 drop = vec2(surfaceHash(cellID + 7.2), surfaceHash(cellID + 31.5));
      float phase = fract(roadTime * 0.8 + surfaceHash(cellID));
      float radius = length(fract(cell) - drop);
      float ring = (1.0 - smoothstep(0.018, 0.045, abs(radius - phase * 0.42))) * (1.0 - phase);
      diffuseColor.rgb += vec3(0.075, 0.095, 0.11) * ring * puddle * roadRain;
    `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.095, puddle);
    `).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.35, puddle);
    `);
  };
  material.customProgramCacheKey = () => 'road-asphalt-pbr-v2';
  return material;
}

/** Rough snow is rendered as a separate raised, patchy mesh, not road tint. */
export function createSnowMaterial(snowWidth: number, aniso: number, values: RoadSurfaceUniforms) {
  const material = new THREE.MeshStandardMaterial({
    map: loadTexture('snow-albedo', snowWidth, 2.4, true, aniso),
    normalMap: loadTexture('snow-normal', snowWidth, 2.4, false, aniso),
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0xe3ebef, roughness: 1, metalness: 0,
    alphaTest: 0.5, alphaToCoverage: true, depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
    uniforms(shader, values);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 roadUV;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nroadUV = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 roadUV;
      uniform float roadSnow;
      ${ROAD_NOISE}
    `).replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p = vec2((roadUV.x - 0.5) * ${snowWidth.toFixed(3)}, roadUV.y);
      // Warped, multi-scale snow deposits: finer, broken edges instead of
      // long smooth white blobs. Tire-polished paths stay mostly exposed.
      vec2 warp = vec2(surfaceNoise(p * 0.71 + 4.1), surfaceNoise(p * 0.64 - 8.2)) - 0.5;
      vec2 uneven = p + warp * 0.75;
      float drifts = surfaceFbm(uneven * vec2(0.52, 0.34) + 13.0);
      float fine = surfaceFbm(uneven * vec2(1.7, 1.25) - 4.0);
      float edge = smoothstep(2.7, 4.35, abs(p.x));
      float tracks = 0.0;
      for (int i = 0; i < 4; i++) {
        float x = (i == 0) ? -2.95 : (i == 1) ? -1.25 : (i == 2) ? 1.25 : 2.95;
        float wander = 0.08 * sin(p.y * 0.05 + float(i));
        tracks = max(tracks, 1.0 - smoothstep(0.18, 0.43, abs(p.x - x + wander)));
      }
      float field = 0.22 + drifts * 0.55 + fine * 0.20 + edge * 0.22 - tracks * 0.28;
      float threshold = mix(0.96, 0.49, smoothstep(0.02, 1.0, roadSnow));
      float snowPatch = smoothstep(threshold - 0.025, threshold + 0.025, field);
      // Slightly dirty compacted snow, with fine-grained surface variation.
      float grain = surfaceNoise(p * 5.5);
      diffuseColor.rgb *= mix(0.88, 1.04, grain) * (1.0 - tracks * 0.18);
      diffuseColor.a *= snowPatch;

    `);
  };
  material.customProgramCacheKey = () => 'road-snow-depth-v3';
  return material;
}

/** Gravel-textured roadside shoulder. */
export function createShoulderMaterial(width: number, aniso: number) {
  return new THREE.MeshStandardMaterial({
    map: loadTexture('gravel-albedo', width, 2.8, true, aniso),
    normalMap: loadTexture('gravel-normal', width, 2.8, false, aniso),
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0x817b71, roughness: 1,
  });
}

/** Slightly weathered thermoplastic paint instead of perfectly flat lines. */
export function createRoadMarkingMaterial(color: number, values: RoadSurfaceUniforms) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  material.onBeforeCompile = (shader) => {
    uniforms(shader, values);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 markingPosition;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nmarkingPosition = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 markingPosition;
      uniform float roadWet;
      ${ROAD_NOISE}
    `).replace('#include <color_fragment>', `#include <color_fragment>
      float wear = surfaceNoise(markingPosition * 5.0);
      float scuff = smoothstep(0.22, 0.48, wear);
      diffuseColor.rgb *= mix(0.62, 1.0, scuff) * (1.0 - roadWet * 0.14);
    `);
  };
  material.customProgramCacheKey = () => 'worn-road-marking-v1';
  return material;
}
