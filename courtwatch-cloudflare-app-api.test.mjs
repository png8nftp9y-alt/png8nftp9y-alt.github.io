import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  ".github/workflows/courtwatch-cloudflare-app-api.yml",
  "utf8",
);

// D1_TEST_INITIAL_IMPORT
test("general D1 workflow preserves the complete first import", () => {
  assert.match(workflow, /for sql_file in seed-universal\/\*\.sql/);
  assert.match(workflow, /guard-d1-import\.mjs/);
});

// D1_TEST_IDENTICAL_ZERO_WRITES
test("identical application data performs zero entity writes", () => {
  assert.match(
    workflow,
    /D1_IMPORT_SKIPPED unchanged=\$LOCAL_IMPORT_HASH rows_written=0/,
  );
  assert.match(workflow, /LOCAL_IMPORT_HASH.*REMOTE_IMPORT_HASH/s);
});

// D1_TEST_REAL_DELTAS_ONLY
test("real differences are protected by the import hash and guard", () => {
  assert.match(workflow, /json_extract\(counts_json, '\$\.importHash'\)/);
  assert.match(workflow, /guard-d1-import\.mjs seed-universal\/\*\.sql/);
});

// D1_TEST_INCOMPLETE_SOURCE_GUARD
test("incomplete imports remain blocked before remote execution", () => {
  assert.match(workflow, /guard-d1-import\.mjs/);
  assert.match(workflow, /npm run verify/);
});

test("freshness refresh changes only generation metadata", () => {
  assert.match(
    workflow,
    /UPDATE generations SET generated_at='\$VERIFIED_AT' WHERE id='current' AND json_extract\(counts_json, '\$\.importHash'\)='\$LOCAL_IMPORT_HASH'/,
  );
  assert.match(workflow, /D1_METADATA_REFRESHED rows_written=1/);
});
