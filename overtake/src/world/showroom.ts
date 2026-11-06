import * as THREE from 'three';

/** The studio is deliberately self-contained, so it never affects the road. */
export function createShowroom(group: THREE.Group) {
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x202931, metalness: .28, roughness: .48 });
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
    new THREE.MeshStandardMaterial({ map: wallMap, color: 0xbac7cf, roughness: .85, metalness: .15, side: THREE.BackSide }));
  wall.name = 'showroom-wall'; wall.position.y = 4.35;
  group.add(wall);

  // Architectural ribs and restrained practical lights, repeated around the
  // entire room instead of a flat backdrop that breaks on orbit.
  const ribGeometry = new THREE.BoxGeometry(.12, 8.6, .24);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x26343c, metalness: .55, roughness: .5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xb9eaf2, toneMapped: false });
  const lightGeometry = new THREE.BoxGeometry(.045, 2.4, .07);
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const x = Math.sin(angle), z = Math.cos(angle);
    const rib = new THREE.Mesh(ribGeometry, ribMat);
    rib.position.set(x * 14.83, 4.15, z * 14.83); rib.rotation.y = angle;
    group.add(rib);
    if (i % 3 === 0) {
      const strip = new THREE.Mesh(lightGeometry, glowMat);
      strip.position.set(x * 14.68, 3.4, z * 14.68); strip.rotation.y = angle;
      group.add(strip);
    }
  }
  const ceilingTrim = new THREE.Mesh(new THREE.TorusGeometry(14.7, .035, 8, 120),
    new THREE.MeshBasicMaterial({ color: 0x8ba8b1 }));
  ceilingTrim.rotation.x = Math.PI / 2; ceilingTrim.position.y = 7.8;
  group.add(ceilingTrim);

  const stage = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 4.85, .16, 96),
    new THREE.MeshStandardMaterial({ color: 0x263139, metalness: .55, roughness: .4 }));
  stage.name = 'showroom-stage'; stage.position.y = -.08; stage.receiveShadow = true;
  group.add(stage);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(4.72, .018, 8, 128),
    new THREE.MeshStandardMaterial({ color: 0x6da8b2, emissive: 0x18464b, emissiveIntensity: .65, metalness: .45, roughness: .35 }));
  trim.name = 'showroom-stage-trim'; trim.rotation.x = Math.PI / 2; trim.position.y = .012;
  group.add(trim);

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
  group.add(shadow);
  return shadow;
}
