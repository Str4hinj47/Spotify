import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTreeGeometries } from './trees';
import { createStreetlightGeometry } from './streetlight';
import {
  BUILDINGS, STREETS, SIDEWALKS, BAYS, PARKED_CARS, LAMPS, BENCHES, FOUNTAIN,
  TREES, BUSHES, HEDGES, ROAD_MARKINGS, PARK, PARKING_LOT, CITY_BOUND,
  facingRotationY, FACADE_TINTS,
} from './city-plan.mjs';
import type { ModelLibrary } from '../models';

// Central City for OVERTAKE: a ten-block district with a retail spine, civic
// towers, a fountain park and a marked parking lot. Buildings come from the
// procedural Blender pack at /models/city/city.glb (tools/build_city.py) —
// 24 unique archetypes, tinted and scaled per lot so no two neighbours repeat.
// Repeated archetypes are merged per building material, which keeps the whole
// district to roughly one draw call per material instead of one per mesh.

const ASPHALT_REPEAT = 3.2;
const MERGE_TILE = 3.0;

type BuildingTint = { key: string; tint: number; scale: number };

export class CityWorld {
  readonly group = new THREE.Group();
  ready = false;
  private loading: Promise<void> | null = null;
  private lampMat: THREE.MeshStandardMaterial | null = null;
  /** Surfaces that whiten as snow settles (ground, sidewalks, roads). */
  private snowSurfaces: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  private snowAmount = 0;
  /** Asphalt that darkens and goes glossy in the rain. */
  private asphaltMats: THREE.MeshStandardMaterial[] = [];
  private wetAmount = -1;
  private nightLights: THREE.PointLight[] = [];
  private nightTimer = 0;
  private playerPos = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private lampOrder: { x: number; z: number }[] = [];

  constructor(private library: ModelLibrary) {
    this.group.name = 'city-world';
    this.buildStatics();
    this.group.visible = false;
  }

  /** Idempotent: starts (or returns) the async asset load. */
  ensureLoaded(): Promise<void> {
    if (!this.loading) {
      this.loading = this.load().then(() => { this.ready = true; }).catch(error => {
        console.error('City world failed to load', error);
      });
    }
    return this.loading;
  }

  setVisible(visible: boolean) { this.group.visible = visible; }

  /** Player position drives the recycled night lamps. */
  setPlayerPosition(pos: THREE.Vector3) { this.playerPos.copy(pos); }

  update(dt: number, night: number, wet = 0, snow = 0) {
    if (Math.abs(wet - this.wetAmount) > 0.01) {
      this.wetAmount = wet;
      for (const m of this.asphaltMats) {
        // Soaked tarmac is darker and much smoother: the environment map and
        // street lights then read as reflections.
        m.color.copy(m.userData.base ??= m.color.clone()).multiplyScalar(1 - wet * 0.34);
        m.roughness = 0.95 - wet * 0.55;
        m.envMapIntensity = 0.3 + wet * 0.85;
        m.normalScale?.set(0.5 - wet * 0.22, 0.5 - wet * 0.22);
      }
    }
    if (Math.abs(snow - this.snowAmount) > 0.004) {
      this.snowAmount = snow;
      const white = new THREE.Color(0xdfe6ec);
      for (const s of this.snowSurfaces) s.mat.color.copy(s.base).lerp(white, snow * 0.92);
    }
    this.nightTimer -= dt;
    if (this.lampMat) this.lampMat.emissiveIntensity = 0.22 + night * 2.4;
    if (this.nightTimer > 0) return;
    this.nightTimer = 0.4;
    // Two pooled point lights hop between the closest lamp poles.
    const px = this.playerPos.x, pz = this.playerPos.z;
    const order = this.lampOrder;
    order.sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    for (let i = 0; i < this.nightLights.length; i++) {
      const lamp = order[Math.min(order.length - 1, i)];
      if (!lamp) break;
      const light = this.nightLights[i];
      light.position.set(lamp.x, 7.2, lamp.z);
      light.intensity = night * 40;
      light.visible = night > 0.04;
    }
  }

  // --- Static layer (everything that does not need the GLB) ------------------
  private asphaltTexture() {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const albedo = new THREE.TextureLoader().load(`${base}textures/road/asphalt-albedo.jpg`);
    const normal = new THREE.TextureLoader().load(`${base}textures/road/asphalt-normal.jpg`);
    for (const tex of [albedo, normal]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
    }
    albedo.colorSpace = THREE.SRGBColorSpace;
    return { albedo, normal };
  }

