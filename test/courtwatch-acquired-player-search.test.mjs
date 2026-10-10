import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import '../cloudflare/app-api/test/sync-acquired-player-search.test.mjs';
const workflow = readFileSync(new URL('../.github/workflows/courtwatch-acquired-player-search.yml', import.meta.url), 'utf8');
test('periodic indexing keeps manual recovery and serial D1 writes without completion cascades', () => {
  const triggers = workflow.split('permissions:')[0];
  assert.match(triggers, /schedule:\n\s+- cron: '17,47 \* \* \* \*'/);
  assert.doesNotMatch(triggers, /\n  (workflow_run|push):/);
  assert.match(triggers, /workflow_dispatch:/);
  assert.match(triggers, /repair_missing_profiles:/);
  assert.match(triggers, /allow_bulk_identity_writes:/);
  assert.match(workflow, /group: courtwatch-d1-writes\n  cancel-in-progress: false\n  queue: max/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /node scripts\/sync-acquired-player-search.mjs/);
  assert.match(workflow, /node scripts\/sync-player-identities.mjs/);
});
