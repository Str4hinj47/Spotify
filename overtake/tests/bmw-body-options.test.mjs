import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCustomization,sanitizeCustomizations} from '../src/customization.mjs';
import {emptyProgression,buyTune,tunePrice} from '../src/progression.mjs';

test('BMW race panels are independent paid options, isolated to BMW and saved',()=>{
  const parts={front:'bmw-race-front',rear:'bmw-race-rear',hood:'bmw-race-hood'};
  assert.deepEqual(Object.fromEntries(Object.keys(parts).map(k=>[k,sanitizeCustomization(parts)[k]])),parts);
  const result=sanitizeCustomizations({'bmw-m3':parts,golf:parts},['bmw-m3','golf']);
  for(const [key,value] of Object.entries(parts)){assert.equal(result['bmw-m3'][key],value);assert.equal(result.golf[key],'stock');assert.ok(tunePrice(key,value)>0)}
  let p={...emptyProgression(),owned:['golf','bmw-m3'],gems:100};
  for(const [key,value] of Object.entries(parts)){const before=p.gems,b=buyTune(p,'bmw-m3',key,value);assert.equal(b.ok,true);p=b.progress;assert.equal(p.gems,before-tunePrice(key,value));assert.ok(p.tunes['bmw-m3'].includes(`${key}:${value}`));assert.equal(buyTune(p,'bmw-m3',key,value).progress.gems,p.gems)}
  const bad=buyTune({...p,gems:0,tunes:{}},'bmw-m3','hood',parts.hood);assert.equal(bad.ok,false);assert.equal(bad.progress.gems,0);
});
