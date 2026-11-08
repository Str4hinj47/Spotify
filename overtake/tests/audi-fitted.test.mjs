import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCustomization,sanitizeCustomizations,AUDI_PART_OPTIONS} from '../src/customization.mjs';
import {emptyProgression,buyTune,tunePrice} from '../src/progression.mjs';
test('Audi options are preserved only on their own car',()=>{
 const cfg={front:'audi-splitter',rear:'audi-diffuser',skirts:'audi-wide'};
 assert.equal(sanitizeCustomization(cfg).front,cfg.front);
 const out=sanitizeCustomizations({audi:cfg,mercedes:cfg,golf:cfg},['audi','mercedes','golf']);
 assert.equal(out.audi.front,cfg.front);assert.equal(out.audi.rear,cfg.rear);assert.equal(out.audi.skirts,cfg.skirts);
 assert.equal(out.mercedes.front,'stock');assert.equal(out.golf.rear,'stock');assert.equal(AUDI_PART_OPTIONS.front.length,2);
});
test('Audi fitted options can be purchased and reused',()=>{
 let p={...emptyProgression(),owned:['golf','audi'],gems:200};
 for(const [key,value] of [['front','audi-aero'],['rear','audi-clean'],['skirts','audi-wide']]) {assert.ok(tunePrice(key,value)>0);const first=buyTune(p,'audi',key,value);assert.equal(first.ok,true);p=first.progress;const again=buyTune(p,'audi',key,value);assert.equal(again.progress.gems,p.gems);}
});
