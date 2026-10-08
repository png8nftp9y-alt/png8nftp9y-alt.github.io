// D1_TEST_INITIAL_IMPORT, D1_TEST_IDENTICAL_ZERO_WRITES, D1_TEST_REAL_DELTAS_ONLY,
// D1_TEST_INCOMPLETE_SOURCE_GUARD are exercised against SQLite by the shared pipeline suite.
import './sync-acquired-player-search.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('future D1 sync triggers indexing after success in the shared serialization lane',()=>{const s=readFileSync(new URL('../../../.github/workflows/courtwatch-acquired-player-search.yml',import.meta.url),'utf8');assert.ok(s.includes('Court Watch ITF acquired draws D1 sync'));assert.ok(s.includes("github.event.workflow_run.conclusion == 'success'"));assert.ok(s.includes('group: courtwatch-d1-writes'));assert.ok(s.includes('cancel-in-progress: false'));assert.ok(s.indexOf('migrations apply')<s.indexOf('run: node scripts/sync-acquired-player-search.mjs'))});
