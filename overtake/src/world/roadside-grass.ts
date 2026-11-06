import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { biomeParams } from './biomes.mjs';
import { terrainOffset } from './terrain.mjs';
import type { SceneryQuality } from './detailed-scenery';

function hash(n: number) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

/** Crossed, alpha-tested clumps live in stable world slots, only on the verge. */
export class RoadsideGrass {
  readonly mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private right = new THREE.Vector3();

  constructor(group: THREE.Group, snow: { value: number }, time: { value: number }, anisotropy: number,
    private road: { centerX: (s: number) => number; centerY: (s: number) => number; rightAt: (s: number, out: THREE.Vector3) => THREE.Vector3 }) {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const texture = new THREE.TextureLoader().load(`${base}textures/landscape/roadside-grass.png`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, anisotropy);
    const planes = [0, Math.PI / 3, Math.PI * 2 / 3].map(angle => {
      const plane = new THREE.PlaneGeometry(1.9, 1);
      plane.translate(0, .5, 0);
      plane.rotateY(angle);
      return plane;
    });
    const geometry = mergeGeometries(planes)!;
    for (const plane of planes) plane.dispose();
    const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, alphaTest: .38, roughness: 1 });
    material.onBeforeCompile = shader => {
      shader.uniforms.grassSnow = snow;
      shader.uniforms.grassTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float grassTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.x += sin(grassTime * 0.8 + instanceMatrix[3].x * .45 + instanceMatrix[3].z * .25) * .035 * position.y;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float grassSnow;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.8, .85, .84), grassSnow * .55);`);
    };
    material.customProgramCacheKey = () => 'roadside-grass-v1';
    this.mesh = new THREE.InstancedMesh(geometry, material, 192);
    this.mesh.name = 'roadside-grass-clumps';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(this.mesh);
  }

  update(base: number, quality: SceneryQuality, snow: number) {
    if (quality === 'low') { this.mesh.visible = false; this.mesh.count = 0; return; }
    const rows = quality === 'high' ? 48 : 24;
    let count = 0;
    for (let i = 0; i < rows; i++) for (const side of [-1, 1]) for (let lane = 0; lane < 2; lane++) {
      const k = Math.floor((base - 24) / 3.5) + i;
      const seed = k * 193 + side * 47 + lane * 71;
      const s = k * 3.5 + hash(seed + 1) * 3.5;
      const biome = biomeParams(s);
      // Desert and built-up outskirts have fewer clumps; snow buries them.
      const density = Math.min(.95, .2 + biome.treeDensity * .85) * (1 - Math.min(1, snow) * .85);
      if (hash(seed + 2) > density) continue;
      const off = side * (8.8 + lane * 6 + hash(seed + 3) * 7);
      const r = this.road.rightAt(s, this.right);
      const scale = .45 + hash(seed + 4) * .45;
      this.dummy.position.set(this.road.centerX(s) + r.x * off, this.road.centerY(s) - .6 + terrainOffset(s, off) - .08, -s + r.z * off);
      this.dummy.rotation.set(0, hash(seed + 5) * Math.PI * 2, 0);
      this.dummy.scale.set(scale * (1 + hash(seed + 6) * .35), scale, scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count++, this.dummy.matrix);
    }
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
