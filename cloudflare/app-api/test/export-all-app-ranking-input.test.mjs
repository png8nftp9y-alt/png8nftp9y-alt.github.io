import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
const source=readFileSync(new URL('../scripts/export-all-app-ranking-input.mjs',import.meta.url),'utf8');
test('D1_TEST_READ_ONLY_TRANSPORT: export-all-app-ranking-input uses the shared guarded client',()=>{
 assert.match(source,/import \{openReadOnlyD1\} from/);assert.match(source,/D1_READ_ONLY: guarded/);
 assert.doesNotMatch(source,/await fetch\(/);assert.doesNotMatch(source,/\.run\(/);
});
test('D1_TEST_MUTATIONS_REJECTED: export-all-app-ranking-input cannot send a D1 mutation through its client',async()=>{
 let calls=0;const client=createReadOnlyD1Client(async()=>{calls++;return[]});
 await assert.rejects(client.query('WITH x AS (SELECT 1) DELETE FROM app_matches'),/read_only_guard/);assert.equal(calls,0);
});
