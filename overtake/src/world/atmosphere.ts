import * as THREE from 'three';
import { easing } from 'maath';
import { dayFactor, sunAngle } from './clock.mjs';

// Day/night atmosphere: gradient sky, sun disc, moon, stars, fog and lighting.
// Colour targets are damped with maath so weather/biome changes never snap.
export class Atmosphere {
  readonly sky: THREE.Mesh;
  readonly skyMat: THREE.ShaderMaterial;
  readonly sun: THREE.DirectionalLight;
  readonly moonLight: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly stars: THREE.Points;
  readonly moon: THREE.Mesh;
  private fogColor = new THREE.Color();
  private tmp = new THREE.Color();

  constructor(private scene: THREE.Scene) {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2a6bb5) },
        horizonColor: { value: new THREE.Color(0xbfd8e8) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(0xfff2d0) },
        sunIntensity: { value: 1 },
        cloudCover: { value: 0.25 },
        cloudLight: { value: 1 },
        cloudTime: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir;
        uniform vec3 sunColor; uniform float sunIntensity;
        uniform float cloudCover; uniform float cloudLight; uniform float cloudTime;
        varying vec3 vDir;
        float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise2(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
        }
        float fbm(vec2 p) {
          float n = 0.0, amp = 0.5;
          for (int i=0; i<4; i++) { n += noise2(p)*amp; p = mat2(1.6,-1.2,1.2,1.6)*p; amp *= 0.5; }
          return n;
        }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          // Soft, directional cloud layers with a clear break near the horizon.
          vec2 cp = d.xz / (max(d.y, 0.0) + 0.32) * 3.0 + vec2(cloudTime * 0.002, cloudTime * 0.0007);
          float n = fbm(cp);
          float clouds = smoothstep(0.56 - cloudCover * 0.16, 0.72 - cloudCover * 0.12, n);
          clouds *= smoothstep(0.015, 0.16, d.y) * cloudLight;
          vec3 cloudColor = mix(horizonColor * 0.85, vec3(1.0, 0.98, 0.95), 0.65);
          col = mix(col, cloudColor, clouds * (0.38 + cloudCover * 0.38));
          col += sunColor * (pow(s, 420.0) * 3.0 + pow(s, 18.0) * 0.22) * sunIntensity;
          float below = 1.0 - smoothstep(-0.25, 0.0, d.y);
          col = mix(col, horizonColor * 0.35, below);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
      const r = 840;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.9 + 20;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    scene.add(this.stars);

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 24), new THREE.MeshBasicMaterial({ color: 0xe8eef8, fog: false }));
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0x9db8dd, 0x4a4038, 0.65);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0b0, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -24; cam.right = 24; cam.top = 24; cam.bottom = -24; cam.near = 1; cam.far = 220;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);
    this.moonLight = new THREE.DirectionalLight(0x8fa8d8, 0.0);
    scene.add(this.moonLight, this.moonLight.target);
    scene.fog = new THREE.Fog(0xbfd8e8, 90, 640);
  }

  update(hour: number, weather: { rain: number; snow: number }, biome: { fog: number }, cameraPos: THREE.Vector3, dt: number) {
    const day = dayFactor(hour);
    const angle = sunAngle(hour);
    const elev = Math.sin(angle);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.28);
    const cloud = Math.min(1, weather.rain * 0.85 + weather.snow * 0.75);
    const night = 1 - day;

    const sunDir = new THREE.Vector3(Math.cos(angle) * 0.8, elev, -0.35).normalize();
    this.skyMat.uniforms.sunDir.value.copy(sunDir);
    this.skyMat.uniforms.sunIntensity.value = (1 - cloud * 0.8) * Math.max(0, elev * 2.5);
    this.skyMat.uniforms.cloudCover.value = 0.22 + cloud * 0.78;
    this.skyMat.uniforms.cloudLight.value = 0.2 + day * 0.8;
    this.skyMat.uniforms.cloudTime.value += Math.max(0, dt);

    // Sky colours: night -> day, warmed at dusk, greyed by weather.
    const top = this.tmp.set(0x03060e).lerp(new THREE.Color(0x3a7bd5), day);
    const cloudTop = new THREE.Color(0x05070c).lerp(new THREE.Color(0x5a6b7a), day);
    top.lerp(cloudTop, cloud * 0.7);
    easing.dampC(this.skyMat.uniforms.topColor.value, top, 0.25, dt);
    const horizon = new THREE.Color(0x0a101c).lerp(new THREE.Color(0xcfe8f5), day);
    horizon.lerp(new THREE.Color(0xff9a5a), dusk * 0.65 * (1 - cloud));
    const cloudHorizon = new THREE.Color(0x0a1018).lerp(new THREE.Color(0x8f9aa3), day);
    horizon.lerp(cloudHorizon, cloud * 0.75);
    horizon.lerp(new THREE.Color(biome.fog), 0.18);
    easing.dampC(this.skyMat.uniforms.horizonColor.value, horizon, 0.25, dt);
    this.skyMat.uniforms.sunColor.value.set(0xfff2d0).lerp(new THREE.Color(0xff8a3c), dusk);

    // Lights.
    this.sun.intensity = 2.3 * day * (1 - cloud * 0.65);
    this.sun.color.set(0xfff2d8).lerp(new THREE.Color(0xff9a5a), dusk);
    this.sun.position.copy(cameraPos).addScaledVector(sunDir, 120);
    this.sun.target.position.copy(cameraPos);
    this.moonLight.intensity = 0.28 * night * (1 - cloud * 0.6);
    const moonDir = sunDir.clone().multiplyScalar(-1);
    moonDir.y = Math.abs(moonDir.y) * 0.7 + 0.25;
    this.moonLight.position.copy(cameraPos).addScaledVector(moonDir, 100);
    this.moonLight.target.position.copy(cameraPos);
    this.moon.position.copy(cameraPos).addScaledVector(moonDir, 820);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = night;
    this.moon.visible = night > 0.05 && cloud < 0.8;
    this.hemi.intensity = 0.12 + 0.6 * day * (1 - cloud * 0.45);
    this.hemi.color.set(0x9db8dd).lerp(new THREE.Color(0x2a3550), night);
    (this.stars.material as THREE.PointsMaterial).opacity = night * (1 - cloud) * 0.9;
    this.stars.visible = night > 0.05 && cloud < 0.9;
    this.stars.position.copy(cameraPos);
    this.sky.position.copy(cameraPos);

    // Fog follows horizon and thickens with precipitation.
    this.fogColor.copy(horizon);
    const fog = this.scene.fog as THREE.Fog;
    easing.dampC(fog.color, this.fogColor, 0.35, dt);
    fog.near = 70 - cloud * 35;
    fog.far = 640 - cloud * 320 - night * 90;
    this.scene.environmentIntensity = 0.22 + 0.5 * day * (1 - cloud * 0.4);
    return { day, night, cloud, dusk };
  }

  setGarage() {
    this.skyMat.uniforms.topColor.value.set(0x05070c);
    this.skyMat.uniforms.horizonColor.value.set(0x161d2a);
    this.skyMat.uniforms.sunIntensity.value = 0;
    this.skyMat.uniforms.cloudLight.value = 0;
    this.sun.intensity = 0.5;
    this.moonLight.intensity = 0;
    this.hemi.intensity = 0.35;
    this.stars.visible = false;
    this.moon.visible = false;
    this.scene.fog = new THREE.Fog(0x0a0e16, 26, 110);
    this.scene.environmentIntensity = 0.75;
  }
}
