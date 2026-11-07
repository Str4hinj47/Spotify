import test from 'node:test';
import assert from 'node:assert/strict';
import {CAR_CONTENT,ACTIVE_CAR_CONTENT} from '../src/content/cars.mjs';
import {emptyProgression,sanitizeProgression,buyCar,canDriveCar,missingCarPrerequisite,CAR_PRICES} from '../src/progression.mjs';
import {captureSnapshot,restoreSnapshot} from '../src/cloud-save.mjs';
const order=['golf','challenger','skyline','mustang','bmw-m3','audi','mercedes','r8','ferrari','aventador-game'];
test('performance rarity order, scaled driving specs and starter stay consistent',()=>{
 assert.deepEqual(ACTIVE_CAR_CONTENT.map(c=>c.id),order);assert.deepEqual(emptyProgression().owned,['golf']);assert.equal(CAR_PRICES.golf,0);assert.ok(!CAR_CONTENT.some(c=>c.id==='camry'));
 for(let i=1;i<ACTIVE_CAR_CONTENT.length;i++) {let a=ACTIVE_CAR_CONTENT[i-1],b=ACTIVE_CAR_CONTENT[i];assert.ok(a.unlockTier<=b.unlockTier);assert.ok(a.price<=b.price);assert.ok(a.maxSpeed<=b.maxSpeed);assert.ok(a.accel<=b.accel);}
});
test('credits unlock one lower tier at a time; retired cars are unavailable',()=>{
 let p={...emptyProgression(),credits:1_000_000,coins:123,gems:456};
 for(const id of order.slice(1,9)) {
  let index=order.indexOf(id), later=order[index+1];assert.equal(missingCarPrerequisite(p,later),id);assert.equal(buyCar(p,later).ok,false);
  const before=p.credits,cost=CAR_PRICES[id],result=buyCar(p,id);assert.ok(result.ok);p=result.progress;assert.equal(p.credits,before-cost);assert.equal(p.coins,123);assert.equal(p.gems,456);
 }
 assert.ok(buyCar(p,'aventador-game').ok);
 for(const id of ['aventador','bugatti']) {assert.equal(buyCar(p,id).ok,false);assert.equal(canDriveCar({...p,dev:true},id),false);}
 assert.equal(buyCar({...p,credits:0},'aventador').ok,false);assert.equal(buyCar({...emptyProgression(),dev:true,credits:1_000_000},'ferrari').ok,false);
 assert.equal(buyCar(p,'camry').ok,false);assert.equal(canDriveCar(p,'camry'),false);
});
test('legacy gap preserves owned cars and unlocks, but blocks new tier skips',()=>{
 const raw={version:2,money:50000,owned:['golf','r8'],upgrades:{r8:{engine:2}},tunes:{r8:['hood:track']}};
 let p=sanitizeProgression(raw);assert.ok(canDriveCar(p,'r8'));assert.equal(p.upgrades.r8.engine,2);assert.ok(p.tunes.r8.includes('hood:track'));assert.equal(missingCarPrerequisite(p,'ferrari'),'challenger');assert.equal(buyCar(p,'ferrari').ok,false);
 p=buyCar(p,'challenger').progress;assert.equal(missingCarPrerequisite(p,'ferrari'),'skyline');assert.ok(canDriveCar(p,'r8'));
 const storage=()=>{let m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
 const a=storage(),b=storage();a.setItem('overtake-progression-v2',JSON.stringify(p));restoreSnapshot(b,captureSnapshot(a));let restored=JSON.parse(b.getItem('overtake-progression-v2'));assert.deepEqual(restored,p);assert.ok(canDriveCar(restored,'r8'));
});
