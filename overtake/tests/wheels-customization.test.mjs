import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCustomization,DEFAULT_CUSTOMIZATION} from '../src/customization.mjs';
import {RIM_OPTIONS} from '../src/content/cosmetics.mjs';
import {tireWidthHandling} from '../src/tire-width.mjs';
import {createVehicleState,stepVehicle} from '../src/physics.mjs';

test('wheel configuration is backward-compatible and sanitizes untrusted saves',()=>{
 assert.deepEqual(sanitizeCustomization({}).rim,'stock');
 assert.deepEqual(sanitizeCustomization({}).tireWidth,'standard');
 for(const rim of RIM_OPTIONS) assert.equal(sanitizeCustomization({rim}).rim,rim);
 assert.equal(sanitizeCustomization({rim:'rim-99',rimColor:'oops',tireWidth:'huge'}).rim,'stock');
 assert.equal(sanitizeCustomization({rimColor:'oops'}).rimColor,DEFAULT_CUSTOMIZATION.rimColor);
 assert.equal(sanitizeCustomization({rim:'rim-4',rimColor:'#FFAA22',tireWidth:'wide'}).tireWidth,'wide');
});
test('tire width changes actual simulated acceleration, grip and steering',()=>{
 const normal=tireWidthHandling('standard'),narrow=tireWidthHandling('narrow'),wide=tireWidthHandling('wide');
 assert.deepEqual(normal,{grip:1,accel:1,steer:1});
 assert.ok(narrow.grip<normal.grip && narrow.steer>normal.steer && wide.grip>normal.grip && wide.steer<normal.steer && wide.accel<normal.accel);
 const simulate=width=>{let v=createVehicleState();v.speed=30;let t=tireWidthHandling(width);for(let i=0;i<120;i++)stepVehicle(v,{throttle:true,brake:false,left:true,right:false,handbrake:false},{grip:t.grip,accel:8*t.accel,steerResponse:7.5*t.steer,maxSpeed:60},1/120);return v;};
 const a=simulate('narrow'),b=simulate('wide');assert.notEqual(a.yawRate,b.yawRate);assert.notEqual(a.speed,b.speed);
});
