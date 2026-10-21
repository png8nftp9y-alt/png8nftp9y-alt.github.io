// Daily workflow validation exercises the real counter/certificate implementation.
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import './d1-verification-counts.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('daily full check is serialized with imports and retains independent native-ID audits',()=>{
 const workflow=fs.readFileSync(new URL('../../../.github/workflows/courtwatch-d1-daily-verification.yml',import.meta.url),'utf8');
 assert.match(workflow,/cron: '17 4 \* \* \*'/);assert.match(workflow,/group: courtwatch-d1-writes/);
 for(const script of ['daily-d1-verification.mjs','all-player-id-audit.mjs','per-circuit-player-id-audit.mjs'])assert.ok(workflow.includes(script));
 assert.doesNotMatch(workflow,/sync-acquired|recover-europe|sync-player-identities|wrangler deploy/);
});
