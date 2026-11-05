import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_CRUISE, trafficCruise, isTruck, chooseTruck, createTrafficAI, findLeader, stepTraffic, canOvertakeTruck, startOvertake, stepOvertake } from '../src/traffic-ai.mjs';

const vehicle = (id, s, speed, dir = 1, offset = dir === 1 ? 2.1 : -2.1) => ({
  id, s, speed, dir, offset, length: id === 'semi' ? 16 : id === 'kraz' ? 8 : 4.5,
  width: isTruck(id) ? 2.5 : 1.9, ai: createTrafficAI(TRAFFIC_CRUISE[id]),
});

test('trucks are rare, score-gated and spaced apart; model cruise speeds differ', () => {
  assert.equal(chooseTruck(1499, [], 200, () => 0), null);
  assert.equal(chooseTruck(1500, [], 200, () => 0.1), null);
  assert.equal(chooseTruck(1500, [], 200, () => 0), 'semi');
  const seq = [0.01, 0.8]; assert.equal(chooseTruck(1500, [], 200, () => seq.shift()), 'kraz');
  assert.equal(chooseTruck(3000, [vehicle('semi', 350, 11.5)], 200, () => 0), null);
  assert.ok(trafficCruise('kraz', () => 1) < trafficCruise('golf', () => 0));
  assert.notEqual(trafficCruise('golf', () => 0), trafficCruise('golf', () => 1));
  assert.ok(Math.max(TRAFFIC_CRUISE.semi, TRAFFIC_CRUISE.kraz) < TRAFFIC_CRUISE.golf);
  assert.equal(new Set(['golf','mercedes','audi','mustang','ferrari','r8','challenger'].map(id => TRAFFIC_CRUISE[id])).size, 7);
});

test('passing requires an open opposing lane and clear return lane', () => {
  const car = vehicle('golf', 0, 12), truck = vehicle('semi', 40, 11.5);
  const ahead = vehicle('audi', 600, 23, -1);
  assert.equal(canOvertakeTruck(car, truck, [car, truck, ahead], null), false, 'oncoming car is too close for the complete pass');
  ahead.s = 3000;
  assert.equal(canOvertakeTruck(car, truck, [car, truck, ahead], null), true);
  assert.equal(canOvertakeTruck(car, truck, [car, truck, ahead, vehicle('audi', 100, 20)], null), false, 'return lane is occupied');
  assert.equal(canOvertakeTruck(car, truck, [car, truck, ahead], {s: -40, maxSpeed: 60}), false, 'player can catch the maneuver');
  assert.equal(canOvertakeTruck(truck, car, [car, truck], null), false, 'trucks do not attempt passes');
  startOvertake(car, truck);
  assert.equal(canOvertakeTruck(vehicle('r8', -80, 15), truck, [car, truck], null), false, 'another maneuver already reserves the lane');
});

test('a car completes a safe pass while the queue stays behind the truck', () => {
  const truck = vehicle('semi', 40, 11.5), car = vehicle('r8', 0, 11.5);
  const follower = vehicle('golf', -35, 15), traffic = [truck, car, follower];
  assert.equal(canOvertakeTruck(car, truck, traffic, null), true);
  startOvertake(car, truck); let reachedOpposite = false, returned = false;
  for (let i = 0; i < 1500; i++) {
    const dt = .05;
    for (const c of traffic) {
      if (c.ai.pass) stepOvertake(c, dt);
      if (c === car && c.offset < -2) reachedOpposite = true;
      const leader = findLeader(c, traffic);
      stepTraffic(c, leader, dt);
      if (leader) c.speed = Math.min(c.speed, Math.max(0, (leader.s - c.s - (leader.length+c.length)/2 - 2)/dt));
      c.s += c.speed * dt;
    }
    assert.ok(follower.s < truck.s, 'following car remains in queue');
    if (reachedOpposite && !car.ai.pass) { returned = true; break; }
  }
  assert.ok(reachedOpposite && returned, 'car moves out, passes, and returns');
  assert.ok(car.s > truck.s + (car.length + truck.length)/2);
  assert.equal(car.offset, 2.1);
});

test('forecast keeps an oncoming vehicle clear through a full pass in low grip', () => {
  for (const carId of ['golf', 'r8']) for (const truckId of ['semi', 'kraz']) {
    const truck = vehicle(truckId, 40, TRAFFIC_CRUISE[truckId]);
    const car = vehicle(carId, 0, truck.speed);
    const oncoming = vehicle('ferrari', 2200, 26, -1);
    const traffic = [truck, car, oncoming];
    assert.equal(canOvertakeTruck(car, truck, traffic, null), true);
    startOvertake(car, truck);
    let returned = false;
    for (let i = 0; i < 4000; i++) {
      const dt = .05;
      if (car.ai.pass) stepOvertake(car, dt);
      const leader = findLeader(car, traffic);
      stepTraffic(car, leader, dt, .55);
      if (leader) car.speed = Math.min(car.speed, Math.max(0, (leader.s-car.s-(leader.length+car.length)/2-2)/dt));
      car.s += car.speed * dt; truck.s += truck.speed * dt; oncoming.s -= oncoming.speed * dt;
      if (car.offset < 0) {
        assert.ok(oncoming.s - car.s > (oncoming.length + car.length) / 2 + 10, `${carId}/${truckId} met oncoming traffic`);
      }
      if (!car.ai.pass) { returned = true; break; }
    }
    assert.ok(returned, `${carId}/${truckId} never returned to its lane`);
  }
});
