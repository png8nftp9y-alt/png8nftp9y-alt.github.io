// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import './audit-personal-reference-repair.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('one-shot repair uses serialized D1 writer and independently audits the result without polling',()=>{
 const workflow=fs.readFileSync(new URL('../../../.github/workflows/courtwatch-audit-personal-reference-repair.yml',import.meta.url),'utf8');
 assert.match(workflow,/group: courtwatch-d1-writes/);assert.match(workflow,/queue: max/);assert.doesNotMatch(workflow,/schedule:|continue-on-error|wrangler deploy/);
 assert.ok(workflow.indexOf('run: node scripts/repair-audit-personal-reference.mjs')<workflow.indexOf('run: node scripts/all-player-id-audit.mjs'));
 const script=fs.readFileSync(new URL('../scripts/repair-audit-personal-reference.mjs',import.meta.url),'utf8');assert.match(script,/D1_credentials_missing/);assert.match(script,/existing_database_not_found/);
});
