import * as THREE from 'three';

// Low, short-lived particles left in world space by the rear tires. One draw
// call is shared by both wheels; no spray is emitted on dry or stationary roads.
export class RoadSpray {
  readonly points: THREE.Points;
  private readonly count = 160;
  private positions = new Float32Array(this.count * 3);
  private colors = new Float32Array(this.count * 3);
  private sizes = new Float32Array(this.count);
  private opacity = new Float32Array(this.count);
  private velocities = new Float32Array(this.count * 3);
  private ages = new Float32Array(this.count).fill(-1);
  private lives = new Float32Array(this.count);
  private strengths = new Float32Array(this.count);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.PointsMaterial;
  private cursor = 0;
  private carry = 0;

  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('spraySize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('sprayAlpha', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, vertexColors: true,
      transparent: true, opacity: 0.65, depthWrite: false, sizeAttenuation: true });
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float spraySize; attribute float sprayAlpha; varying float vSprayAlpha;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * spraySize; vSprayAlpha = sprayAlpha;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSprayAlpha;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
          float soft = 1.0 - smoothstep(0.1, 1.0, d);
          diffuseColor.a *= soft * soft * vSprayAlpha;`);
    };
    this.material.customProgramCacheKey = () => 'road-tire-spray-v1';
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
    this.carry += dt * amount * 100;
    while (this.carry >= 1) {
      this.carry--;
      const i = this.cursor++ % this.count, p = i * 3;
      const side = (this.cursor % 2 ? -1 : 1) * width * 0.36;
      const jitter = (Math.random() - 0.5) * 0.45;
      const back = length * (0.38 + Math.random() * 0.17);
      this.positions[p] = position.x - fx * back + rx * (side + jitter);
      this.positions[p + 1] = position.y + 0.14 + snowHeight;
      this.positions[p + 2] = position.z - fz * back + rz * (side + jitter);
      const drift = speed * (0.82 + Math.random() * 0.08);
      const sideways = (side < 0 ? -1 : 1) * (0.25 + Math.random() * 0.35);
      this.velocities[p] = fx * drift + rx * sideways;
      this.velocities[p + 1] = 0.22 + Math.random() * 0.35;
      this.velocities[p + 2] = fz * drift + rz * sideways;
      this.ages[i] = 0;
      this.lives[i] = 0.65 + Math.random() * 0.45;
      this.strengths[i] = amount;
      this.colors[p] = 0.63 + powder * 0.22;
      this.colors[p + 1] = 0.70 + powder * 0.18;
      this.colors[p + 2] = 0.76 + powder * 0.16;
      this.opacity[i] = amount * 0.6;
      this.sizes[i] = 0.28;
    }
    let active = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.ages[i] < 0) continue;
      const age = this.ages[i] += dt, life = this.lives[i], p = i * 3;
      if (age >= life) { this.ages[i] = -1; this.opacity[i] = 0; continue; }
      const t = age / life;
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
      this.opacity[i] = Math.sin(Math.PI * t) * 0.12 * this.strengths[i];
      this.sizes[i] = 0.45 + t * 1.15;
      active++;
    }
    this.points.visible = active > 0;
    if (active) for (const name of ['position', 'color', 'spraySize', 'sprayAlpha']) this.geometry.getAttribute(name).needsUpdate = true;
  }

  clear() {
    this.ages.fill(-1); this.opacity.fill(0); this.carry = 0;
    this.geometry.getAttribute('sprayAlpha').needsUpdate = true;
    this.points.visible = false;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
