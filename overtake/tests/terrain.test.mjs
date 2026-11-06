import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainOffset } from '../src/world/terrain.mjs';
test('rolling terrain is stable, continuous and stays below the highway', () => {
  for (let s=-100;s<5000;s+=17) {
    for (const x of [-8,-3,0,3,8]) assert.equal(terrainOffset(s,x),0);
    for (const x of [-150,-50,-12,12,50,150]) {
      assert.ok(terrainOffset(s,x)>=0);
      assert.ok(Math.abs(terrainOffset(s+1,x)-terrainOffset(s,x))<.2);
      assert.ok(Math.abs(terrainOffset(s,x+1)-terrainOffset(s,x))<.8);
    }
  }
});
