import * as THREE from 'three';

// A photographic-style surface sampled in world space so the ground does not
// slide as the road ribbon is recycled. Large-scale variation breaks up tiling.
export function createGroundMaterial() {
  const texture = new THREE.TextureLoader().load('./textures/landscape/grass.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ color: 0x33402f, roughness: 1 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.meadowMap = { value: texture };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;');
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGroundWorld; uniform sampler2D meadowMap;
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
      diffuseColor.rgb *= detail * (0.78 + broad * 0.28 + fine * 0.12);`);
  };
  mat.customProgramCacheKey = () => 'overtake-ground-photographic-v2';
  return mat;
}
