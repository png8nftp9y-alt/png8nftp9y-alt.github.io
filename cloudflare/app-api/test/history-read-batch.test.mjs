import test from 'node:test';
import assert from 'node:assert/strict';
import {historyReadDb} from '../lib/history-read-batch.mjs';
import {readOnlyReplayDb} from '../../../tools/read-only-replay-db.mjs';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';
const sql='SELECT payload FROM match_participants WHERE source_player_id=?';
function binding({fail=false}={}){
 const calls=[];let requests=0,active=0,max=0;
 const db={prepare(sql){
  const make=params=>({bind:(...p)=>make(p),all:async()=>{requests++;calls.push({sql,params});return{results:[{id:params[0]}]}}});
  return make([]);
 },async batch(statements){
  requests++;active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));
  try{if(fail)throw Error('7500');const before=requests,result=[];for(const s of statements)result.push(await s.all());requests=before;return result}finally{active--}
 }};
 return{db,calls,get requests(){return requests},get max(){return max}};
}
test('18 unchanged queries use three bounded requests, preserve parameters and complete row ordering',async()=>{
 const b=binding(),db=historyReadDb(b.db);const prepared=db.prepare(sql);
 const result=await Promise.all(Array.from({length:18},(_,i)=>prepared.bind(i).all()));
 assert.equal(b.requests,3);assert.equal(b.max,1);assert.equal(b.calls.length,18);
 assert.deepEqual(b.calls.map(c=>c.params[0]),Array.from({length:18},(_,i)=>i));
 assert.deepEqual(result.map(r=>r.results[0].id),Array.from({length:18},(_,i)=>i));
});
test('failed batch stops queued history, propagates error, never retries or returns partial success',async()=>{
 const b=binding({fail:true}),db=historyReadDb(b.db);
 const results=await Promise.allSettled(Array.from({length:18},(_,i)=>db.prepare(sql).bind(i).all()));
 assert.ok(results.every(r=>r.status==='rejected'&&r.reason.message==='7500'));assert.equal(b.requests,1);
 await assert.rejects(db.prepare(sql).all(),/7500/);assert.equal(b.requests,1);
});
test('single SELECT and optional identity lookups retain their original semantics; writes rejected',async()=>{
 const b=binding(),db=historyReadDb(b.db);assert.deepEqual((await db.prepare(sql).bind(3).all()).results,[{id:3}]);
 assert.deepEqual(await db.prepare('SELECT payload FROM player_identity_people').bind(9).first(),{id:9});
 await assert.rejects(db.prepare('DELETE FROM match_participants').all(),/history_read_only/);await assert.rejects(db.prepare('WITH x AS (SELECT 1) DELETE FROM match_participants').all(),/history_read_only/);await assert.rejects(db.prepare('SELECT 1; DELETE FROM match_participants').all(),/history_read_only/);assert.throws(()=>db.prepare(sql).run(),/history_read_only/);assert.equal(b.requests,2);
});
test('REST diagnostic keeps its two-request guard and executes each queued read once',async()=>{
 let calls=0;const db=historyReadDb(readOnlyReplayDb(async()=>{calls++;return{results:[]}}));
 await Promise.all(Array.from({length:18},()=>db.prepare(sql).all()));assert.equal(calls,18);
});
test('no batch binding keeps existing adapters compatible',()=>{const db={prepare(){}};assert.equal(historyReadDb(db),db)});
test('real history output and complete pagination are identical with and without transport batching',async()=>{
 const player={id:'p',name:'Player Example',sourceCircuit:'tennis-europe',sourcePlayerId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
 const sources=Array.from({length:251},(_,i)=>({match_id:String(i+1).padStart(4,'0'),tournament_id:'t',played_date:'2026-11-01',match_payload:JSON.stringify({score:'6-0 6-0',event:'Singles'}),tournament_payload:JSON.stringify({name:'Tournament'}),history_participants:JSON.stringify([{match_id:String(i+1).padStart(4,'0'),participant_key:'a',source_player_id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',display_name:'Player Example',nationality:'ITA',team_index:0,is_winner:1},{match_id:String(i+1).padStart(4,'0'),participant_key:'b',display_name:'Opponent',nationality:'FRA',team_index:1,is_winner:0}])}));
 function make(){let requests=0;const reads=[];const db={prepare(sql){const statement=params=>({bind:(...p)=>statement(p),all:async()=>{requests++;reads.push([sql,params]);return{results:sql.includes('WITH candidate_matches')?sources.filter(s=>s.match_id>params.at(-1)).slice(0,250):[]}}});return statement([])},async batch(statements){const before=requests;const result=await Promise.all(statements.map(s=>s.all()));requests=before+1;return result}};return{db,reads,get requests(){return requests}}}
 const a=make(),b=make();const before=await personalCircuitHistory(a.db,player),after=await personalCircuitHistory(historyReadDb(b.db),player);
 assert.equal(after.matches.length,251);assert.deepEqual(after,before);assert.deepEqual(b.reads,a.reads);assert.ok(b.requests<a.requests);
});
