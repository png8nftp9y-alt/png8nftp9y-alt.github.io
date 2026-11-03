import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnlyReplayDb} from '../read-only-replay-db.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('REST replay has at most two active SELECTs, exact independent bindings and one attempt per read',async()=>{
 const pending=[],calls=[],logs=[];let active=0,max=0;
 const db=readOnlyReplayDb(async(sql,params)=>{calls.push({sql,params});active++;max=Math.max(max,active);await new Promise(resolve=>pending.push(()=>{active--;resolve()}));return{results:[{value:params[0]}]}},{log:row=>logs.push(row)});
 const prepared=db.prepare('SELECT value FROM match_participants WHERE match_id=?');
 const tasks=Array.from({length:8},(_,i)=>prepared.bind('private-'+i).all());await tick();assert.equal(calls.length,2);assert.equal(max,2);
 for(let i=0;i<8;i++){pending[i]();await tick();}const rows=await Promise.all(tasks);
 assert.deepEqual(rows.map(row=>row.results[0].value),Array.from({length:8},(_,i)=>'private-'+i));assert.equal(max,2);assert.equal(db.queries,8);assert.equal(logs.length,8);assert.ok(!JSON.stringify(logs).includes('private-'));assert.ok(logs.every(row=>row.fingerprint.length===16));
});
test('7500 stops queued reads and later statements, does not retry or return an empty success',async()=>{
 let fail,finish,calls=0;const error=Error('[{"code":7500,"message":"internal error"}]'),logs=[];
 const db=readOnlyReplayDb(async()=>{const i=++calls;await new Promise((resolve,reject)=>{if(i===1)fail=()=>reject(error);else finish=()=>resolve()});return{results:[]}},{log:row=>logs.push(row)});
 const done=Promise.allSettled(Array.from({length:6},()=>db.prepare('SELECT payload FROM matches').all()));await tick();assert.equal(calls,2);fail();await tick();finish();const results=await done;
 assert.equal(calls,2);assert.equal(results.filter(row=>row.status==='rejected').length,5);assert.ok(results.filter(row=>row.status==='rejected').every(row=>row.reason===error));await assert.rejects(db.prepare('SELECT id FROM matches').first(),e=>e===error);assert.equal(calls,2);assert.equal(db.failure,error);assert.equal(logs.find(row=>row.status==='failure').code,7500);
});
test('write guards and ordinary SELECT results are preserved',async()=>{
 let calls=0;const db=readOnlyReplayDb(async()=>{calls++;return{results:[{id:7}],meta:{read:1}}});
 await assert.rejects(db.prepare('UPDATE matches SET payload=?').bind('x').all(),/read_only_guard/);assert.throws(()=>db.prepare('DELETE FROM matches').run(),/read_only_guard/);assert.throws(()=>db.batch([]),/read_only_guard/);assert.equal(calls,0);assert.deepEqual(await db.prepare('SELECT id FROM matches').first(),{id:7});assert.equal(calls,1);
});
