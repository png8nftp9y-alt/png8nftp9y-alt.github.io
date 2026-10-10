// D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY D1_TEST_INCOMPLETE_SOURCE_GUARD
import './archived-profile-evidence.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('historical recovery is isolated from recurring schedules and shares the D1 write lock',()=>{const workflow=readFileSync(new URL('../../../.github/workflows/courtwatch-player-profile-archive-repair.yml',import.meta.url),'utf8');assert.ok(!/^\s*(schedule|workflow_run):/m.test(workflow));assert.match(workflow,/group: courtwatch-d1-writes/);assert.match(workflow,/cancel-in-progress: false/);assert.match(workflow,/paths: \['\.github\/workflows\/courtwatch-player-profile-archive-repair\.yml'\]/);assert.match(workflow,/bash src\/v3\/tennis-europe-r2-cache.sh restore/);assert.match(workflow,/bash src\/v3\/itf-r2-cache.sh restore/);assert.ok(!/r2-cache.sh publish/.test(workflow));});
