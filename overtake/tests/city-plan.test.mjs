import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDINGS, BUILDING_SPECS, buildingHalfExtents, facingRotationY,
  COLLISION_AABBS, COLLISION_CIRCLES, PARKED_CARS, BAYS, PARKING_LOT, PARK,
  resolveCollisions, bayAt, stepCityCar, createCityCar, CITY_BOUND, STREETS,
  BUILDING_COUNT, FACADE_TINTS, HEDGES, ROAD_MARKINGS,
} from '../src/world/city-plan.mjs';

test('all 24 archetypes exist and every one is placed at least once', () => {
  const keys = Object.keys(BUILDING_SPECS);
  assert.equal(keys.length, 24);
  for (const entry of BUILDINGS) {
    assert.ok(BUILDING_SPECS[entry.key], `missing spec for ${entry.key}`);
  }
  for (const key of keys) assert.ok(BUILDINGS.some(b => b.key === key), `${key} never placed`);
});

test('the district is genuinely built up, not a few isolated props', () => {
  assert.ok(BUILDING_COUNT >= 150, `only ${BUILDING_COUNT} buildings`);
  const counts = {};
  for (const b of BUILDINGS) counts[b.key] = (counts[b.key] ?? 0) + 1;
  for (const key of Object.keys(BUILDING_SPECS)) {
    assert.ok(counts[key] >= 2, `${key} placed only ${counts[key]} time(s)`);
  }
});

test('neighbouring buildings look different: tints, mirrors and scales vary', () => {
  const tints = new Set(BUILDINGS.map(b => b.tint));
  assert.equal(tints.size, FACADE_TINTS.length, 'not every facade tint is used');
  const scales = new Set(BUILDINGS.map(b => b.scale.toFixed(2)));
  assert.ok(scales.size >= 5, `only ${scales.size} distinct building scales`);
});

test('no two buildings overlap their collision footprints', () => {
  for (let i = 0; i < COLLISION_AABBS.length; i++) {
    for (let j = i + 1; j < COLLISION_AABBS.length; j++) {
      const a = COLLISION_AABBS[i], b = COLLISION_AABBS[j];
      const overlapX = (a.hw + b.hw) - Math.abs(a.x - b.x);
      const overlapZ = (a.hd + b.hd) - Math.abs(a.z - b.z);
      assert.ok(overlapX <= 0 || overlapZ <= 0,
        `buildings ${i} (${a.x},${a.z}) and ${j} (${b.x},${b.z}) overlap by ${Math.min(overlapX, overlapZ).toFixed(2)}m`);
    }
  }
});

test('every building sits fully inside the district and off the streets', () => {
  for (const entry of BUILDINGS) {
    const { hw, hd } = buildingHalfExtents(entry);
    assert.ok(Math.abs(entry.x) + hw <= CITY_BOUND && Math.abs(entry.z) + hd <= CITY_BOUND,
      `${entry.key} at ${entry.x},${entry.z} escapes the district`);
    for (const s of STREETS) {
      const overlapX = (hw + s.w / 2) - Math.abs(entry.x - s.x);
      const overlapZ = (hd + s.d / 2) - Math.abs(entry.z - s.z);
      assert.ok(overlapX <= 0 || overlapZ <= 0, `${entry.key} at ${entry.x},${entry.z} blocks ${s.name}`);
    }
  }
});

test('open ground stays open: no buildings in the park or the parking lot', () => {
  for (const entry of BUILDINGS) {
    const { hw, hd } = buildingHalfExtents(entry);
    const hits = r => entry.x - hw < r.x1 && entry.x + hw > r.x0 && entry.z - hd < r.z1 && entry.z + hd > r.z0;
    assert.ok(!hits(PARK), `${entry.key} at ${entry.x},${entry.z} stands in the park`);
    assert.ok(!hits(PARKING_LOT), `${entry.key} at ${entry.x},${entry.z} stands in the parking lot`);
  }
});

test('footprint swap only happens for east/west facing lots', () => {
  const e = BUILDINGS.find(b => b.facing === 'E');
  const spec = BUILDING_SPECS[e.key];
  const side = buildingHalfExtents(e), north = buildingHalfExtents({ ...e, facing: 'N' });
  assert.equal(side.hw, spec.d / 2);
  assert.equal(north.hw, spec.w / 2);
  assert.equal(facingRotationY('N'), 0);
  assert.equal(facingRotationY('S'), Math.PI);
  assert.equal(facingRotationY('E'), -Math.PI / 2);
  assert.equal(facingRotationY('W'), Math.PI / 2);
});

