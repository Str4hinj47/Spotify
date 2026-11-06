import * as THREE from 'three';

interface VehicleShadow {
  s: number;
  offset: number;
  width: number;
  length: number;
}

/** One bounded draw call for soft road-contact patches under nearby traffic. */
export class TrafficShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly right = new THREE.Vector3();

  constructor(group: THREE.Group, private road: {
    centerX: (s: number) => number;
    centerY: (s: number) => number;
    rightAt: (s: number, out: THREE.Vector3) => THREE.Vector3;
    roadYaw: (s: number) => number;
    snowHeight: (offset: number, s: number, cover: number) => number;
    step: number;
    back: number;
  }) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,.62)');
    gradient.addColorStop(.48, 'rgba(0,0,0,.48)');
    gradient.addColorStop(.8, 'rgba(0,0,0,.16)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, opacity: .7 });
    this.mesh = new THREE.InstancedMesh(geometry, material, 48);
    this.mesh.name = 'traffic-contact-shadows';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(this.mesh);
  }

  update(vehicles: readonly VehicleShadow[], playerS: number, snow: number) {
    let count = 0;
    const start = playerS - this.road.back;
    for (const vehicle of vehicles) {
      // Avoid shadows for the traffic beyond the rendered ribbon or capacity.
      if (vehicle.s < playerS - 75 || vehicle.s > playerS + 630 || count >= 48) continue;
      const s = vehicle.s, r = this.road.rightAt(s, this.right);
      // Match the road ribbon's piecewise-linear vertical profile exactly.
      const row = Math.floor((s - start) / this.road.step);
      const a = start + row * this.road.step;
      const y0 = this.road.centerY(a), y1 = this.road.centerY(a + this.road.step);
      const height = THREE.MathUtils.lerp(y0, y1, (s - a) / this.road.step);
      const slope = (y1 - y0) / this.road.step;
      this.dummy.position.set(this.road.centerX(s) + r.x * vehicle.offset,
        height + .045 + this.road.snowHeight(vehicle.offset, s, snow), -s + r.z * vehicle.offset);
      this.dummy.rotation.order = 'YXZ';
      this.dummy.rotation.set(Math.atan(slope), this.road.roadYaw(s), 0);
      this.dummy.scale.set(vehicle.width * 1.25, 1, vehicle.length * 1.13);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count++, this.dummy.matrix);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
