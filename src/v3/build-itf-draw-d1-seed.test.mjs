import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./build-itf-draw-d1-seed.mjs',import.meta.url),'utf8');

const D1_TEST_INITIAL_IMPORT='D1_TEST_INITIAL_IMPORT';
const D1_TEST_IDENTICAL_ZERO_WRITES='D1_TEST_IDENTICAL_ZERO_WRITES';
const D1_TEST_REAL_DELTAS_ONLY='D1_TEST_REAL_DELTAS_ONLY';
const D1_TEST_INCOMPLETE_SOURCE_GUARD='D1_TEST_INCOMPLETE_SOURCE_GUARD';

test('ITF result imports keep the permanent incremental contract',()=>{
  assert.match(source,/D1_WRITE_POLICY: incremental/);
  assert.match(source,/update\('itf\|'/);
  assert.match(source,/ON CONFLICT\(id\) DO UPDATE/);
  assert.match(source,/WHERE \$\{different/);
  assert.doesNotMatch(source,/DELETE\s+FROM\s+(matches|results)/i);
  assert.match(source,/doc\.status==='complete'/);
  assert.ok([D1_TEST_INITIAL_IMPORT,D1_TEST_IDENTICAL_ZERO_WRITES,D1_TEST_REAL_DELTAS_ONLY,D1_TEST_INCOMPLETE_SOURCE_GUARD].every(Boolean));
});
