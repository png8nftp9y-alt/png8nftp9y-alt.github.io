// D1_TEST_INITIAL_IMPORT: bootstrap from actual D1 rows and repair missing children.
// D1_TEST_IDENTICAL_ZERO_WRITES: verified replay emits neither import nor receipts.
// D1_TEST_REAL_DELTAS_ONLY: change one result and exercise an interrupted revert.
// D1_TEST_INCOMPLETE_SOURCE_GUARD: invalid/failed probes reject the plan.
import './tennis-europe-historical-sync.test.mjs';
