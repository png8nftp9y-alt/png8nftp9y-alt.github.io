// Workflow contract backed by real SQLite tests:
// D1_TEST_INITIAL_IMPORT, D1_TEST_IDENTICAL_ZERO_WRITES,
// D1_TEST_REAL_DELTAS_ONLY, D1_TEST_INCOMPLETE_SOURCE_GUARD.
import '../../../src/v3/repair-itf-storage-51.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('repair workflow stages immutable SQL, imports only pending versions, and verifies all frozen documents',()=>{
 const s=readFileSync(new URL('../../../.github/workflows/courtwatch-itf-storage-51-repair.yml',import.meta.url),'utf8');
 assert.ok(s.includes('D1_WRITE_POLICY: incremental'));
 assert.ok(s.indexOf('repair-itf-storage-51.mjs stage')<s.indexOf('wrangler d1 execute'));
 assert.ok(s.indexOf('wrangler d1 execute')<s.indexOf('verify-itf-draw-documents-d1.mjs'));
 assert.ok(s.includes('run-id: 38972488702'));
});
