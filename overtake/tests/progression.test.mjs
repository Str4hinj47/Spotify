import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgression, sanitizeProgression, payoutForScore, canDriveCar, earnedCar, awardProgress, buyCar, buyUpgrade, buyTune, effectiveUpgrades } from '../src/progression.mjs';
test('score payout increases per point in steps, with a cap', () => {
  assert.equal(payoutForScore(999),999); assert.equal(payoutForScore(1000),1250); assert.equal(payoutForScore(2000),3000); assert.equal(payoutForScore(10000),30000);
  assert.equal(payoutForScore(NaN),0);
});
test('cars and upgrades spend independent earned balances', () => {
  let p=awardProgress(emptyProgression(),{score:5000}).progress; assert.equal(p.coins,11250); assert.equal(p.credits,11250); assert.equal(p.gems,0);
  assert.equal(buyCar(p,'ferrari').ok,false);
  p=buyCar(p,'challenger').progress; assert.equal(p.credits,8250);assert.equal(p.coins,11250);assert.equal(earnedCar(p,'challenger'),true);assert.equal(buyCar(p,'challenger').ok,false);
  p=buyUpgrade(p,'challenger','engine').progress;assert.equal(p.coins,10550);assert.equal(p.credits,8250);assert.equal(p.upgrades.challenger.engine,1);assert.equal(effectiveUpgrades(p,'golf').engine,0);
});
test('tunes spend only gems, once; dev bypass grants no ownership', () => {
  let p={...awardProgress(emptyProgression(),{score:1000}).progress,gems:10};
  p=buyTune(p,'golf','front','street').progress;assert.equal(p.gems,5);assert.equal(p.coins,1250);assert.equal(p.credits,1250);
  p=buyTune(p,'golf','front','street').progress;assert.equal(p.gems,5);
  assert.equal(buyTune(p,'golf','exhaust','flame').ok,false);
  const dev={...p,dev:true};assert.equal(canDriveCar(dev,'ferrari'),true);assert.equal(earnedCar(dev,'ferrari'),false);
  const result=buyTune(dev,'ferrari','exhaust','flame');assert.equal(result.ok,true);assert.equal(result.progress.gems,5);assert.equal(result.progress.tunes.ferrari,undefined);
  assert.equal(effectiveUpgrades(dev,'golf').engine,3);assert.equal(effectiveUpgrades({...dev,dev:false},'golf').engine,0);
});
test('invalid or previous-version progression starts fresh',()=>{
  assert.deepEqual(sanitizeProgression({version:1,xp:1000,dev:true}),emptyProgression());
  assert.deepEqual(sanitizeProgression({version:2,money:Infinity,owned:['fake'],dev:'yes'}),emptyProgression());
});
