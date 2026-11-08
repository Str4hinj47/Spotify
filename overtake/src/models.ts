import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CARS, TRUCKS, TRAFFIC_ONLY, isPlayableCar, type CarId, type TrafficId } from './catalog';
import { indicatorMaterial, isIndicatorMaterial, addFrontIndicator, isFrontIndicatorMaterial, type IndicatorUniforms } from './indicators';
import { createBodyKit, disposeBodyKit, BODY_FITS } from './body-kits';
import { rigWheels } from './wheels';
import { fitGolfBodywork, removeGolfTailgateHandle } from './golf-bodywork';
import { fitMercedesBodywork } from './mercedes-bodywork';
import { fitAudiBodywork } from './audi-bodywork';
import { createCarbonMaterial, customPaintMaterial } from './livery';
import { GOLF_PART_OPTIONS, sanitizeCustomization, type Customization } from './customization.mjs';

export interface CarModel {
  id: TrafficId;
  scene: THREE.Group;
  length: number;
  width: number;
  height: number;
}

// A few source meshes reuse one "glass" material for both the cabin and lamp
// lenses (notably the W222). Preserve transparent lenses while making cabin
// glazing depth-writing. Split triangles only where a mesh actually spans both.
function separateLampLenses(scene: THREE.Group, id: TrafficId) {
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
      classes.push(y<.96 && (z < -1.5 || z > (id === 'aventador-game' ? 1.85 : 2.25)) ? 1 : 0);
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

// Mercedes plates share a photo-texture primitive with other details. Remove
// only the measured front/rear plate triangles on the player clone; retain
// the painted surfaces beneath, the rest of the texture mesh and all traffic.
function removeMercedesPlates(inner:THREE.Group,wrapper:THREE.Group):THREE.BufferGeometry[] {
  const mesh=inner.getObjectByName('mercedes_mesh_4') as THREE.Mesh | undefined;
  if(!mesh?.isMesh || !mesh.geometry.index)return [];
  wrapper.updateMatrixWorld(true);
  const source=mesh.geometry,index=source.index!,position=source.getAttribute('position');
  const transform=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld), v=new THREE.Vector3(),keep:number[]=[];
  const plate=(p:THREE.Vector3)=>Math.abs(p.x)<.273 && ((p.z< -2.58 && p.y>.35 && p.y<.47) || (p.z>2.49 && p.y>.77 && p.y<.895));
  for(let i=0;i+2<index.count;i+=3) {
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    if(!ids.every(n=>plate(v.fromBufferAttribute(position,n).applyMatrix4(transform))))keep.push(...ids);
  }
  const copy=source.clone();copy.setIndex(keep);copy.clearGroups();mesh.geometry=copy;return [copy];
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

// The race car's factory wing is merged with body/trim in the source. Clip
// only the raised rear aero element on an aftermarket-equipped player clone.
function removeBmwFactoryWing(inner: THREE.Group, wrapper: THREE.Group): THREE.BufferGeometry[] {
  const owned: THREE.BufferGeometry[] = [];
  inner.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !/^(paint__Material|trim__plastic)$/.test(mesh.material.name)) return;
    const geo=mesh.geometry, index=geo.index, pos=geo.getAttribute('position'); if (!index || !pos) return;
    const transform=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
    const point=new THREE.Vector3(), c=new THREE.Vector3(), kept:number[]=[];
    for(let i=0;i+2<index.count;i+=3) {
      c.set(0,0,0); for(let j=0;j<3;j++) c.add(point.fromBufferAttribute(pos,index.getX(i+j)).applyMatrix4(transform)); c.multiplyScalar(1/3);
      if (!(c.z>1.55 && c.y>.86)) kept.push(index.getX(i),index.getX(i+1),index.getX(i+2));
    }
    const copy=geo.clone();copy.setIndex(kept);copy.clearGroups();mesh.geometry=copy;owned.push(copy);
  });
  return owned;
}

