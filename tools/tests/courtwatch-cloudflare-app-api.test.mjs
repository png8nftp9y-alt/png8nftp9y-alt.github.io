// Actual generator/SQLite cases below cover D1_TEST_INITIAL_IMPORT,
// D1_TEST_IDENTICAL_ZERO_WRITES, D1_TEST_REAL_DELTAS_ONLY and
// D1_TEST_INCOMPLETE_SOURCE_GUARD for this workflow's exact seed command.
import './generate-seed.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('general import reads completed generation before planning sections and executes each file once',()=>{
 const flow=readFileSync(new URL('../../.github/workflows/courtwatch-cloudflare-app-api.yml',import.meta.url),'utf8');
 const step=flow.slice(flow.indexOf('      - name: Build and import universal generation'),flow.indexOf('      - name: Build and import opponent tournament entries'));
 assert.match(step,/AS import_hash,counts_json FROM generations/);assert.ok(step.indexOf('> remote-import-hash.json')<step.indexOf('D1_REMOTE_GENERATION_FILE=remote-import-hash.json npm run seed'));
 assert.ok(step.indexOf('npm run seed')<step.indexOf('LOCAL_IMPORT_HASH='));assert.match(step,/LOCAL_IMPORT_HASH.*REMOTE_IMPORT_HASH/);assert.doesNotMatch(step,/for attempt|Retry |sleep /);
 assert.match(step,/guard-d1-import/);assert.match(flow,/group: courtwatch-d1-writes/);
});
