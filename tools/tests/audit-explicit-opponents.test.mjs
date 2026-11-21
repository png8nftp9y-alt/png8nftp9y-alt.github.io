import test from 'node:test';import assert from 'node:assert/strict';
import {explicitAuditOpponents} from '../lib/audit-explicit-opponents.mjs';
import {auditOpponentSelection} from '../lib/audit-opponent-selection.mjs';
test('Mascaretti outside observed scope resolves by exact ITF ID and remains a targeted audit',async()=>{
 const all=new Map([['800111111','Other']]);let calls=0;
 const resolved=await explicitAuditOpponents(async(sql,args)=>{calls++;assert.match(sql,/official_id=\?/);assert.deepEqual(args,['800672143','800672143']);return [{display_name:'Teo Mascaretti'}];},all,'800672143,800672143');
 assert.equal(calls,1);assert.equal(all.size,1);const selected=auditOpponentSelection(resolved,'800672143');assert.deepEqual([...selected.opponents],[['800672143','Teo Mascaretti']]);assert.equal(selected.kind,'targeted_fresh');
});
test('invalid or oversized requests fail before reads; unknown IDs never succeed empty',async()=>{
 let reads=0;const query=async()=>{reads++;return[]};
 for(const text of ['x','800672143,','123',Array.from({length:11},(_,i)=>'800'+String(i).padStart(6,'0')).join(',')])await assert.rejects(explicitAuditOpponents(query,new Map(),text));
 assert.equal(reads,0);await assert.rejects(explicitAuditOpponents(query,new Map(),'800672143'),/identity_missing/);
});
test('ordinary scope and known explicit IDs perform no extra reads',async()=>{const all=new Map([['800672143','Teo Mascaretti']]);const fail=()=>{throw Error('unexpected query')};assert.equal(await explicitAuditOpponents(fail,all,''),all);assert.deepEqual(await explicitAuditOpponents(fail,all,'800672143'),all);});
