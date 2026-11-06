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

/** Cheap forest clusters bridge the near trees and mountain backdrop. */
export class MidgroundTreeline {
  readonly mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private right = new THREE.Vector3();
  constructor(group: THREE.Group, snow: { value: number }, anisotropy: number,
    private road: { centerX: (s: number) => number; centerY: (s: number) => number; rightAt: (s: number, out: THREE.Vector3) => THREE.Vector3; roadYaw: (s: number) => number }) {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const map = new THREE.TextureLoader().load(`${base}textures/landscape/treeline.png`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, anisotropy);
    const planes = [0, Math.PI / 2].map(angle => {
      const p = new THREE.PlaneGeometry(2, 1);
      p.translate(0, .5, 0); p.rotateY(angle);
      return p;
    });
    const geometry = mergeGeometries(planes)!;
    planes.forEach(p => p.dispose());
    const material = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, alphaTest: .42, roughness: 1 });
    material.onBeforeCompile = shader => {
      shader.uniforms.treelineSnow = snow;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float treelineSnow;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float frost = smoothstep(.15, .75, vMapUv.y) * treelineSnow * .30;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.75, .82, .83), frost);`);
    };
    material.customProgramCacheKey = () => 'midground-treeline-snow-v1';
    this.mesh = new THREE.InstancedMesh(geometry, material, 48);
    this.mesh.name = 'midground-treeline';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(this.mesh);
  }

  update(base: number, quality: SceneryQuality) {
    if (quality === 'low') { this.mesh.visible = false; this.mesh.count = 0; return; }
    const high = quality === 'high';
    const spacing = high ? 30 : 55, rows = high ? 24 : 12;
    const start = Math.floor((base - 105) / spacing);
    let count = 0;
    for (let i = 0; i < rows; i++) for (const side of [-1, 1]) {
      const k = start + i, seed = k * 241 + side * 157;
      const s = k * spacing + hash(seed + 1) * spacing;
      const biome = biomeParams(s);
      const weight = (id: string) => (biome.a === id ? 1 - biome.blend : 0) + (biome.b === id ? biome.blend : 0);
      const density = weight('forest') * .78 + weight('alpine') * .42 + weight('meadow') * .16 + weight('urban') * .04;
      if (hash(seed + 2) > density) continue;
      const off = side * (100 + hash(seed + 3) * 26);
      const right = this.road.rightAt(s, this.right);
      const width = 35 + hash(seed + 4) * 16, height = 12 + hash(seed + 5) * 5;
      this.dummy.position.set(this.road.centerX(s) + right.x * off,
        this.road.centerY(s) - .6 + terrainOffset(s, off) - 1.3, -s + right.z * off);
      this.dummy.rotation.set(0, this.road.roadYaw(s) + (hash(seed + 6) - .5) * .28, 0);
      this.dummy.scale.set(width / 2, height, width / 2);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count++, this.dummy.matrix);
    }
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
