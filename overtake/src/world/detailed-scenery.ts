import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { addFoliageSnow } from './roadside';

export type SceneryQuality = 'low' | 'medium' | 'high';
export function sanitizeSceneryQuality(value: unknown): SceneryQuality {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'high';
}

type Species = 'broadleaf' | 'conifer' | 'fern';
interface Vegetation { meshes: THREE.InstancedMesh[]; height: number; }

// Three shared, textured models replace many unique draw calls. Instances are
// compacted to the visible road window each update; no thousands of hidden
// trees are submitted to the GPU. The low setting keeps the simple fallback.
export class DetailedScenery {
  ready = false;
  private species = {} as Record<Species, Vegetation>;
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private counts: Record<Species, number> = { broadleaf: 0, conifer: 0, fern: 0 };
  readonly capacity = 96;

  constructor(private parent: THREE.Group, private snow: { value: number }, private maxAnisotropy: number, onReady: () => void) {
    void this.load().then(() => { this.ready = true; onReady(); }).catch(error => {
      console.warn('Detailed scenery unavailable; using lightweight scenery.', error);
    });
  }

  private async load() {
    const names: [Species, string][] = [['broadleaf', 'deciduous'], ['conifer', 'conifer'], ['fern', 'fern']];
    const models = await Promise.all(names.map(([, file]) => this.loader.loadAsync(`./models/scenery/${file}.glb`)));
    names.forEach(([kind], index) => {
      const root = models[index].scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), center = box.getCenter(new THREE.Vector3());
      const height = box.max.y - box.min.y;
      const meshes: THREE.InstancedMesh[] = [];
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry.clone();
        // Quantized glTF coordinates cannot be translated safely in an integer
        // BufferAttribute: bake into floats first, then bake the node transform.
        const old = geometry.getAttribute('position');
        const positions = new Float32Array(old.count * 3);
        for (let i = 0; i < old.count; i++) {
          positions[i*3] = old.getX(i); positions[i*3+1] = old.getY(i); positions[i*3+2] = old.getZ(i);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.applyMatrix4(object.matrixWorld);
        geometry.translate(-center.x, -box.min.y, -center.z);
        const original = object.material as THREE.MeshStandardMaterial;
        const material = original.clone();
        material.roughness = Math.max(.8, material.roughness);
        material.metalness = 0;
        if (material.map) material.map.anisotropy = Math.min(8, this.maxAnisotropy);
        if (material.alphaTest > 0) {
          material.side = THREE.DoubleSide;
          addFoliageSnow(material, this.snow);
        }
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = `detailed-${kind}`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.parent.add(mesh);
        meshes.push(mesh);
      });
      this.species[kind] = { meshes, height };
    });
  }

  begin() { this.counts = { broadleaf: 0, conifer: 0, fern: 0 }; }
  place(kind: Species, matrix: THREE.Matrix4) {
    if (!this.ready || this.counts[kind] >= this.capacity) return;
    const i = this.counts[kind]++;
    for (const mesh of this.species[kind].meshes) mesh.setMatrixAt(i, matrix);
  }
  height(kind: Species) { return this.species[kind]?.height || 1; }
  end(visible: boolean) {
    if (!this.ready) return;
    for (const kind of ['broadleaf', 'conifer', 'fern'] as const) {
      for (const mesh of this.species[kind].meshes) {
        mesh.visible = visible;
        mesh.count = visible ? this.counts[kind] : 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
