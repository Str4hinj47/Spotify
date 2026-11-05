import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared geometries for both sides of the road. Each light uses only a few
// draw calls: the pole, footplate, access panel and curved arm are merged.
export function createStreetlightGeometry() {
  const metal: THREE.BufferGeometry[] = [];
  const cylinder = (top: number, bottom: number, height: number, x: number, y: number, z: number, segments = 10) => {
    const geometry = new THREE.CylinderGeometry(top, bottom, height, segments);
    geometry.translate(x, y, z); metal.push(geometry);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z); metal.push(geometry);
  };
  // Tapered shaft, reinforced plinth, flange and inspection hatch.
  cylinder(0.075, 0.14, 7.35, 0, 3.675, 0);
  cylinder(0.18, 0.22, 0.48, 0, 0.24, 0, 12);
  cylinder(0.23, 0.23, 0.06, 0, 0.06, 0, 12);
  cylinder(0.15, 0.15, 0.055, 0, 0.55, 0, 12);
  box(0.08, 0.32, 0.016, 0, 0.9, 0.134);
  for (const x of [-0.15, 0.15]) for (const z of [-0.15, 0.15]) cylinder(0.028, 0.028, 0.05, x, 0.08, z, 6);

  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 7.15, 0), new THREE.Vector3(0, 8.06, 0),
    new THREE.Vector3(-0.65, 8.25, 0), new THREE.Vector3(-2.16, 8.16, 0),
  );
  metal.push(new THREE.TubeGeometry(curve, 16, 0.075, 8, false));
  const pole = mergeGeometries(metal, false)!;
  metal.forEach(g => g.dispose());

  // A rounded, low-profile LED housing and recessed underside diffuser.
  const housing = new THREE.SphereGeometry(1, 16, 8);
  housing.scale(0.58, 0.10, 0.24);
  housing.translate(-2.42, 8.16, 0);
  const lens = new THREE.BoxGeometry(0.83, 0.025, 0.30);
  lens.translate(-2.47, 8.015, 0);
  const rim = new THREE.BoxGeometry(0.94, 0.035, 0.38);
  rim.translate(-2.47, 8.045, 0);
  return { pole, housing, rim, lens };
}
