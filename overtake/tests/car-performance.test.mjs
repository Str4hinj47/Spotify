import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_CONTENT } from '../src/content/cars.mjs';
import { vehicleParameters, performanceStats } from '../src/car-performance.mjs';
import { createVehicleState, stepVehicle } from '../src/physics.mjs';

const stock={engine:0,tires:0,brakes:0};
test('all cars show finite, game-scaled performance figures', () => {
  for(const spec of CAR_CONTENT) {
    const s=performanceStats(spec,stock,'standard');
    assert.ok(Number.isFinite(s.topSpeed) && s.topSpeed>100/3.6 && s.topSpeed<=spec.maxSpeed, spec.id);
    assert.ok(s.sprint>0 && s.sprint<120, spec.id);
    assert.ok(s.brakingDistance>0 && s.brakingDistance<100, spec.id);
    assert.equal(s.grip,spec.physics.grip); assert.equal(s.bonus,spec.bonus);
  }
});
test('upgrades and tire width reflect the same parameters used by driving', () => {
  const spec=CAR_CONTENT[0], base=performanceStats(spec,stock,'standard');
  const engine=performanceStats(spec,{...stock,engine:3},'standard');
  const brakes=performanceStats(spec,{...stock,brakes:3},'standard');
  const tires=performanceStats(spec,{...stock,tires:3},'standard');
  const narrow=performanceStats(spec,stock,'narrow'), wide=performanceStats(spec,stock,'wide');
  assert.ok(engine.topSpeed>base.topSpeed && engine.sprint<base.sprint);
  assert.ok(brakes.brakingDistance<base.brakingDistance); assert.ok(tires.grip>base.grip);
  assert.ok(wide.grip>base.grip && narrow.grip<base.grip && wide.sprint>base.sprint && narrow.sprint<base.sprint);
  assert.equal(vehicleParameters(spec,stock,'wide',.8).surfaceGrip,.8);
});
test('reported acceleration and braking match independently stepped physics', () => {
  const spec=CAR_CONTENT[0], s=performanceStats(spec,stock,'standard'), p=vehicleParameters(spec,stock,'standard');
  const dt=1/120, target=100/3.6, car=createVehicleState();
  const input={throttle:true,brake:false,left:false,right:false,handbrake:false};
  let elapsed=0; while(car.speed<target && elapsed<120) {stepVehicle(car,input,p,dt);elapsed+=dt;}
  assert.ok(Math.abs(s.sprint-elapsed)<=dt);
  const stopped=createVehicleState();stopped.speed=target;input.throttle=false;input.brake=true;
  while(stopped.speed>0) stepVehicle(stopped,input,p,dt);
  assert.equal(s.brakingDistance,stopped.s);
});
test('unreachable 100 km/h is represented without inventing a time', () => {
  const slow={...CAR_CONTENT[0],maxSpeed:20};
  assert.equal(performanceStats(slow,stock,'standard').sprint,null);
});

test('traction-limited terminal speed agrees with a long physics run',()=>{
 const spec={...CAR_CONTENT[0],physics:{...CAR_CONTENT[0].physics,grip:.05}};
 const p=vehicleParameters(spec,stock,'standard'),expected=performanceStats(spec,stock,'standard').topSpeed;
 const car=createVehicleState(),controls={throttle:true,brake:false,left:false,right:false,handbrake:false};
 for(let i=0;i<40000;i++)stepVehicle(car,controls,p,.05);
 assert.ok(Math.abs(car.speed-expected)<.02,`${car.speed} vs ${expected}`);
});
