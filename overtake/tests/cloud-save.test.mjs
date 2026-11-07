import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSnapshot, normalizeSnapshot, restoreSnapshot, undoRestore, CLOUD_BACKUP_KEY} from '../src/cloud-save.mjs';
const makeStorage = (initial={}) => { const map = new Map(Object.entries(initial)); return { getItem:k=>map.get(k)??null, setItem:(k,v)=>map.set(k,String(v)), removeItem:k=>map.delete(k), map }; };
const progression = {version:2,money:1234,dev:true,owned:['golf','mustang'],upgrades:{},tunes:{}};
test('snapshot is limited to known game data and never transfers dev mode',()=>{
 const storage=makeStorage({'overtake-progression-v2':JSON.stringify(progression),'overtake-paints':JSON.stringify({golf:'#abc',bad:'#000'}),'overtake-car':'mustang','overtake-best':'123','auth-token':'secret'});
 const snapshot=captureSnapshot(storage);assert.equal(snapshot.progression.dev,false);assert.equal(snapshot.progression.money,1234);assert.equal(snapshot.records.modes.endless.bestScore,123);assert.deepEqual(snapshot.paints,{golf:'#aabbcc'});assert.ok(!JSON.stringify(snapshot).includes('secret'));
});
test('unsupported, oversized or invalid snapshots never change local data',()=>{
 const storage=makeStorage({'overtake-progression-v2':JSON.stringify(progression)});const snap=captureSnapshot(storage);const before=storage.getItem('overtake-progression-v2');
 assert.throws(()=>restoreSnapshot(storage,{...snap,schema:2}));assert.throws(()=>restoreSnapshot(storage,{...snap, records:{...snap.records,modes:{endless:{bestScore:'Infinity'}}}}));assert.throws(()=>normalizeSnapshot({...snap,junk:'x'.repeat(120000)}));assert.equal(storage.getItem('overtake-progression-v2'),before);assert.equal(storage.getItem(CLOUD_BACKUP_KEY),null);
});
test('restore backs up and undo swaps the previous local data without touching other keys',()=>{
 const source=makeStorage({'overtake-progression-v2':JSON.stringify(progression)}), target=makeStorage({'overtake-progression-v2':JSON.stringify({...progression,money:12}),'unrelated':'ok'});
 restoreSnapshot(target,captureSnapshot(source));assert.equal(JSON.parse(target.getItem('overtake-progression-v2')).money,1234);assert.equal(JSON.parse(target.getItem('overtake-progression-v2')).dev,false);assert.equal(target.getItem('unrelated'),'ok');
 undoRestore(target);assert.equal(JSON.parse(target.getItem('overtake-progression-v2')).money,12);undoRestore(target);assert.equal(JSON.parse(target.getItem('overtake-progression-v2')).money,1234);
});
test('failure to make backup leaves local values untouched; partial write rolls back',()=>{
 const source=makeStorage({'overtake-progression-v2':JSON.stringify(progression)}), target=makeStorage({'overtake-progression-v2':'old'}), snap=captureSnapshot(source), set=target.setItem;
 target.setItem=(k,v)=>{if(k===CLOUD_BACKUP_KEY) throw Error('quota');set(k,v);};assert.throws(()=>restoreSnapshot(target,snap));assert.equal(target.getItem('overtake-progression-v2'),'old');
 let fail=true;target.setItem=(k,v)=>{if(k==='overtake-paints'&&fail){fail=false;throw Error('quota');}set(k,v);};assert.throws(()=>restoreSnapshot(target,snap),/previous data was restored/);assert.equal(target.getItem('overtake-progression-v2'),'old');
});
test('uninitialized device cannot overwrite a cloud save with defaults',()=>assert.throws(()=>captureSnapshot(makeStorage()),/Open the game/));
test('rank is backed up and restored; older snapshots and backups preserve current rank',()=>{
 const source=makeStorage({'overtake-progression-v2':JSON.stringify(progression),'overtake-ranked-v1':JSON.stringify({version:1,points:755,attempts:3,scenarios:{}})});
 const target=makeStorage({'overtake-progression-v2':JSON.stringify(progression),'overtake-ranked-v1':JSON.stringify({version:1,points:50,attempts:1,scenarios:{}})});
 const snap=captureSnapshot(source);restoreSnapshot(target,snap);assert.equal(JSON.parse(target.getItem('overtake-ranked-v1')).points,755);undoRestore(target);assert.equal(JSON.parse(target.getItem('overtake-ranked-v1')).points,50);
 const {ranked,...old}=snap;restoreSnapshot(target,old);assert.equal(JSON.parse(target.getItem('overtake-ranked-v1')).points,50);
 const backup=JSON.parse(target.getItem(CLOUD_BACKUP_KEY));delete backup.values['overtake-ranked-v1'];target.setItem(CLOUD_BACKUP_KEY,JSON.stringify(backup));undoRestore(target);assert.equal(JSON.parse(target.getItem('overtake-ranked-v1')).points,50);
 assert.throws(()=>restoreSnapshot(target,{...snap,ranked:{version:2}}),/Unsupported ranked/);
});
