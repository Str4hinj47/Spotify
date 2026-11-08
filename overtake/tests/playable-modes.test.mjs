import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYABLE_RUN_MODES,playableRunMode,RUN_MODES} from '../src/run.mjs';
import {sanitizeRecords} from '../src/records.mjs';

test('only the requested highway modes and circuit racing can be selected',()=>{
 assert.deepEqual(PLAYABLE_RUN_MODES,['endless','rush','trial','circuit','ranked']);
 for(const mode of PLAYABLE_RUN_MODES)assert.equal(playableRunMode(mode),mode);
 for(const mode of ['near','daily','weekly','seasonal','convoy','ghost','checkpoint','precision','speed','other',null])assert.equal(playableRunMode(mode),'endless');
 assert.equal(RUN_MODES.trial.label,'Time Attack');
});
test('retired highway event history remains readable in old saves',()=>{
 const records=sanitizeRecords({modes:{daily:{bestScore:4000,runs:4},speed:{bestScore:3000,runs:3},trial:{bestTime:42,runs:1}}});
 assert.equal(records.modes.daily.bestScore,4000);assert.equal(records.modes.speed.runs,3);assert.equal(records.modes.trial.bestTime,42);
});
