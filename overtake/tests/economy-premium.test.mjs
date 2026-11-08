import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProgression,sanitizeProgression,awardProgress,awardQuestXp,buyCar,buyUpgrade,buyTune,buyPremiumPass} from '../src/progression.mjs';
import {PREMIUM_TIERS,PREMIUM_PASS_PRICE,currentSeasonPass} from '../src/season-pass.mjs';
import {captureSnapshot,restoreSnapshot} from '../src/cloud-save.mjs';
const now=Date.UTC(2026,10,1), next=Date.UTC(2027,0,1);
test('legacy money migrates once into all three wallets without losing existing ownership',()=>{
 const p=sanitizeProgression({version:2,money:1234,owned:['golf','mustang'],upgrades:{golf:{engine:2}},tunes:{golf:['livery:race']}});
 assert.deepEqual([p.coins,p.credits,p.gems],[1234,1234,25]);assert.equal(p.upgrades.golf.engine,2);assert.ok(p.owned.includes('mustang'));assert.ok(p.tunes.golf.includes('livery:race'));
 assert.deepEqual(sanitizeProgression(p),p);assert.equal(sanitizeProgression({...p,money:999999}).coins,1234);
});
test('only gameplay earns coins and credits; gems cannot buy power or cars',()=>{
 let p={...emptyProgression(),gems:999999};assert.equal(buyCar(p,'mustang').ok,false);assert.equal(buyUpgrade(p,'golf','engine').ok,false);
 p=awardProgress(p,{score:1000}).progress;assert.deepEqual([p.coins,p.credits,p.gems],[1250,1250,999999]);
 const t=buyTune(p,'golf','livery','race').progress;assert.equal(t.coins,p.coins);assert.equal(t.credits,p.credits);assert.equal(t.gems,p.gems-14);
});
test('premium costs earned gems, retroactively grants cosmetics, and never grants upgrades',()=>{
 let p=emptyProgression();for(let i=0;i<10;i++)p=awardQuestXp(p,'endless',false,now).progress;
 assert.equal(p.seasonPass.xp,800);assert.equal(p.gems,PREMIUM_PASS_PRICE);assert.ok(PREMIUM_TIERS.every(t=>t.type==='tune'));
 const before=structuredClone(p.upgrades), purchase=buyPremiumPass(p,now);p=purchase.progress;
 assert.equal(purchase.ok,true);assert.equal(p.gems,0);assert.equal(purchase.rewards.length,8);assert.deepEqual(p.upgrades,before);assert.ok(p.tunes.golf.includes('livery:race'));assert.ok(p.tunes.challenger.includes('hood:track'));
 assert.equal(buyPremiumPass(p,now).ok,false);assert.equal(awardQuestXp(p,'endless',false,now).gemsGained,5);
 const rolled=awardQuestXp(p,'endless',false,next).progress;assert.equal(rolled.seasonPass.premium,false);assert.equal(rolled.seasonPass.xp,100);assert.ok(rolled.tunes.challenger.includes('hood:track'));assert.equal(currentSeasonPass(p.seasonPass,next).premium,false);
});
test('premium and wallet survive snapshot restore; dev quests earn currency',()=>{
 let p={...emptyProgression(),gems:50};p=buyPremiumPass(p,now).progress;p=awardQuestXp(p,'seasonal',false,now).progress;
 const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
 const a=store(),b=store();a.setItem('overtake-progression-v2',JSON.stringify(p));restoreSnapshot(b,captureSnapshot(a));assert.deepEqual(JSON.parse(b.getItem('overtake-progression-v2')),p);
 assert.equal(awardQuestXp(p,'endless',true,now).gemsGained,5);assert.equal(awardQuestXp(p,'ranked',false,now).gemsGained,0);
});

test('driving distance pays even without score, score bonus remains additive',()=>{
 const p=emptyProgression();
 assert.deepEqual([awardProgress(p,{score:0,distance:1250}).coinsGained,awardProgress(p,{score:0,distance:1250}).creditsGained],[125,125]);
 assert.equal(awardProgress(p,{score:1000,distance:1000}).gain,1350);
 assert.equal(awardProgress(p,{score:0,distance:0}).gain,0);
});
