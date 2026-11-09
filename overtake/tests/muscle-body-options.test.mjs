import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCustomization,sanitizeCustomizations} from '../src/customization.mjs';
import {emptyProgression,buyTune,tunePrice} from '../src/progression.mjs';

test('Mustang and Challenger body options are independent, paid and isolated by car',()=>{
  const cars={mustang:{front:'mustang-heritage',rear:'mustang-valance',skirts:'mustang-rockers'},challenger:{front:'challenger-aero',rear:'challenger-diffuser',skirts:'challenger-wide'}};
  for(const [car,parts] of Object.entries(cars)) {
    const other=car==='mustang'?'challenger':'mustang';
    const saved=sanitizeCustomizations({[car]:parts,[other]:parts,golf:parts},[car,other,'golf']);
    let progress={...emptyProgression(),owned:['golf','mustang','challenger'],gems:200};
    for(const [part,value] of Object.entries(parts)) {
      assert.equal(sanitizeCustomization(parts)[part],value);
      assert.equal(saved[car][part],value);
      assert.equal(saved[other][part],'stock');assert.equal(saved.golf[part],'stock');
      const price=tunePrice(part,value);assert.ok(price>0);
      const bought=buyTune(progress,car,part,value);assert.equal(bought.ok,true);
      assert.equal(bought.progress.gems,progress.gems-price);progress=bought.progress;
      assert.ok(progress.tunes[car].includes(`${part}:${value}`));
      assert.equal(buyTune(progress,car,part,value).progress.gems,progress.gems);
      assert.equal(buyTune({...progress,gems:0,tunes:{}},car,part,value).ok,false);
    }
  }
});
