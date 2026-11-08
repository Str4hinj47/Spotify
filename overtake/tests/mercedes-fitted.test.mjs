import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCustomization,sanitizeCustomizations,MERCEDES_PART_OPTIONS} from '../src/customization.mjs';
import {emptyProgression,buyTune,tunePrice} from '../src/progression.mjs';

test('Mercedes options remain scoped to their car and retain existing options',()=>{
 const config={front:'mercedes-splitter',rear:'mercedes-diffuser',skirts:'mercedes-wide'};
 assert.equal(sanitizeCustomization(config).front,config.front);
 const saved=sanitizeCustomizations({mercedes:config,golf:config,audi:{front:'sport'}},['mercedes','golf','audi']);
 assert.equal(saved.mercedes.rear,config.rear);assert.equal(saved.mercedes.skirts,config.skirts);
 assert.equal(saved.golf.front,'stock');assert.equal(saved.golf.rear,'stock');assert.equal(saved.golf.skirts,'stock');assert.equal(saved.audi.front,'sport');
 assert.equal(MERCEDES_PART_OPTIONS.front.length,2);
});
test('Mercedes new parts are priced, purchasable and reusable',()=>{
 let p={...emptyProgression(),owned:['golf','mercedes'],gems:200};
 for(const [key,value] of [['front','mercedes-aero'],['rear','mercedes-clean'],['skirts','mercedes-wide']]) {
  assert.ok(tunePrice(key,value)>0);const buy=buyTune(p,'mercedes',key,value);assert.equal(buy.ok,true);p=buy.progress;
  const again=buyTune(p,'mercedes',key,value);assert.equal(again.ok,true);assert.equal(again.progress.gems,p.gems);
 }
});
