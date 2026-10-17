// D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES D1_TEST_REAL_DELTAS_ONLY D1_TEST_INCOMPLETE_SOURCE_GUARD
import './runtime-document-plan.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('every full-content readback precedes the single release pointer publication',()=>{
 const source=readFileSync(new URL('../scripts/sync-runtime-documents-d1.mjs',import.meta.url),'utf8');
 assert.ok(source.indexOf('decodeDocument({...d,chunks:d.chunks.length},check.map')<source.indexOf('for(const sql of plan.sql)'));
 assert.ok(source.indexOf('for(const path of RUNTIME_DOCUMENT_FILES)')<source.indexOf('CREATE TABLE IF NOT EXISTS'));
 assert.ok(source.includes('cutoverEnabled:false'));assert.ok(source.includes('merge-base'));
});
