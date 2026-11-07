import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_CAR_CONTENT, CAR_CONTENT } from '../src/content/cars.mjs';
import { emptyProgression, sanitizeProgression, canDriveCar, buyCar } from '../src/progression.mjs';
import { normalizeSnapshot } from '../src/cloud-save.mjs';
import { emptyRecords, sanitizeRecords } from '../src/records.mjs';
import { SEASON_TIERS, PREMIUM_TIERS } from '../src/season-pass.mjs';

test('retirement keeps the preferred Aventador, and never offers either removed vehicle', () => {
  const ids = ACTIVE_CAR_CONTENT.map(c=>c.id);
  assert.equal(ids.length,10); assert.ok(ids.includes('aventador-game'));
  for (const id of ['aventador','bugatti']) {
    assert.ok(CAR_CONTENT.some(c=>c.id===id)); assert.ok(!ids.includes(id));
    assert.equal(canDriveCar({...emptyProgression(),dev:true},id),false);
    assert.equal(buyCar({...emptyProgression(),credits:1000000},id).ok,false);
    const records=sanitizeRecords({modes:{endless:{recent:[{car:id,score:100}]}}});
    assert.equal(records.modes.endless.recent[0].car,id);
  }
  for(const reward of [...SEASON_TIERS,...PREMIUM_TIERS])assert.ok(ids.includes(reward.car));
});

test('legacy purchases migrate without erasing history or repeatedly refunding', () => {
  const raw={...emptyProgression(),credits:500,owned:['golf','aventador','bugatti'],upgrades:{aventador:{engine:2,tires:1,brakes:0},bugatti:{engine:3}},tunes:{aventador:['front:track','roof:track'],bugatti:['hood:sport']}};
  const p=sanitizeProgression(raw);
  assert.equal(p.credits,55500);assert.equal(p.retiredChironRefunded,true);
  assert.ok(p.owned.includes('aventador-game'));assert.equal(canDriveCar(p,'aventador-game'),true);
  assert.equal(p.upgrades['aventador-game'].engine,2);assert.ok(p.tunes['aventador-game'].includes('front:track'));
  assert.equal(p.upgrades.bugatti.engine,3);assert.ok(p.tunes.bugatti.includes('hood:sport'));
  assert.deepEqual(sanitizeProgression(p),p);
});

test('older snapshots preserve retired car data and transfer Aventador cosmetics', () => {
  const s=normalizeSnapshot({schema:1,contentRevision:8,progression:{...emptyProgression(),owned:['golf','aventador']},
    paints:{aventador:'#ab3456',bugatti:'#123456'},customizations:{aventador:{hood:'track'},bugatti:{roof:'sport'}},
    selectedCar:'aventador',records:emptyRecords()});
  assert.equal(s.selectedCar,'aventador-game');assert.equal(s.paints['aventador-game'],'#ab3456');
  assert.equal(s.customizations['aventador-game'].hood,'track');assert.equal(s.paints.bugatti,'#123456');assert.equal(s.customizations.bugatti.roof,'sport');
});
