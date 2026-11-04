import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOpponentCheckpoints} from '../lib/audit-opponent-checkpoints.mjs';
import {auditReadSession} from '../lib/itf-audit-read-session.mjs';
import {auditReadEvidence} from '../lib/audit-read-evidence.mjs';

test('eight profiles share a common read and recheck once; next group refreshes it',async()=>{
 let reads=0,value=1;const verified=[];
 const evidence=auditReadEvidence(async()=>{reads++;return [{value}];});
 const session=auditReadSession(evidence.query,{minimumIntervalMs:0});
 const groups=auditOpponentCheckpoints({verify:async()=>{const result=await evidence.verify({clearAfterVerification:true});session.clear();return result;},onVerified:ids=>verified.push(...ids)});
 for(let n=0;n<8;n++){assert.deepEqual(await session.query('SELECT value FROM shared',[]),[{value:1}]);groups.add(String(n));}
 assert.equal(reads,1);assert.equal(groups.due(),true);await groups.flush();assert.equal(reads,2);assert.equal(verified.length,8);
 value=2;assert.deepEqual(await session.query('SELECT value FROM shared',[]),[{value:2}]);groups.add('8');await groups.flush();assert.equal(reads,4);assert.equal(verified.length,9);
});
test('changed input leaves every member unverified and final short group is checked',async()=>{
 const verified=[],seen=[];let stable=false;
 const groups=auditOpponentCheckpoints({verify:async(scope,ids)=>{seen.push(ids);return {stable};},onVerified:ids=>verified.push(...ids)});
 groups.add('a');groups.add('b');await groups.flush();assert.deepEqual(verified,[]);
 stable=true;groups.add('c');await groups.flush();assert.deepEqual(verified,['c']);assert.deepEqual(seen,[['a','b'],['c']]);
});
test('transport discard cannot certify earlier members and checkpoint error cannot acknowledge profiles',async()=>{
 const verified=[];const groups=auditOpponentCheckpoints({verify:async()=>{throw Error('7500');},onVerified:ids=>verified.push(...ids)});
 groups.add('a');groups.discard();await groups.flush();assert.deepEqual(verified,[]);
 groups.add('b');await assert.rejects(groups.flush(),/7500/);assert.deepEqual(verified,[]);
});
test('age triggers between sequential profiles and size never exceeds eight',()=>{
 let clock=0;const groups=auditOpponentCheckpoints({verify:async()=>({stable:true}),onVerified:()=>{},now:()=>clock});
 assert.equal(groups.due(),false);groups.add('a');clock=30000;assert.equal(groups.due(),true);
 assert.throws(()=>auditOpponentCheckpoints({size:9}),/invalid_checkpoint_group/);
});
