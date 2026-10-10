import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {continuationDecision} from './continue-profile-recovery.mjs';
const report={recoverySeries:'europe-profile-20261010',recoveryRunNumber:2,status:'unresolved_official_evidence',before:19901,after:{unresolved:15436},repaired:4465,mapping:{status:'ready',pending:0}};
test('only verified decreasing residuals schedule another bounded recovery',()=>{
 assert.equal(continuationDecision(report),'continue');
 for(const changed of [{repaired:0},{before:15436},{mapping:{status:'pending',pending:1}},{status:'failed'},{after:{unresolved:0}},{recoverySeries:'different'},{recoveryRunNumber:9},{recoveryRunNumber:NaN}])assert.notEqual(continuationDecision({...report,...changed}),'continue');
});
test('continuation watches only recovery, has no periodic schedule or D1 credentials, and avoids queued duplicates',()=>{
 const y=readFileSync(new URL('../../.github/workflows/courtwatch-player-profile-recovery-continuation.yml',import.meta.url),'utf8'),s=readFileSync(new URL('./continue-profile-recovery.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(y,/schedule:|CLOUDFLARE|R2_ACCOUNT|workflows: \[Court Watch profile recovery continuation\]/);
 assert.match(y,/workflows: \[Court Watch targeted official player profile recovery\]/);
 assert.match(s,/recovery_already_scheduled/);assert.match(s,/run\.conclusion!==\x27failure\x27/);
});
