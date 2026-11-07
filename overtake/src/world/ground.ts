import * as THREE from 'three';
import { CLOUD_SHADOW_GLSL } from './cloud-shadows';

// A photographic-style surface sampled in world space so the ground does not
// slide as the road ribbon is recycled. Large-scale variation breaks up tiling.
export function createGroundMaterial(cloud: { value: number }, time: { value: number }) {
  const texture = new THREE.TextureLoader().load('./textures/landscape/grass.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  const sand = new THREE.TextureLoader().load('./textures/landscape/desert-ground.jpg');
  sand.colorSpace = THREE.SRGBColorSpace;
  sand.wrapS = sand.wrapT = THREE.RepeatWrapping;
  sand.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ color: 0x33402f, roughness: 1 });
  const detail = { value: 1 };
  const dry = { value: 0 };
  const snow = { value: 0 };
  mat.userData.groundDetail = { detail, dry, snow };
  mat.onBeforeCompile = shader => {
    shader.uniforms.cloudShadowStrength = cloud; shader.uniforms.cloudShadowTime = time;
    shader.uniforms.meadowMap = { value: texture };
    shader.uniforms.sandMap = { value: sand };
    shader.uniforms.groundDetail = detail; shader.uniforms.groundDry = dry; shader.uniforms.groundSnow = snow;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;');
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGroundWorld; uniform sampler2D meadowMap; uniform sampler2D sandMap;
      uniform float groundDetail; uniform float groundDry; uniform float groundSnow;
      ${CLOUD_SHADOW_GLSL}
      float groundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float groundNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float broad = groundNoise(vGroundWorld.xz * 0.022);
      float fine = groundNoise(vGroundWorld.xz * 0.20);
      vec3 grass = texture2D(meadowMap, vGroundWorld.xz * 0.11).rgb;
      vec3 grassLarge = texture2D(meadowMap, vGroundWorld.xz * 0.031 + vec2(0.37,0.18)).rgb;
      vec3 detail = clamp(mix(grass, grassLarge, 0.35) * 3.5, 0.4, 1.6);
      if (groundDry > 0.001) {
        vec3 sandSample = texture2D(sandMap, vGroundWorld.xz * 0.14).rgb;
        float sandLuma = dot(sandSample, vec3(0.299, 0.587, 0.114));
        // The biome colour supplies the desert tint; the texture supplies
        // soil and pebbles instead of desaturated meadow blades.
        vec3 sandDetail = clamp(vec3(sandLuma * 2.1), 0.48, 1.45);
        detail = mix(detail, sandDetail, groundDry);
      }
      float strength = groundDetail * (1.0 - groundSnow * 0.8);
      diffuseColor.rgb *= mix(vec3(1.0), detail, strength) * (0.78 + broad * 0.28 + fine * 0.12) * cloudShadowAt(vGroundWorld.xz);`);
  };
  mat.customProgramCacheKey = () => 'overtake-ground-photographic-v4';
  return mat;
}
