import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CARS, type CarId } from './catalog';
import { extractWheels, animateWheels, countWheels, type WheelRig } from './wheels';
import { createStudioEnvironment } from './world/lighting';

export interface CarModel {
  id: CarId;
  scene: THREE.Group;
  length: number;
  width: number;
  height: number;
  wheels: WheelRig;
}

// Some source models export nose-first along +Z; the game drives toward -Z.
// The Ferrari source mesh is also yawed ~13.5° inside its own bounding box, so
// a plain 180° flip leaves it visibly diagonal to the road. Bake the measured
// PCA correction (paint/tire/glass principal axis) into the same wrapper.
const FERRARI_SKEW = (13.5 * Math.PI) / 180;
const ORIENTATION: Record<CarId, number> = {
  golf: 0,
  mercedes: 0,
  audi: Math.PI,
  mustang: 0,
  ferrari: Math.PI + FERRARI_SKEW,
};

export class ModelLibrary {
  private loader: GLTFLoader;
  private models = new Map<CarId, CarModel>();
  private paintCache = new Map<string, THREE.MeshStandardMaterial>();
  private paintOverrides = new Map<CarId, number>();
  private thumbs = new Map<CarId, string>();
  private lamps: { mat: THREE.MeshStandardMaterial; kind: 'head' | 'tail' }[] = [];

