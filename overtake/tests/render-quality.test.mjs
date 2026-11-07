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

test('presets trade resolution for GPU cost and handle unknown preferences', () => {
  const r = q => vehiclePixelRatio(1,1920,1080,false,Infinity,q);
  assert.equal(r('performance'),0.8);
  assert.equal(r('balanced'),1);
  assert.equal(r('sharp'),1.25);
  assert.equal(r('invalid'),r('sharp'));
  assert.equal(vehiclePixelRatio(2,390,844,true,Infinity,'balanced'),1.5);
});
test('hard budget and GPU size cap apply to every preset even at high DPI', () => {
  assert.ok(vehiclePixelRatio(3,100000,1000,false,1024,'sharp') <= 1024/100000);
  for (const quality of ['performance','balanced','sharp']) {
    const width=3840, height=2160;
    const r=vehiclePixelRatio(3,width,height,false,Infinity,quality);
    assert.ok(width*height*r*r <= 8_294_400 + 0.001);
    assert.ok(vehiclePixelRatio(3,2000,1000,false,1024,quality) <= 1024/2000);
  }
});
