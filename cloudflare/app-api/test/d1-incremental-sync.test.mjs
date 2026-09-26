import test from "node:test";
import assert from "node:assert/strict";
import { buildIncrementalSyncPlan } from "../lib/d1-incremental-sync.mjs";

const keyOf = row => row.id;

// D1_TEST_INITIAL_IMPORT
test("empty D1 imports every valid record", () => {
  const plan = buildIncrementalSyncPlan({
    current: [],
    incoming: [
      { id: "1", name: "A" },
      { id: "2", name: "B" }
    ],
    keyOf
  });

  assert.equal(plan.inserts.length, 2);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.deletes.length, 0);
  assert.equal(plan.writes, 2);
});

// D1_TEST_IDENTICAL_ZERO_WRITES
test("second identical synchronization performs zero writes", () => {
  const rows = [
    { id: "1", name: "A", details: { city: "Roma", rank: 1 } },
    { id: "2", name: "B", details: { city: "Milano", rank: 2 } }
  ];

  const reorderedObjects = [
    { details: { rank: 1, city: "Roma" }, name: "A", id: "1" },
    { name: "B", id: "2", details: { rank: 2, city: "Milano" } }
  ];

  const plan = buildIncrementalSyncPlan({
    current: rows,
    incoming: reorderedObjects,
    keyOf
  });

  assert.equal(plan.writes, 0);
  assert.equal(plan.unchanged.length, 2);
});

// D1_TEST_REAL_DELTAS_ONLY
test("subsequent synchronization writes only real differences", () => {
  const plan = buildIncrementalSyncPlan({
    current: [
      { id: "1", name: "unchanged" },
      { id: "2", name: "old" },
      { id: "3", name: "removed" }
    ],
    incoming: [
      { id: "1", name: "unchanged" },
      { id: "2", name: "new" },
      { id: "4", name: "added" }
    ],
    keyOf,
    maxDeleted: 10,
    maxDeletedRatio: 1
  });

  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.deletes.length, 1);
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.writes, 3);
});

// D1_TEST_INCOMPLETE_SOURCE_GUARD
test("incomplete source cannot delete valid D1 data", () => {
  assert.throws(
    () => buildIncrementalSyncPlan({
      current: [{ id: "1", name: "valid" }],
      incoming: [],
      keyOf,
      sourceComplete: false
    }),
    /source incomplete/
  );
});
