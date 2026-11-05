import * as THREE from 'three';
import { ModelLibrary } from './models';
import { CARS, getCar, TRAFFIC_COLORS, type CarId, type TrafficId } from './catalog';
import {
  ROAD_HALF, PLAYER_LANE, ONCOMING_LANE,
  multiplierFor, passScore, vehiclesOverlap, hitsRoadBarrier, blockedTrafficGap,
  canSpawnSame, findOncomingSpawn, sameSpawnInterval, oncomingSpawnInterval,
} from './rules.mjs';
import { createVehicleState, stepVehicle } from './physics.mjs';
import { easing } from 'maath';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, FXAAEffect } from 'postprocessing';
import { Atmosphere } from './world/atmosphere';
import { Precipitation } from './world/precipitation';
import { RoadSpray } from './world/road-spray';
import { createTreeGeometries } from './world/trees';
import { createRidgeGeometry, createBuildingGeometry, createGrassGeometry, createDistantTreeGeometries, createRockGeometry } from './world/landscape';
import { createGroundMaterial } from './world/ground';
import { createStreetlightGeometry } from './world/streetlight';
import { addFoliageSnow, createRoadsideSignGeometry } from './world/roadside';
import { disposeBodyKit, updateExhaustFlames } from './body-kits';
import { createAsphaltMaterial, createSnowMaterial, createShoulderMaterial, createRoadMarkingMaterial } from './world/road-surface';
import { biomeParams, dominantBiome } from './world/biomes.mjs';
import { snowDriftHeight } from './world/road-snow.mjs';
import { createWeatherState, stepWeather, weatherGrip, weatherLabel, type WeatherState } from './world/weather.mjs';
import { createClock, stepClock, formatHour } from './world/clock.mjs';
import { createRun, tickRun, registerPass, finishRun, runSummary, contractProgress, medalFor, RUN_MODES, type RunMode, type RunState, type RunEvent, type Medal } from './run.mjs';
import { createTrafficAI, findLeader, stepTraffic, hazardAhead, trafficCruise, chooseTruck, canOvertakeTruck, startOvertake, stepOvertake, type TrafficAI, type Hazard } from './traffic-ai.mjs';
import { chooseTrafficModel, chooseTrafficPaint } from './traffic-appearance.mjs';
import { emptyRecords, sanitizeRecords, recordRun, bestFor, type Records } from './records.mjs';

export type Mode = 'garage' | 'driving' | 'paused' | 'gameover';
export type CameraPreset = 'close' | 'chase' | 'far' | 'hood' | 'bumper';

export interface CameraSettings {
  preset: CameraPreset;
  distance: number;
  height: number;
  fov: number;
  lookAhead: number;
}

export const CAMERA_PRESETS: Record<CameraPreset, Omit<CameraSettings, 'preset'>> = {
  close: { distance: 5.2, height: 2.0, fov: 62, lookAhead: 7 },
  chase: { distance: 7.0, height: 2.6, fov: 60, lookAhead: 9 },
  far: { distance: 10.0, height: 3.8, fov: 56, lookAhead: 12 },
  hood: { distance: 1.15, height: 1.12, fov: 68, lookAhead: 30 },
  bumper: { distance: 2.25, height: 0.55, fov: 70, lookAhead: 30 },
};
export const CAMERA_ORDER: CameraPreset[] = ['close', 'chase', 'far', 'hood', 'bumper'];

export interface HudState {
  score: number;
  speed: number;
  distance: number;
  combo: number;
  mult: number;
  best: number;
  overtakes: number;
  oncoming: number | null; // metres to nearest oncoming car, if relevant
  offroad: boolean;
  throttle: number;
  brake: number;
  time: string;
  weather: string;
  biome: string;
  night: boolean;
  runMode: RunMode;
  runLabel: string;
  timeLeft: number | null;
  elapsed: number;
  contract: { title: string; desc: string; value: number; target: number; ratio: number; index: number; total: number; reward: number } | null;
  contractsDone: number;
  signal: 'left' | 'right' | null;
  signalLit: boolean;
  hazard: Hazard | null;
}

export interface RunStats {
  score: number;
  distance: number;
  overtakes: number;
  nearMisses: number;
  best: number;
  newBest: boolean;
  mode: RunMode;
  car: CarId;
  topSpeed: number;
  contractsDone: number;
  elapsed: number;
  medal: Medal;
  reason: string | null;
}

export interface GameCallbacks {
  onHud: (h: HudState) => void;
  onEvent: (e: { kind: 'overtake' | 'near' | 'combo' | 'crash' | 'oncoming' | 'contract' | 'finish'; text: string; points?: number }) => void;
  onGameOver: (s: RunStats) => void;
  onMode: (m: Mode) => void;
}

interface Traffic {
  group: THREE.Group;
  id: TrafficId;
  paint: number;
  dir: 1 | -1; // 1 = same direction, -1 = oncoming
  s: number;
  offset: number;
  speed: number;
  passed: boolean;
  length: number;
  width: number;
  ai: TrafficAI;
  braking: boolean;
  brakeGlow?: THREE.Sprite;
}

// Winding, rolling centreline. s is distance along the road.
const centerX = (s: number) => 16 * Math.sin(s * 0.004) + 8 * Math.sin(s * 0.009 + 1.7) + 4 * Math.sin(s * 0.017 + 0.4);
const centerY = (s: number) => 2.2 * Math.sin(s * 0.005 + 0.8) + 1.1 * Math.sin(s * 0.012);
const centerDx = (s: number) => 16 * 0.004 * Math.cos(s * 0.004) + 8 * 0.009 * Math.cos(s * 0.009 + 1.7) + 4 * 0.017 * Math.cos(s * 0.017 + 0.4);
const centerDy = (s: number) => 2.2 * 0.005 * Math.cos(s * 0.005 + 0.8) + 1.1 * 0.012 * Math.cos(s * 0.012);

function centerAt(s: number, out = new THREE.Vector3()) {
  return out.set(centerX(s), centerY(s), -s);
}
function tangentAt(s: number, out = new THREE.Vector3()) {
  return out.set(centerDx(s), centerDy(s), -1).normalize();
}
function rightAt(s: number, out = new THREE.Vector3()) {
  const dx = centerDx(s);
  return out.set(1, 0, dx).normalize();
}
function roadYaw(s: number) {
  return Math.atan2(-centerDx(s), 1);
}
function roadCurvature(s: number) {
  const dx = centerDx(s);
  const ddx = -16 * 0.004 * 0.004 * Math.sin(s * 0.004)
    - 8 * 0.009 * 0.009 * Math.sin(s * 0.009 + 1.7)
    - 4 * 0.017 * 0.017 * Math.sin(s * 0.017 + 0.4);
  return -ddx / (1 + dx * dx);
}

function hash01(n: number) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function smooth01(edge: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge + 0.12) / 0.24));
  return t * t * (3 - 2 * t);
}

const STEP = 4;
const SEGMENTS = 180;
const BACK = 80;

