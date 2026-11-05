import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CARS, TRUCKS, type CarId, type TrafficId } from './catalog';
import { indicatorMaterial, isIndicatorMaterial, type IndicatorUniforms } from './indicators';
import { createBodyKit } from './body-kits';
import { createCarbonMaterial, customPaintMaterial } from './livery';
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

// A few source meshes reuse one "glass" material for both the cabin and lamp
// lenses (notably the W222). Preserve transparent lenses while making cabin
// glazing depth-writing. Split triangles only where a mesh actually spans both.
function separateLampLenses(scene: THREE.Group) {
  scene.updateMatrixWorld(true);
  const lenses = new Map<THREE.Material, THREE.Material>();
  const point = new THREE.Vector3();
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.name.startsWith('glass__')) return;
    const geometry = mesh.geometry, positions = geometry.getAttribute('position');
    if (!positions) return;
    const index = geometry.index, count = index ? index.count : positions.count;
    const classes:number[]=[];
    for(let i=0;i+2<count;i+=3) {
      let z=0,y=0;
      for(let j=0;j<3;j++) {
        point.fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
        z+=point.z/3;y+=point.y/3;
      }
      classes.push(y<.96 && (z < -1.5 || z > 2.25) ? 1 : 0);
    }
    if(!classes.includes(1)) return;
    let lens=lenses.get(mesh.material);
    if(!lens) {
      lens=mesh.material.clone();
      const material=lens as THREE.MeshStandardMaterial;
      material.name=mesh.material.name+'__lamp_lens';
      material.color.set(0x999fa6);material.transparent=true;material.opacity=.18;
      material.depthWrite=false;material.depthTest=true;material.side=THREE.DoubleSide;
      lenses.set(mesh.material,lens);
    }
    const copy=geometry.clone();copy.clearGroups();
    let start=0, previous=classes[0];
    for(let i=1;i<=classes.length;i++) if(i===classes.length || classes[i]!==previous) {
      copy.addGroup(start*3,(i-start)*3,previous);start=i;previous=classes[i];
    }
    mesh.geometry=copy;mesh.material=[mesh.material,lens];
  });
}

// Mustang's original pedestal wing is merged into two trim primitives. Filter
// only its Blender-identified rear-deck components on the player clone; the
// stock source and traffic retain their unmodified buffers and window louvers.
function removeMustangFactoryWing(inner:THREE.Group, wrapper:THREE.Group):THREE.BufferGeometry[] {
  const owned:THREE.BufferGeometry[]=[];
  for(const name of ['mustang_mesh_1','mustang_mesh_5']) {
    const mesh=inner.getObjectByName(name) as THREE.Mesh | undefined;
    if(!mesh?.isMesh) continue;
    const geometry=mesh.geometry, index=geometry.index, pos=geometry.getAttribute('position');
    if(!index || !pos) continue;
    const transform=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
    const point=new THREE.Vector3(), centroid=new THREE.Vector3(), kept:number[]=[];
    for(let i=0;i+2<index.count;i+=3) {
      centroid.set(0,0,0);
      for(let j=0;j<3;j++) centroid.add(point.fromBufferAttribute(pos,index.getX(i+j)).applyMatrix4(transform));
      centroid.multiplyScalar(1/3);
      const wing=centroid.z>1.89 && centroid.z<2.18 && centroid.y>.93 && centroid.y<1.15;
      if(!wing) kept.push(index.getX(i),index.getX(i+1),index.getX(i+2));
    }
    const copy=geometry.clone();copy.setIndex(kept);copy.clearGroups();mesh.geometry=copy;owned.push(copy);
  }
  return owned;
}

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
              // Some source GLBs disable depth writes even on nominally opaque
              // glass. That lets cabin geometry and rear lights render through it.
              // Treat glazing as smoked, depth-writing exterior bodywork on both
              // player and traffic clones; never rely on opacity alone.
              std.transparent = false;
              std.opacity = 1;
              std.depthWrite = true;
              std.depthTest = true;
              std.alphaTest = 0;
              std.alphaMap = null;
              if ('transmission' in std) (std as THREE.MeshPhysicalMaterial).transmission = 0;
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
      separateLampLenses(scene);
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
    const customGeometries: THREE.BufferGeometry[] = [];
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
        if (id === 'challenger' && config.spoiler !== 'stock') {
          const factoryWing = inner.getObjectByName('Cube001_Cube003');
          if (factoryWing) factoryWing.visible = false;
        }
        if (id === 'mustang' && config.spoiler !== 'stock') customGeometries.push(...removeMustangFactoryWing(inner,wrapper));
        if (id === 'ferrari' && config.exhaust !== 'stock') {
          const factoryExhaust=inner.getObjectByName('ferrari_mesh_23') as THREE.Mesh | undefined;
          if (factoryExhaust && config.exhaust !== 'flame') factoryExhaust.visible=false;
          if (factoryExhaust && config.exhaust === 'flame' && config.exhaustFinish === 'carbon') {
            const finish=createCarbonMaterial();factoryExhaust.material=finish;customPaintCopies.push(finish);
          }
        }
        wrapper.add(createBodyKit(id, config, paint ?? factoryPaint ?? 0x808080));
      }
    }
    wrapper.userData.customPaintMaterials = customPaintCopies;
    wrapper.userData.customGeometries = customGeometries;
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