// The Mustang source includes two valance turn lenses, but they are buried
// behind its chrome bumper. Move only those lens triangles onto the face of
// the valance, retaining their original shape and shared source attributes.
function exposeMustangValanceSignals(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const mesh = root.getObjectByName('mustang_mesh_13') as THREE.Mesh | undefined;
  if (!mesh?.isMesh) return;
  const geo = mesh.geometry, pos = geo.getAttribute('position'), index = geo.index;
  if (!pos) return;
  const point = new THREE.Vector3(), selected: number[] = [], rest: number[] = [];
  const count = index ? index.count : pos.count;
  for (let i = 0; i + 2 < count; i += 3) {
    const tri: number[] = [];
    let lens = true;
    for (let j = 0; j < 3; j++) {
      const n = index ? index.getX(i+j) : i+j;
      tri.push(n); point.fromBufferAttribute(pos, n).applyMatrix4(mesh.matrixWorld);
      lens &&= Math.abs(point.x) > .38 && Math.abs(point.x) < .51 && point.y > .40 && point.y < .46 && point.z < -2.15;
    }
    (lens ? selected : rest).push(...tri);
  }
  if (!selected.length) return;
  const geometryFor = (indices: number[]) => {
    const copy = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) copy.setAttribute(name, geo.getAttribute(name));
    copy.setIndex(indices);
    return copy;
  };
  mesh.geometry = geometryFor(rest);
  const lenses = mesh.clone(false);
  lenses.name = 'mustang-front-valance-signals';
  lenses.geometry = geometryFor(selected);
  mesh.parent!.add(lenses);
  lenses.updateWorldMatrix(true, false);
  root.attach(lenses);
  lenses.position.y -= .065;
  lenses.position.z -= .10;
}

// Remove the factory Golf mirror housing and glass from player-owned copies.
// They are merged with body and trim, so clip the two mirror volumes rather
// than putting new housings on top. Door frames stay outside these volumes.
function removeGolfMirrors(inner:THREE.Group,wrapper:THREE.Group):THREE.BufferGeometry[] {
  const owned:THREE.BufferGeometry[]=[];wrapper.updateMatrixWorld(true);
  for(const name of ['golf_mesh','golf_mesh_3','golf_mesh_7']) {
    const mesh=inner.getObjectByName(name) as THREE.Mesh | undefined;if(!mesh?.isMesh)continue;
    const source=mesh.geometry,pos=source.getAttribute('position'),index=source.index;if(!pos)continue;
    const matrix=new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld),v=new THREE.Vector3(),kept:number[]=[];
    for(let i=0;i<(index?index.count:pos.count);i+=3) {
      const tri=[index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2];
      const q=new THREE.Vector3();for(const n of tri)q.add(v.fromBufferAttribute(pos,n).applyMatrix4(matrix));q.multiplyScalar(1/3);
      if(!(Math.abs(q.x)>.805 && q.y>.86 && q.y<1.07 && q.z>-.64 && q.z<-.30))kept.push(...tri);
    }
    const copy=source.clone();copy.setIndex(kept);copy.clearGroups();mesh.geometry=copy;owned.push(copy);
  }
  return owned;
}

