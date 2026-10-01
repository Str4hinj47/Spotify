import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const TRACK_WIDTH = 8;
const TRACK_SAMPLE_COUNT = 180;
const DIRT_START = 0.34;
const DIRT_END = 0.55;

const trackControlPoints = [
  new THREE.Vector3(-34, 0, 16),
  new THREE.Vector3(-27, 0, -13),
  new THREE.Vector3(-6, 0, -24),
  new THREE.Vector3(22, 0, -18),
  new THREE.Vector3(34, 0, 4),
  new THREE.Vector3(22, 0, 24),
  new THREE.Vector3(-2, 0, 29),
  new THREE.Vector3(-25, 0, 25),
];

const rivalColors = ["#ff5f9a", "#6ee7f6", "#ffd15b"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isDirtT = (t) => t >= DIRT_START && t <= DIRT_END;

const createMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: options.roughness ?? 0.72,
  metalness: options.metalness ?? 0.08,
  emissive: options.emissive || "#000000",
  emissiveIntensity: options.emissiveIntensity ?? 0,
  flatShading: options.flatShading ?? true,
});

const createCartoonCar = (car, scale = 1) => {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const bodyMaterial = createMaterial(car.color, { roughness: 0.42, metalness: 0.18 });
  const shadowMaterial = createMaterial(car.shadow || "#563c58", { roughness: 0.62 });
  const glassMaterial = createMaterial("#1a254d", { roughness: 0.18, metalness: 0.34, emissive: "#213f69", emissiveIntensity: 0.45 });
  const tireMaterial = createMaterial("#111326", { roughness: 0.88 });
  const rimMaterial = createMaterial("#f7cf67", { roughness: 0.3, metalness: 0.65 });
  const lightMaterial = createMaterial("#fff3bd", { emissive: "#ffe08a", emissiveIntensity: 2.2, roughness: 0.2 });
  const tailMaterial = createMaterial("#ff506e", { emissive: "#ff194d", emissiveIntensity: 1.8, roughness: 0.25 });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.15, 24), createMaterial("#090b1d", { roughness: 1 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  shadow.scale.set(1.15, 2.05, 1);
  shadow.material.transparent = true;
  shadow.material.opacity = 0.48;
  group.add(shadow);

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.6, 4.5), shadowMaterial);
  lowerBody.position.y = 0.65;
  lowerBody.castShadow = true;
  group.add(lowerBody);

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.7, 4.05), bodyMaterial);
  body.position.set(0, 0.88, 0.08);
  body.castShadow = true;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 1.25), bodyMaterial);
  hood.position.set(0, 1.28, -1.35);
  hood.castShadow = true;
  group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 1.72), bodyMaterial);
  cabin.position.set(0, 1.45, 0.35);
  cabin.castShadow = true;
  group.add(cabin);

  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.38, 0.08), glassMaterial);
  frontWindow.position.set(0, 1.54, -0.54);
  frontWindow.rotation.x = -0.24;
  group.add(frontWindow);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 0.08), glassMaterial);
  rearWindow.position.set(0, 1.54, 1.2);
  rearWindow.rotation.x = 0.18;
  group.add(rearWindow);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.25, 0.25), shadowMaterial);
  bumper.position.set(0, 0.69, -2.08);
  group.add(bumper);

  const frontLights = [-0.82, 0.82].map((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), lightMaterial);
    light.position.set(x, 1.0, -2.12);
    group.add(light);
    return light;
  });

  [-0.82, 0.82].forEach((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMaterial);
    light.position.set(x, 1.02, 2.13);
    group.add(light);
  });

  const wheels = [];
  [-1.23, 1.23].forEach((x) => {
    [-1.35, 1.38].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 16), tireMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.48, z);
      wheel.castShadow = true;
      group.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.36, 12), rimMaterial);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(wheel.position);
      group.add(rim);
      wheels.push(wheel);
    });
  });
  group.userData.wheels = wheels;

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), rimMaterial);
  antenna.position.set(0, 2.02, 0.45);
  group.add(antenna);
  const antennaTop = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), createMaterial(car.accent || "#ffd15b", { emissive: car.accent || "#ffd15b", emissiveIntensity: 0.65 }));
  antennaTop.position.set(0, 2.48, 0.45);
  group.add(antennaTop);

  return group;
};

