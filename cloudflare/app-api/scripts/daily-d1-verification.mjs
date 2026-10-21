// D1_WRITE_POLICY: incremental; only the daily certificate can change.
// buildIncrementalSyncPlan is unnecessary: source tables are read-only here.
import {readVerificationCounts} from '../lib/d1-verification-counts.mjs';
import {readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import {cliD1Query} from '../lib/d1-cli-query.mjs';
const result=await readVerificationCounts(cliD1Query,{version:await readCheckVersion(new URL('../lib/d1-verification-counts.mjs',import.meta.url))});
console.log(JSON.stringify({check:'D1_DAILY_COMPLETE_COUNTS',mode:result.mode,counts:result.value}));
