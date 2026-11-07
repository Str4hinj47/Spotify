import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAR_CONTENT, ACTIVE_CAR_CONTENT } from '../src/content/cars.mjs';
import { emptyProgression, buyCar, canDriveCar, sanitizeProgression } from '../src/progression.mjs';
import { trafficCruise } from '../src/traffic-ai.mjs';
import { ENGINE_PROFILES, firingAngles } from '../src/vendor/engine-sim/profiles.js';
import { builtinPreset, normalisePreset } from '../src/vendor/engine-sim/presets.js';

test('retired models are unavailable and traffic-only models stay non-playable', () => {
 for(const id of ['bugatti','aventador']) { assert.ok(CAR_CONTENT.some(c=>c.id===id)); assert.ok(!ACTIVE_CAR_CONTENT.some(c=>c.id===id)); assert.equal(canDriveCar({...emptyProgression(),dev:true},id),false); assert.equal(buyCar({...emptyProgression(),credits:1e6},id).ok,false); }
 for(const id of ['camry','mercedes-560','range-rover']) {
  assert.ok(!CAR_CONTENT.some(c=>c.id===id)); assert.equal(canDriveCar(emptyProgression(),id),false);
  assert.equal(buyCar({...emptyProgression(),credits:1e6},id).ok,false); assert.ok(trafficCruise(id,()=>.5)>0);
 }
 const old=sanitizeProgression({version:2,money:1000,owned:['golf','r8'],upgrades:{r8:{engine:2}}});
 assert.ok(canDriveCar(old,'r8')); assert.equal(old.upgrades.r8.engine,2); assert.equal(canDriveCar(old,'bugatti'),false);
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/manifest.json',import.meta.url)));
 for(const id of ['mercedes-560','range-rover']) {
  assert.equal(manifest[id].file,`models/${id}.glb`);
  assert.equal(fs.readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url)).toString('ascii',0,4),'glTF');
 }
});
test('Chiron uses a synthetic 16-cylinder preset with valid banks',()=>{
 const w=ENGINE_PROFILES.w16;assert.equal(w.cylinders,16);assert.equal(firingAngles(w).size,16);
 const preset=normalisePreset(builtinPreset('w16'));assert.equal(preset.engine.cylinders,16);assert.equal(preset.engine.banks.flat().length,16);
});