const buildTrack = (scene) => {
  const curve = new THREE.CatmullRomCurve3(trackControlPoints, true, "catmullrom", 0.32);
  const samples = [];
  let length = 0;
  for (let i = 0; i < TRACK_SAMPLE_COUNT; i += 1) {
    const t = i / TRACK_SAMPLE_COUNT;
    const position = curve.getPointAt(t);
    const next = curve.getPointAt((i + 1) / TRACK_SAMPLE_COUNT);
    if (i > 0) length += position.distanceTo(samples[i - 1].position);
    samples.push({ t, position, tangent: next.clone().sub(position).normalize() });
  }
  length += samples[0].position.distanceTo(samples[samples.length - 1].position);

  const roadPositions = [];
  const roadUvs = [];
  const roadIndices = [];
  const leftEdge = [];
  const rightEdge = [];
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const side = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x).normalize();
    const left = sample.position.clone().addScaledVector(side, TRACK_WIDTH / 2);
    const right = sample.position.clone().addScaledVector(side, -TRACK_WIDTH / 2);
    leftEdge.push(left.clone().setY(0.08));
    rightEdge.push(right.clone().setY(0.08));
    roadPositions.push(left.x, 0.08, left.z, right.x, 0.08, right.z);
    roadUvs.push(0, i / 7, 1, i / 7);
    const nextIndex = (i + 1) % samples.length;
    roadIndices.push(i * 2, nextIndex * 2, i * 2 + 1, nextIndex * 2, nextIndex * 2 + 1, i * 2 + 1);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeometry.setIndex(roadIndices);
  roadGeometry.computeVertexNormals();
  for (let i = 0; i < samples.length; i += 1) {
    roadGeometry.addGroup(i * 6, 6, isDirtT(samples[i].t) ? 1 : 0);
  }
  const road = new THREE.Mesh(roadGeometry, [
    createMaterial("#292950", { roughness: 0.92 }),
    createMaterial("#ad684e", { roughness: 1, flatShading: true }),
  ]);
  road.receiveShadow = true;
  scene.add(road);

  const curbGroup = new THREE.Group();
  const roadCurb = createMaterial("#65e6eb", { emissive: "#3abac7", emissiveIntensity: 0.9, roughness: 0.42 });
  const dirtCurb = createMaterial("#f0ae68", { emissive: "#733e37", emissiveIntensity: 0.36, roughness: 0.72 });
  for (let i = 0; i < samples.length; i += 3) {
    const sample = samples[i];
    const side = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x).normalize();
    const material = isDirtT(sample.t) ? dirtCurb : roadCurb;
    [-1, 1].forEach((edge) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.18), material);
      curb.position.copy(sample.position).addScaledVector(side, edge * (TRACK_WIDTH / 2 + 0.25));
      curb.position.y = 0.16;
      curb.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
      curb.castShadow = true;
      curbGroup.add(curb);
    });
  }
  scene.add(curbGroup);

  const centerMarks = new THREE.Group();
  const markMaterial = createMaterial("#ff5f9a", { emissive: "#ff2f7d", emissiveIntensity: 1.3, roughness: 0.45 });
  for (let i = 0; i < samples.length; i += 8) {
    if (isDirtT(samples[i].t)) continue;
    const sample = samples[i];
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 1.55), markMaterial);
    mark.position.copy(sample.position);
    mark.position.y = 0.13;
    mark.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    centerMarks.add(mark);
  }
  scene.add(centerMarks);

  const dirtDetails = new THREE.Group();
  const rockMaterial = createMaterial("#e0a064", { roughness: 1 });
  for (let i = 0; i < samples.length; i += 7) {
    if (!isDirtT(samples[i].t)) continue;
    const sample = samples[i];
    const side = new THREE.Vector3(-sample.tangent.z, 0, sample.tangent.x).normalize();
    [-1, 1].forEach((edge) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.04, 0), rockMaterial);
      rock.position.copy(sample.position).addScaledVector(side, edge * (TRACK_WIDTH / 2 + 0.65 + (i % 2) * 0.3));
      rock.position.y = 0.18;
      dirtDetails.add(rock);
    });
  }
  scene.add(dirtDetails);

  const leftLine = new THREE.BufferGeometry().setFromPoints([...leftEdge, leftEdge[0]]);
  const rightLine = new THREE.BufferGeometry().setFromPoints([...rightEdge, rightEdge[0]]);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: "#ff5f9a", transparent: true, opacity: 0.82 });
  scene.add(new THREE.Line(leftLine, edgeMaterial));
  scene.add(new THREE.Line(rightLine, edgeMaterial));

  return { curve, samples, length };
};

