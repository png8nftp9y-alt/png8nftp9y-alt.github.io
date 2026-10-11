import test from 'node:test';import assert from 'node:assert/strict';
import {acceptanceQueryBatches} from '../lib/acceptance-query-batches.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
test('400-row ceiling and UTF8 SQL size ceiling preserve all keys',()=>{
 const rows=Array.from({length:900},(_,i)=>({source_key:i+'\u00e8'.repeat(250)}));const batches=acceptanceQueryBatches(rows);
 assert.deepEqual(batches.flat(),rows);assert.ok(batches.every(b=>b.length<=400&&new TextEncoder().encode(b.map(r=>sqlString(r.source_key)).join(',')).length<=60000));
});