test('parking bays tile the lot without duplicating and parked cars use real bays', () => {
  const ids = new Set(BAYS.map(b => b.id));
  assert.equal(ids.size, BAYS.length);
  for (const b of BAYS) {
    assert.ok(b.x - b.w / 2 >= PARKING_LOT.x0 && b.x + b.w / 2 <= PARKING_LOT.x1, `bay ${b.id} spills past the lot edge`);
    assert.ok(b.z - b.d / 2 >= PARKING_LOT.z0 && b.z + b.d / 2 <= PARKING_LOT.z1, `bay ${b.id} spills past the lot end`);
  }
  for (const p of PARKED_CARS) {
    assert.ok(p.bay >= 0 && p.bay < BAYS.length, `parked car references bay ${p.bay}`);
    assert.ok(['golf', 'mustang', 'challenger', 'ferrari', 'audi', 'r8', 'mercedes'].includes(p.car));
  }
  const used = PARKED_CARS.map(p => p.bay);
  assert.equal(new Set(used).size, used.length);
});

test('resolveCollisions pushes the car out of a building and off the boundary', () => {
  const tower = BUILDINGS.find(b => b.key === 'glass_tower') ?? BUILDINGS[0];
  const stuck = resolveCollisions(tower.x, tower.z, 1.0);
  assert.ok(stuck.hit);
  assert.ok(Math.hypot(stuck.x - tower.x, stuck.z - tower.z) > 4, 'should be pushed outside the building');
  const wall = resolveCollisions(9999, 0, 1.0);
  assert.equal(wall.x, CITY_BOUND - 0.6);
  const clear = resolveCollisions(-60, 130, 1.0);
  assert.equal(clear.hit, false);
});

test('bayAt finds the bay under a parking spot and rejects open road', () => {
  for (const b of BAYS) assert.equal(bayAt(b.x, b.z), b.id);
  assert.equal(bayAt(0, 62), null);
  assert.equal(bayAt(0, -60), null);
});

test('city decorations agree with the open spaces and stay inside the wall', () => {
  for (const h of HEDGES) {
    assert.ok(Math.abs(h.x) <= CITY_BOUND + 0.01 && Math.abs(h.z) <= CITY_BOUND + 0.01);
  }
  assert.ok(HEDGES.length > 400, `only ${HEDGES.length} hedge blocks`);
  assert.ok(ROAD_MARKINGS.length > 200, `only ${ROAD_MARKINGS.length} road markings`);
  const circles = new Set(COLLISION_CIRCLES.map(c => `${c.x.toFixed(1)},${c.z.toFixed(1)}`));
  assert.ok(circles.size > 80, 'not enough props');
});

test('city car accelerates, brakes, reverses and never exceeds limits', () => {
  const spec = { accel: 9.6, brake: 10.6, grip: 1.0, wheelbase: 2.95, maxSteer: 0.48, understeer: 0.003, drag: 0.00085, maxSpeed: 59, steerResponse: 6.5 };
  const state = createCityCar();
  const input = { throttle: true, brake: false, left: false, right: false, handbrake: false };
  for (let i = 0; i < 240; i++) stepCityCar(state, input, spec, 1, 1 / 60);
  assert.ok(state.speed > 20, `expected forward speed, got ${state.speed}`);
  input.throttle = false; input.brake = true;
  for (let i = 0; i < 600 && state.speed > 0; i++) stepCityCar(state, input, spec, 1, 1 / 60);
  assert.ok(Math.abs(state.speed) < 0.5);
  for (let i = 0; i < 600; i++) stepCityCar(state, input, spec, 1, 1 / 60);
  assert.ok(state.speed < 0 && state.speed >= -8.5, `reverse speed ${state.speed}`);
  const slow = createCityCar(); const fast = createCityCar();
  fast.speed = 40; slow.speed = 2;
  const steer = { throttle: false, brake: false, left: true, right: false, handbrake: false };
  for (let i = 0; i < 90; i++) { stepCityCar(slow, steer, spec, 1, 1 / 60); stepCityCar(fast, steer, spec, 1, 1 / 60); }
  assert.ok(Math.abs(slow.steer) > Math.abs(fast.steer));
});

test('grip loss in rain/snow reduces yaw authority instead of granting it', () => {
  const spec = { accel: 9.6, brake: 10.6, grip: 1.0, wheelbase: 2.95, maxSteer: 0.48, understeer: 0.003, drag: 0.00085, maxSpeed: 59, steerResponse: 6.5 };
  const dry = createCityCar(); const wet = createCityCar();
  dry.speed = 20; wet.speed = 20; dry.steer = 0.2; wet.steer = 0.2;
  stepCityCar(dry, { throttle: true, brake: false, left: false, right: false, handbrake: false }, spec, 1.0, 1 / 60);
  stepCityCar(wet, { throttle: true, brake: false, left: false, right: false, handbrake: false }, spec, 0.55, 1 / 60);
  assert.ok(Math.abs(dry.yawDelta) > Math.abs(wet.yawDelta));
});
