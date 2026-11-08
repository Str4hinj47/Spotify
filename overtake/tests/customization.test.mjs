import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_PARTS, DEFAULT_CUSTOMIZATION, sanitizeCustomization, sanitizeCustomizations } from '../src/customization.mjs';

test('customization defaults are independent and reject corrupt values', () => {
  const a=sanitizeCustomization(null), b=sanitizeCustomization({front:'invalid',rear:3,spoiler:'track',skirts:'street',exhaust:'stock',underglow:'true',glowColor:'bad'});
  assert.deepEqual(a,{...DEFAULT_CUSTOMIZATION});
  assert.equal(b.front,'stock'); assert.equal(b.rear,'stock'); assert.equal(b.spoiler,'track'); assert.equal(b.skirts,'street');
  assert.equal(b.underglow,false); assert.equal(b.glowColor,'#bbaadd'); // valid short hex
  a.front='track'; assert.equal(DEFAULT_CUSTOMIZATION.front,'stock');
});
test('per-car configurations retain valid options and arbitrary RGB colors', () => {
  const data=sanitizeCustomizations({golf:{front:'track',underglow:true,glowColor:'#a1b2c3'},audi:{rear:'street',glowColor:'oops'},unknown:{spoiler:'track'}},['golf','audi']);
  assert.deepEqual(Object.keys(data),['golf','audi']);
  assert.equal(data.golf.front,'track'); assert.equal(data.golf.underglow,true); assert.equal(data.golf.glowColor,'#a1b2c3');
  assert.equal(data.audi.rear,'street'); assert.equal(data.audi.glowColor,'#00ddff');
  for(const part of BODY_PARTS) assert.ok(['stock','street','track'].includes(data.golf[part]));
});

test('paint, livery, carbon finishes and afterfire validate independently', () => {
  const old = sanitizeCustomization({front:'street', underglow:true, glowColor:'#123456'});
  assert.equal(old.paintScheme,'single'); assert.equal(old.frontFinish,'standard');
  assert.equal(old.secondaryFinish,'paint'); assert.equal(old.livery,'none');
  const tuned=sanitizeCustomization({exhaust:'flame', front:'flame', frontFinish:'carbon', exhaustFinish:'carbon',
    paintScheme:'upper', secondaryFinish:'carbon', secondaryColor:'#abc', livery:'race', liveryColor:'#15ab43'});
  assert.equal(tuned.exhaust,'flame'); assert.equal(tuned.front,'stock');
  assert.equal(tuned.frontFinish,'carbon'); assert.equal(tuned.exhaustFinish,'carbon');
  assert.equal(tuned.paintScheme,'upper'); assert.equal(tuned.secondaryFinish,'carbon'); assert.equal(tuned.secondaryColor,'#aabbcc');
  assert.equal(tuned.livery,'race'); assert.equal(tuned.liveryColor,'#15ab43');
  const invalid=sanitizeCustomization({exhaust:'rocket',paintScheme:'bad',secondaryFinish:'unknown',rearFinish:'glass',livery:'licensed'});
  assert.equal(invalid.exhaust,'stock');assert.equal(invalid.paintScheme,'single');assert.equal(invalid.secondaryFinish,'paint');assert.equal(invalid.rearFinish,'standard');assert.equal(invalid.livery,'none');
});

test('touring and sport options persist independently for every part', () => {
  for (const variant of ['touring','sport']) {
    const config = Object.fromEntries(BODY_PARTS.map(part=>[part,variant]));
    const loaded = sanitizeCustomizations({golf:config}, ['golf']);
    for (const part of BODY_PARTS) assert.equal(loaded.golf[part],variant);
    assert.deepEqual(sanitizeCustomization(JSON.parse(JSON.stringify(loaded.golf))), loaded.golf);
  }
});

test('Golf full rear variants persist only in the Golf rear slot', () => {
  for (const rear of ['golf-r32','golf-clean']) {
    const config=sanitizeCustomization({rear,front:rear,skirts:rear,exhaust:rear});
    assert.equal(config.rear,rear);assert.equal(config.front,'stock');assert.equal(config.skirts,'stock');assert.equal(config.exhaust,'stock');
    const cars=sanitizeCustomizations({golf:config,audi:config},['golf','audi']);
    assert.equal(cars.golf.rear,rear);assert.equal(cars.audi.rear,'stock');
    assert.equal(sanitizeCustomization(JSON.parse(JSON.stringify(cars.golf))).rear,rear);
  }
});

