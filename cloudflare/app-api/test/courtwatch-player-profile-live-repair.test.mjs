import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import './repair-live-player-profiles.test.mjs';
test('targeted historical recovery is once-only, preserves the shared write lock and always saves its audit',()=>{
 const y=readFileSync(new URL('../../../.github/workflows/courtwatch-player-profile-live-repair.yml',import.meta.url),'utf8');
 assert.doesNotMatch(y,/schedule:|workflow_run:/);assert.match(y,/paths: \['.github\/workflows\/courtwatch-player-profile-live-repair.yml'\]/);
 assert.match(y,/group: courtwatch-d1-writes\n  cancel-in-progress: false\n  queue: max/);assert.match(y,/if: always\(\)/);
});
