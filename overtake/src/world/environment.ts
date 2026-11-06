import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { dayFactor, sunAngle } from './clock.mjs';

// Open-source, physically based image lighting for the road and the studio.
//
// The HDRIs are CC0 Poly Haven environments distributed with the three.js
// examples. They are loaded with three's HDRLoader and prefiltered with
// PMREMGenerator, then swapped by time of day and biome. The canvas gradients
// below remain as offline/offline-CDN fallbacks so a missing HDRI can never
// leave the PBR materials unlit.
type EnvKey = 'studio' | 'day' | 'arid' | 'dusk' | 'aridDusk' | 'night';
type EnvMode = 'garage' | 'road';

const HDR_FILES: Record<Exclude<EnvKey, 'dusk' | 'aridDusk'>, string> = {
  studio: 'studio.hdr',
  day: 'day.hdr',
  arid: 'arid.hdr',
  night: 'night.hdr',
};

interface WeatherLike { rain: number; snow: number }

export interface EnvironmentStatus {
  loaded: boolean;
  active: EnvKey;
  available: EnvKey[];
  intensity: number;
  rotation: number;
  hdr: boolean;
}

export class EnvironmentRig {
  readonly ready: Promise<void>;
  private maps = new Map<EnvKey, THREE.Texture>();
  private fallbacks = new Set<THREE.Texture>();
  private loader = new HDRLoader();
  private pmrem: THREE.PMREMGenerator;
  private mode: EnvMode = 'garage';
  private active: EnvKey = 'studio';
  private loaded = false;
  private intensity = 0.5;
  private rotation = 0.35;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene) {
    // Half-float RGBE decoding is roughly half the memory of float RGBE and is
    // enough headroom for prefiltered car-paint reflections at 512×256.
    this.loader.setDataType(THREE.HalfFloatType);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.maps.set('studio', this.makeCanvasEnv('studio'));
    this.maps.set('day', this.makeCanvasEnv('road'));
    this.maps.set('arid', this.makeCanvasEnv('road'));
    this.maps.set('dusk', this.makeCanvasEnv('dusk'));
    this.maps.set('aridDusk', this.makeCanvasEnv('dusk'));
    this.maps.set('night', this.makeCanvasEnv('night'));
    this.apply();
    this.ready = this.load();
  }

  /** Compact procedural gradients used only when an HDRI cannot be fetched. */
  private makeCanvasEnv(kind: 'studio' | 'road' | 'dusk' | 'night'): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    if (kind === 'studio') {
      ctx.fillStyle = '#11151d'; ctx.fillRect(0, 0, 512, 256);
      const strip = (y: number, h: number, a: number) => {
        const g = ctx.createLinearGradient(0, y - h, 0, y + h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(.5, `rgba(235,244,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y - h, 512, h * 2);
      };
      strip(62, 22, .9); strip(112, 12, .45); strip(170, 28, .22);
      const glow = ctx.createRadialGradient(360, 72, 2, 360, 72, 58);
      glow.addColorStop(0, 'rgba(255,250,238,.75)');
      glow.addColorStop(1, 'rgba(255,250,238,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 256);
    } else if (kind === 'night') {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#050914'); g.addColorStop(.48, '#182338');
      g.addColorStop(.52, '#10151d'); g.addColorStop(1, '#05070a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = 'rgba(255,206,130,.75)';
      for (let x = 12; x < 512; x += 47) ctx.fillRect(x, 123, 7, 2);
    } else {
      const dusk = kind === 'dusk';
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, dusk ? '#2a3354' : '#314c6c');
      g.addColorStop(.43, dusk ? '#bd765e' : '#9bacbc');
      g.addColorStop(.5, dusk ? '#e1a06e' : '#c6c9c6');
      g.addColorStop(.56, dusk ? '#5b4450' : '#777d80');
      g.addColorStop(1, dusk ? '#181622' : '#2c2c2c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
      const sun = ctx.createRadialGradient(dusk ? 390 : 350, dusk ? 120 : 112, 3, dusk ? 390 : 350, dusk ? 120 : 112, 70);
      sun.addColorStop(0, dusk ? 'rgba(255,190,130,.9)' : 'rgba(255,250,238,.8)');
      sun.addColorStop(.22, dusk ? 'rgba(255,160,110,.35)' : 'rgba(231,231,218,.4)');
      sun.addColorStop(1, 'rgba(210,219,225,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, 512, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const env = this.pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    this.fallbacks.add(env);
    return env;
  }

  /** A linear radiance blend of two half-float HDRIs, used for dawn/dusk. */
  private blendEquirect(a: THREE.Texture, b: THREE.Texture, t: number): THREE.Texture | null {
    const ai = a.image as { width: number; height: number; data?: Float32Array | Uint16Array };
    const bi = b.image as { width: number; height: number; data?: Float32Array | Uint16Array };
    if (!ai?.data || !bi?.data || ai.width !== bi.width || ai.height !== bi.height || ai.data.length !== bi.data.length) return null;
    const isFloat = ai.data instanceof Float32Array && bi.data instanceof Float32Array;
    const data = isFloat ? new Float32Array(ai.data.length) : new Uint16Array(ai.data.length);
    const read = (value: number) => isFloat ? value : THREE.DataUtils.fromHalfFloat(value);
    const write = (value: number) => isFloat ? value : THREE.DataUtils.toHalfFloat(value);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = write(read(ai.data[i]) * (1 - t) + read(bi.data[i]) * t);
      data[i + 1] = write(read(ai.data[i + 1]) * (1 - t) + read(bi.data[i + 1]) * t);
      data[i + 2] = write(read(ai.data[i + 2]) * (1 - t) + read(bi.data[i + 2]) * t);
      data[i + 3] = write(1);
    }
    const tex = new THREE.DataTexture(data, ai.width, ai.height, THREE.RGBAFormat,
      isFloat ? THREE.FloatType : THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  }

  private prefilter(tex: THREE.Texture): THREE.Texture {
    const env = this.pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    return env;
  }

  private async load(): Promise<void> {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const entries = Object.entries(HDR_FILES) as [Exclude<EnvKey, 'dusk' | 'aridDusk'>, string][];
    const textures = new Map<Exclude<EnvKey, 'dusk' | 'aridDusk'>, THREE.Texture>();
    try {
      const results = await Promise.allSettled(entries.map(async ([key, file]) => {
        const tex = await this.loader.loadAsync(`${base}env/${file}`);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        tex.needsUpdate = true;
        return [key, tex] as const;
      }));
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') textures.set(result.value[0], result.value[1]);
        else console.warn(`HDR environment ${entries[i][1]} unavailable; using procedural fallback`, result.reason);
      });
      for (const [key, tex] of textures) {
        const old = this.maps.get(key);
        this.maps.set(key, this.prefilter(tex));
        if (old && this.fallbacks.has(old)) { old.dispose(); this.fallbacks.delete(old); }
      }
      const day = textures.get('day'), night = textures.get('night');
      if (day && night) {
        const dusk = this.blendEquirect(day, night, .62);
        if (dusk) {
          const env = this.prefilter(dusk);
          // Share one blended twilight PMREM between green and arid biomes to
          // avoid a second GPU prefilter during startup.
          for (const key of ['dusk', 'aridDusk'] as const) {
            const old = this.maps.get(key);
            this.maps.set(key, env);
            if (old && this.fallbacks.has(old)) { old.dispose(); this.fallbacks.delete(old); }
          }
        }
      }
    } catch (error) {
      // A GPU/driver failure must not strand the player on the loading screen.
      console.warn('HDR lighting could not be initialized; using procedural IBL', error);
    } finally {
      this.pmrem.dispose();
      this.loaded = true;
      this.apply();
    }
  }

  private apply() {
    const env = this.maps.get(this.active);
    if (env) this.scene.environment = env;
    this.scene.environmentIntensity = this.intensity;
    this.scene.environmentRotation.set(0, this.rotation, 0);
  }

  setGarage() {
    this.mode = 'garage';
    this.active = 'studio';
    // A real studio HDRI carries far more radiance than the old canvas strips;
    // keep it below unity so softboxes still shape the paint.
    this.intensity = 0.5;
    this.rotation = 0.35;
    this.apply();
  }

  setRoad() {
    this.mode = 'road';
    this.apply();
  }

  /** Called after Atmosphere.update so its intensity is not overwritten. */
  update(hour: number, weather: WeatherLike, biomeId: string, dt: number) {
    if (this.mode !== 'road') return;
    const day = dayFactor(hour);
    const cloud = Math.min(1, weather.rain * .85 + weather.snow * .75);
    const arid = biomeId === 'desert' || biomeId === 'urban';
    let key: EnvKey;
    if (day < .14) key = 'night';
    else if (day < .48) key = arid ? 'aridDusk' : 'dusk';
    else key = arid ? 'arid' : 'day';
    if (key !== this.active) { this.active = key; this.apply(); }

    // HDRIs are much brighter than the old canvas gradients. Keep a cool, low
    // ambient contribution at night and dim it further under heavy cloud.
    const target = (0.13 + 0.52 * day * (1 - cloud * .55)) * (key === 'night' ? .7 : 1);
    this.intensity += (target - this.intensity) * (1 - Math.exp(-Math.max(0, dt) * 3.5));
    const targetRotation = sunAngle(hour) * .42 + (arid ? .55 : .18);
    let delta = (targetRotation - this.rotation) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.rotation += delta * (1 - Math.exp(-Math.max(0, dt) * 1.5));
    this.scene.environmentIntensity = this.intensity;
    this.scene.environmentRotation.set(0, this.rotation, 0);
  }

  getStatus(): EnvironmentStatus {
    return {
      loaded: this.loaded,
      active: this.active,
      available: [...this.maps.keys()],
      intensity: this.scene.environmentIntensity,
      rotation: this.scene.environmentRotation.y,
      hdr: this.loaded && this.maps.get('studio') !== undefined && !this.fallbacks.has(this.maps.get('studio')!),
    };
  }

  whenReady() { return this.ready; }

  dispose() {
    for (const texture of new Set(this.maps.values())) texture.dispose();
    this.maps.clear();
    this.fallbacks.clear();
  }
}
