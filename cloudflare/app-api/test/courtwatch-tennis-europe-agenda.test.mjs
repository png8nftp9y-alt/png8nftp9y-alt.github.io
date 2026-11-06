import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Execute the same initial/replay/changed/incomplete cases required by this workflow.
// D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY D1_TEST_INCOMPLETE_SOURCE_GUARD
import './tennis-europe-historical-sync.test.mjs';
test('the Europe writer imports only planned SQL and cannot certify before parity',()=>{
 const s=readFileSync(new URL('../../../.github/workflows/courtwatch-tennis-europe-agenda.yml',import.meta.url),'utf8');
 const stages=['prepare-tennis-europe-delta.mjs plan','guard-d1-import.mjs seed-tennis-europe-oop/delta/*.sql','prepare-tennis-europe-delta.mjs import','name: Verify Tennis Europe D1 parity','prepare-tennis-europe-delta.mjs confirm','name: Deploy Worker API'];
 let previous=-1;for(const stage of stages){const at=s.indexOf(stage);assert.ok(at>previous,stage);previous=at;}
 assert.match(s,/name: Import Tennis Europe rows only\s+if: steps\.delta\.outputs\.changed == 'true'/);
 assert.match(s,/TE_DELTA_FULL_CHECK:.*workflow_dispatch.*full_archive/);
 const historical=s.split('\n').find(line=>line.includes('TE_SYNC_HISTORICAL:'));
 assert.match(historical,/workflow_run.*OOP historical merge/);
 assert.match(historical,/workflow_dispatch.*full_archive/);
 assert.doesNotMatch(historical,/event_name == 'push'/);
 assert.doesNotMatch(s,/guard-d1-import\.mjs seed-tennis-europe-oop\/\*\.sql/);
});
