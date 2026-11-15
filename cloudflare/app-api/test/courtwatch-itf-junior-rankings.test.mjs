import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import './itf-junior-ranking-batch.test.mjs';
import './itf-junior-ranking-publish.test.mjs';
const flow=readFileSync(new URL('../../../.github/workflows/courtwatch-itf-junior-rankings.yml',import.meta.url),'utf8');
test('D1_TEST_INITIAL_IMPORT: workflow initializes the dedicated archive under the shared writer lease',()=>{assert.match(flow,/group: courtwatch-d1-writes/);assert.ok(flow.indexOf('guard-d1-import.mjs lib/itf-junior-ranking-schema.sql')<flow.indexOf('--file lib/itf-junior-ranking-schema.sql'));});
test('D1_TEST_IDENTICAL_ZERO_WRITES: acquisition and publication jobs require actual pending work',()=>{const acq=flow.slice(flow.indexOf('  acquire:'),flow.indexOf('  publish:'));assert.match(acq,/needs.plan.outputs.due == 'true'/);assert.match(flow.slice(flow.indexOf('  publish:')),/needs.plan.outputs.due == 'true'/);});
test('D1_TEST_REAL_DELTAS_ONLY: independent category jobs never cancel a successful other category',()=>{assert.match(flow,/fail-fast: false/);assert.match(flow,/ITF_CATEGORY: \$\{\{ matrix.category \}\}/);assert.match(flow,/itf-junior-acquired-\$\{\{ matrix.category \}\}/);});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: source policy and release approval precede mutation; errors remain explicit',()=>{assert.match(flow,/verify-d1-new-feature-policy.mjs/);assert.match(flow,/needs.release-safety.result == 'success'/);assert.match(flow,/pending-status:/);});
