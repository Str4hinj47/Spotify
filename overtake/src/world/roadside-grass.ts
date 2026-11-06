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
  readonly wildflowers: THREE.InstancedMesh;
  readonly desertScrub: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private right = new THREE.Vector3();

  constructor(group: THREE.Group, snow: { value: number }, time: { value: number }, anisotropy: number,
    private road: { centerX: (s: number) => number; centerY: (s: number) => number; rightAt: (s: number, out: THREE.Vector3) => THREE.Vector3 }) {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const planes = [0, Math.PI / 3, Math.PI * 2 / 3].map(angle => {
      const plane = new THREE.PlaneGeometry(1.9, 1);
      plane.translate(0, .5, 0);
      plane.rotateY(angle);
      return plane;
    });
    const geometry = mergeGeometries(planes)!;
    for (const plane of planes) plane.dispose();
    const makeMesh = (file: string, name: string) => {
      const texture = new THREE.TextureLoader().load(`${base}textures/landscape/${file}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, anisotropy);
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
      const mesh = new THREE.InstancedMesh(geometry, material, 192);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
      return mesh;
    };
    this.mesh = makeMesh('roadside-grass', 'roadside-grass-clumps');
    this.wildflowers = makeMesh('wildflower', 'roadside-wildflowers');
    this.desertScrub = makeMesh('desert-scrub', 'roadside-desert-scrub');
  }

  update(base: number, quality: SceneryQuality, snow: number) {
    const meshes = [this.mesh, this.wildflowers, this.desertScrub];
    if (quality === 'low') { for (const mesh of meshes) { mesh.visible = false; mesh.count = 0; } return; }
    const rows = quality === 'high' ? 48 : 24;
    const counts = [0, 0, 0];
    for (let i = 0; i < rows; i++) for (const side of [-1, 1]) for (let lane = 0; lane < 2; lane++) {
      const k = Math.floor((base - 24) / 3.5) + i;
      const seed = k * 193 + side * 47 + lane * 71;
      const s = k * 3.5 + hash(seed + 1) * 3.5;
      const biome = biomeParams(s);
      // Species blend continuously along with the biome, rather than putting
      // the same green clumps in the desert. Stable hashes avoid slot jitter.
      const weight = (id: string) => (biome.a === id ? 1 - biome.blend : 0) + (biome.b === id ? biome.blend : 0);
      const desert = weight('desert');
      const isScrub = hash(seed + 7) < desert;
      const flowers = weight('meadow') * .48 + weight('forest') * .12 + weight('alpine') * .08;
      const species = isScrub ? 2 : hash(seed + 8) < flowers ? 1 : 0;
      const density = (isScrub ? .65 : Math.min(.95, .2 + biome.treeDensity * .85)) * (1 - Math.min(1, snow) * .85);
      if (hash(seed + 2) > density) continue;
      const off = side * (8.8 + lane * 6 + hash(seed + 3) * 7);
      const r = this.road.rightAt(s, this.right);
      const scale = (species === 2 ? .65 : .45) + hash(seed + 4) * .45;
      this.dummy.position.set(this.road.centerX(s) + r.x * off, this.road.centerY(s) - .6 + terrainOffset(s, off) - .08, -s + r.z * off);
      this.dummy.rotation.set(0, hash(seed + 5) * Math.PI * 2, 0);
      this.dummy.scale.set(scale * (1 + hash(seed + 6) * .35), scale, scale);
      this.dummy.updateMatrix();
      meshes[species].setMatrixAt(counts[species]++, this.dummy.matrix);
    }
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].count = counts[i];
      meshes[i].visible = counts[i] > 0;
      meshes[i].instanceMatrix.needsUpdate = true;
    }
  }
}