// Change tire sidewall depth radially, keeping the outer contact diameter and
// the independent tread-width/handling setting unchanged. Clone only player
// position buffers; the stock and traffic models remain shared and untouched.
function adjustGolfTireProfile(wheels:THREE.Group[],profile:'low'|'thick'):THREE.BufferGeometry[] {
  const owned:THREE.BufferGeometry[]=[], delta=profile==='low'?.026:-.035;
  for(const pivot of wheels) {
    pivot.updateWorldMatrix(true,true);
    pivot.traverse(o=>{
      const mesh=o as THREE.Mesh;if(!mesh.isMesh || Array.isArray(mesh.material))return;
      const name=mesh.material.name,tire=name.startsWith('tire__'),rim=name.startsWith('rim__')||name.startsWith('other__Wheel-nuts');
      if(!tire&&!rim)return;
      const geo=mesh.geometry,position=geo.getAttribute('position'),index=geo.index;if(!position)return;
      const copy=geo.clone(),p=copy.getAttribute('position'),matrix=new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(mesh.matrixWorld),inverse=matrix.clone().invert();
      const indices=new Set<number>();for(let i=0;i<(index?index.count:position.count);i++)indices.add(index?index.getX(i):i);
      const v=new THREE.Vector3(),outer=pivot.userData.wheelRadius as number,scale=profile==='low'?1.115:.845;
      for(const i of indices) {
        v.fromBufferAttribute(position,i).applyMatrix4(matrix);const r=Math.hypot(v.y,v.z);if(r<1e-6)continue;
        const weight=tire ? 1-THREE.MathUtils.smoothstep(r,outer*.70,outer*.98) : 1;
        const factor=tire ? Math.max(.3,(r+delta*weight)/r) : scale;
        v.y*=factor;v.z*=factor;v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
      }
      p.needsUpdate=true;copy.computeBoundingSphere();mesh.geometry=copy;owned.push(copy);
    });
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
  private rims = new Map<string, THREE.BufferGeometry>();

  constructor() {
    const draco = new DRACOLoader();
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    draco.setDecoderPath(`${base}draco/`);
    draco.setDecoderConfig({ type: 'wasm' });
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);
  }

  async loadAll(onProgress: (done: number, total: number, label: string) => void) {
    const rimFile = await this.loader.loadAsync(`${(import.meta as any).env?.BASE_URL ?? '/'}models/custom-rims.glb`);
    rimFile.scene.traverse(o => { const mesh=o as THREE.Mesh; if(mesh.isMesh) { const n=mesh.name.match(/^wheel[_\s]*(\d+)$/i)?.[1]; if(n) this.rims.set(`rim-${n}`,mesh.geometry); } });
    let done = 0;
    const models = [...CARS, ...TRUCKS, ...TRAFFIC_ONLY];
    for (const spec of models) {
      onProgress(done, models.length, spec.name);
      const gltf: GLTF = await this.loader.loadAsync(`${(import.meta as any).env?.BASE_URL ?? '/'}models/${spec.id}.glb`);
      const scene = gltf.scene;
      scene.name = spec.id;
      // Cars store their source orientation in the content registry; trucks face forward.
      scene.rotation.y = 'orientationDegrees' in spec ? THREE.MathUtils.degToRad(spec.orientationDegrees) : 0;
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
          // The Ferrari plate is exported as its own material primitives.
          // Remove both its text and backing from every Ferrari instance.
          if (spec.id === 'ferrari' && !Array.isArray(mesh.material) && mesh.material.name.startsWith('plate__')) mesh.visible = false;
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
              if (spec.id === 'golf' && m.name === 'headlight__Glass-light-cover') {
                // This primitive is the outer lens, not a bulb. Let the
                // reflector underneath show through instead of glowing white.
                std.color.set(0xb9cbd2);std.transparent=true;std.opacity=.20;
                std.depthWrite=false;std.depthTest=true;std.side=THREE.DoubleSide;
                std.emissive.set(0x000000);std.emissiveIntensity=0;
              } else {
                std.emissive = new THREE.Color(0xf6f9ff);
                std.emissiveIntensity = spec.id === 'golf' ? 0.28 : 0.85;
              }
            } else if (m.name.startsWith('taillight__')) {
              std.emissive = new THREE.Color(0xff2020);
              std.emissiveIntensity = 0.9;
            } else if (m.name.startsWith('rim__')) {
              std.metalness = 0.75;
              std.roughness = 0.28;
              // The R8 export has reversed wheel faces on two corners.
              if (spec.id === 'r8') std.side = THREE.DoubleSide;
            } else if (m.name.startsWith('trim__') || m.name.startsWith('carbon__')) {
              std.roughness = 0.55;
              std.metalness = 0.12;
            } else if (m.name.startsWith('tire__')) {
              std.roughness = 0.9;
              std.metalness = 0.0;
              if (spec.id === 'r8') std.side = THREE.DoubleSide;
            }
          }
        }
      });
      separateLampLenses(scene, spec.id);
      const normalized = new THREE.Group();
      normalized.add(scene);
      // The R34's imported rear panel ends unevenly around the four lenses.
      // Close those gaps with slim, fitted bezels; leave the actual lens and
      // indicator geometry unobscured and share them across car instances.
      if (spec.id === 'skyline') {
        const material = new THREE.MeshStandardMaterial({ color: 0x252a2e, metalness: .3, roughness: .55 });
        for (const side of [-1, 1]) for (const [x, y, z, radius] of [[.6625,.846,2.142,.096], [.4623,.8226,2.185,.076]]) {
          const surround = new THREE.Mesh(new THREE.TorusGeometry(radius, .01, 12, 96), material);
          surround.name = 'skyline-taillight-surround';
          surround.position.set(side*x, y, z); surround.rotation.y = side*.34;
          surround.castShadow = true;
          normalized.add(surround);
        }
      }
      if (spec.id === 'challenger') {
        // Opaque, inset backplates close the empty centres of the source LED
        // rings. The original red lenses remain in front and keep their signals.
        const backing=new THREE.MeshStandardMaterial({color:0x14181b,roughness:.55,metalness:.15});
        for(const side of [-1,1]) {
          const shape=new THREE.Shape(),w=.61,h=.11,r=.035;
          shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
          shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);
          shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
          const plate=new THREE.Mesh(new THREE.ShapeGeometry(shape),backing);plate.name='challenger-lamp-backing';plate.position.set(side*.515,.882,2.323);normalized.add(plate);
        }
      }
      if (spec.id === 'mustang') exposeMustangValanceSignals(normalized);
      rigWheels(normalized, spec.id);
      this.models.set(spec.id, {
        id: spec.id,
        scene: normalized,
        length: size.z,
        width: size.x,
        height: size.y,
      });
      done++;
      onProgress(done, models.length, spec.name);
    }
  }

  /** Improve angled tire, lamp and trim textures without exceeding GPU limits. */
  setTextureAnisotropy(value: number) {
    const textures = new Set<THREE.Texture>();
    for (const model of this.models.values()) model.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const property of Object.values(material)) {
          if (property && (property as THREE.Texture).isTexture) textures.add(property as THREE.Texture);
        }
      }
    });
    for (const texture of textures) {
      texture.anisotropy = Math.max(1, value);
      texture.needsUpdate = true;
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
    const clean=sanitizeCustomization(config);
    if(id!=='golf') {
      for(const [part, options] of Object.entries(GOLF_PART_OPTIONS)) if(options?.includes(clean[part as keyof typeof GOLF_PART_OPTIONS] as never)) (clean as unknown as Record<string,string>)[part]='stock';
      clean.rearDiffuserColor='';clean.headlights='stock';clean.taillights='stock';clean.mirrors='stock';clean.tireProfile='standard';
    }
    if(id!=='mercedes') { for(const part of ['front','rear','skirts'] as const) if(clean[part].startsWith('mercedes-')) (clean as unknown as Record<string,string>)[part]='stock'; }
    if(id!=='audi') { for(const part of ['front','rear','skirts'] as const) if(clean[part].startsWith('audi-')) (clean as unknown as Record<string,string>)[part]='stock'; }
    this.customization.set(id, clean);
  }

  getCustomization(id: CarId): Customization { return sanitizeCustomization(this.customization.get(id)); }

  /** Clone a car. Explicit paint wins, then the user's saved paint override. */
  create(id: TrafficId, opts: { paint?: number; player?: boolean } = {}): THREE.Group {
    const source = this.get(id);
    const paint = opts.paint ?? (isPlayableCar(id) ? this.paintOverrides.get(id) : undefined);
    const inner = source.scene.clone(true);
    const wrapper = new THREE.Group();
    wrapper.name = `${id}_wrapper`;
    wrapper.add(inner);
    // Lights must be per-car: a braking vehicle must not brighten every
    // instance that shares the same source material.
    const lightCopies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const headlightCopies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const headlightIndicators: THREE.MeshStandardMaterial[] = [];
    const indicatorCopies: THREE.MeshStandardMaterial[] = [];
    const brakeIndicatorCopies: THREE.MeshStandardMaterial[] = [];
    const signal: IndicatorUniforms = { left: { value: 0 }, right: { value: 0 }, viewZ: { value: 1 }, brake: { value: 0 } };
    let factoryPaint: number | undefined;
    const customPaintCopies: THREE.Material[] = [];
    const customGeometries: THREE.BufferGeometry[] = [];
    const config = opts.player && isPlayableCar(id) ? (this.customization.get(id) ?? (id==='golf' ? sanitizeCustomization(undefined) : undefined)) : undefined;
    wrapper.updateMatrixWorld(true);
    if (id === 'bmw-m3' && config && config.spoiler !== 'stock') customGeometries.push(...removeBmwFactoryWing(inner, wrapper));
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((id === 'skyline' || id === 'bugatti') && config && config.spoiler !== 'stock' && !Array.isArray(mesh.material) && /__factory_wing/.test(mesh.material.name)) mesh.visible = false;
      mesh.castShadow = !!opts.player;
      mesh.receiveShadow = false;
      const recolor = (mat: THREE.Material) => {
        if (factoryPaint === undefined && mat.name.startsWith('paint__')) factoryPaint = (mat as THREE.MeshStandardMaterial).color?.getHex();
        if ((opts.player || id === 'golf' || id === 'camry' || id === 'mercedes-560' || id === 'range-rover' || id === 'bugatti' || id === 'bmw-m3' || id === 'skyline' || id === 'aventador' || id === 'aventador-game') && id !== 'semi' && id !== 'kraz' && (isIndicatorMaterial(id, mat) || isFrontIndicatorMaterial(id, mat))) {
          const meshToCar = new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(mesh.matrixWorld);
          const rear = isIndicatorMaterial(id, mat);
          let lamp = rear ? indicatorMaterial(id, mat, meshToCar, signal) : mat.clone() as THREE.MeshStandardMaterial;
          // The source BMW lens has a pale texture; keep the rear lenses red
          // while the existing signal shader can still flash amber.
          if (id === 'bmw-m3' && rear) { lamp.map = null; lamp.emissiveMap = null; lamp.color.set(0xb50008); lamp.emissive.set(0x960008); }
          if (isFrontIndicatorMaterial(id, mat)) lamp = addFrontIndicator(id, lamp, meshToCar, signal);
          if (rear && (mat.name.startsWith('taillight__') || id === 'camry')) {
            if (id === 'camry') lamp.emissive.set(0xff2020);
            lamp.emissiveIntensity = 0.55; brakeIndicatorCopies.push(lamp);
          }
          if ((mat.name.startsWith('headlight__') && !/cover/i.test(mat.name)) || (id === 'camry' && !rear)) {
            if (id === 'camry') lamp.emissive.set(0xf6f9ff);
            headlightIndicators.push(lamp);
          }
          indicatorCopies.push(lamp);
          return lamp;
        }
        if (mat.name.startsWith('headlight__') && !/cover/i.test(mat.name)) {
          let light = headlightCopies.get(mat);
          if (!light) { light = mat.clone() as THREE.MeshStandardMaterial; headlightCopies.set(mat, light); }
          return light;
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
        if (id==='challenger' && mesh.name==='Plane_Plane032' && config && (config.paintScheme==='upper' || config.paintScheme==='lower')) {
          const hood=config.secondaryFinish==='carbon' ? createCarbonMaterial() : (mat as THREE.MeshStandardMaterial).clone();
          if(config.secondaryFinish!=='carbon') {hood.color.set(config.secondaryColor);hood.map=null;hood.metalness=.45;hood.roughness=.36;}
          hood.name='challenger-secondary-hood';customPaintCopies.push(hood);return hood;
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
          if (config && isPlayableCar(id) && (config.paintScheme !== 'single' || config.livery !== 'none')) {
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
    if (opts.player && isPlayableCar(id)) {
      if (config) {
        if(config.removePlates) {
          inner.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name.startsWith('plate__'))mesh.visible=false;});
          if(id==='mercedes')customGeometries.push(...removeMercedesPlates(inner,wrapper));
        }
        // These separate rear outlet meshes belong to the source R8, not the
        // bumper. Hide them only when this player clone has replacement tips.
        if (id === 'mustang' && config.exhaust !== 'stock' && config.exhaust !== 'flame') {
          const outlets = inner.getObjectByName('mustang_mesh_9');
          if (outlets) outlets.visible = false;
        }
        if (id === 'r8' && config.exhaust !== 'stock') {
          for (const name of ['black_gloss_13', 'metal_2_10', 'black_matt_18']) {
            const outlet = inner.getObjectByName(name);
            if (outlet) outlet.visible = false;
          }
        }
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
        if (BODY_FITS[id]) {
          const kit=createBodyKit(id, config, paint ?? factoryPaint ?? 0x808080);
          wrapper.add(kit);
          if(id==='audi') customGeometries.push(...fitAudiBodywork(inner,wrapper,kit,config));
          if(id==='mercedes') customGeometries.push(...fitMercedesBodywork(inner,wrapper,kit,config));
          if(id==='golf') {
            customGeometries.push(...fitGolfBodywork(inner,wrapper,kit,config));
            customGeometries.push(...removeGolfTailgateHandle(inner,wrapper));
            if(config.mirrors!=='stock')customGeometries.push(...removeGolfMirrors(inner,wrapper));
            if(config.taillights!=='stock') {
              // The indicator/brake material is already unique to this player.
              // Keep its signal shader and original texture while tinting it.
              const lens=inner.getObjectByName('golf_mesh_13') as THREE.Mesh | undefined;
              if(lens && !Array.isArray(lens.material)) {
                const material=lens.material as THREE.MeshStandardMaterial;
                material.color.multiplyScalar(config.taillights==='smoked' ? .30 : .65);
                if(config.taillights==='led') {
                  wrapper.updateMatrixWorld(true);
                  const led=new THREE.MeshBasicMaterial({color:0xff2424});customPaintCopies.push(led);
                  const geo=new THREE.BoxGeometry(.035,.009,.006);customGeometries.push(geo);
                  const ray=new THREE.Raycaster();
                  for(const side of [-1,1]) for(const y of [.72,.76,.82]) for(const x of [.47,.51,.55,.59,.63,.67]) {
                    const origin=wrapper.localToWorld(new THREE.Vector3(side*x,y,2.5));
                    const direction=new THREE.Vector3(0,0,-1).transformDirection(wrapper.matrixWorld);
                    ray.set(origin,direction);const hit=ray.intersectObject(lens,false)[0];if(!hit)continue;
                    const strip=new THREE.Mesh(geo,led);strip.name='golf-tail-led';
                    strip.position.copy(wrapper.worldToLocal(hit.point.clone()));strip.position.z+=.007;wrapper.add(strip);
                  }
                }
              }
            }
            if(config.headlights!=='stock') {
              const lens=inner.getObjectByName('golf_mesh_4') as THREE.Mesh | undefined;
              if(lens && !Array.isArray(lens.material)) {
                const material=lens.material.clone() as THREE.MeshStandardMaterial;
                material.color.set(config.headlights==='smoked'?0x38424b:0xb6dcf1);
                material.opacity=config.headlights==='smoked'?.52:.24;material.transparent=true;material.depthWrite=false;
                lens.material=material;customPaintCopies.push(material);
              }
            }
          }
        }
      }
    }
    const wheels: THREE.Group[] = [];
    inner.traverse(o => { if (o.name.startsWith('wheel_pivot_')) wheels.push(o as THREE.Group); });
    if (config) {
      if(id==='golf') {
        // The source's oversized exposed brake block is not part of the tire
        // or rim. Hide only on the player clone, never the shared model.
        const brake=inner.getObjectByName('golf_mesh_9');if(brake)brake.visible=false;
        if(config.tireProfile!=='standard') customGeometries.push(...adjustGolfTireProfile(wheels,config.tireProfile));
      }
      const geometry=this.rims.get(config.rim);
      const width={narrow:.85,standard:1,wide:1.18}[config.tireWidth];
      const colored = config.rimColor ? new THREE.Color(config.rimColor) : null;
      const rimMaterial=geometry ? new THREE.MeshStandardMaterial({color:colored ?? new THREE.Color('#bbc2cb'),metalness:.8,roughness:.27,side:THREE.DoubleSide}) : null;
      if(rimMaterial) customPaintCopies.push(rimMaterial);
      for(const pivot of wheels) {
        const side=Math.sign(pivot.position.x) || 1;
        pivot.scale.x=width;
        pivot.traverse(o=>{
          const m=o as THREE.Mesh;if(!m.isMesh || Array.isArray(m.material)) return;
          const name=m.material.name;
          if(name.startsWith('tire__')) return;
          if(geometry) m.visible=false;
          else if(colored && !name.startsWith('brake__')) {
            const copy=m.material.clone() as THREE.MeshStandardMaterial;
            if(copy.color) { copy.color.copy(colored); copy.map=null; copy.metalness=.8; copy.roughness=.27; }
            m.material=copy;customPaintCopies.push(copy);
          }
        });
        if(geometry && rimMaterial) {
          const profileScale=id==='golf' ? {low:1.115,standard:1,thick:.845}[config.tireProfile] : 1;
          const rim=new THREE.Mesh(geometry,rimMaterial), radius=pivot.userData.wheelRadius*.76*profileScale;
          // The uploaded rims have a deep barrel. Compress only the axle axis
          // and inset the outer face inside the sidewall, including narrow tires.
          const depth=radius*.55;
          rim.name='custom-rim';rim.rotation.y=side*Math.PI/2;rim.scale.set(radius,radius,depth);
          rim.position.x=side*Math.max(0,pivot.userData.wheelHalfWidth-depth*.33-.065);

          pivot.add(rim);
        }
      }
    }
    wrapper.userData.wheels = wheels;
    wrapper.userData.customPaintMaterials = customPaintCopies;
    wrapper.userData.customGeometries = customGeometries;
    wrapper.userData.brakeMaterials = [...lightCopies.values(), ...brakeIndicatorCopies];
    wrapper.userData.headlightMaterials = [...headlightCopies.values(), ...headlightIndicators];
    wrapper.userData.indicatorMaterials = indicatorCopies;
    wrapper.userData.indicatorState = signal;
    return wrapper;
  }

  /** Render the actual fitted part (or uploaded rim) into a card without
   * equipping it or touching the player's saved configuration. */
  private workshopThumbs = new Map<string, string>();
  private workshopRenderer?: THREE.WebGLRenderer;
  workshopThumbnail(id: CarId, part: string, value: string): string {
    const cacheKey = `${id}:${part}:${value}`;
    const cached = this.workshopThumbs.get(cacheKey);
    if (cached) return cached;
    if (value === 'stock') return '';
    const renderer = this.workshopRenderer ??= new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(1); renderer.setSize(180,100);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe5f6ff,0x253444,2));
    const light=new THREE.DirectionalLight(0xffffff,2.5); light.position.set(4,6,5); scene.add(light);
    const camera=new THREE.PerspectiveCamera(32,1.8,.01,100);
    let kit: THREE.Group | undefined;
    let material: THREE.Material | undefined;
    let object: THREE.Object3D | undefined;
    if(part==='rim') {
      const geo=this.rims.get(value);
      if(geo) { material=new THREE.MeshStandardMaterial({color:0xc4d2dd,metalness:.65,roughness:.27,side:THREE.DoubleSide}); object=new THREE.Mesh(geo,material); scene.add(object); }
    } else {
      const config=sanitizeCustomization({[part]:value});
      kit=createBodyKit(id,config,0x91a9ba);
      let temporary:THREE.BufferGeometry[]=[];
      if((id==='golf'||id==='mercedes'||id==='audi') && ['front','rear','skirts'].includes(part)) {
        const wrapper=new THREE.Group(), inner=this.get(id).scene.clone(true);wrapper.add(inner,kit);wrapper.updateMatrixWorld(true);
        temporary=id==='golf'?fitGolfBodywork(inner,wrapper,kit,config):id==='mercedes'?fitMercedesBodywork(inner,wrapper,kit,config):fitAudiBodywork(inner,wrapper,kit,config);wrapper.remove(kit);
      }
      for(const geometry of temporary)geometry.dispose();
      object=kit.getObjectByName(`custom-${part}`); scene.add(kit);
    }
    if(object) {
      object.updateWorldMatrix(true,true);
      const bounds=new THREE.Box3().setFromObject(object), center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
      const extent=Math.max(size.x,size.y,size.z,.1);
      const direction=part==='rim' ? new THREE.Vector3(.12,.10,1) : new THREE.Vector3(1,.8,1.6);
      camera.position.copy(center).add(direction.normalize().multiplyScalar(extent*2.4));
      camera.lookAt(center); camera.updateProjectionMatrix(); renderer.render(scene,camera);
    }
    const url=renderer.domElement.toDataURL('image/png');
    if(kit) disposeBodyKit(kit); material?.dispose();
    this.workshopThumbs.set(cacheKey,url); return url;
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
