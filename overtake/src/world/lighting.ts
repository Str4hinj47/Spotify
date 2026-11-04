import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { Atmosphere } from './atmosphere';

// Open-source studio IBL: three.js RoomEnvironment (MIT), itself based on
// Google's model-viewer EnvironmentScene. PMREM-prefiltering gives car paint a
// real softbox reflection instead of the old flat canvas gradient.
let areaLightsReady = false;
export function initRectAreaLights() {
  if (areaLightsReady) return;
  RectAreaLightUniformsLib.init();
  areaLightsReady = true;
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.dispose();
    }
  });
  pmrem.dispose();
  return target;
}

interface WeatherLike { rain: number; snow: number }

// HDR sky environment for the road. We sample the same sky colours/sun as the
// visible atmosphere into a small float equirect texture, then prefilter it with
// three's PMREMGenerator. Updating only when the hour/weather bucket changes
// keeps reflections smooth without a per-frame PMREM cost.
export class RoadEnvironment {
  private pmrem: THREE.PMREMGenerator;
  private target: THREE.WebGLRenderTarget | null = null;
  private tex!: THREE.Texture;
  private dataTex: THREE.DataTexture;
  private data = new Uint16Array(128 * 64 * 4);
  private lastKey = '';
  private timer = 1;
  private ground = new THREE.Color();

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.dataTex = new THREE.DataTexture(this.data, 128, 64, THREE.RGBAFormat, THREE.HalfFloatType);
    this.dataTex.mapping = THREE.EquirectangularReflectionMapping;
    this.dataTex.colorSpace = THREE.LinearSRGBColorSpace;
    this.dataTex.minFilter = THREE.LinearFilter;
    this.dataTex.magFilter = THREE.LinearFilter;
    this.generate(
      new THREE.Color(0x3a7bd5), new THREE.Color(0xcfe8f5),
      new THREE.Vector3(0.5, 0.75, -0.35).normalize(), new THREE.Color(0xfff2d0), 1, 0x33402f,
    );
  }

  get texture(): THREE.Texture { return this.tex; }

  update(hour: number, atmosphere: Atmosphere, weather: WeatherLike, ground: number, dt: number) {
    const cloud = Math.min(1, weather.rain * 0.85 + weather.snow * 0.75);
    const key = `${Math.round(hour * 20)}:${Math.round(cloud * 10)}:${ground}`;
    this.timer += dt;
    if (key === this.lastKey || this.timer < 0.5) return;
    this.timer = 0;
    this.lastKey = key;
    const u = atmosphere.skyMat.uniforms;
    this.generate(
      u.topColor.value as THREE.Color,
      u.horizonColor.value as THREE.Color,
      u.sunDir.value as THREE.Vector3,
      u.sunColor.value as THREE.Color,
      u.sunIntensity.value as number,
      ground,
    );
  }

  private generate(top: THREE.Color, horizon: THREE.Color, sunDir: THREE.Vector3, sunColor: THREE.Color, sunIntensity: number, ground: number) {
    const W = 128, H = 64;
    const d = this.data;
    this.ground.set(ground);
    const gr = this.ground.r * 0.35, gg = this.ground.g * 0.35, gb = this.ground.b * 0.35;
    const sx = sunDir.x, sy = sunDir.y, sz = sunDir.z;
    let idx = 0;
    for (let j = 0; j < H; j++) {
      const v = j / (H - 1);
      const phi = (v - 0.5) * Math.PI;
      const y = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const h = Math.max(y, 0);
      const t = Math.pow(h, 0.55);
      const below = y < 0 ? Math.min(1, -y / 0.25) : 0;
      const b = below * below * (3 - 2 * below);
      for (let i = 0; i < W; i++) {
        const theta = (i / (W - 1) - 0.5) * Math.PI * 2;
        const x = Math.cos(theta) * cosPhi;
        const z = Math.sin(theta) * cosPhi;
        let r = horizon.r + (top.r - horizon.r) * t;
        let g = horizon.g + (top.g - horizon.g) * t;
        let bl = horizon.b + (top.b - horizon.b) * t;
        const s = Math.max(x * sx + y * sy + z * sz, 0);
        const glow = (Math.pow(s, 420) * 30 + Math.pow(s, 18) * 0.4) * sunIntensity;
        r += sunColor.r * glow; g += sunColor.g * glow; bl += sunColor.b * glow;
        d[idx++] = THREE.DataUtils.toHalfFloat(r * (1 - b) + gr * b);
        d[idx++] = THREE.DataUtils.toHalfFloat(g * (1 - b) + gg * b);
        d[idx++] = THREE.DataUtils.toHalfFloat(bl * (1 - b) + gb * b);
        d[idx++] = THREE.DataUtils.toHalfFloat(1);
      }
    }
    this.dataTex.needsUpdate = true;
    const next = this.pmrem.fromEquirectangular(this.dataTex);
    this.target?.dispose();
    this.target = next;
    this.tex = next.texture;
  }

  dispose() {
    this.target?.dispose();
    this.dataTex.dispose();
    this.pmrem.dispose();
  }
}