export class OvertakeGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private library: ModelLibrary;
  private cb: GameCallbacks;

  private atmosphere!: Atmosphere;
  private precipitation!: Precipitation;
  private spray!: RoadSpray;
  private composer!: EffectComposer;
  private roadEnv: THREE.Texture | null = null;
  private studioEnv: THREE.Texture | null = null;
  private worldClock = createClock(9.5, 1, true);
  private weather: WeatherState = createWeatherState('auto');
  private worldElapsed = 0;
  private nightFactor = 0;
  private headlights: THREE.SpotLight[] = [];
  private headlightTargets: THREE.Object3D[] = [];

  private roadGroup = new THREE.Group();
  private garageGroup = new THREE.Group();
  private terrain!: THREE.Mesh;
  private ground!: THREE.Mesh;
  private asphalt!: THREE.Mesh;
  private asphaltMat!: THREE.MeshStandardMaterial;
  private roadSurface = { wet: { value: 0 }, snow: { value: 0 }, rain: { value: 0 }, time: { value: 0 } };
  private snowLayer!: THREE.Mesh;
  private shoulderMat!: THREE.MeshStandardMaterial;
  private groundMat!: THREE.MeshStandardMaterial;
  private mountainMat!: THREE.MeshStandardMaterial;
  private lampMat!: THREE.MeshStandardMaterial;
  private shoulder!: THREE.Mesh;
  private edgeL!: THREE.Mesh;
  private edgeR!: THREE.Mesh;
  private centerLine!: THREE.Mesh;
  private railL!: THREE.Mesh;
  private railR!: THREE.Mesh;
  private posts!: THREE.InstancedMesh;
  private reflectors!: THREE.InstancedMesh;
  private roadsideSigns: THREE.InstancedMesh[] = [];
  private railCaps: THREE.Mesh[] = [];
  private broadleaf!: THREE.InstancedMesh;
  private conifers!: THREE.InstancedMesh;
  private broadTrunks!: THREE.InstancedMesh;
  private pineTrunks!: THREE.InstancedMesh;
  private rocks!: THREE.InstancedMesh;
  private buildings!: THREE.InstancedMesh;
  private grass!: THREE.InstancedMesh;
  private distantTrees!: THREE.InstancedMesh;
  private distantTrunks!: THREE.InstancedMesh;
  private distantPines!: THREE.InstancedMesh;
  private distantPineTrunks!: THREE.InstancedMesh;
  private treeMat!: THREE.MeshStandardMaterial;
  private coniferMat!: THREE.MeshStandardMaterial;
  private rockMat!: THREE.MeshStandardMaterial;
  private buildingMat!: THREE.MeshStandardMaterial;
  private lamps: { g: THREE.Group; s: number; side: number }[] = [];
  private mountains = new THREE.Group();
  private dummy = new THREE.Object3D();
  private contactShadow!: THREE.Mesh;

  private player: THREE.Group | null = null;
  private playerMeta = { length: 4.5, width: 1.9 };
  private selected: CarId = 'golf';
  mode: Mode = 'garage';
  private cam: CameraSettings = { preset: 'close', ...CAMERA_PRESETS.close };
  private garageZoom = 6.2;
  private garageDragging = false;
  private garageWorkshop = false;
  private garageAuto = true;

  // Free-driving state (road-relative vehicle model)
  private pos = new THREE.Vector3();
  private yaw = 0;
  private speed = 0;
  private steer = 0;
  private playerS = 0;
  private offset = PLAYER_LANE;
  private vehicle = createVehicleState();

  private run: RunState = createRun('endless');
  private runMode: RunMode = 'endless';
  private records: Records = emptyRecords();
  private best = 0;
  private hazard: Hazard | null = null;
  private brakeTexture: THREE.Texture | null = null;
  private playerBrakes: THREE.Sprite[] = [];
  private signal: 'left' | 'right' | null = null;
  private signalElapsed = 0;
  private traffic: Traffic[] = [];
  private sameTimer = 0.8;
  private oncomingTimer = 2.0;
  private input = { throttle: false, brake: false, left: false, right: false, handbrake: false };

  get distance() { return this.run.distance; }
  get score() { return this.run.score; }
  get combo() { return this.run.combo; }
  get overtakes() { return this.run.overtakes; }
  get nearMisses() { return this.run.nearMisses; }
  private garageAngle = Math.PI * 0.78;
  private garagePitch = 0.32;
  private shake = 0;
  private raf = 0;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, library: ModelLibrary, cb: GameCallbacks) {
    this.library = library;
    this.cb = cb;
    const testMode = new URLSearchParams(location.search).has('test');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !testMode, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(testMode ? 1 : Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = !testMode;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

    this.loadRecords();
    this.best = bestFor(this.records, this.runMode);

    this.buildEnvironments();
    this.atmosphere = new Atmosphere(this.scene);
    this.precipitation = new Precipitation(this.scene);
    this.spray = new RoadSpray(this.scene);
    this.buildRoad();
    this.buildScenery();
    this.buildGarage();
    this.buildContactShadow();
    this.buildHeadlights();
    this.scene.add(this.roadGroup, this.garageGroup, this.mountains);
    // Canvas antialiasing does not affect the composer's offscreen buffers.
    // Multisample those buffers so car silhouettes remain smooth in motion.
    const samples = testMode ? 0 : Math.min(4, this.renderer.capabilities.maxSamples);
    this.composer = new EffectComposer(this.renderer, { multisampling: samples });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.72, luminanceSmoothing: 0.25, mipmapBlur: true });
    const vignette = new VignetteEffect({ offset: 0.42, darkness: 0.24 });
    this.composer.addPass(new EffectPass(this.camera, bloom, vignette));
    // Shader AA is a low-cost fallback on devices without multisample support.
    if (!testMode && samples === 0) this.composer.addPass(new EffectPass(this.camera, new FXAAEffect()));
    this.setEnvironment('garage');

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.loadCameraSettings();
    this.bindGarageOrbit(canvas);
    this.setSelectedCar('golf');
    this.loop();
  }

  private loadCameraSettings() {
    try {
      const raw = localStorage.getItem('overtake-camera');
      if (raw) {
        const s = JSON.parse(raw) as CameraSettings;
        if (s.preset && CAMERA_PRESETS[s.preset]) this.cam = { ...CAMERA_PRESETS[s.preset], ...s };
      }
    } catch { /* ignore */ }
  }

  private saveCameraSettings() {
    try { localStorage.setItem('overtake-camera', JSON.stringify(this.cam)); } catch { /* ignore */ }
  }

  getCameraSettings(): CameraSettings { return { ...this.cam }; }

  setCameraPreset(preset: CameraPreset) {
    this.cam = { preset, ...CAMERA_PRESETS[preset] };
    this.saveCameraSettings();
  }

  setCameraValue(key: 'distance' | 'height' | 'fov' | 'lookAhead', value: number) {
    const limits = { distance: [3.2, 14], height: [0.4, 6], fov: [45, 95], lookAhead: [3, 40] } as const;
    const [lo, hi] = limits[key];
    this.cam[key] = Math.max(lo, Math.min(hi, value));
    this.saveCameraSettings();
  }

  cycleCamera() {
    const i = CAMERA_ORDER.indexOf(this.cam.preset);
    this.setCameraPreset(CAMERA_ORDER[(i + 1) % CAMERA_ORDER.length]);
  }

  private bindGarageOrbit(canvas: HTMLCanvasElement) {
    let lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'garage') return;
      this.garageDragging = true; this.garageAuto = false;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.garageDragging || this.mode !== 'garage') return;
      this.garageAngle -= (e.clientX - lastX) * 0.006;
      this.garagePitch = Math.max(0.15, Math.min(1.2, this.garagePitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    });
    const up = () => { this.garageDragging = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      if (this.mode !== 'garage') return;
      e.preventDefault();
      this.garageAuto = false;
      this.garageZoom = Math.max(4.2, Math.min(12, this.garageZoom + e.deltaY * 0.005));
    }, { passive: false });
  }

  // --- Environment / lighting -------------------------------------------------
  private makeEnvTexture(kind: 'road' | 'studio'): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d')!;
    if (kind === 'road') {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#314c6c');
      g.addColorStop(0.42, '#9bacbc');
      g.addColorStop(0.5, '#c6c9c6');
      g.addColorStop(0.55, '#777d80');
      g.addColorStop(1, '#2c2c2c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
      const sun = ctx.createRadialGradient(700, 235, 4, 700, 235, 120);
      sun.addColorStop(0, 'rgba(255,250,238,0.8)');
      sun.addColorStop(0.2, 'rgba(231,231,218,0.4)');
      sun.addColorStop(1, 'rgba(210,219,225,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, 1024, 512);
    } else {
      ctx.fillStyle = '#0a0c11'; ctx.fillRect(0, 0, 1024, 512);
      const strip = (y: number, h: number, a: number) => {
        const g = ctx.createLinearGradient(0, y - h, 0, y + h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(235,242,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y - h, 1024, h * 2);
      };
      strip(120, 46, 0.95);
      strip(210, 22, 0.55);
      strip(330, 60, 0.25);
      const side = ctx.createLinearGradient(0, 0, 1024, 0);
      side.addColorStop(0, 'rgba(80,140,255,0.18)');
      side.addColorStop(0.5, 'rgba(0,0,0,0)');
      side.addColorStop(1, 'rgba(255,170,90,0.16)');
      ctx.fillStyle = side; ctx.fillRect(0, 0, 1024, 512);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose(); pmrem.dispose();
    return env;
  }

  private buildEnvironments() {
    this.roadEnv = this.makeEnvTexture('road');
    this.studioEnv = this.makeEnvTexture('studio');
  }

  private buildHeadlights() {
    for (const side of [-0.62, 0.62]) {
      const light = new THREE.SpotLight(0xf6f9ff, 0, 55, Math.PI / 7, 0.45, 1.4);
      const target = new THREE.Object3D();
      light.target = target;
      this.scene.add(light, target);
      this.headlights.push(light);
      this.headlightTargets.push(target);
      light.userData.side = side;
    }
  }

  // --- Road geometry ----------------------------------------------------------
  private ribbon(width: number, mat: THREE.Material, yOffset = 0.02) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 4), 2).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { width, yOffset };
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  private updateRibbon(mesh: THREE.Mesh, startY: number, width?: number, lateral = 0) {
    const w = width ?? mesh.userData.width;
    const yOff = mesh.userData.yOffset ?? 0.02;
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const start = this.playerS - BACK;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = start + i * STEP;
      const cx = centerX(s), cy = centerY(s) + yOff + startY;
      const r = rightAt(s, this.tmpA);
      const ox = cx + r.x * lateral, oz = -s + r.z * lateral;
      const hw = w / 2;
      arr[i * 6 + 0] = ox - r.x * hw; arr[i * 6 + 1] = cy; arr[i * 6 + 2] = oz - r.z * hw;
      arr[i * 6 + 3] = ox + r.x * hw; arr[i * 6 + 4] = cy; arr[i * 6 + 5] = oz + r.z * hw;
    }
    attr.needsUpdate = true;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = start + i * STEP;
      uv.setXY(i * 2, 0, s); uv.setXY(i * 2 + 1, 1, s);
    }
    uv.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  // A continuous corrugated W-beam barrier, swept along the actual road
  // curve. The previous horizontal ribbon looked like a flat stripe from the
  // driving camera. The profile gives the guardrail a real face and silhouette.
  private makeGuardrail(material: THREE.Material, side: number) {
    const profile = [0.38, 0.40, 0.44, 0.49, 0.54, 0.59, 0.64, 0.69, 0.74, 0.79, 0.81];
    const bulge = [0, 0.04, 0.11, 0.12, 0.04, 0, 0.04, 0.12, 0.11, 0.04, 0];
    const n = profile.length, indices: number[] = [];
    for (let row = 0; row < SEGMENTS; row++) for (let col = 0; col < n - 1; col++) {
      const a = row * n + col, b = a + 1, c = a + n, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * n * 2), 2).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = side < 0 ? 'guardrail-left' : 'guardrail-right';
    mesh.userData = { side, profile, bulge };
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  private updateGuardrail(mesh: THREE.Mesh) {
    const { side, profile, bulge } = mesh.userData as { side: number; profile: number[]; bulge: number[] };
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const start = this.playerS - BACK;
    for (let row = 0; row <= SEGMENTS; row++) {
      const s = start + row * STEP, r = rightAt(s, this.tmpA), cx = centerX(s), cy = centerY(s);
      for (let col = 0; col < profile.length; col++) {
        const lateral = side * (ROAD_HALF + 0.55 - bulge[col]), i = row * profile.length + col;
        pos.setXYZ(i, cx + r.x * lateral, cy + profile[col], -s + r.z * lateral);
        uv.setXY(i, col / (profile.length - 1), s);
      }
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  // A raised snow mesh conforms to the curved road and accumulates in shallow
  // drifts. Its fragment mask exposes asphalt in irregular wheel tracks.
  private makeSnowLayer(aniso: number) {
    const columns = 32;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((SEGMENTS + 1) * (columns + 1) * 3);
    const uvs = new Float32Array((SEGMENTS + 1) * (columns + 1) * 2);
    const indices: number[] = [];
    for (let row = 0; row < SEGMENTS; row++) for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(indices);
    const width = ROAD_HALF * 2 + 1.4;
    const mesh = new THREE.Mesh(geo, createSnowMaterial(width, aniso, this.roadSurface));
    mesh.userData = { width, columns };
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    return mesh;
  }

  private updateSnowLayer() {
    const mesh = this.snowLayer;
    const cover = this.weather.snowCover;
    mesh.visible = cover > 0.005;
    if (!mesh.visible) return;
    const { width, columns } = mesh.userData as { width: number; columns: number };
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const start = this.playerS - BACK;
    for (let row = 0; row <= SEGMENTS; row++) {
      const s = start + row * STEP;
      const cx = centerX(s), cy = centerY(s);
      const r = rightAt(s, this.tmpA);
      for (let col = 0; col <= columns; col++) {
        const u = col / columns, x = (u - 0.5) * width;
        const height = snowDriftHeight(x, s, cover, ROAD_HALF);
        const index = row * (columns + 1) + col;
        pos.setXYZ(index, cx + r.x * x, cy + 0.025 + height, -s + r.z * x);
        uv.setXY(index, u, s);
      }
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  private buildRoad() {
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const asphaltMat = createAsphaltMaterial(ROAD_HALF * 2, aniso, this.roadSurface);
    const shoulderMat = createShoulderMaterial(ROAD_HALF * 2 + 3.2, aniso, this.roadSurface);
    this.asphaltMat = asphaltMat;
    this.shoulderMat = shoulderMat;
    const lineMat = createRoadMarkingMaterial(0xd7d9d1, this.roadSurface);
    const yellowMat = createRoadMarkingMaterial(0xe4b632, this.roadSurface);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x929da5, metalness: 0.72, roughness: 0.46, side: THREE.DoubleSide });
    railMat.onBeforeCompile = shader => {
      shader.uniforms.roadSnow = this.roadSurface.snow;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 railUV;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nrailUV = uv;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 railUV;\nuniform float roadSnow;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wear = 0.94 + 0.06 * sin(railUV.y * 1.4) * sin(railUV.y * 0.23);
          diffuseColor.rgb *= wear;
          float frost = smoothstep(0.94, 1.0, railUV.x) * smoothstep(0.1, 0.8, roadSnow);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.89, 0.94), frost * 0.8);`);
    };
    railMat.customProgramCacheKey = () => 'guardrail-galvanized-v1';
    const capMat = new THREE.MeshStandardMaterial({ color: 0x939da6, metalness: 0.7, roughness: 0.42 });
    capMat.onBeforeCompile = shader => {
      shader.uniforms.roadSnow = this.roadSurface.snow;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float roadSnow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.9, 0.96), smoothstep(0.08, 0.7, roadSnow));');
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, roadSnow);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - roadSnow;');
    };
    capMat.customProgramCacheKey = () => 'guardrail-snow-cap-v1';

    this.groundMat = createGroundMaterial();
    this.terrain = this.ribbon(320, this.groundMat, -0.6);
    this.shoulder = this.ribbon(ROAD_HALF * 2 + 3.2, shoulderMat, -0.03);
    this.asphalt = this.ribbon(ROAD_HALF * 2, asphaltMat, 0);
    this.snowLayer = this.makeSnowLayer(aniso);
    this.edgeL = this.ribbon(0.16, lineMat, 0.02);
    this.edgeR = this.ribbon(0.16, lineMat, 0.02);
    this.railL = this.makeGuardrail(railMat, -1);
    this.railR = this.makeGuardrail(railMat, 1);
    this.railCaps = [this.ribbon(0.16, capMat, 0.815), this.ribbon(0.16, capMat, 0.815)];
    this.roadGroup.add(this.terrain, this.shoulder, this.asphalt, this.edgeL, this.edgeR, this.railL, this.railR, ...this.railCaps, this.snowLayer);

    // Dashed centre line (passing zone between the two directions).
    const dashGeo = new THREE.BufferGeometry();
    const dashCount = Math.ceil((SEGMENTS * STEP) / 9) + 2;
    dashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dashCount * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < dashCount; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    dashGeo.setIndex(idx);
    this.centerLine = new THREE.Mesh(dashGeo, yellowMat);
    this.centerLine.userData.dashCount = dashCount;
    this.centerLine.frustumCulled = false;
    this.roadGroup.add(this.centerLine);

    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.75, 0.16), railMat, 320);
    this.posts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.roadGroup.add(this.posts);
    // Small reflectors mounted on the road-facing side, not glowing billboards.
    this.reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.095, 0.20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x897b56, emissiveIntensity: 0.12, roughness: 0.36 }), 320);
    this.reflectors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const amberReflector = new THREE.Color(0xf5c261), whiteReflector = new THREE.Color(0xe6f1ff);
    for (let i = 0; i < 320; i++) this.reflectors.setColorAt(i, i % 2 === 0 ? amberReflector : whiteReflector);
    this.roadGroup.add(this.reflectors);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.5;
    ground.receiveShadow = true;
    this.ground = ground;
    this.roadGroup.add(ground);
  }

  private updateCenterLine() {
    const attr = this.centerLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = this.centerLine.userData.dashCount as number;
    const start = Math.floor((this.playerS - BACK) / 9) * 9;
    for (let i = 0; i < count; i++) {
      const s0 = start + i * 9, s1 = s0 + 4;
      const r0 = rightAt(s0, this.tmpA), r1 = rightAt(s1, this.tmpB);
      const y0 = centerY(s0) + 0.025, y1 = centerY(s1) + 0.025;
      const hw = 0.09;
      arr[i * 12 + 0] = centerX(s0) - r0.x * hw; arr[i * 12 + 1] = y0; arr[i * 12 + 2] = -s0 - r0.z * hw;
      arr[i * 12 + 3] = centerX(s0) + r0.x * hw; arr[i * 12 + 4] = y0; arr[i * 12 + 5] = -s0 + r0.z * hw;
      arr[i * 12 + 6] = centerX(s1) - r1.x * hw; arr[i * 12 + 7] = y1; arr[i * 12 + 8] = -s1 - r1.z * hw;
      arr[i * 12 + 9] = centerX(s1) + r1.x * hw; arr[i * 12 + 10] = y1; arr[i * 12 + 11] = -s1 + r1.z * hw;
    }
    attr.needsUpdate = true;
    this.centerLine.geometry.computeVertexNormals();
  }

  private updatePosts() {
    const start = Math.floor((this.playerS - BACK) / 6) * 6;
    let i = 0;
    for (let s = start; s < this.playerS - BACK + SEGMENTS * STEP && i < 318; s += 6) {
      for (const side of [-1, 1]) {
        const r = rightAt(s, this.tmpA);
        const off = side * (ROAD_HALF + 0.68);
        this.dummy.position.set(centerX(s) + r.x * off, centerY(s) + 0.35, -s + r.z * off);
        this.dummy.rotation.set(0, roadYaw(s), 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.posts.setMatrixAt(i, this.dummy.matrix);
        const face = side * (ROAD_HALF + 0.405);
        this.dummy.position.set(centerX(s) + r.x * face, centerY(s) + 0.68, -s + r.z * face);
        this.dummy.updateMatrix();
        this.reflectors.setMatrixAt(i, this.dummy.matrix);
        i++;
      }
    }
    this.posts.count = i;
    this.posts.instanceMatrix.needsUpdate = true;
    this.reflectors.count = i;
    this.reflectors.instanceMatrix.needsUpdate = true;
  }

  private buildScenery() {
    // Deterministic roadside slots. Each slot is placed by absolute road
    // distance, then scaled/faded by the local biome weights, so biome changes
    // cross-fade instead of swapping the whole background at once.
    this.treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true });
    this.coniferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true });
    addFoliageSnow(this.treeMat, this.roadSurface.snow);
    addFoliageSnow(this.coniferMat, this.roadSurface.snow);
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true });
    this.buildingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true });
    const trees = createTreeGeometries();
    const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    this.broadleaf = new THREE.InstancedMesh(trees.broadCrown, this.treeMat, 150);
    this.conifers = new THREE.InstancedMesh(trees.pineCrown, this.coniferMat, 150);
    this.broadTrunks = new THREE.InstancedMesh(trees.broadWood, bark, 150);
    this.pineTrunks = new THREE.InstancedMesh(trees.pineWood, bark, 150);
    this.rocks = new THREE.InstancedMesh(createRockGeometry(), this.rockMat, 100);
    this.buildings = new THREE.InstancedMesh(createBuildingGeometry(), this.buildingMat, 70);
    this.grass = new THREE.InstancedMesh(createGrassGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide }), 420);
    const distant = createDistantTreeGeometries();
    this.distantTrees = new THREE.InstancedMesh(distant.crown, this.treeMat, 180);
    this.distantTrunks = new THREE.InstancedMesh(distant.wood, bark, 180);
    this.distantPines = new THREE.InstancedMesh(distant.pine, this.coniferMat, 180);
    this.distantPineTrunks = new THREE.InstancedMesh(distant.wood, bark, 180);
    for (const m of [this.broadleaf, this.conifers, this.broadTrunks, this.pineTrunks, this.rocks, this.buildings, this.grass, this.distantTrees, this.distantTrunks, this.distantPines, this.distantPineTrunks]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.roadGroup.add(m);
    }

    const sign = createRoadsideSignGeometry();
    const signMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x879199, metalness: 0.7, roughness: 0.48 }),
      new THREE.MeshStandardMaterial({ color: 0x292a24, metalness: 0.3, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0xe9b93d, roughness: 0.65, emissive: 0x735010, emissiveIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x22241f, roughness: 0.8 }),
    ];
    this.roadsideSigns = [sign.pole, sign.border, sign.face, sign.symbol].map((geo, i) => {
      const mesh = new THREE.InstancedMesh(geo, signMaterials[i], 8);
      mesh.name = ['sign-pole', 'sign-border', 'sign-face', 'sign-symbol'][i];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; this.roadGroup.add(mesh); return mesh;
    });

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x69737a, metalness: 0.75, roughness: 0.48 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x3e474e, metalness: 0.65, roughness: 0.4 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x252d34, metalness: 0.45, roughness: 0.5 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2d2, emissive: 0xffdf9e, emissiveIntensity: 0.4, roughness: 0.5 });
    const streetlight = createStreetlightGeometry();
    for (let i = 0; i < 24; i++) {
      const g = new THREE.Group();
      const side = i % 2 ? 1 : -1;
      g.name = 'streetlight';
      g.scale.x = side; // mirror the arm so the fixture always faces the road
      const pole = new THREE.Mesh(streetlight.pole, poleMat); pole.name = 'streetlight-pole-and-arm';
      const housing = new THREE.Mesh(streetlight.housing, housingMat); housing.name = 'streetlight-housing';
      const rim = new THREE.Mesh(streetlight.rim, rimMat); rim.name = 'streetlight-rim';
      const lens = new THREE.Mesh(streetlight.lens, this.lampMat); lens.name = 'streetlight-lens';
      g.add(pole, housing, rim, lens);
      this.lamps.push({ g, s: i * 32, side });
      this.roadGroup.add(g);
    }

    this.mountainMat = new THREE.MeshStandardMaterial({ color: 0x728598, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
    for (const [radius, height, phase] of [[525, 110, 0.7], [760, 175, 2.4]]) {
      const ridge = new THREE.Mesh(createRidgeGeometry(radius, height, phase), this.mountainMat);
      ridge.frustumCulled = false;
      this.mountains.add(ridge);
    }
  }

  private updateScenery() {
    const base = this.playerS;
    const spacing = 14;
    const start = Math.floor((base - 80) / spacing);
    const snow = this.weather.snowCover;
    const color = new THREE.Color();
    const snowyColor = new THREE.Color(0xe8eef4);
    const place = (mesh: THREE.InstancedMesh, i: number, s: number, side: number, dist: number, sc: number, y: number, hex: number) => {
      const r = rightAt(s, this.tmpA);
      const off = side * dist;
      this.dummy.position.set(centerX(s) + r.x * off, centerY(s) + y * sc - 0.2, -s + r.z * off);
      this.dummy.rotation.set(0, roadYaw(s) + hash01(Math.floor(s * 100) * 17 + 9) * 0.5, 0);
      this.dummy.scale.set(sc, sc, sc);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      const foliage = mesh === this.broadleaf || mesh === this.conifers || mesh === this.distantTrees || mesh === this.distantPines;
      color.set(hex).lerp(snowyColor, snow * (foliage ? 0.16 : 0.65));
      mesh.setColorAt(i, color);
    };
    for (let i = 0; i < 150; i++) {
      const k = start + i;
      const s = k * spacing + hash01(k * 3 + 1) * spacing;
      const p = biomeParams(s);
      const side = hash01(k * 5 + 2) > 0.5 ? 1 : -1;
      const dist = 11 + hash01(k * 7 + 4) * 40;
      const sc = 0.7 + hash01(k * 11 + 6) * 1.2;
      const treeFade = smooth01(hash01(k * 13 + 8), p.treeDensity);
      const coniferFade = treeFade * smooth01(hash01(k * 17 + 3), p.coniferRatio);
      const broadFade = treeFade * (1 - smooth01(hash01(k * 17 + 3), p.coniferRatio));
      place(this.broadleaf, i, s, side, dist, sc * broadFade, 0, p.tree);
      place(this.broadTrunks, i, s, side, dist, sc * broadFade, 0, 0x564333);
      place(this.conifers, i, s, -side, dist + 6, sc * coniferFade, 0, p.conifer);
      place(this.pineTrunks, i, s, -side, dist + 6, sc * coniferFade, 0, 0x4c392c);
      if (i < 100) {
        const rockFade = smooth01(hash01(k * 19 + 7), p.rockDensity);
        place(this.rocks, i, s + 5, side, dist + 10, (0.6 + hash01(k * 23 + 2)) * rockFade, 0.6, p.rock);
      }
      if (i < 70) {
        const bFade = smooth01(hash01(k * 29 + 11), p.buildingDensity);
        place(this.buildings, i, s + 8, -side, 34 + hash01(k * 31 + 5) * 40, (0.6 + hash01(k * 37 + 1) * 1.5) * bFade, 0, p.building);
      }
    }
    // Fill the middle distance and verge without placing anything on the road.
    // Absolute-distance hashes make slots stable as the player moves.
    for (let i = 0; i < 420; i++) {
      const k = Math.floor((base - 40) / 4) + Math.floor(i / 2);
      const s = k * 4 + hash01(k * 41 + (i % 2) * 7) * 4;
      const side = i % 2 ? 1 : -1;
      const p = biomeParams(s);
      const dist = 9 + hash01(k * 37 + i % 2 * 113) * 70;
      const density = Math.max(0.12, Math.min(1, p.treeDensity * 0.75 + 0.24)) * (1 - snow * 0.92);
      const fade = smooth01(hash01(k * 43 + i % 2 * 173), density);
      place(this.grass, i, s, side, dist, (0.65 + hash01(k * 47 + i % 2) * 1.15) * fade, 0.2, p.tree);
    }
    for (let i = 0; i < 180; i++) {
      const k = Math.floor((base - 80) / 9) + Math.floor(i / 2);
      const s = k * 9 + hash01(k * 53 + i % 2) * 9;
      const side = i % 2 ? 1 : -1;
      const p = biomeParams(s);
      const dist = 50 + hash01(k * 59 + i % 2 * 97) * 90;
      const fade = smooth01(hash01(k * 61 + i % 2 * 101), p.treeDensity * 0.8);
      const scale = (0.8 + hash01(k * 67 + i % 2) * 1.3) * fade;
      const pine = smooth01(hash01(k * 71 + i % 2 * 109), p.coniferRatio);
      place(this.distantTrees, i, s, side, dist, scale * (1 - pine), 0, p.tree);
      place(this.distantTrunks, i, s, side, dist, scale * (1 - pine), 0, 0x564333);
      place(this.distantPines, i, s, side, dist, scale * pine, 0, p.conifer);
      place(this.distantPineTrunks, i, s, side, dist, scale * pine, 0, 0x4c392c);
    }
    for (const m of [this.broadleaf, this.conifers, this.broadTrunks, this.pineTrunks, this.rocks, this.buildings, this.grass, this.distantTrees, this.distantTrunks, this.distantPines, this.distantPineTrunks]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Recycled sign slots use absolute road distance, so they never jump as
    // the road and scenery buffers shift around a moving car.
    const signStart = Math.floor((base - BACK) / 155) - 1;
    for (let i = 0; i < 8; i++) {
      const slot = signStart + i;
      const s = slot * 155 + hash01(slot * 71 + 13) * 24;
      const side = slot % 2 === 0 ? 1 : -1;
      const r = rightAt(s, this.tmpA), off = side * (ROAD_HALF + 2.8);
      this.dummy.position.set(centerX(s) + r.x * off, centerY(s), -s + r.z * off);
      this.dummy.rotation.set(0, roadYaw(s) + (side < 0 ? Math.PI : 0), 0);
      this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix();
      for (const mesh of this.roadsideSigns) mesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (const mesh of this.roadsideSigns) mesh.instanceMatrix.needsUpdate = true;
    for (const l of this.lamps) {
      let s = l.s;
      while (s < base - 80) s += 768;
      while (s > base + 688) s -= 768;
      l.s = s;
      const r = rightAt(s, this.tmpA);
      const off = l.side * (ROAD_HALF + 2.0);
      l.g.position.set(centerX(s) + r.x * off, centerY(s), -s + r.z * off);
      l.g.rotation.y = roadYaw(s);
    }
    const p = biomeParams(base);
    this.groundMat.color.set(p.ground).lerp(new THREE.Color(0xe8eef4), snow * 0.8);
    this.shoulderMat.color.set(p.shoulder).lerp(new THREE.Color(0xa7a39a), 0.58).lerp(new THREE.Color(0xe0e8ed), snow * 0.65);
    this.mountainMat.color.set(p.mountain).lerp(new THREE.Color(0xe8eef4), snow * 0.5);
    for (const m of this.mountains.children) {
      m.scale.y = p.mountainScale;
    }
    this.ground.position.set(centerX(base), centerY(base) - 4, -base);
    this.mountains.position.set(centerX(base), centerY(base), -base);
  }

  private buildGarage() {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x0c0e13, metalness: 0.6, roughness: 0.28 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.1; floor.receiveShadow = true;
    this.garageGroup.add(floor);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.0, 0.18, 64), new THREE.MeshStandardMaterial({ color: 0x171a21, metalness: 0.5, roughness: 0.3 }));
    platform.position.y = -0.09; platform.receiveShadow = true;
    this.garageGroup.add(platform);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.9, 0.03, 8, 96), new THREE.MeshStandardMaterial({ color: 0x37e0ff, emissive: 0x37e0ff, emissiveIntensity: 2 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    this.garageGroup.add(ring);

    // Soft studio key + rim lights for readable paint highlights.
    const key = new THREE.SpotLight(0xffffff, 55, 35, Math.PI / 4, 0.6, 1.6);
    key.position.set(6, 9, 5); key.target.position.set(0, 0.5, 0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    this.garageGroup.add(key, key.target);
    const rim = new THREE.SpotLight(0x88bbff, 35, 35, Math.PI / 4, 0.7, 1.6);
    rim.position.set(-7, 6, -6); rim.target.position.set(0, 0.5, 0);
    this.garageGroup.add(rim, rim.target);
    const warm = new THREE.SpotLight(0xffb070, 20, 30, Math.PI / 5, 0.8, 1.6);
    warm.position.set(0, 5, -8); warm.target.position.set(0, 0.5, 0);
    this.garageGroup.add(warm, warm.target);
  }

  private buildContactShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.contactShadow);
  }

  private setEnvironment(mode: 'garage' | 'road') {
    if (mode === 'garage') {
      this.scene.environment = this.studioEnv;
      this.atmosphere.setGarage();
      this.roadGroup.visible = false; this.garageGroup.visible = true; this.mountains.visible = false;
      this.contactShadow.visible = false;
      this.precipitation.setVisible(false);
      this.spray.clear();
      for (const h of this.headlights) h.intensity = 0;
    } else {
      this.scene.environment = this.roadEnv;
      this.roadGroup.visible = true; this.garageGroup.visible = false; this.mountains.visible = true;
      this.contactShadow.visible = true;
      this.precipitation.setVisible(true);
    }
  }

  // --- Cars -------------------------------------------------------------------
  setSelectedCar(id: CarId) {
    this.selected = id;
    if (this.player) { this.scene.remove(this.player); this.disposeCarLights(this.player); }
    this.player = this.library.create(id, { player: true });
    const meta = this.library.get(id);
    this.playerMeta = { length: meta.length, width: meta.width };
    this.playerBrakes = [];
    for (const sign of [-1, 1]) {
      const brake = this.makeBrakeGlow();
      brake.scale.set(0.22, 0.13, 1);
      brake.position.set(sign * meta.width * 0.31, meta.height * 0.59, meta.length * 0.5 + 0.03);
      this.player.add(brake); this.playerBrakes.push(brake);
    }
    this.player.position.set(0, 0, 0);
    this.player.rotation.set(0, 0, 0);
    this.scene.add(this.player);
  }

  setGarageWorkshop(open: boolean) {
    this.garageWorkshop = open;
    if (this.mode === 'garage') this.updateCamera(0);
  }

  setGarageView(view: 'front' | 'side' | 'rear') {
    if (this.mode !== 'garage') return;
    this.garageAuto = false;
    this.garageAngle = view === 'front' ? Math.PI : view === 'side' ? Math.PI / 2 : 0;
    this.garagePitch = 0.22;
    this.updateCamera(0);
  }

  start() {
    this.clearTraffic();
    this.signal = null; this.signalElapsed = 0;
    this.updatePlayerLights(0);
    this.setEnvironment('road');
    this.playerS = 0;
    this.run = createRun(this.runMode, (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    this.hazard = null;
    this.best = bestFor(this.records, this.runMode);
    this.vehicle = createVehicleState();
    this.vehicle.speed = 12; this.vehicle.offset = PLAYER_LANE;
    this.speed = 12; this.yaw = roadYaw(0); this.steer = 0; this.shake = 0;
    this.playerS = 0; this.offset = PLAYER_LANE;
    centerAt(0, this.pos);
    const r = rightAt(0, this.tmpA);
    this.pos.x += r.x * PLAYER_LANE; this.pos.z += r.z * PLAYER_LANE;
    this.sameTimer = 0.5; this.oncomingTimer = 0.8;
    if (this.player) { this.player.position.copy(this.pos); this.player.rotation.set(0, this.yaw, 0); }
    // Seed a busy two-way road: slower traffic ahead and a steady stream of
    // oncoming cars, spaced so there is always a visible overtaking window.
    this.spawnSame(55, 16); this.spawnSame(120, 19); this.spawnSame(195, 15); this.spawnSame(280, 21);
    this.spawnOncoming(230, 26); this.spawnOncoming(390, 29); this.spawnOncoming(550, 27);
    this.updateRoad();
    this.setMode('driving');
    this.emitHud();
  }

  pause() { if (this.mode === 'driving') this.setMode('paused'); }
  resume() { if (this.mode === 'paused') this.setMode('driving'); }

  toGarage() {
    this.clearTraffic();
    this.setEnvironment('garage');
    this.signal = null; this.input.brake = false; this.input.handbrake = false;
    this.updatePlayerLights(0);
    if (this.player) { this.player.position.set(0, 0, 0); this.player.rotation.set(0, 0, 0); const glow = this.player.getObjectByName('underglow-pool'); if (glow) glow.position.y = 0.035; }
    this.setMode('garage');
  }

  setInput(name: 'throttle' | 'brake' | 'left' | 'right' | 'handbrake', v: boolean) {
    this.input[name] = v;
  }

  toggleSignal(side: 'left' | 'right') {
    if (this.mode !== 'driving') return;
    this.signal = this.signal === side ? null : side;
    this.signalElapsed = 0;
    this.updatePlayerLights(0);
    this.emitHud();
  }

  private updatePlayerLights(dt: number) {
    this.signalElapsed += dt;
    const braking = this.input.brake || this.input.handbrake;
    for (const m of (this.player?.userData.brakeMaterials ?? []) as THREE.MeshStandardMaterial[]) m.emissiveIntensity = braking ? 2.8 : 0.55;
    // Fallback lamps for models without dedicated tail-light materials. Other
    // cars use their actual rear lenses, not a floating red billboard.
    const needsFallback = !(this.player?.userData.brakeMaterials?.length);
    for (const light of this.playerBrakes) (light.material as THREE.SpriteMaterial).opacity = braking && needsFallback ? 0.65 : 0;
    const lit = !!this.signal && (this.signalElapsed % 1.0) < 0.5;
    const state = this.player?.userData.indicatorState;
    if (state) {
      state.left.value = this.signal === 'left' ? (lit ? 1 : -1) : 0;
      state.right.value = this.signal === 'right' ? (lit ? 1 : -1) : 0;
    }
  }

  setRunMode(mode: RunMode) {
    if (this.mode !== 'garage' && this.mode !== 'gameover') return;
    this.runMode = mode;
    this.best = bestFor(this.records, mode);
    try { localStorage.setItem('overtake-mode', mode); } catch { /* ignore */ }
  }
  getRunMode() { return this.runMode; }
  getRecords() { return this.records; }

  private loadRecords() {
    try {
      const raw = localStorage.getItem('overtake-records-v2');
      this.records = raw ? sanitizeRecords(JSON.parse(raw)) : emptyRecords();
      const legacy = Number(localStorage.getItem('overtake-best') || 0) || 0;
      if (legacy > this.records.modes.endless.bestScore) this.records.modes.endless.bestScore = legacy;
      const savedMode = localStorage.getItem('overtake-mode');
      if (savedMode === 'rush' || savedMode === 'endless') this.runMode = savedMode;
    } catch { this.records = emptyRecords(); }
  }
  private saveRecords() {
    try {
      localStorage.setItem('overtake-records-v2', JSON.stringify(this.records));
      localStorage.setItem('overtake-best', String(this.records.modes.endless.bestScore));
    } catch { /* ignore */ }
  }

  private setMode(m: Mode) { this.mode = m; this.cb.onMode(m); }

  private disposeCarLights(group: THREE.Group) {
    for (const material of (group.userData.customPaintMaterials ?? []) as THREE.Material[]) material.dispose();
    const kit = group.getObjectByName('custom-body-kit');
    if (kit) disposeBodyKit(kit as THREE.Group);
    const owned = new Set<THREE.Material>([...(group.userData.brakeMaterials ?? []), ...(group.userData.indicatorMaterials ?? [])]);
    for (const m of owned) m.dispose();
    group.traverse(o => {
      const sprite = o as THREE.Sprite;
      if (sprite.isSprite) sprite.material.dispose();
    });
  }

  private clearTraffic() {
    for (const t of this.traffic) { this.scene.remove(t.group); this.disposeCarLights(t.group); }
    this.traffic = [];
  }

  private spawnSame(s: number, speed: number) {
    const ids = CARS.filter(c => c.id !== this.selected).map(c => c.id);
    const id: TrafficId = chooseTruck(this.score, this.traffic, s) ?? chooseTrafficModel(ids, this.traffic, s);
    const preferred = id === 'semi' || id === 'kraz' ? undefined : this.library.getPaint(id);
    const paint = chooseTrafficPaint(TRAFFIC_COLORS, this.traffic, s, preferred);
    const group = this.library.create(id, { paint });
    const meta = this.library.get(id);
    this.scene.add(group);
    const brakeGlow = this.makeBrakeGlow();
    brakeGlow.position.set(0, 0.62, meta.length / 2 + 0.05);
    group.add(brakeGlow);
    const cruise = trafficCruise(id);
    this.traffic.push({ group, id, paint, dir: 1, s, offset: PLAYER_LANE, speed: Math.min(speed, cruise), passed: false, length: meta.length, width: meta.width, ai: createTrafficAI(cruise), braking: false, brakeGlow });
  }

  private spawnOncoming(s: number, speed: number) {
    const ids = CARS.filter(c => c.id !== this.selected).map(c => c.id);
    const spec = getCar(chooseTrafficModel(ids, this.traffic, s));
    const paint = chooseTrafficPaint(TRAFFIC_COLORS, this.traffic, s, this.library.getPaint(spec.id));
    const group = this.library.create(spec.id, { paint });
    const meta = this.library.get(spec.id);
    this.scene.add(group);
    const cruise = trafficCruise(spec.id);
    this.traffic.push({ group, id: spec.id, paint, dir: -1, s, offset: ONCOMING_LANE, speed: speed === 0 ? 0 : cruise, passed: false, length: meta.length, width: meta.width, ai: createTrafficAI(cruise), braking: false });
  }

  private makeBrakeGlow() {
    if (!this.brakeTexture) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,60,60,0.95)');
      g.addColorStop(0.5, 'rgba(255,30,30,0.35)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      this.brakeTexture = new THREE.CanvasTexture(c);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.brakeTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  }

  private trySpawn(dt: number) {
    this.sameTimer -= dt; this.oncomingTimer -= dt;
    const same = this.traffic.filter((t) => t.dir === 1);
    const oncoming = this.traffic.filter((t) => t.dir === -1);
    const passing = same.some(t => t.ai.pass);
    if (this.sameTimer <= 0 && same.length < 12 && !passing) {
      for (let a = 0; a < 6; a++) {
        const s = this.playerS + 200 + Math.random() * 160;
        if (canSpawnSame(s, same)) { this.spawnSame(s, 14 + Math.random() * 10); break; }
      }
      this.sameTimer = sameSpawnInterval(this.speed) * (0.8 + Math.random() * 0.5);
    }
    // A passing car reserves the opposing lane. Short periodic gaps also let
    // a queue find a genuinely clear opportunity instead of never overtaking.
    const queuedForTruck = same.some(t => {
      const leader = findLeader(t, same);
      // Don't thin oncoming traffic unless a queue could use the opening
      // (player and return lane included in this check).
      return canOvertakeTruck(t, leader, same, { s: this.playerS, maxSpeed: getCar(this.selected).maxSpeed });
    });
    const holdingGap = queuedForTruck && (this.worldElapsed % 55 < 22);
    if (this.oncomingTimer <= 0 && oncoming.length < 16 && !passing && !holdingGap) {
      const s = findOncomingSpawn(this.playerS, oncoming, same);
      if (s !== null) this.spawnOncoming(s, 24 + Math.random() * 10);
      // Retry quickly when the window is temporarily full.
      this.oncomingTimer = s === null ? 0.25 : oncomingSpawnInterval(this.speed) * (0.75 + Math.random() * 0.5);
    }
  }

  private updateRoad() {
    this.updateRibbon(this.terrain, 0);
    this.updateRibbon(this.shoulder, 0);
    this.updateRibbon(this.asphalt, 0);
    this.updateSnowLayer();
    this.updateRibbon(this.edgeL, 0, undefined, -(ROAD_HALF - 0.25));
    this.updateRibbon(this.edgeR, 0, undefined, ROAD_HALF - 0.25);
    this.updateGuardrail(this.railL);
    this.updateGuardrail(this.railR);
    this.updateRibbon(this.railCaps[0], 0, undefined, -(ROAD_HALF + 0.51));
    this.updateRibbon(this.railCaps[1], 0, undefined, ROAD_HALF + 0.51);
    this.updateCenterLine();
    this.updatePosts();
    this.updateScenery();
  }

  private emitHud() {
    let oncoming: number | null = null;
    if (this.offset < 0.6) {
      for (const t of this.traffic) {
        if (t.dir === -1 && t.s > this.playerS) {
          const d = t.s - this.playerS;
          if (oncoming === null || d < oncoming) oncoming = d;
        }
      }
    }
    const prog = contractProgress(this.run);
    this.cb.onHud({
      score: this.score, speed: this.speed * 3.6, distance: this.distance,
      combo: this.combo, mult: multiplierFor(this.combo), best: this.best,
      overtakes: this.overtakes, oncoming, offroad: Math.abs(this.offset) > ROAD_HALF - 0.4,
      throttle: this.input.throttle ? 1 : 0,
      brake: this.input.brake || this.input.handbrake ? 1 : 0,
      time: formatHour(this.worldClock.hour),
      weather: weatherLabel(this.weather),
      biome: biomeParams(this.playerS).label,
      night: this.nightFactor > 0.5,
      runMode: this.run.mode,
      runLabel: RUN_MODES[this.run.mode].label,
      timeLeft: this.run.timeLeft,
      elapsed: this.run.elapsed,
      contract: prog.contract ? {
        title: prog.contract.title, desc: prog.contract.desc, value: prog.value, target: prog.target,
        ratio: prog.ratio, index: this.run.contractIndex + 1, total: this.run.contracts.length, reward: prog.contract.reward,
      } : null,
      contractsDone: this.run.contractsDone,
      signal: this.signal,
      signalLit: !!this.signal && (this.signalElapsed % 1.0) < 0.5,
      hazard: this.hazard,
    });
  }

  private handleRunEvents(events: RunEvent[]) {
    for (const e of events) {
      if (e.type === 'contract' && e.contract) {
        this.cb.onEvent({ kind: 'contract', text: `CONTRACT · ${e.contract.title.toUpperCase()}`, points: e.points });
      } else if (e.type === 'allContracts') {
        this.cb.onEvent({ kind: 'contract', text: 'ALL CONTRACTS COMPLETE' });
      } else if (e.type === 'combo') {
        this.cb.onEvent({ kind: 'combo', text: `COMBO ×${e.mult}` });
      } else if (e.type === 'finish') {
        this.endRun('time');
      }
    }
  }

  private updateDriving(dt: number) {
    this.updatePlayerLights(dt);
    const spec = getCar(this.selected);
    const grip = spec.physics.grip * weatherGrip(this.weather);
    const params = {
      ...spec.physics, accel: spec.accel, maxSpeed: spec.maxSpeed, grip, surfaceGrip: weatherGrip(this.weather),
    };
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      stepVehicle(this.vehicle, this.input, params, h, roadCurvature(this.vehicle.s));
    }
    this.speed = this.vehicle.speed;
    this.steer = this.vehicle.steer;
    this.playerS = this.vehicle.s;
    this.offset = this.vehicle.offset;
    this.yaw = roadYaw(this.playerS) + this.vehicle.heading;

    // World position from road coordinates.
    centerAt(this.playerS, this.pos);
    const r = rightAt(this.playerS, this.tmpA);
    this.pos.x += r.x * this.offset;
    this.pos.z += r.z * this.offset;
    this.pos.y = centerY(this.playerS);

    // Barrier / off-road
    if (hitsRoadBarrier(this.offset, this.playerMeta.width, this.playerMeta.length, this.vehicle.heading)) { this.crash('You hit the barrier'); return; }
    if (Math.abs(this.offset) > ROAD_HALF - 0.2) {
      this.speed = Math.max(0, this.speed - 6 * dt);
      this.vehicle.speed = this.speed;
      this.shake = Math.max(this.shake, 0.15);
    }

    if (this.player) {
      this.player.position.copy(this.pos);
      // Keep the body level under throttle/brake; only a small cornering roll.
      const roll = THREE.MathUtils.clamp(-this.vehicle.latAccel / 9.81 * 0.09, -0.12, 0.12);
      this.player.rotation.set(0, this.yaw, roll);
      this.contactShadow.position.set(this.pos.x, this.pos.y + 0.03, this.pos.z);
      this.contactShadow.rotation.z = -this.yaw;
      this.contactShadow.scale.set(this.playerMeta.width * 1.7, this.playerMeta.length * 1.5, 1);
    }
    this.trySpawn(dt);

    // Only one overtake can reserve the opposing lane at a time. Decide using
    // the complete current traffic snapshot before moving any vehicle.
    for (const t of this.traffic) {
      if (t.dir !== 1 || t.ai.pass) continue;
      const leader = findLeader(t, this.traffic);
      if (canOvertakeTruck(t, leader, this.traffic, { s: this.playerS, maxSpeed: spec.maxSpeed })) {
        startOvertake(t, leader!);
        break;
      }
    }
    const pHalfL = this.playerMeta.length / 2;
    const trafficGrip = weatherGrip(this.weather);
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      if (t.dir === 1) {
        const passing = !!t.ai.pass;
        if (passing) stepOvertake(t, dt, PLAYER_LANE, ONCOMING_LANE);
        // Continue following the truck until the car has actually moved clear.
        const leader = findLeader(t, this.traffic);
        stepTraffic(t, leader, dt, trafficGrip);
        if (leader && leader.s > t.s) {
          const minGap = (t.length + leader.length) * 0.5 + 2;
          const available = leader.s - t.s - minGap;
          t.speed = Math.min(t.speed, Math.max(0, available / Math.max(dt, 0.0001)));
        }
      }
      t.s += t.dir * t.speed * dt;
      const r = rightAt(t.s, this.tmpA);
      const px = centerX(t.s) + r.x * t.offset, pz = -t.s + r.z * t.offset;
      t.group.position.set(px, centerY(t.s), pz);
      t.group.rotation.y = roadYaw(t.s) + (t.dir === -1 ? Math.PI : 0);
      if (t.brakeGlow) (t.brakeGlow.material as THREE.SpriteMaterial).opacity = t.braking && !t.group.userData.brakeMaterials?.length ? 0.9 : 0;
      for (const m of (t.group.userData.brakeMaterials ?? []) as THREE.MeshStandardMaterial[]) m.emissiveIntensity = t.braking ? 2.8 : 0.55;

      const ds = t.s - this.playerS;
      const dOff = t.offset - this.offset;
      if (vehiclesOverlap(ds, dOff, this.playerMeta.length, this.playerMeta.width, t.length, t.width)) {
        this.crash(t.dir === -1 ? 'Head-on collision' : 'You rear-ended traffic');
        return;
      }
      if (t.dir === 1 && !t.passed && ds < -(pHalfL + t.length / 2 + 1)) {
        t.passed = true;
        const near = Math.abs(dOff) < 2.6;
        const { points, events } = registerPass(this.run, 'same', near, spec.bonus);
        // Cancel at the same clearance threshold that awards a completed pass.
        // Oncoming dodges are not overtakes and must not cancel a signal.
        if (this.signal) {
          this.signal = null;
          this.signalElapsed = 0;
          this.updatePlayerLights(0);
        }
        this.cb.onEvent({ kind: near ? 'near' : 'overtake', text: near ? 'NEAR MISS' : 'OVERTAKE', points });
        this.handleRunEvents(events);
      }
      if (t.dir === -1 && !t.passed && ds < -(pHalfL + t.length / 2 + 1)) {
        t.passed = true;
        const near = Math.abs(dOff) < 3.4;
        if (near) {
          const { points, events } = registerPass(this.run, 'oncoming', true, spec.bonus);
          this.cb.onEvent({ kind: 'oncoming', text: 'HEAD-ON DODGE', points });
          this.handleRunEvents(events);
        }
      }
      if ((t.dir === 1 && t.s < this.playerS - 70) || (t.dir === -1 && t.s < this.playerS - 90)) {
        this.scene.remove(t.group);
        this.disposeCarLights(t.group);
        this.traffic.splice(i, 1);
      }
    }

    if (blockedTrafficGap({ s: this.playerS, offset: this.offset, length: this.playerMeta.length, width: this.playerMeta.width }, this.traffic)) {
      this.crash('Not enough room between cars');
      return;
    }
    this.hazard = hazardAhead({ s: this.playerS, offset: this.offset, speed: this.speed, width: this.playerMeta.width, length: this.playerMeta.length }, this.traffic);

    const events = tickRun(this.run, dt, this.speed);
    this.handleRunEvents(events);
    if (this.run.finished) return;

    this.updateRoad();
    this.updateCamera(dt);
    this.updateWorld(dt);
    this.emitHud();
  }

  private crash(reason: string) {
    this.shake = 1;
    finishRun(this.run, 'crash');
    this.cb.onEvent({ kind: 'crash', text: reason.toUpperCase() });
    this.endRun('crash');
  }

  private endRun(reason: string) {
    if (this.mode === 'gameover') return;
    finishRun(this.run, reason);
    this.setMode('gameover');
    const summary = runSummary(this.run, this.selected);
    const result = recordRun(this.records, summary);
    this.records = result.records;
    this.saveRecords();
    this.best = bestFor(this.records, this.runMode);
    if (reason === 'time') this.cb.onEvent({ kind: 'finish', text: 'RUSH COMPLETE' });
    this.cb.onGameOver({
      score: this.score, distance: this.distance, overtakes: this.overtakes, nearMisses: this.nearMisses,
      best: this.best, newBest: result.newBest, mode: this.run.mode, car: this.selected,
      topSpeed: this.run.topSpeed, contractsDone: this.run.contractsDone, elapsed: this.run.elapsed,
      medal: result.medal, reason,
    });
  }

  private updateWorld(dt: number) {
    this.worldElapsed += dt;
    stepClock(this.worldClock, dt);
    const biome = biomeParams(this.playerS);
    stepWeather(this.weather, dt, biome.temperature);
    const atm = this.atmosphere.update(this.worldClock.hour, this.weather, biome, this.camera.position, dt);
    this.nightFactor = atm.night;
    this.precipitation.update(dt, this.camera.position, this.speed, this.weather, this.worldElapsed);
    this.spray.update(dt, this.pos, this.yaw, this.playerMeta.width, this.playerMeta.length, this.speed,
      this.weather.wet, this.weather.snowCover, snowDriftHeight(this.offset, this.playerS, this.weather.snowCover, ROAD_HALF));

    // Wet asphalt / snow cover.
    const wet = this.weather.wet;
    const snow = this.weather.snowCover;
    const glow = this.player?.getObjectByName('underglow-pool');
    if (glow) glow.position.y = 0.075 + snow * 0.11; // follow the raised snow surface
    this.roadSurface.wet.value = wet;
    this.roadSurface.snow.value = snow;
    this.roadSurface.rain.value = this.weather.rain;
    this.roadSurface.time.value = this.worldElapsed;
    this.asphaltMat.roughness = 0.94 - wet * 0.37;
    this.asphaltMat.metalness = 0.02 + wet * 0.04;
    this.asphaltMat.color.set(0xb2b5ba);
    this.lampMat.emissiveIntensity = 0.25 + atm.night * 2.4 + atm.cloud * 0.8;

    // Player headlights follow the car and fade in at night / in precipitation.
    const beam = Math.max(atm.night, atm.cloud * 0.65);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.headlights.forEach((h, i) => {
      const side = h.userData.side as number;
      h.intensity = beam * 85;
      h.position.set(this.pos.x + fx * 2.1 + rx * side, this.pos.y + 0.62, this.pos.z + fz * 2.1 + rz * side);
      this.headlightTargets[i].position.set(this.pos.x + fx * 24 + rx * side * 1.5, this.pos.y + 0.2, this.pos.z + fz * 24 + rz * side * 1.5);
    });
  }

  private updateCamera(dt: number) {
    if (this.mode === 'garage') {
      if (this.garageAuto && !this.garageDragging) this.garageAngle += dt * 0.05;
      const compactWorkshop = this.garageWorkshop && window.innerWidth <= 700;
      const r = compactWorkshop ? Math.max(this.garageZoom, 10.5) : this.garageZoom;
      const y = 0.7 + Math.sin(this.garagePitch) * r;
      const horiz = Math.cos(this.garagePitch) * r;
      this.camera.position.set(Math.sin(this.garageAngle) * horiz, y, Math.cos(this.garageAngle) * horiz);
      this.camera.lookAt(0, 0.65, 0);
      this.camera.fov = compactWorkshop ? 50 : 42;
      if (compactWorkshop) this.camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * 0.2, window.innerWidth, window.innerHeight);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.atmosphere.sky.position.copy(this.camera.position);
      return;
    }
    if (this.camera.view?.enabled) this.camera.clearViewOffset();
    // Fixed camera: rigidly attached to the car. No speed-based FOV, no lag,
    // no acceleration drift or shake. Only the user's camera settings move it.
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.shake = 0;
    const { preset, distance, height, lookAhead } = this.cam;
    if (preset === 'hood' || preset === 'bumper') {
      this.camera.position.set(this.pos.x + fx * distance, this.pos.y + height, this.pos.z + fz * distance);
      this.camera.lookAt(this.pos.x + fx * lookAhead, this.pos.y + (preset === 'bumper' ? 0.5 : 0.9), this.pos.z + fz * lookAhead);
    } else {
      this.camera.position.set(this.pos.x - fx * distance, this.pos.y + height, this.pos.z - fz * distance);
      this.camera.lookAt(this.pos.x + fx * lookAhead, this.pos.y + 0.9, this.pos.z + fz * lookAhead);
    }
    this.camera.fov = this.cam.fov;
    this.camera.updateProjectionMatrix();
    this.atmosphere.sky.position.copy(this.camera.position);
  }

  // A few imported cars have incomplete interiors that expose a rear lens
  // through the windshield. A rear-only indicator must not flash from ahead.
  private updateIndicatorView() {
    const state = this.player?.userData.indicatorState;
    if (!state || !this.player) return;
    this.player.updateWorldMatrix(true, false);
    this.tmpC.copy(this.camera.position);
    this.player.worldToLocal(this.tmpC);
    state.viewZ.value = this.tmpC.z;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === 'driving') {
      this.updateDriving(dt);
    } else {
      this.updateCamera(dt);
    }
    this.updateIndicatorView();
    updateExhaustFlames(this.player, performance.now()/1000, this.mode === 'garage' || (this.mode === 'driving' && this.input.throttle && !this.input.brake && this.speed > 6));
    this.composer.render();
  };

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  getWorldSettings() {
    return {
      hour: this.worldClock.hour,
      time: formatHour(this.worldClock.hour),
      speed: this.worldClock.speed,
      running: this.worldClock.running,
      weatherMode: this.weather.mode,
      weather: weatherLabel(this.weather),
      biome: biomeParams(this.playerS).label,
      rain: this.weather.rain,
      snow: this.weather.snow,
    };
  }
  setWeatherMode(mode: 'auto' | 'clear' | 'rain' | 'snow') { this.weather.mode = mode; this.weather.timer = 0; }
  setTimeOfDay(hour: number) {
    this.worldClock.hour = ((hour % 24) + 24) % 24;
    this.atmosphere.update(this.worldClock.hour, this.weather, biomeParams(this.playerS), this.camera.position, 5);
  }
  setCycleSpeed(speed: number) { this.worldClock.speed = Math.max(0, Math.min(8, speed)); }
  setCycleRunning(running: boolean) { this.worldClock.running = running; }

  getBest() { return this.best; }
  dispose() { cancelAnimationFrame(this.raf); this.spray.dispose(); this.renderer.dispose(); }
}