const addCity = (scene) => {
  const city = new THREE.Group();
  const buildingColors = ["#222858", "#29234e", "#1d3651", "#322451"];
  const windowColors = ["#64e6e4", "#ff5f9a", "#ffd15b"];
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 12; i += 1) {
      const width = 5 + (i % 3) * 1.8;
      const depth = 5 + ((i + 1) % 3) * 1.4;
      const height = 5 + ((i * 7) % 8) * 2.1;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), createMaterial(buildingColors[i % buildingColors.length], { roughness: 0.95 }));
      building.position.set(side * (43 + (i % 3) * 5), height / 2 - 0.05, -47 + i * 8.8);
      building.castShadow = true;
      building.receiveShadow = true;
      city.add(building);
      const window = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.08, 0.12), createMaterial(windowColors[i % windowColors.length], { emissive: windowColors[i % windowColors.length], emissiveIntensity: 1.7, roughness: 0.35 }));
      window.position.set(building.position.x - side * width * 0.2, Math.min(height - 1, 4 + (i % 4) * 3), building.position.z - depth / 2 - 0.08);
      city.add(window);
    }
  });
  scene.add(city);
};

const addSky = (scene) => {
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), createMaterial("#ffe1c4", { emissive: "#ffb6c8", emissiveIntensity: 0.8, roughness: 0.9 }));
  moon.position.set(38, 39, -55);
  scene.add(moon);

  const starPositions = [];
  for (let i = 0; i < 180; i += 1) {
    starPositions.push(((i * 47) % 160) - 80, 16 + ((i * 23) % 38), ((i * 71) % 140) - 75);
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: "#b7f6ff", size: 0.22, sizeAttenuation: true }))); 
};

const addNeonGate = (scene, track) => {
  const sample = track.samples[4];
  const gate = new THREE.Group();
  const glowMaterial = createMaterial("#ff5f9a", { emissive: "#ff2c79", emissiveIntensity: 2.2, roughness: 0.35 });
  const postMaterial = createMaterial("#32234f", { roughness: 0.7 });
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.8, 0.35), glowMaterial);
    post.position.set(side * 4.8, 2.9, 0);
    gate.add(post);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(10, 0.42, 0.4), glowMaterial);
  top.position.y = 5.7;
  gate.add(top);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.05, 0.2), postMaterial);
  sign.position.set(0, 4.95, 0);
  gate.add(sign);
  gate.position.copy(sample.position);
  gate.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
  scene.add(gate);
};

const findNearestTrack = (position, samples) => {
  let nearest = samples[0];
  let distance = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const sampleDistance = position.distanceToSquared(samples[i].position);
    if (sampleDistance < distance) {
      distance = sampleDistance;
      nearest = samples[i];
    }
  }
  return { sample: nearest, distance: Math.sqrt(distance) };
};

