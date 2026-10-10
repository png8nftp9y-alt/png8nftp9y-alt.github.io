import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import './sync-acceptance-player-profiles.test.mjs';
test('acceptance publication triggers all circuits automatically without periodic heavy indexing',()=>{
 const y=readFileSync(new URL('../../../.github/workflows/courtwatch-acceptance-player-profiles.yml',import.meta.url),'utf8');
 for(const name of ['Court Watch v3 FITP player entries','Court Watch v3 Tennis Europe live entries','Court Watch v3 ITF acceptance discovery 42d','Court Watch v3 ITF known labels fast','Court Watch v3 ITF acceptance safety 120d'])assert.ok(y.includes(name));
 assert.match(y,/types: \[completed\]/);assert.doesNotMatch(y,/if:.*workflow_run.conclusion/);
 assert.match(y,/group: courtwatch-d1-writes\n  cancel-in-progress: false\n  queue: max/);
 assert.match(y,/pointers\/current.json/);assert.doesNotMatch(y,/backup-1|backup-2|schedule:|workflow_dispatch:/);
 assert.match(y,/node scripts\/sync-acceptance-player-profiles.mjs/);
});
