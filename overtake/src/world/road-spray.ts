import * as THREE from 'three';

// World-space tire spray: a low, turbulent powder plume and occasional heavier
// snow grains, with a separate finer mist on wet roads. Both tires share one
// bounded draw call; particles remain behind when the car turns or moves on.
export class RoadSpray {
  readonly points: THREE.Points;
  private readonly count = 384;
  private positions = new Float32Array(this.count * 3);
  private colors = new Float32Array(this.count * 3);
  private sizes = new Float32Array(this.count);
  private opacity = new Float32Array(this.count);
  // 0: water mist, 1: powder, 2: individual grains.
  private kinds = new Float32Array(this.count);
  private seeds = new Float32Array(this.count);
  private velocities = new Float32Array(this.count * 3);
  private ages = new Float32Array(this.count).fill(-1);
  private lives = new Float32Array(this.count);
  private strengths = new Float32Array(this.count);
  private initialSizes = new Float32Array(this.count);
  private ground = new Float32Array(this.count);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.PointsMaterial;
  private cursor = 0;
  private carry = 0;

  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('spraySize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('sprayAlpha', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('sprayKind', new THREE.BufferAttribute(this.kinds, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('spraySeed', new THREE.BufferAttribute(this.seeds, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.PointsMaterial({ color: 0xffffff, size: 1, vertexColors: true,
      transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true });
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float spraySize; attribute float sprayAlpha; attribute float sprayKind; attribute float spraySeed; varying float vSprayAlpha; varying float vSprayKind; varying float vSpraySeed;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * spraySize; vSprayAlpha = sprayAlpha; vSprayKind = sprayKind; vSpraySeed = spraySeed;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying float vSprayAlpha; varying float vSprayKind; varying float vSpraySeed;
        float sprayHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
        float sprayNoise(vec2 p) {
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(sprayHash(i),sprayHash(i+vec2(1.,0.)),f.x),
                     mix(sprayHash(i+vec2(0.,1.)),sprayHash(i+vec2(1.,1.)),f.x),f.y);
        }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 uv = gl_PointCoord - vec2(0.5);
          float a = vSpraySeed * 6.283185;
          uv = mat2(cos(a),-sin(a),sin(a),cos(a)) * uv;
          float d = length(uv * vec2(1.0, 1.12)) * 2.0;
          float shape;
          if (vSprayKind > 1.5) {
            // A small, crisp speck rather than another soft fog circle.
            shape = 1.0 - smoothstep(0.38, 0.94, d);
          } else {
            // Broken, translucent clumps prevent the repeating round-smoke look.
            float n = sprayNoise(uv * 6.0 + vec2(vSpraySeed * 19.0));
            float edge = 1.0 - smoothstep(0.25, 1.0, d);
            shape = edge * edge * mix(0.5, 1.25, n);
          }
          diffuseColor.a *= shape * vSprayAlpha;`);
    };
    this.material.customProgramCacheKey = () => 'road-tire-spray-v2';
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'tire-spray';
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  update(dt: number, position: THREE.Vector3, yaw: number, width: number, length: number,
         speed: number, wet: number, snow: number, snowHeight: number) {
    dt = Math.max(0, Math.min(0.05, dt));
    const wetness = THREE.MathUtils.clamp(wet, 0, 1);
    const powder = THREE.MathUtils.clamp(snow, 0, 1);
    const moisture = Math.max(wetness, powder);
    const movement = THREE.MathUtils.smoothstep(speed, 4, 22);
    const amount = moisture * movement;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    this.carry += dt * amount * THREE.MathUtils.lerp(90, 190, powder);
    while (this.carry >= 1) {
      this.carry--;
      const i = this.cursor++ % this.count, p = i * 3;
      const isSnow = Math.random() < powder / Math.max(moisture, 0.001);
      const grain = isSnow && Math.random() < 0.28;
      const kind = grain ? 2 : isSnow ? 1 : 0;
      const side = (this.cursor % 2 ? -1 : 1) * width * 0.36;
      const jitter = (Math.random() - 0.5) * width * 0.15;
      const back = length * (0.32 + Math.random() * 0.10);
      this.positions[p] = position.x - fx * back + rx * (side + jitter);
      this.ground[i] = position.y + snowHeight + 0.015;
      this.positions[p + 1] = this.ground[i] + 0.05 + Math.random() * 0.09;
      this.positions[p + 2] = position.z - fz * back + rz * (side + jitter);
      // The rotating tire throws particles rearward relative to the vehicle;
      // they keep some forward momentum but are left behind in world space.
      const drift = speed * (isSnow ? 0.25 + Math.random() * 0.30 : 0.70 + Math.random() * 0.12);
      const sideways = (side < 0 ? -1 : 1) * (isSnow ? 0.30 + Math.random() * 0.8 : 0.25 + Math.random() * 0.35);
      this.velocities[p] = fx * drift + rx * sideways;
      this.velocities[p + 1] = grain ? 0.8 + Math.random() * 1.5 : isSnow ? 0.18 + Math.random() * 0.5 : 0.22 + Math.random() * 0.35;
      this.velocities[p + 2] = fz * drift + rz * sideways;
      this.ages[i] = 0;
      this.lives[i] = grain ? 0.45 + Math.random() * 0.40 : isSnow ? 0.60 + Math.random() * 0.65 : 0.65 + Math.random() * 0.45;
      this.strengths[i] = amount;
      this.kinds[i] = kind;
      this.seeds[i] = Math.random();
      this.initialSizes[i] = grain ? 0.025 + Math.random() * 0.045 : isSnow ? 0.16 + Math.random() * 0.22 : 0.28 + Math.random() * 0.16;
      const shade = 0.87 + Math.random() * 0.10;
      this.colors[p] = isSnow ? shade * 0.97 : 0.63;
      this.colors[p + 1] = isSnow ? shade * 0.99 : 0.70;
      this.colors[p + 2] = isSnow ? shade : 0.76;
      this.opacity[i] = 0;
      this.sizes[i] = this.initialSizes[i];
    }
    let active = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.ages[i] < 0) continue;
      const age = this.ages[i] += dt, life = this.lives[i], p = i * 3, kind = this.kinds[i];
      if (age >= life || this.positions[p + 1] < this.ground[i]) { this.ages[i] = -1; this.opacity[i] = 0; continue; }
      const t = age / life;
      if (kind === 2) this.velocities[p + 1] -= 3.2 * dt;
      else if (kind === 1) {
        // Small eddies disperse the powder without making it billow like smoke.
        this.velocities[p] += Math.sin(age * 6 + this.seeds[i] * 17) * 0.45 * dt;
        this.velocities[p + 2] += Math.cos(age * 5 + this.seeds[i] * 13) * 0.35 * dt;
        this.velocities[p + 1] -= 0.20 * dt;
      }
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      const fade = Math.min(1, t * 8) * Math.pow(1 - t, kind === 2 ? 1 : 1.5);
      this.opacity[i] = fade * this.strengths[i] * (kind === 2 ? 0.65 : kind === 1 ? 0.30 : 0.14);
      this.sizes[i] = this.initialSizes[i] * (kind === 2 ? 1 : kind === 1 ? 1 + t * 2.0 : 1 + t * 2.4);
      active++;
    }
    this.points.visible = active > 0;
    if (active) for (const name of ['position', 'color', 'spraySize', 'sprayAlpha', 'sprayKind', 'spraySeed']) this.geometry.getAttribute(name).needsUpdate = true;
  }

  clear() {
    this.ages.fill(-1); this.opacity.fill(0); this.carry = 0;
    this.geometry.getAttribute('sprayAlpha').needsUpdate = true;
    this.points.visible = false;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
