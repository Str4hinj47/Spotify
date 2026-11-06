import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// RectAreaLight needs the LTC lookup textures from the three.js examples.
RectAreaLightUniformsLib.init();

// A blurred, Fresnel-faded planar reflection based on three.js's Reflector.
// The reflection render target stays linear/HDR; the final ToneMappingEffect in
// the composer handles the display transform. Nine taps give the lacquered
// stage a soft glossy sheen instead of a perfect mirror.
const ShowroomReflectionShader = {
  name: 'OvertakeBlurredReflection',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.34 },
    blur: { value: 0.0032 },
    radius: { value: 4.56 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPos;
    varying vec2 vLocal;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorldPos = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float blur;
    uniform float radius;
    varying vec4 vUv;
    varying vec3 vWorldPos;
    varying vec2 vLocal;

    vec3 tap(vec2 offset) {
      vec4 uv = vUv;
      uv.xy += offset * vUv.w;
      return texture2DProj(tDiffuse, uv).rgb;
    }

    void main() {
      float dist = length(vLocal);
      float radial = 1.0 - smoothstep(radius * 0.52, radius, dist);
      if (radial <= 0.001) discard;
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float grazing = pow(1.0 - clamp(abs(viewDir.y), 0.0, 1.0), 2.2);
      float fade = radial * (0.32 + 0.68 * grazing);
      float b = blur * (0.45 + 0.55 * dist / radius);
      vec3 reflected = tap(vec2(0.0));
      reflected += tap(vec2( b, 0.0));
      reflected += tap(vec2(-b, 0.0));
      reflected += tap(vec2(0.0,  b));
      reflected += tap(vec2(0.0, -b));
      reflected += tap(vec2( b,  b) * 0.72);
      reflected += tap(vec2(-b,  b) * 0.72);
      reflected += tap(vec2( b, -b) * 0.72);
      reflected += tap(vec2(-b, -b) * 0.72);
      reflected = reflected / 9.0 * color;
      gl_FragColor = vec4(reflected, clamp(strength * fade, 0.0, 0.68));
    }`,
};

interface ShowroomOptions { reflections?: boolean }

/** The studio is deliberately self-contained, so it never affects the road. */
export function createShowroom(group: THREE.Group, options: ShowroomOptions = {}) {
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x202931, metalness: .36, roughness: .34 });
  floorMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 showroomPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nshowroomPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 showroomPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 tile = abs(fract(showroomPos.xz / 2.4 + .5) - .5);
        float seams = smoothstep(.493, .5, max(tile.x, tile.y));
        float variation = sin(showroomPos.x * .73) * sin(showroomPos.z * .69);
        diffuseColor.rgb *= (1.0 - seams * .23) * (1.0 + variation * .025);`);
  };
  floorMaterial.customProgramCacheKey = () => 'showroom-floor-v1';
  const floor = new THREE.Mesh(new THREE.CircleGeometry(35, 96), floorMaterial);
  floor.name = 'showroom-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.16;
  floor.receiveShadow = true;
  group.add(floor);

  // A circular wall keeps the scene coherent when the user orbits the car.
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 1024; wallCanvas.height = 512;
  const ctx = wallCanvas.getContext('2d')!;
  ctx.fillStyle = '#53616b'; ctx.fillRect(0, 0, 1024, 512);
  for (let x = 0; x < 1024; x += 128) {
    const grad = ctx.createLinearGradient(x, 0, x + 128, 0);
    grad.addColorStop(0, '#37454e'); grad.addColorStop(.10, '#586872');
    grad.addColorStop(.85, '#4a5963'); grad.addColorStop(1, '#303d45');
    ctx.fillStyle = grad; ctx.fillRect(x, 0, 128, 512);
    ctx.fillStyle = 'rgba(10,16,21,.45)'; ctx.fillRect(x, 0, 3, 512);
  }
  ctx.fillStyle = 'rgba(12,20,26,.45)'; ctx.fillRect(0, 405, 1024, 4);
  const wallMap = new THREE.CanvasTexture(wallCanvas);
  wallMap.colorSpace = THREE.SRGBColorSpace;
  wallMap.wrapS = THREE.RepeatWrapping; wallMap.repeat.x = 3;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 9, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: wallMap, color: 0xbac7cf, emissive: 0x18232c, emissiveIntensity: .8, roughness: .85, metalness: .15, side: THREE.BackSide }));
  wall.name = 'showroom-wall'; wall.position.y = 4.35;
  group.add(wall);

  // Architectural ribs and restrained practical lights, repeated around the
  // entire room instead of a flat backdrop that breaks on orbit.
  const ribGeometry = new THREE.BoxGeometry(.12, 8.6, .24);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x26343c, metalness: .55, roughness: .5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x9ac5ca, toneMapped: false });
  const lightGeometry = new THREE.BoxGeometry(.045, 2.4, .07);
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const x = Math.sin(angle), z = Math.cos(angle);
    const rib = new THREE.Mesh(ribGeometry, ribMat);
    rib.position.set(x * 14.83, 4.15, z * 14.83); rib.rotation.y = angle;
    group.add(rib);
    if (i % 3 === 0) {
      const strip = new THREE.Mesh(lightGeometry, glowMat);
      strip.position.set(x * 14.68, 1.5, z * 14.68); strip.rotation.y = angle;
      group.add(strip);
    }
  }
  const ceilingTrim = new THREE.Mesh(new THREE.TorusGeometry(14.7, .035, 8, 120),
    new THREE.MeshBasicMaterial({ color: 0x8ba8b1 }));
  ceilingTrim.rotation.x = Math.PI / 2; ceilingTrim.position.y = 7.8;
  group.add(ceilingTrim);

  const stage = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 4.85, .16, 96),
    new THREE.MeshStandardMaterial({ color: 0x263139, metalness: .65, roughness: .3 }));
  stage.name = 'showroom-stage'; stage.position.y = -.08; stage.receiveShadow = true;
  group.add(stage);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(4.72, .018, 8, 128),
    new THREE.MeshStandardMaterial({ color: 0x6da8b2, emissive: 0x18464b, emissiveIntensity: .65, metalness: .45, roughness: .35 }));
  trim.name = 'showroom-stage-trim'; trim.rotation.x = Math.PI / 2; trim.position.y = .012;
  group.add(trim);

  // Large, physically shaped softboxes give clearcoat paint long specular
  // highlights that punctual lights and a flat gradient environment cannot.
  const softboxes: Array<{ color: number; panelColor: number; intensity: number; width: number; height: number; pos: [number, number, number] }> = [
    { color: 0xf3f8ff, panelColor: 0xb8cfe0, intensity: 4.5, width: 5.2, height: 1.8, pos: [-3.6, 5.2, 3.8] },
    { color: 0xbcd8ff, panelColor: 0x8fb2d0, intensity: 3.0, width: 4.2, height: 2.6, pos: [4.8, 4.2, -3.0] },
    { color: 0xffd2a1, panelColor: 0xd3aa86, intensity: 1.8, width: 5.8, height: 1.2, pos: [0, 6.2, -5.6] },
  ];
  softboxes.forEach((spec, i) => {
    const light = new THREE.RectAreaLight(spec.color, spec.intensity, spec.width, spec.height);
    light.name = `showroom-softbox-${i}`;
    light.position.set(...spec.pos);
    light.lookAt(0, .65, 0);
    group.add(light);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height),
      new THREE.MeshBasicMaterial({ color: spec.panelColor, toneMapped: false, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide }));
    panel.name = `showroom-softbox-panel-${i}`;
    panel.position.copy(light.position);
    panel.quaternion.copy(light.quaternion);
    group.add(panel);
  });

  // Blurred planar reflection sits just above the lacquered display platform.
  if (options.reflections !== false) {
    const reflector = new Reflector(new THREE.CircleGeometry(4.56, 96), {
      textureWidth: 384,
      textureHeight: 384,
      clipBias: 0.003,
      color: 0xa8bccb,
      multisample: 0,
      shader: ShowroomReflectionShader,
    });
    reflector.name = 'showroom-reflection';
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = .004;
    reflector.renderOrder = 1;
    const material = reflector.material as THREE.ShaderMaterial;
    material.transparent = true;
    material.depthWrite = false;
    material.toneMapped = false;
    material.fog = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    group.add(reflector);
    // Exposed for cleanup/inspection by the game and graphics smoke tests.
    (group.userData as any).reflector = reflector;
  }

  // A soft local contact patch is available even when shadow maps are off.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const shadowCtx = canvas.getContext('2d')!;
  const shadowGradient = shadowCtx.createRadialGradient(64, 64, 6, 64, 64, 64);
  shadowGradient.addColorStop(0, 'rgba(0,0,0,.64)');
  shadowGradient.addColorStop(.55, 'rgba(0,0,0,.38)');
  shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
  shadowCtx.fillStyle = shadowGradient; shadowCtx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  shadow.name = 'showroom-contact-shadow'; shadow.rotation.x = -Math.PI / 2; shadow.position.y = .006;
  shadow.renderOrder = 2;
  group.add(shadow);
  // Four small, soft tire-contact patches add weight without a shadow map.
  const contactGeo = new THREE.PlaneGeometry(1, 1);
  contactGeo.rotateX(-Math.PI / 2);
  const tireContacts = new THREE.InstancedMesh(contactGeo,
    new THREE.MeshBasicMaterial({ map: (shadow.material as THREE.MeshBasicMaterial).map,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: .72 }), 4);
  tireContacts.name = 'showroom-tire-contacts';
  tireContacts.count = 0;
  tireContacts.frustumCulled = false;
  tireContacts.renderOrder = 2;
  group.add(tireContacts);
  shadow.userData.tireContacts = tireContacts;
  return shadow;
}
