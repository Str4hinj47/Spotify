import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAR_CONTENT } from '../src/content/cars.mjs';
import { emptyProgression, buyCar, canDriveCar, sanitizeProgression } from '../src/progression.mjs';
import { trafficCruise } from '../src/traffic-ai.mjs';
import { ENGINE_PROFILES, firingAngles } from '../src/vendor/engine-sim/profiles.js';
import { builtinPreset, normalisePreset } from '../src/vendor/engine-sim/presets.js';

test('Chiron is a persistent tier 11 playable car, traffic-only models are not', () => {
 const chiron=CAR_CONTENT.find(c=>c.id==='bugatti');
 assert.equal(chiron.unlockTier,11); assert.equal(chiron.price,55000); assert.equal(chiron.rarity,'Legendary');
 for(const id of ['camry','mercedes-560','range-rover']) {
  assert.ok(!CAR_CONTENT.some(c=>c.id===id)); assert.equal(canDriveCar(emptyProgression(),id),false);
  assert.equal(buyCar({...emptyProgression(),credits:1e6},id).ok,false); assert.ok(trafficCruise(id,()=>.5)>0);
 }
 const old=sanitizeProgression({version:2,money:1000,owned:['golf','r8'],upgrades:{r8:{engine:2}}});
 assert.ok(canDriveCar(old,'r8')); assert.equal(old.upgrades.r8.engine,2); assert.equal(canDriveCar(old,'bugatti'),false);
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/manifest.json',import.meta.url)));
 for(const id of ['bugatti','mercedes-560','range-rover']) {
  assert.equal(manifest[id].file,`models/${id}.glb`);
  assert.equal(fs.readFileSync(new URL(`../public/models/${id}.glb`,import.meta.url)).toString('ascii',0,4),'glTF');
 }
});
test('Chiron uses a synthetic 16-cylinder preset with valid banks',()=>{
 const w=ENGINE_PROFILES.w16;assert.equal(w.cylinders,16);assert.equal(firingAngles(w).size,16);
 const preset=normalisePreset(builtinPreset('w16'));assert.equal(preset.engine.cylinders,16);assert.equal(preset.engine.banks.flat().length,16);
});
