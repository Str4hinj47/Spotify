import test from 'node:test';
import assert from 'node:assert/strict';
import { vehiclePixelRatio } from '../src/render-quality.mjs';

test('desktop receives capped supersampling without reducing the old native resolution', () => {
  assert.equal(vehiclePixelRatio(1,1920,1080,false),1.25);
  assert.equal(vehiclePixelRatio(2,1280,720,false),2);
  assert.equal(vehiclePixelRatio(1,3840,2160,false),1);
  assert.ok(vehiclePixelRatio(1,2560,1440,false)>1);
});
test('mobile and hardware limits bound resolution', () => {
  assert.equal(vehiclePixelRatio(3,390,844,true),1.75);
  assert.equal(vehiclePixelRatio(1,640,480,false),1);
  assert.equal(vehiclePixelRatio(2,1600,800,false,2048),1.28);
  assert.equal(vehiclePixelRatio(NaN,800,600,false),1.25);
});
