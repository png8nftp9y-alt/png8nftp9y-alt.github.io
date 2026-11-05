import test from 'node:test';import assert from 'node:assert/strict';
import {recoverPendingOpponents,resolveOpponentCheckpoints} from '../lib/audit-pending-opponents.mjs';
import {auditReadEvidence} from '../lib/audit-read-evidence.mjs';
import {auditReadSession} from '../lib/itf-audit-read-session.mjs';

test('only the pending unique profiles receive one fresh pass with reset before every attempt',async()=>{
 const calls=[];const result=await recoverPendingOpponents({pending:['1','2','1'],reset:()=>calls.push('reset'),check:id=>calls.push(id)});
 assert.deepEqual(calls,['reset','1','reset','2']);assert.deepEqual(result.attempted,['1','2']);
});
test('large unresolved scopes do not restart the full audit',async()=>{
 let calls=0;const result=await recoverPendingOpponents({pending:Array.from({length:33},(_,i)=>String(i)),reset:()=>calls++,check:()=>calls++});
 assert.equal(calls,0);assert.equal(result.skipped,'pending_scope_exceeds_recovery_limit');
});
test('an error remains an error and cannot create an endless replay loop',async()=>{
 let calls=0;await assert.rejects(recoverPendingOpponents({pending:['1','2'],reset:()=>{},check:()=>{calls++;throw Error('corrupt');}}),/corrupt/);assert.equal(calls,1);
});
test('a changed group is superseded only after every member has later stable fresh evidence',()=>{
 const original={scope:'opponents:1',members:['a','b'],stable:false,changedQueries:['hash']};
 const first={scope:'opponent:a',members:['a'],stable:true,recovery:true};
 assert.equal(resolveOpponentCheckpoints([original,first])[0].supersededBy,undefined);
 const second={scope:'opponent:b',members:['b'],stable:true,recovery:true};
 const resolved=resolveOpponentCheckpoints([original,first,second]);assert.deepEqual(resolved[0].supersededBy,[1,2]);assert.equal(resolved[0].stable,false);assert.deepEqual(resolved[0].changedQueries,['hash']);assert.equal(original.supersededBy,undefined);
});
test('failed recovery, older evidence and unrelated profiles cannot supersede a checkpoint',()=>{
 const failed={scope:'opponent:a',members:['a'],stable:false};
 for(const candidate of [{members:['a'],stable:false,recovery:true},{members:['b'],stable:true,recovery:true},{members:['a'],stable:true}])assert.equal(resolveOpponentCheckpoints([failed,candidate])[0].supersededBy,undefined);
 assert.equal(resolveOpponentCheckpoints([{members:['a'],stable:true,recovery:true},failed])[1].supersededBy,undefined);
});
test('observed-player evidence remains blocking and is never hidden by recovered opponents',()=>{
 const observed={scope:'observed_players_and_alternates',stable:false};assert.equal(resolveOpponentCheckpoints([observed,{scope:'opponent:a',members:['a'],stable:true,recovery:true}])[0].supersededBy,undefined);
});
test('recovery discards a stale cached read and verifies the newly fetched current value',async()=>{
 let value=1,reads=0;const evidence=auditReadEvidence(async()=>{reads++;return [{value}];}),session=auditReadSession(evidence.query,{minimumIntervalMs:0});
 await session.query('SELECT value FROM source');value=2;assert.equal((await evidence.verify({clearAfterVerification:true})).stable,false);
 let stable=false;await recoverPendingOpponents({pending:['1'],reset:()=>{evidence.discard();session.clear();},check:async()=>{assert.deepEqual(await session.query('SELECT value FROM source'),[{value:2}]);stable=(await evidence.verify({clearAfterVerification:true})).stable;}});
 assert.equal(stable,true);assert.equal(reads,4);
});

test('all nineteen pending IDs must be independently certified; one unresolved member keeps its old block blocking',()=>{
 const ids=Array.from({length:19},(_,i)=>String(100+i));const initial=[{scope:'observed_players_and_alternates',stable:true},{scope:'opponents:1',members:ids.slice(0,8),stable:false},{scope:'opponent:'+ids[10],members:[ids[10]],stable:false},{scope:'opponents:17',members:ids.slice(11),stable:false}];
 const recovered=ids.map(id=>({scope:'opponent:'+id,members:[id],stable:true,recovery:true}));
 const resolved=resolveOpponentCheckpoints([...initial,...recovered]);assert.equal(resolved.every(x=>x.stable||x.supersededBy?.length),true);
 const incomplete=resolveOpponentCheckpoints([...initial,...recovered.slice(0,-1)]);assert.equal(incomplete.every(x=>x.stable||x.supersededBy?.length),false);
});