test('Golf expansion options, flame color and sidewall profile survive saves without leaking to other cars', () => {
  const raw={front:'golf-wide',rear:'golf-diffuser',spoiler:'golf-wing',exhaust:'golf-quad-flame',hood:'golf-vented',roof:'golf-roof-scoop',headlights:'halo',mirrors:'sport',tireProfile:'thick',flameColor:'#123abc'};
  const saved=sanitizeCustomizations({golf:raw,audi:raw},['golf','audi']);
  for(const [k,v] of Object.entries(raw))assert.equal(saved.golf[k],v,k);
  for(const k of ['front','rear','spoiler','exhaust','hood','roof','headlights','mirrors'])assert.equal(saved.audi[k],'stock',k);
  assert.equal(saved.audi.tireProfile,'standard');assert.equal(saved.audi.flameColor,'#123abc');
  assert.equal(sanitizeCustomization({tireProfile:'bogus',flameColor:'bogus'}).tireProfile,'standard');
});

test('roof-only paint survives sanitizing without changing legacy schemes',()=>{
  assert.equal(sanitizeCustomization({paintScheme:'roof-only'}).paintScheme,'roof-only');
  assert.equal(sanitizeCustomization({paintScheme:'upper'}).paintScheme,'upper');
  assert.equal(sanitizeCustomization({paintScheme:'lower'}).paintScheme,'lower');
});

test('new Golf bodywork, independent exhaust flames and plate preference round-trip safely',()=>{
  const raw={front:'golf-splitter',skirts:'golf-superwide',exhaust:'touring',afterfire:true,removePlates:true,flameColor:'#abcdef'};
  const saved=sanitizeCustomizations({golf:raw,audi:raw},['golf','audi']);
  for(const [key,value] of Object.entries(raw)) assert.equal(saved.golf[key],value,key);
  assert.equal(saved.audi.front,'stock');assert.equal(saved.audi.skirts,'stock');assert.equal(saved.audi.afterfire,true);
  assert.equal(sanitizeCustomization({afterfire:'yes',removePlates:1}).afterfire,false);
  assert.equal(sanitizeCustomization({afterfire:'yes',removePlates:1}).removePlates,false);
  assert.equal(sanitizeCustomization({exhaust:'flame'}).exhaust,'flame');
});

test('Golf diffuser colors survive sanitization and cannot leak to other cars',()=>{
 const raw={golf:{rear:'golf-diffuser',rearDiffuserColor:'#CC4422'},audi:{rearDiffuserColor:'#cc4422'}};
 const value=sanitizeCustomizations(raw,['golf','audi']);
 assert.equal(value.golf.rearDiffuserColor,'#cc4422');assert.equal(value.audi.rearDiffuserColor,'');
 assert.equal(sanitizeCustomization({rearDiffuserColor:'bad color'}).rearDiffuserColor,'');
});

test('Golf taillight styles are validated and scoped',()=>{
 const c=sanitizeCustomizations({golf:{taillights:'led'},audi:{taillights:'smoked'}},['golf','audi']);
 assert.equal(c.golf.taillights,'led');assert.equal(c.audi.taillights,'stock');assert.equal(sanitizeCustomization({taillights:'invalid'}).taillights,'stock');
});

test('independent body-part colors sanitize and round-trip',()=>{
 const result=sanitizeCustomization({frontColor:'#f00',rearColor:'#112233',skirtsColor:'invalid',spoilerColor:'#000',hoodColor:'#abcdef',roofColor:'#987654'});
 assert.equal(result.frontColor,'#ff0000');assert.equal(result.rearColor,'#112233');assert.equal(result.skirtsColor,'');assert.equal(result.spoilerColor,'#000000');assert.equal(result.hoodColor,'#abcdef');assert.equal(result.roofColor,'#987654');
 assert.deepEqual(sanitizeCustomization(JSON.parse(JSON.stringify(result))),result);
});

test('Golf door colors persist independently and are scoped to the Golf',()=>{
 const result=sanitizeCustomizations({golf:{leftFrontDoorColor:'#f00',rightFrontDoorColor:'#0f0',leftRearDoorColor:'#00f',rightRearDoorColor:'#fff'},audi:{leftFrontDoorColor:'#f00'}},['golf','audi']);
 assert.equal(result.golf.leftFrontDoorColor,'#ff0000');assert.equal(result.golf.rightFrontDoorColor,'#00ff00');assert.equal(result.golf.leftRearDoorColor,'#0000ff');assert.equal(result.golf.rightRearDoorColor,'#ffffff');assert.equal(result.audi.leftFrontDoorColor,'');
});