  constructor() {
    const draco = new DRACOLoader();
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    draco.setDecoderPath(`${base}draco/`);
    draco.setDecoderConfig({ type: 'wasm' });
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);
  }

  async loadAll(onProgress: (done: number, total: number, label: string) => void) {
    let done = 0;
    for (const spec of CARS) {
      onProgress(done, CARS.length, spec.name);
      const gltf: GLTF = await this.loader.loadAsync(`${(import.meta as any).env?.BASE_URL ?? '/'}models/${spec.id}.glb`);
      const scene = gltf.scene;
      scene.name = spec.id;
      scene.rotation.y = ORIENTATION[spec.id];
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      // Recenter on X/Z and sit the tires on y=0 (export is already normalized,
      // but this guards against tiny offsets).
      const center = box.getCenter(new THREE.Vector3());
      scene.position.x -= center.x;
      scene.position.z -= center.z;
      scene.position.y -= box.min.y;
      const tuned = new Set<THREE.Material>();
      const replaced = new Map<THREE.Material, THREE.Material>();
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = false;
          mesh.frustumCulled = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (let mi = 0; mi < mats.length; mi++) {
            const original = mats[mi];
            const swap = replaced.get(original);
            if (swap) { mats[mi] = swap; continue; }
            if (tuned.has(original)) continue;
            tuned.add(original);
            const std = original as THREE.MeshStandardMaterial;
            std.envMapIntensity = 0.9;
            if (original.name.startsWith('paint__')) {
              // Real automotive paint: a coloured basecoat under a smooth
              // clearcoat. Keep metalness moderate so solid colours do not turn
              // into chrome, and let the IBL softboxes draw the highlight.
              let phys: THREE.MeshPhysicalMaterial;
              if ((original as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
                phys = original as THREE.MeshPhysicalMaterial;
              } else {
                phys = new THREE.MeshPhysicalMaterial({
                  name: original.name,
                  color: std.color,
                  map: std.map,
                  normalMap: std.normalMap,
                  roughnessMap: std.roughnessMap,
                  metalnessMap: std.metalnessMap,
                });
                replaced.set(original, phys);
                mats[mi] = phys;
              }
              phys.metalness = 0.25;
              phys.roughness = 0.32;
              phys.clearcoat = 1.0;
              phys.clearcoatRoughness = 0.04;
              phys.envMapIntensity = 1.1;
              phys.specularIntensity = 1.0;
            } else if (original.name.startsWith('glass__')) {
              std.color.set(0x0a0f14);
              std.metalness = 0.0;
              std.roughness = 0.05;
              std.transparent = true;
              std.opacity = 0.72;
              std.envMapIntensity = 1.4;
            } else if (original.name.startsWith('chrome__')) {
              std.metalness = 1.0;
              std.roughness = 0.08;
              std.envMapIntensity = 1.0;
            } else if (original.name.startsWith('rim__')) {
              std.metalness = 1.0;
              std.roughness = 0.18;
              std.envMapIntensity = 0.9;
            } else if (original.name.startsWith('headlight__')) {
              std.color.set(0x0c1016);
              std.metalness = 0.1;
              std.roughness = 0.15;
              std.emissive = new THREE.Color(0xf6f9ff);
              std.emissiveIntensity = 0.12;
              this.lamps.push({ mat: std, kind: 'head' });
            } else if (original.name.startsWith('taillight__')) {
              std.color.set(0x2a0404);
              std.metalness = 0.1;
              std.roughness = 0.25;
              std.emissive = new THREE.Color(0xff2020);
              std.emissiveIntensity = 0.35;
              this.lamps.push({ mat: std, kind: 'tail' });
            } else if (original.name.startsWith('tire__') || /w222 - wheel$/i.test(original.name)) {
              // The Mercedes source calls its rubber "W222 - Wheel", so the
              // converter exported it as a light-grey "other" material. Treat
              // it as tire rubber here instead of letting it render white.
              std.color.set(0x0b0b0c);
              std.roughness = 0.95;
              std.metalness = 0.0;
              std.envMapIntensity = 0.35;
            } else if (original.name.startsWith('trim__')) {
              std.roughness = 0.6;
              std.metalness = 0.1;
            }
          }
          if (Array.isArray(mesh.material)) mesh.material = mats;
          else mesh.material = mats[0];
        }
      });
      const wheels = extractWheels(scene, size);
      this.models.set(spec.id, {
        id: spec.id,
        scene,
        length: size.z,
        width: size.x,
        height: size.y,
        wheels,
      });
      done++;
      onProgress(done, CARS.length, spec.name);
    }
  }

  get(id: CarId): CarModel {
    const m = this.models.get(id);
    if (!m) throw new Error(`Model ${id} not loaded`);
    return m;
  }

  /** User-selected paint for a model. Applies to the player car and traffic. */
  setPaint(id: CarId, color: number | null) {
    if (color === null) this.paintOverrides.delete(id);
    else this.paintOverrides.set(id, color);
    this.thumbs.delete(id);
  }

  getPaint(id: CarId): number | undefined {
    return this.paintOverrides.get(id);
  }

  /** Head/tail lamp emissive strength, driven by time of day and weather. */
  setLamps(head: number, tail: number) {
    for (const l of this.lamps) l.mat.emissiveIntensity = l.kind === 'head' ? head : tail;
  }

  animateWheels(wrapper: THREE.Object3D, speed: number, steerAngle: number, dt: number) {
    animateWheels(wrapper, speed, steerAngle, dt);
  }

  wheelCount(wrapper: THREE.Object3D) {
    return countWheels(wrapper);
  }

  /** Clone a car. Explicit paint wins, then the user's saved paint override. */
  create(id: CarId, opts: { paint?: number; player?: boolean } = {}): THREE.Group {
    const source = this.get(id);
    const paint = opts.paint ?? this.paintOverrides.get(id);
    const inner = source.scene.clone(true);
    const wrapper = new THREE.Group();
    wrapper.name = `${id}_wrapper`;
    wrapper.add(inner);
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !!opts.player;
      mesh.receiveShadow = false;
      const recolor = (mat: THREE.Material) => {
        if (paint !== undefined && mat.name.startsWith('paint__')) {
          const key = `${mat.uuid}:${paint}`;
          let cached = this.paintCache.get(key);
          if (!cached) {
            cached = new THREE.MeshPhysicalMaterial({
              color: paint,
              metalness: 0.25,
              roughness: 0.32,
              clearcoat: 1.0,
              clearcoatRoughness: 0.04,
              envMapIntensity: 1.1,
              specularIntensity: 1.0,
            });
            this.paintCache.set(key, cached);
          }
          return cached;
        }
        return mat;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(recolor)
        : recolor(mesh.material);
    });
    return wrapper;
  }

  async thumbnail(id: CarId): Promise<string> {
    const cached = this.thumbs.get(id);
    if (cached) return cached;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(360, 180);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    const scene = new THREE.Scene();
    const env = createStudioEnvironment(renderer);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.9;
    const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(5.2, 2.1, 5.8);
    camera.lookAt(0, 0.55, 0);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x20242c, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 6, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const car = this.create(id, { player: false });
    scene.add(car);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    this.thumbs.set(id, url);
    scene.remove(car);
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return url;
  }
}
