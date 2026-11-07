import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_CONTENT } from '../src/content/cars.mjs';
import { LIVERY_OPTIONS } from '../src/content/cosmetics.mjs';
import { CONTENT_REVISION } from '../src/content/version.mjs';
import { validateContent } from '../tools/validate-content.mjs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { CAR_PRICES, buyCar, buyTune, emptyProgression, sanitizeProgression, tunePrice } from '../src/progression.mjs';
import { sanitizeCustomization } from '../src/customization.mjs';
import { sanitizeRecords } from '../src/records.mjs';
import { TRAFFIC_CRUISE } from '../src/traffic-ai.mjs';
import { captureSnapshot, restoreSnapshot } from '../src/cloud-save.mjs';

const storage = (initial={}) => {const map = new Map(Object.entries(initial)); return { map, getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k) };};

test('shipped content and model assets validate', () => assert.deepEqual(validateContent(), []));
test('every catalog model is readable, paintable and has tire material', async () => {
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
 for(const car of CAR_CONTENT) {
  const doc=await io.read(new URL(`../public/models/${car.id}.glb`,import.meta.url).pathname), root=doc.getRoot();
  assert.ok(root.listMeshes().length>0,`${car.id}: missing geometry`);
  for(const prefix of ['paint__','tire__']) assert.ok(root.listMaterials().some(m=>m.getName().startsWith(prefix)),`${car.id}: missing ${prefix} material`);
 }
});
test('validator catches content collisions, missing assets, invalid prices and unsupported styles', () => {
 const car={...CAR_CONTENT[0],id:'season-car',price:-1};
 const errors=validateContent({cars:[...CAR_CONTENT,car,CAR_CONTENT[0]],liveries:[...LIVERY_OPTIONS,{...LIVERY_OPTIONS[1],id:'future',pattern:'missing'}]});
 assert.ok(errors.some(e=>e.includes('duplicate ID')));assert.ok(errors.some(e=>e.includes('invalid price')));assert.ok(errors.some(e=>e.includes('missing models/season-car.glb')));assert.ok(errors.some(e=>e.includes('unsupported renderer pattern')));
});
test('released IDs cannot disappear or change livery patterns unnoticed', () => {
 const errors=validateContent({cars:CAR_CONTENT.filter(c=>c.id!=='audi'),liveries:LIVERY_OPTIONS.map(item=>item.id==='sunset-stripe'?{...item,pattern:'race'}:item)});
 assert.ok(errors.some(e=>e.includes('Released car audi is missing')));assert.ok(errors.some(e=>e.includes('Released livery sunset-stripe is missing or changed pattern')));
});
test('catalog drives purchasing, traffic and saved run car IDs', () => {
 for(const car of CAR_CONTENT) {
  assert.equal(CAR_PRICES[car.id],car.price);assert.equal(TRAFFIC_CRUISE[car.id],car.trafficCruise);
  const record=sanitizeRecords({modes:{endless:{recent:[{car:car.id,score:1}]}}});assert.equal(record.modes.endless.recent[0].car,car.id);
  if(car.id!=='golf') {const result=buyCar({...emptyProgression(),money:1_000_000_000},car.id);assert.ok(result.ok);assert.ok(sanitizeProgression(result.progress).owned.includes(car.id));}
 }
});
test('livery variants retain their ID, price, ownership and customization through backup', () => {
 for(const item of LIVERY_OPTIONS) {
  assert.equal(sanitizeCustomization({livery:item.id}).livery,item.id);assert.equal(tunePrice('livery',item.id),item.price);
  const result=buyTune({...emptyProgression(),money:1_000_000},'golf','livery',item.id);assert.ok(result.ok);assert.equal(result.progress.money,1_000_000-item.price);
  if(item.price) {const p=sanitizeProgression(result.progress);assert.ok(p.tunes.golf.includes(`livery:${item.id}`));assert.equal(buyTune(p,'golf','livery',item.id).progress.money,p.money);}
 }
 const p=buyTune({...emptyProgression(),money:1000},'golf','livery','sunset-stripe').progress;
 const src=storage({'overtake-progression-v2':JSON.stringify(p),'overtake-customization-v1':JSON.stringify({golf:{livery:'sunset-stripe',liveryColor:'#ff7a1a'}})}), dst=storage();
 const snap=captureSnapshot(src);restoreSnapshot(dst,snap);assert.equal(JSON.parse(dst.getItem('overtake-customization-v1')).golf.livery,'sunset-stripe');assert.ok(JSON.parse(dst.getItem('overtake-progression-v2')).tunes.golf.includes('livery:sunset-stripe'));
});
test('newer content snapshots are rejected without writes; older snapshots remain accepted', () => {
 const source=storage({'overtake-progression-v2':JSON.stringify(emptyProgression())}), dest=storage({'overtake-progression-v2':'unchanged'});
 const snap=captureSnapshot(source);assert.equal(snap.contentRevision,CONTENT_REVISION);
 assert.throws(()=>restoreSnapshot(dest,{...snap,contentRevision:CONTENT_REVISION+1}),/newer game version/);assert.equal(dest.getItem('overtake-progression-v2'),'unchanged');assert.equal(dest.map.size,1);
 const {contentRevision,...old}=snap;restoreSnapshot(dest,old);assert.equal(JSON.parse(dest.getItem('overtake-progression-v2')).owned[0],'golf');
});