  private buildStatics() {
    // Ground slab: park green with the asphalt laid on top of it.
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d6a41, roughness: 1 });
    this.snowSurfaces.push({ mat: groundMat, base: groundMat.color.clone() });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_BOUND * 2 + 40, CITY_BOUND * 2 + 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.group.add(ground);

    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9d9b91, roughness: 0.96 });
    this.snowSurfaces.push({ mat: sidewalkMat, base: sidewalkMat.color.clone() });
    for (const s of SIDEWALKS) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.09, s.d), sidewalkMat);
      mesh.position.set(s.x, -0.045, s.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    const { albedo, normal } = this.asphaltTexture();
    const asphalt = (w: number, d: number, x: number, z: number) => {
      const map = albedo.clone(), nrm = normal.clone();
      map.repeat.set(w / ASPHALT_REPEAT, d / ASPHALT_REPEAT);
      nrm.repeat.copy(map.repeat);
      map.needsUpdate = true; nrm.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        map, normalMap: nrm, normalScale: new THREE.Vector2(0.5, 0.5),
        color: 0xb7babd, roughness: 0.95,
      });
      this.snowSurfaces.push({ mat, base: mat.color.clone() });
      this.asphaltMats.push(mat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.03, z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    for (const s of STREETS) asphalt(s.w, s.d, s.x, s.z);
    asphalt(PARKING_LOT.x1 - PARKING_LOT.x0, PARKING_LOT.z1 - PARKING_LOT.z0,
      (PARKING_LOT.x0 + PARKING_LOT.x1) / 2, (PARKING_LOT.z0 + PARKING_LOT.z1) / 2);

    this.buildMarkings();
    this.buildParkingBays();
    this.buildTrees();
    this.buildLamps();
    this.buildPark();
    this.buildHedges();
  }

  /** Road paint, merged into two draw calls (white + yellow). */
  private buildMarkings() {
    const white: THREE.BufferGeometry[] = [];
    const yellow: THREE.BufferGeometry[] = [];
    for (const m of ROAD_MARKINGS) {
      const g = new THREE.PlaneGeometry(m.w, m.l);
      g.rotateX(-Math.PI / 2);
      g.translate(m.x, 0.055, m.z);
      (m.color === 'yellow' ? yellow : white).push(g);
    }
    for (const [list, color] of [[white, 0xdfe3da], [yellow, 0xd9b754]] as const) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list, false)!,
        new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      list.forEach(g => g.dispose());
      mesh.receiveShadow = true;
      mesh.name = 'city-markings';
      this.group.add(mesh);
    }
  }

  private buildParkingBays() {
    const strips: THREE.BufferGeometry[] = [];
    for (const b of BAYS) {
      const hw = b.w / 2, hd = b.d / 2;
      for (const s of [-1, 1]) {
        const g = new THREE.PlaneGeometry(0.14, b.d);
        g.rotateX(-Math.PI / 2);
        g.translate(b.x + s * hw, 0.058, b.z);
        strips.push(g);
      }
      const nose = new THREE.PlaneGeometry(b.w + 0.14, 0.14);
      nose.rotateX(-Math.PI / 2);
      nose.translate(b.x, 0.058, b.z + (b.facing === 'N' ? -hd : hd));
      strips.push(nose);
    }
    const merged = mergeGeometries(strips, false)!;
    strips.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0xe8ebe4, roughness: 0.8 }));
    mesh.receiveShadow = true;
    mesh.name = 'parking-bays';
    this.group.add(mesh);
  }

  private buildTrees() {
    // Hundreds of trees share the frame here, so use the light crown LOD.
    const trees = createTreeGeometries('low');
    const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const crown = new THREE.InstancedMesh(trees.broadCrown, crownMat, TREES.length);
    const trunk = new THREE.InstancedMesh(trees.broadWood, bark, TREES.length);
    crown.castShadow = true;
    const green = new THREE.Color(0x4e7a3f), autumn = new THREE.Color(0x6d7a35), tmp = new THREE.Color();
    TREES.forEach((t, i) => {
      this.dummy.position.set(t.x, 0, t.z);
      this.dummy.rotation.set(0, (i * 2.39996) % (Math.PI * 2), 0);
      this.dummy.scale.setScalar(t.s * 1.05);
      this.dummy.updateMatrix();
      crown.setMatrixAt(i, this.dummy.matrix);
      trunk.setMatrixAt(i, this.dummy.matrix);
      tmp.copy(green).lerp(autumn, ((i * 37) % 100) / 100);
      crown.setColorAt(i, tmp);
    });
    crown.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
    if (crown.instanceColor) crown.instanceColor.needsUpdate = true;
    this.group.add(crown, trunk);

    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    bushGeo.scale(1.35, 0.72, 1.35);
    const bush = new THREE.InstancedMesh(bushGeo,
      new THREE.MeshStandardMaterial({ color: 0x41603a, roughness: 1 }), BUSHES.length);
    BUSHES.forEach((b, i) => {
      this.dummy.position.set(b.x, 0.3 * b.s, b.z);
      this.dummy.rotation.set(0, i * 1.7, 0);
      this.dummy.scale.setScalar(b.s);
      this.dummy.updateMatrix();
      bush.setMatrixAt(i, this.dummy.matrix);
    });
    bush.instanceMatrix.needsUpdate = true;
    this.group.add(bush);
  }

  private buildLamps() {
    const streetlight = createStreetlightGeometry();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x69737a, metalness: 0.75, roughness: 0.48 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x3e474e, metalness: 0.65, roughness: 0.4 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x252d34, metalness: 0.45, roughness: 0.5 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2d2, emissive: 0xffdf9e, emissiveIntensity: 0.3, roughness: 0.5 });
    const pole = new THREE.InstancedMesh(streetlight.pole, poleMat, LAMPS.length);
    const housing = new THREE.InstancedMesh(streetlight.housing, housingMat, LAMPS.length);
    const rim = new THREE.InstancedMesh(streetlight.rim, rimMat, LAMPS.length);
    const lens = new THREE.InstancedMesh(streetlight.lens, this.lampMat, LAMPS.length);
    this.lampOrder = LAMPS.map(l => ({ x: l.x, z: l.z }));
    LAMPS.forEach((l, i) => {
      // Arms point away from the pole toward the carriageway.
      const rotY = l.side === 1 ? Math.PI : 0;
      this.dummy.position.set(l.x, 0, l.z);
      this.dummy.rotation.set(0, rotY, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      pole.setMatrixAt(i, this.dummy.matrix);
      housing.setMatrixAt(i, this.dummy.matrix);
      rim.setMatrixAt(i, this.dummy.matrix);
      lens.setMatrixAt(i, this.dummy.matrix);
    });
    for (const m of [pole, housing, rim, lens]) {
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffd6a1, 0, 26, 2);
      light.visible = false;
      this.nightLights.push(light);
      this.group.add(light);
    }
  }

  /** Fountain plaza: paving ring, grass border and benches. */
  private buildPark() {
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 40),
      new THREE.MeshStandardMaterial({ color: 0xb4b0a4, roughness: 0.95 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(FOUNTAIN.x, 0.02, FOUNTAIN.z);
    plaza.receiveShadow = true;
    this.group.add(plaza);
    // Cross paths through the park block.
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xc0bbae, roughness: 0.97 });
    for (const vertical of [true, false]) {
      const w = vertical ? 5 : PARK.x1 - PARK.x0;
      const d = vertical ? PARK.z1 - PARK.z0 : 5;
      const path = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat);
      path.rotation.x = -Math.PI / 2;
      path.position.set(FOUNTAIN.x, 0.015, FOUNTAIN.z);
      path.receiveShadow = true;
      this.group.add(path);
    }
  }

  private buildHedges() {
    const hedge = new THREE.BoxGeometry(1.5, 1.85, 1.5);
    const inst = new THREE.InstancedMesh(hedge,
      new THREE.MeshStandardMaterial({ color: 0x2c4630, roughness: 1 }), HEDGES.length);
    HEDGES.forEach((h, i) => {
      this.dummy.position.set(h.x, 0.9, h.z);
      this.dummy.rotation.set(0, hashRot(i), 0);
      this.dummy.scale.set(1, 0.9 + hashRot(i + 999) * 0.3, 1);
      this.dummy.updateMatrix();
      inst.setMatrixAt(i, this.dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    this.group.add(inst);
  }

  // --- Async layer: GLB buildings & props, parked cars -----------------------
  private async load() {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const gltf = await new GLTFLoader().loadAsync(`${base}models/city/city.glb`);
    const byName = new Map<string, THREE.Object3D>();
    for (const child of gltf.scene.children) byName.set(child.name, child);

    // Merge every placement into one mesh per building material. Repeating an
    // archetype costs geometry only — the whole town stays at a few dozen
    // draw calls. Facade variation is baked in as a per-vertex tint, so two
    // bakeries on the same street still read as different premises.
    const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; colors: number[][] }>();

    const matrix = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const axisY = new THREE.Vector3(0, 1, 0);
    let placedCount = 0;

    for (const entry of BUILDINGS) {
      const source = byName.get(`bldg_${entry.key}`);
      if (!source) continue;
      const scale = entry.scale ?? 1;
      quat.setFromAxisAngle(axisY, facingRotationY(entry.facing));
      pos.set(entry.x, 0, entry.z);
      scl.setScalar(scale);
      matrix.compose(pos, quat, scl);
      source.updateMatrixWorld(true);
      const tint = new THREE.Color(entry.tint ?? 0xffffff).convertSRGBToLinear();
      source.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material & { name?: string };
        const key = mat.uuid;
        let bucket = buckets.get(key);
        if (!bucket) { bucket = { mat, geos: [], colors: [] }; buckets.set(key, bucket); }
        local.multiplyMatrices(matrix, localMatrix(source, mesh));
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        // Normalise attributes so mergeGeometries sees one schema per bucket.
        for (const name of Object.keys(g.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        }
        if (!g.getAttribute('uv')) {
          g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
        }
        if (!g.getAttribute('normal')) g.computeVertexNormals();
        g.applyMatrix4(local);
        const isFacade = (mat.name ?? '').startsWith('facade_');
        bucket.geos.push(g);
        bucket.colors.push(isFacade ? [tint.r, tint.g, tint.b] : [1, 1, 1]);
      });
      placedCount++;
    }
    if (placedCount < BUILDINGS.length) {
      console.warn(`city.glb supplied ${placedCount}/${BUILDINGS.length} building lots`);
    }

    for (const { mat, geos, colors } of buckets.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) { geos.forEach(g => g.dispose()); continue; }
      // Per-vertex tint attribute spanning every merged instance.
      const total = geos.reduce((n, g) => n + g.getAttribute('position').count, 0);
      const attr = new Float32Array(total * 3);
      let at = 0;
      for (let i = 0; i < geos.length; i++) {
        const count = geos[i].getAttribute('position').count;
        const [r, g, b] = colors[i];
        for (let v = 0; v < count; v++) { attr[at++] = r; attr[at++] = g; attr[at++] = b; }
      }
      merged.setAttribute('color', new THREE.BufferAttribute(attr, 3));
      geos.forEach(g => g.dispose());
      const material = (mat as THREE.MeshStandardMaterial).clone();
      material.vertexColors = true;
      material.envMapIntensity = 0.45;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `city-${(mat.name ?? 'mesh')}`;
      this.group.add(mesh);
    }

    // Props.
    const prop = (name: string, x: number, z: number, rotY = 0) => {
      const source = byName.get(name);
      if (!source) return;
      const node = source.clone(true);
      node.position.set(x, 0, z);
      node.rotation.y = rotY;
      node.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.group.add(node);
    };
    prop('prop_fountain', FOUNTAIN.x, FOUNTAIN.z);
    for (const b of BENCHES) prop('prop_bench', b.x, b.z, b.rotY);
    for (const [x, z] of [[16, PARKING_LOT.z0 - 4], [-16, PARKING_LOT.z0 - 4],
      [16, PARKING_LOT.z1 + 4], [-16, PARKING_LOT.z1 + 4]]) {
      prop('prop_parkingsign', x, z, z < PARKING_LOT.z0 ? Math.PI : 0);
    }

    // Parked cars fill 14 bays — the same models you race, but merged per
    // material so a full lot costs a handful of draw calls instead of hundreds.
    for (const parked of PARKED_CARS) {
      const bay = BAYS[parked.bay];
      const car = this.library.create(parked.car as any, { paint: parked.paint });
      car.position.set(bay.x, 0.02, bay.z);
      car.rotation.y = bay.facing === 'N' ? 0 : Math.PI;
      car.updateMatrixWorld(true);
      const merged = mergeStatic(car);
      // mergeStatic bakes geometry in the model's own frame, so re-apply the
      // bay placement here (otherwise every car parks at the world origin).
      merged.position.copy(car.position);
      merged.rotation.copy(car.rotation);
      merged.scale.copy(car.scale);
      this.group.add(merged);
    }
  }
}

/**
 * Collapse a whole loaded model into one mesh per material, keeping each
 * material's own look. Used for the parked cars, which arrive as ~70 small
 * meshes each; without this the lot alone would be ~1,000 draw calls.
 */
function mergeStatic(root: THREE.Object3D): THREE.Object3D {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    // Merge in the root's own frame; the returned group then inherits the
    // caller's placement exactly once.
    local.multiplyMatrices(invRoot, mesh.matrixWorld);
    g.applyMatrix4(local);
    const mat = mats[0];
    const list = buckets.get(mat);
    if (list) list.push(g); else buckets.set(mat, [g]);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

/** Combine the instance transform with a mesh's transform inside its node. */
const _inv = new THREE.Matrix4();
function localMatrix(root: THREE.Object3D, mesh: THREE.Object3D) {
  _inv.copy(root.matrixWorld).invert();
  return new THREE.Matrix4().multiplyMatrices(_inv, mesh.matrixWorld);
}

function hashRot(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}
