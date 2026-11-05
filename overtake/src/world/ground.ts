import * as THREE from 'three';

// Procedural world-space variation keeps the fields anchored to the landscape
// as the road ribbon and distant ground recenter around the player.
export function createGroundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x33402f, roughness: 1 });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;');
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGroundWorld;
      float groundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float groundNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float broad = groundNoise(vGroundWorld.xz * 0.022);
      float fine = groundNoise(vGroundWorld.xz * 0.20);
      float grain = groundHash(floor(vGroundWorld.xz * 2.0));
      diffuseColor.rgb *= 0.78 + broad * 0.27 + fine * 0.14 + grain * 0.06;`);
  };
  mat.customProgramCacheKey = () => 'overtake-ground-v1';
  return mat;
}
