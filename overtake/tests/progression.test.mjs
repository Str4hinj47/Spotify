import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgression, sanitizeProgression, payoutForScore, canDriveCar, earnedCar, awardProgress, buyCar, buyUpgrade, buyTune, effectiveUpgrades } from '../src/progression.mjs';
test('score payout increases per point in steps, with a cap', () => {
  assert.equal(payoutForScore(999),999); assert.equal(payoutForScore(1000),1250); assert.equal(payoutForScore(2000),3000); assert.equal(payoutForScore(10000),30000);
  assert.equal(payoutForScore(NaN),0);
});
test('buying cars and upgrades spends money once and is per-car', () => {
  let p=awardProgress(emptyProgression(),{score:5000}).progress; assert.equal(p.money,11250);
  assert.equal(buyCar(p,'ferrari').ok,false);
  p=buyCar(p,'mustang').progress; assert.equal(p.money,8250);assert.equal(earnedCar(p,'mustang'),true);assert.equal(buyCar(p,'mustang').ok,false);
  p=buyUpgrade(p,'mustang','engine').progress;assert.equal(p.money,7550);assert.equal(p.upgrades.mustang.engine,1);assert.equal(effectiveUpgrades(p,'golf').engine,0);
});
test('tunes cost once, stock is free, developer bypass grants no ownership', () => {
  let p=awardProgress(emptyProgression(),{score:1000}).progress;
  p=buyTune(p,'golf','front','street').progress;assert.equal(p.money,1000);
  p=buyTune(p,'golf','front','street').progress;assert.equal(p.money,1000);
  assert.equal(buyTune(p,'golf','exhaust','flame').ok,false);
  const dev={...p,dev:true};assert.equal(canDriveCar(dev,'ferrari'),true);assert.equal(earnedCar(dev,'ferrari'),false);
  const result=buyTune(dev,'ferrari','exhaust','flame');assert.equal(result.ok,true);assert.equal(result.progress.money,1000);assert.equal(result.progress.tunes.ferrari,undefined);
  assert.equal(effectiveUpgrades(dev,'golf').engine,3);assert.equal(effectiveUpgrades({...dev,dev:false},'golf').engine,0);
});
test('invalid or previous-version progression starts fresh',()=>{
  assert.deepEqual(sanitizeProgression({version:1,xp:1000,dev:true}),emptyProgression());
  assert.deepEqual(sanitizeProgression({version:2,money:Infinity,owned:['fake'],dev:'yes'}),emptyProgression());
});
