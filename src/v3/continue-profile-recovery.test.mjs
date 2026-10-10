import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {continuationDecision,continueRecovery} from './continue-profile-recovery.mjs';
const report={recoverySeries:'europe-profile-20261010',recoveryRunNumber:2,status:'unresolved_official_evidence',before:19901,after:{unresolved:15436},repaired:4465,mapping:{status:'ready',pending:0}};
test('only verified decreasing residuals schedule another bounded recovery',()=>{
 assert.equal(continuationDecision(report),'continue');
 for(const changed of [{repaired:0},{before:15436},{mapping:{status:'pending',pending:1}},{status:'failed'},{after:{unresolved:0}},{recoverySeries:'different'},{recoveryRunNumber:9},{recoveryRunNumber:NaN}])assert.notEqual(continuationDecision({...report,...changed}),'continue');
});
test('continuation runs within the failed recovery instead of relying on another workflow event',()=>{
 const y=readFileSync(new URL('../../.github/workflows/courtwatch-player-profile-live-repair.yml',import.meta.url),'utf8'),s=readFileSync(new URL('./continue-profile-recovery.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(y,/schedule:|workflow_run:/);assert.match(y,/if: failure\(\)/);
 assert.match(y,/node ..\/..\/src\/v3\/continue-profile-recovery.mjs/);
 assert.match(s,/recovery_already_scheduled/);assert.match(s,/GITHUB_REF!==\x27refs\/heads\/main\x27/);
});
test('a running source job does not block its own next pass and only one dispatch is sent',async()=>{
 const calls=[],request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({workflow_runs:[{id:42,status:'in_progress'}]})};};
 assert.equal(await continueRecovery({report,sourceRun:42,repo:'test/repo',token:'test',request,log:()=>{}}),'dispatched');
 assert.equal(calls.length,2);assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.body,JSON.stringify({ref:'main'}));
});
test('another pending recovery blocks duplicate dispatch and zero residuals call no API',async()=>{
 let calls=0;const request=async()=>{calls++;return {ok:true,json:async()=>({workflow_runs:[{id:43,status:'pending'}]})};};
 const options={report,sourceRun:42,repo:'test/repo',token:'test',request,log:()=>{}};
 assert.equal(await continueRecovery(options),'already_scheduled');assert.equal(calls,1);
 assert.equal(await continueRecovery({...options,report:{...report,after:{unresolved:0}}}),'no_verified_residual');assert.equal(calls,1);
});
