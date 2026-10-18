import test from 'node:test';import assert from 'node:assert/strict';
import {fieldDifferences,compareRecords} from '../verify-d1-record-differences.mjs';
test('nested scores, state, missing values and null remain substantive differences',()=>{
 const changes=fieldDifferences({state:'active',acceptance:{position:4},nullable:null},{state:'withdrawn',acceptance:{position:5}});
 assert.deepEqual(changes.map(x=>x.path),['state','acceptance.position','nullable']);assert.ok(changes.every(x=>x.kind==='data'));assert.equal(changes[2].d1.present,false);
});
test('observation timestamps are reported with actual values, never erased',()=>{
 const changes=fieldDifferences({lastObservedAt:'new',source:{observedAt:'new'}},{lastObservedAt:'old',source:{}});
 assert.equal(changes.length,2);assert.ok(changes.every(x=>x.kind==='observation_metadata'));assert.equal(changes[0].github.value,'new');assert.equal(changes[0].d1.value,'old');
});
test('all pinned IDs are classified, including absent records and identical payloads',()=>{
 const rows=[{id:'a',state:'active'},{id:'b',lastObservedAt:'new'},{id:'c',state:'active'},{id:'e',state:'active'}],db=[{id:'a',payload:JSON.stringify(rows[0])},{id:'b',payload:{id:'b',lastObservedAt:'old'}},{id:'c',payload:{id:'c',state:'withdrawn'}},{id:'d',payload:{id:'d'}}];
 assert.deepEqual(compareRecords(['a','b','c','d','e'],rows,db).map(x=>x.status),['identical','observation_metadata_only','data_differences','not_in_current_github','missing_in_d1']);
});
