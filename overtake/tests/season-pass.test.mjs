import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProgression,awardQuestXp,buyTune,upgradeLevels,sanitizeProgression} from '../src/progression.mjs';
import {seasonPeriod,currentSeasonPass,SEASON_TIERS} from '../src/season-pass.mjs';
import {sanitizeCustomization} from '../src/customization.mjs';
import {captureSnapshot,restoreSnapshot} from '../src/cloud-save.mjs';
const now=Date.UTC(2026,10,1), next=Date.UTC(2027,0,1);
test('quest XP unlocks car-specific rewards automatically, without buying unowned cars',()=>{
 let p=emptyProgression(),a=awardQuestXp(p,'endless',false,now);assert.equal(a.gained,100);assert.deepEqual(a.progress.tunes.golf,['front:street']);
 p=a.progress;for(let i=0;i<7;i++)p=awardQuestXp(p,'endless',false,now).progress;
 assert.equal(p.seasonPass.xp,800);assert.ok(p.tunes.golf.includes('underglow:on'));assert.equal(upgradeLevels(p,'golf').tires,1);
 assert.equal(upgradeLevels(p,'skyline').engine,1);assert.ok(p.tunes['bmw-m3'].includes('hood:sport'));assert.ok(p.tunes['aventador-game'].includes('roof:track'));
 assert.equal(p.owned.includes('skyline'),false);assert.equal(buyTune(p,'golf','front','street').progress.gems,p.gems);
 assert.equal(awardQuestXp(p,'endless',false,now).gained,0);
});
test('seasonal quests earn 200 XP, dev runs never earn XP, rollover preserves earned rewards',()=>{
 let p=emptyProgression(),a=awardQuestXp(p,'seasonal',false,now);assert.equal(a.gained,200);assert.equal(a.rewards.length,2);
 let dev=awardQuestXp(a.progress,'seasonal',true,now);assert.equal(dev.gained,0);assert.deepEqual(dev.progress,a.progress);
 assert.equal(awardQuestXp(a.progress,'ranked',false,now).gained,0);assert.equal(awardQuestXp(a.progress,'ghost',false,now).gained,0);
 let reset=awardQuestXp(a.progress,'endless',false,next).progress;assert.equal(reset.seasonPass.xp,100);assert.equal(reset.seasonPass.period,seasonPeriod(next));assert.equal(upgradeLevels(reset,'golf').tires,1);assert.ok(reset.tunes.golf.includes('front:street'));
 assert.equal(currentSeasonPass(a.progress.seasonPass,next).xp,0);assert.equal(SEASON_TIERS.length,8);
});
test('hood and roof options sanitize and old saves default to factory',()=>{
 assert.equal(sanitizeCustomization({}).hood,'stock');assert.equal(sanitizeCustomization({hood:'bad',roof:'flame'}).roof,'stock');
 let c=sanitizeCustomization({hood:'sport',roof:'track',hoodFinish:'carbon',roofFinish:'carbon'});assert.equal(c.hood,'sport');assert.equal(c.roof,'track');assert.equal(c.hoodFinish,'carbon');
 assert.equal(sanitizeProgression({version:2,money:100,owned:['golf']}).coins,100);
});
test('backup and restore include the pass and its rewards',()=>{
 class Store{data=new Map();getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
 let s=new Store(),p=awardQuestXp(emptyProgression(),'seasonal',false,now).progress;s.setItem('overtake-progression-v2',JSON.stringify(p));
 let snap=captureSnapshot(s);let target=new Store();restoreSnapshot(target,snap);let restored=JSON.parse(target.getItem('overtake-progression-v2'));
 assert.deepEqual(restored.seasonPass,p.seasonPass);assert.deepEqual(restored.tunes,p.tunes);
});
