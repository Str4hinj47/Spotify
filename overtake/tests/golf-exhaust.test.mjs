import test from 'node:test';
import assert from 'node:assert/strict';
import { golfExhaustLayout } from '../src/golf-exhaust.mjs';
import { sanitizeCustomization } from '../src/customization.mjs';
import { buyTune,emptyProgression,tunePrice } from '../src/progression.mjs';

test('R32 rear consistently supplies two widely spaced pipes, even with factory exhaust', () => {
  for(const exhaust of ['stock','street','touring','sport','track','flame']) {
    const l=golfExhaustLayout(sanitizeCustomization({rear:'golf-r32',exhaust}));
    assert.deepEqual(l.centers,[-.48,.48]);assert.ok(l.radius>.05 && l.radius<.07);assert.equal(l.y,.29);
  }
  assert.deepEqual(golfExhaustLayout(sanitizeCustomization({rear:'golf-clean',exhaust:'stock'})).centers,[]);
  assert.equal(golfExhaustLayout(sanitizeCustomization({rear:'golf-clean',exhaust:'sport'})).centers.length,1);
});
test('new rear purchases charge once and retain owned tokens', () => {
  const initial={...emptyProgression(),gems:100};
  for(const rear of ['golf-r32','golf-clean']) {
    const price=tunePrice('rear',rear);assert.ok(price>0);
    const one=buyTune(initial,'golf','rear',rear);assert.equal(one.ok,true);assert.equal(one.progress.gems,100-price);
    const two=buyTune(one.progress,'golf','rear',rear);assert.equal(two.ok,true);assert.equal(two.progress.gems,100-price);
    assert.ok(two.progress.tunes.golf.includes(`rear:${rear}`));
  }
});

test('quad afterfire uses four distinct symmetric outlets regardless of rear bumper', () => {
 for(const rear of ['stock','street','track','golf-r32','golf-clean','golf-diffuser']) {
  const layout=golfExhaustLayout(sanitizeCustomization({rear,exhaust:'golf-quad-flame'}));
  assert.deepEqual(layout.centers,[-.57,-.47,.47,.57]);assert.ok(layout.radius>0);assert.equal(layout.y,.29);
 }
});
