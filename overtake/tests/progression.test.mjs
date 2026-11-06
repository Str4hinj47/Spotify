import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_XP, emptyProgression, sanitizeProgression, migrateProgression, xpForRun, earnedCar, canDriveCar, awardProgress, nextUnlock } from '../src/progression.mjs';

test('starter car, XP thresholds and ordered unlocks', () => {
  let p = emptyProgression();
  assert.equal(canDriveCar(p, 'golf'), true);
  assert.equal(canDriveCar(p, 'mustang'), false);
  assert.deepEqual(nextUnlock(p), ['mustang', 150]);
  assert.equal(xpForRun({score:1200,distance:1500}), 150);
  let award = awardProgress(p,{score:1200,distance:1500});p=award.progress;
  assert.equal(p.xp, 150);assert.deepEqual(award.unlocked,['mustang']);
  assert.equal(earnedCar(p,'mustang'),true);assert.deepEqual(nextUnlock(p),['challenger',300]);
  award=awardProgress(p,{score:16000,distance:0});
  assert.equal(award.progress.xp,1750);assert.equal(award.unlocked.length,5);assert.equal(nextUnlock(award.progress),null);
  assert.equal(Object.keys(CAR_XP).length,7);
});
test('developer toggle bypasses without granting or erasing ownership', () => {
  const p={...emptyProgression(), xp: 42, dev:true};
  assert.equal(canDriveCar(p,'ferrari'),true);assert.equal(earnedCar(p,'ferrari'),false);
  const next=awardProgress(p,{score:100,distance:0}).progress;
  assert.equal(next.xp,52);assert.equal(canDriveCar({...next,dev:false},'ferrari'),false);
  assert.equal(canDriveCar(p,'invalid'),false);
});
test('migrates once from existing bests and keeps the previously selected car', () => {
  const old={modes:{endless:{bestScore:1000,bestDistance:1000},rush:{bestScore:500,bestDistance:500}}};
  const p=migrateProgression(old,'r8');assert.equal(p.xp,180);assert.equal(p.legacyCar,'r8');assert.equal(earnedCar(p,'r8'),true);assert.equal(p.dev,false);
});
test('corrupt progress and score cannot cause negative, infinite or invalid XP', () => {
  assert.deepEqual(sanitizeProgression({xp:Infinity,dev:'true',legacyCar:'fake'}),emptyProgression());
  assert.equal(xpForRun({score:NaN,distance:-100}),0);
  assert.equal(xpForRun({score:1e30,distance:0}),1_000_000_000);
});