const Game3D = ({ running, selectedCar, onToggleRace, onTelemetry }) => {
  const mountRef = useRef(null);
  const runningRef = useRef(running);
  const toggleRaceRef = useRef(onToggleRace);
  const telemetryRef = useRef(onTelemetry);
  const keysRef = useRef({ up: false, down: false, left: false, right: false, drift: false });
  const [hud, setHud] = useState({ speed: 0, surface: "road", drifting: false, driftScore: 0, progress: 0, lap: 1 });

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { toggleRaceRef.current = onToggleRace; }, [onToggleRace]);
  useEffect(() => { telemetryRef.current = onTelemetry; }, [onTelemetry]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c1028");
    scene.fog = new THREE.Fog("#111431", 55, 155);

    const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 240);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#7884c9", "#171b31", 1.35));
    const moonLight = new THREE.DirectionalLight("#d5d7ff", 2.1);
    moonLight.position.set(-30, 52, -25);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = -70;
    moonLight.shadow.camera.right = 70;
    moonLight.shadow.camera.top = 70;
    moonLight.shadow.camera.bottom = -70;
    scene.add(moonLight);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), createMaterial("#172d32", { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(200, 40, "#25515a", "#183036");
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.34;
    scene.add(grid);

    addSky(scene);
    addCity(scene);
    const track = buildTrack(scene);
    addNeonGate(scene, track);

    const player = createCartoonCar(selectedCar, 1);
    player.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    scene.add(player);

    const rivals = rivalColors.map((color, index) => {
      const rivalCar = createCartoonCar({ ...selectedCar, color, shadow: index === 0 ? "#773855" : index === 1 ? "#336d85" : "#8c652e", accent: color }, 0.83);
      scene.add(rivalCar);
      return { car: rivalCar, t: 0.18 + index * 0.075, speed: 0.008 + index * 0.0018 };
    });

    const startT = 0.08;
    const startSample = track.curve.getPointAt(startT);
    const startTangent = track.curve.getTangentAt(startT).normalize();
    const initialYaw = Math.atan2(startTangent.x, -startTangent.z);
    const state = {
      position: startSample.clone(),
      yaw: initialYaw,
      speed: 0,
      lateralSpeed: 0,
      totalDistance: 0,
      driftScore: 0,
      lastTelemetry: 0,
    };
    player.position.copy(state.position);
    player.rotation.y = state.yaw;

    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const lateral = new THREE.Vector3();
    const desiredCameraPosition = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    let animationFrame;
    let previousRunning = runningRef.current;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const currentlyRunning = runningRef.current;

      if (currentlyRunning && !previousRunning) {
        state.speed = 0;
        state.lateralSpeed = 0;
      }
      previousRunning = currentlyRunning;

      const nearest = findNearestTrack(state.position, track.samples);
      const onTrack = nearest.distance < TRACK_WIDTH * 0.72;
      const surface = onTrack ? (isDirtT(nearest.sample.t) ? "dirt" : "road") : "grass";
      const keys = keysRef.current;
      let drifting = false;

      if (currentlyRunning) {
        const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (keys.up) state.speed += (surface === "dirt" ? 15 : 22) * dt;
        if (keys.down) state.speed -= 28 * dt;
        if (!keys.up && !keys.down) state.speed *= Math.pow(surface === "dirt" ? 0.988 : 0.955, dt * 60);
        if (surface === "grass") state.speed *= Math.pow(0.87, dt * 60);
        state.speed = clamp(state.speed, -8, 32);

        const speedFactor = clamp(Math.abs(state.speed) / 10, 0, 1.35);
        drifting = keys.drift && Math.abs(state.speed) > 4 && steer !== 0;
        const steeringGrip = surface === "dirt" ? 1.28 : 1;
        const driftSteering = drifting ? 1.75 : 0.92;
        state.yaw += steer * driftSteering * steeringGrip * speedFactor * dt * (state.speed >= 0 ? 1 : -1);
        forward.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
        lateral.set(-forward.z, 0, forward.x);
        const targetLateralSpeed = steer * state.speed * (drifting ? 0.52 : 0.08);
        const grip = drifting ? 1.65 : surface === "dirt" ? 3.3 : 9.5;
        state.lateralSpeed = THREE.MathUtils.lerp(state.lateralSpeed, targetLateralSpeed, clamp(grip * dt, 0, 1));
        state.position.addScaledVector(forward, state.speed * dt);
        state.position.addScaledVector(lateral, state.lateralSpeed * dt);
        if (drifting) state.driftScore += Math.abs(state.speed) * dt * 0.95;
        state.totalDistance += Math.max(state.speed, 0) * dt;
      } else {
        state.speed = THREE.MathUtils.lerp(state.speed, 0, clamp(dt * 4.4, 0, 1));
        state.lateralSpeed = THREE.MathUtils.lerp(state.lateralSpeed, 0, clamp(dt * 5, 0, 1));
      }

      player.position.copy(state.position);
      player.rotation.y = state.yaw;
      player.position.y = 0.08 + Math.sin(elapsed * 7) * 0.025;
      player.userData.wheels?.forEach((wheel) => { wheel.rotation.x -= state.speed * dt * 1.5; });

      rivals.forEach((rival, index) => {
        rival.t = (rival.t + rival.speed * dt * (currentlyRunning ? 1 : 0.22)) % 1;
        const rivalPosition = track.curve.getPointAt(rival.t);
        const rivalTangent = track.curve.getTangentAt(rival.t).normalize();
        rival.car.position.copy(rivalPosition);
        rival.car.position.y = 0.06 + Math.sin(elapsed * 5 + index) * 0.018;
        rival.car.rotation.y = Math.atan2(rivalTangent.x, -rivalTangent.z);
      });

      forward.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      desiredCameraPosition.copy(state.position).addScaledVector(forward, -14);
      desiredCameraPosition.y += 7.2;
      camera.position.lerp(desiredCameraPosition, 1 - Math.pow(0.0008, dt));
      lookTarget.copy(state.position).addScaledVector(forward, 7);
      lookTarget.y += 1.35;
      camera.lookAt(lookTarget);

      if (elapsed - state.lastTelemetry > 0.1) {
        state.lastTelemetry = elapsed;
        const payload = {
          speed: Math.max(0, state.speed) * 3.1,
          surface,
          drifting,
          driftScore: state.driftScore,
          progress: state.totalDistance > 0 ? (state.totalDistance / track.length) * 100 : 0,
          lap: Math.floor(state.totalDistance / track.length) + 1,
        };
        setHud(payload);
        telemetryRef.current?.(payload);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [selectedCar]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (event.code === "ArrowUp" || key === "w") keysRef.current.up = true;
      if (event.code === "ArrowDown" || key === "s") keysRef.current.down = true;
      if (event.code === "ArrowLeft" || key === "a") keysRef.current.left = true;
      if (event.code === "ArrowRight" || key === "d") keysRef.current.right = true;
      if (event.code === "Space" || key === "shift") {
        event.preventDefault();
        keysRef.current.drift = true;
      }
      if (key === "r" && !event.repeat) toggleRaceRef.current?.();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) event.preventDefault();
    };
    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (event.code === "ArrowUp" || key === "w") keysRef.current.up = false;
      if (event.code === "ArrowDown" || key === "s") keysRef.current.down = false;
      if (event.code === "ArrowLeft" || key === "a") keysRef.current.left = false;
      if (event.code === "ArrowRight" || key === "d") keysRef.current.right = false;
      if (event.code === "Space" || key === "shift") keysRef.current.drift = false;
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const setInput = (input, active) => {
    keysRef.current[input] = active;
  };
  const bindTouch = (input) => ({
    onPointerDown: (event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setInput(input, true); },
    onPointerUp: () => setInput(input, false),
    onPointerCancel: () => setInput(input, false),
    onPointerLeave: () => setInput(input, false),
  });

  return (
    <div className="game3d-shell" onPointerDown={() => mountRef.current?.focus()}>
      <div ref={mountRef} className="game3d-canvas" tabIndex="0" aria-label="Playable 3D Tokyo street race" />
      <div className="game3d-vignette" />
      <div className="game3d-hud game3d-hud-top">
        <div className="game3d-location"><span className="hud-live-dot" /> 3D LIVE <strong>TOKYO NIGHT CIRCUIT</strong></div>
        <div className="game3d-lap">LAP <strong>{hud.lap}</strong> / 3</div>
      </div>
      <div className="game3d-speed"><span>SPEED</span><strong>{Math.round(hud.speed).toString().padStart(3, "0")}</strong><small>KM/H</small></div>
      {!running && <div className="game3d-start-card"><span className="card-label">ENGINE OFF / GRID READY</span><strong>Drive the night.</strong><button onClick={onToggleRace}>START ENGINE <span>→</span></button></div>}
      {running && <button className="game3d-pause" onClick={onToggleRace}>Ⅱ <span>PAUSE</span></button>}
      <div className="game3d-hud game3d-hud-bottom">
        <div className={`surface-readout surface-readout-${hud.surface}`}><span className="surface-readout-dot" /><div><small>SURFACE</small><strong>{hud.surface === "dirt" ? "DIRT SECTOR" : hud.surface === "grass" ? "OFF TRACK" : "TARMAC"}</strong></div></div>
        <div className={`drift-readout ${hud.drifting ? "drift-readout-active" : ""}`}><span>DRIFT CHAIN</span><strong>{Math.floor(hud.driftScore).toString().padStart(3, "0")}</strong>{hud.drifting && <em>SLIDING</em>}</div>
        <div className="game3d-key-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> DRIVE <kbd>SPACE</kbd> DRIFT</div>
      </div>
      <div className="game3d-touch-controls" aria-label="Touch driving controls">
        <div className="touch-steer"><button aria-label="Steer left" {...bindTouch("left")}>←</button><button aria-label="Steer right" {...bindTouch("right")}>→</button></div>
        <div className="touch-drive"><button aria-label="Brake or reverse" {...bindTouch("down")}>▼</button><button className="touch-drift" aria-label="Drift" {...bindTouch("drift")}>DRIFT</button><button aria-label="Accelerate" {...bindTouch("up")}>▲</button></div>
      </div>
    </div>
  );
};

export default Game3D;
