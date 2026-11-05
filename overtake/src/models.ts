import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CARS, TRUCKS, type CarId, type TrafficId } from './catalog';
import { indicatorMaterial, isIndicatorMaterial, type IndicatorUniforms } from './indicators';
import { createBodyKit } from './body-kits';
import { customPaintMaterial } from './livery';
import { sanitizeCustomization, type Customization } from './customization.mjs';

export interface CarModel {
  id: TrafficId;
  scene: THREE.Group;
  length: number;
  width: number;
  height: number;
}

// Some source models export nose-first along +Z; the game drives toward -Z.
// The Ferrari source mesh is also yawed ~13.5° inside its own bounding box, so
// a plain 180° flip leaves it visibly diagonal to the road. Bake the measured
// PCA correction (paint/tire/glass principal axis) into the same wrapper.
const FERRARI_SKEW = (13.5 * Math.PI) / 180;
const ORIENTATION: Record<TrafficId, number> = {
  golf: 0,
  mercedes: 0,
  audi: Math.PI,
  mustang: 0,
  ferrari: Math.PI + FERRARI_SKEW,
  r8: Math.PI,
  challenger: Math.PI,
  semi: 0,
  kraz: 0,
};

export class ModelLibrary {
  private loader: GLTFLoader;
  private models = new Map<TrafficId, CarModel>();
  private paintCache = new Map<string, THREE.MeshStandardMaterial>();
  private paintOverrides = new Map<CarId, number>();
  private thumbs = new Map<CarId, string>();
  private customization = new Map<CarId, Customization>();

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
    const models = [...CARS, ...TRUCKS];
    for (const spec of models) {
      onProgress(done, models.length, spec.name);
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
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = false;
          mesh.frustumCulled = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (tuned.has(m)) continue;
            tuned.add(m);
            const std = m as THREE.MeshStandardMaterial;
            std.envMapIntensity = 0.9;
            if (m.name.startsWith('paint__')) {
              std.metalness = 0.45;
              std.roughness = 0.36;
              const phys = m as THREE.MeshPhysicalMaterial;
              if ('clearcoat' in phys) {
                phys.clearcoat = 0.4;
                phys.clearcoatRoughness = 0.22;
              }
            } else if (m.name.startsWith('glass__')) {
              std.color.set(0x0a0f14);
              std.metalness = 0.1;
              std.roughness = 0.06;
              // The RS6 has no modeled cabin. Opaque smoked glass keeps the
              // exterior reflections but prevents seeing through an empty shell.
              std.transparent = spec.id !== 'audi';
              std.opacity = spec.id === 'audi' ? 1 : 0.92;
              std.side = THREE.DoubleSide;
              std.envMapIntensity = 1.2;
            } else if (m.name.startsWith('chrome__')) {
              std.metalness = 1.0;
              std.roughness = 0.12;
              std.envMapIntensity = 1.1;
            } else if (m.name.startsWith('headlight__')) {
              std.emissive = new THREE.Color(0xf6f9ff);
              std.emissiveIntensity = 0.85;
            } else if (m.name.startsWith('taillight__')) {
              std.emissive = new THREE.Color(0xff2020);
              std.emissiveIntensity = 0.9;
            } else if (m.name.startsWith('rim__')) {
              std.metalness = 0.75;
              std.roughness = 0.28;
            } else if (m.name.startsWith('trim__') || m.name.startsWith('carbon__')) {
              std.roughness = 0.55;
              std.metalness = 0.12;
            } else if (m.name.startsWith('tire__')) {
              std.roughness = 0.9;
              std.metalness = 0.0;
            }
          }
        }
      });
      this.models.set(spec.id, {
        id: spec.id,
        scene,
        length: size.z,
        width: size.x,
        height: size.y,
      });
      done++;
      onProgress(done, models.length, spec.name);
    }
  }

  get(id: TrafficId): CarModel {
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

  setCustomization(id: CarId, config: Customization) {
    this.customization.set(id, sanitizeCustomization(config));
  }

  /** Clone a car. Explicit paint wins, then the user's saved paint override. */
  create(id: TrafficId, opts: { paint?: number; player?: boolean } = {}): THREE.Group {
    const source = this.get(id);
    const paint = opts.paint ?? (id !== 'semi' && id !== 'kraz' ? this.paintOverrides.get(id) : undefined);
    const inner = source.scene.clone(true);
    const wrapper = new THREE.Group();
    wrapper.name = `${id}_wrapper`;
    wrapper.add(inner);
    // Lights must be per-car: a braking vehicle must not brighten every
    // instance that shares the same source material.
    const lightCopies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const indicatorCopies: THREE.MeshStandardMaterial[] = [];
    const brakeIndicatorCopies: THREE.MeshStandardMaterial[] = [];
    const signal: IndicatorUniforms = { left: { value: 0 }, right: { value: 0 }, viewZ: { value: 1 } };
    let factoryPaint: number | undefined;
    const customPaintCopies: THREE.Material[] = [];
    const config = opts.player && id !== 'semi' && id !== 'kraz' ? this.customization.get(id) : undefined;
    wrapper.updateMatrixWorld(true);
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !!opts.player;
      mesh.receiveShadow = false;
      const recolor = (mat: THREE.Material) => {
        if (factoryPaint === undefined && mat.name.startsWith('paint__')) factoryPaint = (mat as THREE.MeshStandardMaterial).color?.getHex();
        if (opts.player && id !== 'semi' && id !== 'kraz' && isIndicatorMaterial(id, mat)) {
          const meshToCar = new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
          const lamp = indicatorMaterial(id, mat, meshToCar, signal);
          if (mat.name.startsWith('taillight__')) { lamp.emissiveIntensity = 0.55; brakeIndicatorCopies.push(lamp); }
          indicatorCopies.push(lamp);
          return lamp;
        }
        if (mat.name.startsWith('taillight__')) {
          let light = lightCopies.get(mat);
          if (!light) {
            light = mat.clone() as THREE.MeshStandardMaterial;
            light.emissiveIntensity = 0.55;
            lightCopies.set(mat, light);
          }
          return light;
        }
        if (mat.name.startsWith('paint__')) {
          let base = mat as THREE.MeshStandardMaterial;
          if (paint !== undefined) {
            const key = `${mat.uuid}:${paint}`;
            let cached = this.paintCache.get(key);
            if (!cached) {
              cached = new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.45, roughness: 0.36, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.9 });
              this.paintCache.set(key, cached);
            }
            base = cached;
          }
          if (config && id !== 'semi' && id !== 'kraz' && (config.paintScheme !== 'single' || config.livery !== 'none')) {
            const meshToCar = new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
            const custom = customPaintMaterial(base, meshToCar, id, config);
            customPaintCopies.push(custom);
            return custom;
          }
          return base;
        }
        return mat;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(recolor)
        : recolor(mesh.material);
    });
    if (opts.player && id !== 'semi' && id !== 'kraz') {
      if (config) {
        // The R8 source has a separate factory wing. Hide it only on this
        // clone when fitting an aftermarket wing; the shared source stays intact.
        if (id === 'r8' && config.spoiler !== 'stock') {
          const factoryWing = inner.getObjectByName('trim_1');
          if (factoryWing) factoryWing.visible = false;
        }
        wrapper.add(createBodyKit(id, config, paint ?? factoryPaint ?? 0x808080));
      }
    }
    wrapper.userData.customPaintMaterials = customPaintCopies;
    wrapper.userData.brakeMaterials = [...lightCopies.values(), ...brakeIndicatorCopies];
    wrapper.userData.indicatorMaterials = indicatorCopies;
    wrapper.userData.indicatorState = signal;
    return wrapper;
  }

  async thumbnail(id: CarId): Promise<string> {
    const cached = this.thumbs.get(id);
    if (cached) return cached;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(360, 180);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(5.2, 2.1, 5.8);
    camera.lookAt(0, 0.55, 0);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x20242c, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(4, 6, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.2);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const warm = new THREE.DirectionalLight(0xffb070, 0.5);
    warm.position.set(0, 2, -6);
    scene.add(warm);
    const car = this.create(id, { player: false });
    scene.add(car);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    this.thumbs.set(id, url);
    scene.remove(car);
    for (const m of new Set([...(car.userData.brakeMaterials as THREE.Material[]), ...(car.userData.indicatorMaterials as THREE.Material[])])) m.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return url;
  }
}
