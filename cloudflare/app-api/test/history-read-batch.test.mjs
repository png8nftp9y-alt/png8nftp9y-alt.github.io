import './history-compound-limit.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {historyReadDb} from '../lib/history-read-batch.mjs';
import {personalCircuitHistory,participantSourceKey} from '../lib/personal-tennis-europe-history.mjs';
import {database} from './search-sqlite-fixture.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const sql='SELECT display_name FROM match_participants WHERE source_player_id=?';
function deferredDb(){const calls=[];return{calls,db:{prepare(sql){const make=params=>({bind:(...p)=>make(p),all(){return new Promise((resolve,reject)=>calls.push({sql,params,resolve,reject}))}});return make([])},batch(){throw Error('native_batch_must_not_be_used')}}}}
test('slow first group does not block another player or the next page; no native batch or retry',async()=>{
 const d=deferredDb(),db=historyReadDb(d.db);
 const a=Promise.all([db.prepare(sql).bind('a').all(),db.prepare(sql).bind('b').all()]);await tick();assert.equal(d.calls.length,1);
 const b=db.prepare(sql).bind('c').all();await tick();assert.equal(d.calls.length,2);
 d.calls[1].resolve({results:[{display_name:'c'}]});assert.equal((await b).results[0].display_name,'c');
 d.calls[0].resolve({results:[{__cw_history_slot:1,display_name:'b'},{__cw_history_slot:0,display_name:'a'}]});
 assert.deepEqual((await a).map(r=>r.results[0].display_name),['a','b']);assert.deepEqual(d.calls[0].params,['a','b']);
});
test('five-read and bind limits split ready groups without an in-flight barrier',async()=>{
 const d=deferredDb(),db=historyReadDb(d.db);const p=Promise.all(Array.from({length:18},(_,i)=>db.prepare(sql).bind(i).all()));await tick();
 assert.equal(d.calls.length,4);assert.deepEqual(d.calls.map(c=>c.params.length),[5,5,5,3]);
 for(const c of d.calls)c.resolve({results:c.params.map((p,i)=>({__cw_history_slot:i,display_name:p}))});
 assert.deepEqual((await p).map(r=>r.results[0].display_name),Array.from({length:18},(_,i)=>i));
 const many='SELECT display_name FROM match_participants WHERE source_player_id IN ('+Array(50).fill('?').join(',')+')';
 const q=Promise.all([db.prepare(many).bind(...Array(50).fill(1)).all(),db.prepare(many).bind(...Array(50).fill(2)).all()]);await tick();assert.equal(d.calls.length,6);assert.ok(d.calls.slice(4).every(c=>c.params.length===50));for(const c of d.calls.slice(4))c.resolve({results:[]});await q;
});
test('failed or malformed grouped responses reject all affected reads without partial success or retry',async()=>{
 for(const invalid of [null,{results:[{display_name:'missing slot'}]}]){
 const d=deferredDb(),db=historyReadDb(d.db),done=Promise.allSettled([db.prepare(sql).all(),db.prepare(sql).all()]);await tick();
 if(invalid)d.calls[0].resolve(invalid);else d.calls[0].reject(Error('7500'));
 const result=await done;assert.ok(result.every(r=>r.status==='rejected'));assert.equal(d.calls.length,1);
 }
});
test('writes are blocked, optional identity reads stay isolated, repeated reads remain fresh',async()=>{
 const d=deferredDb(),db=historyReadDb(d.db);
 for(const s of ['DELETE FROM match_participants','WITH x AS (SELECT 1) DELETE FROM match_participants','SELECT 1; DELETE FROM match_participants'])await assert.rejects(db.prepare(s).all(),/history_read_only/);
 assert.throws(()=>db.prepare(sql).run(),/history_read_only/);assert.equal(d.calls.length,0);
 const identity=db.prepare('SELECT payload FROM player_identity_people').all();assert.equal(d.calls.length,1);d.calls[0].resolve({results:[]});await identity;
 for(const name of ['before','after']){const result=db.prepare(sql).all();await tick();d.calls.at(-1).resolve({results:[{display_name:name}]});assert.equal((await result).results[0].display_name,name)}
 assert.equal(d.calls.length,3);
});
test('real SQLite: complete multi-player histories, native IDs, aliases, 250-row pagination and participants stay identical with zero writes',async()=>{
 const d=database({identityMapping:true});
 const native='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const players=[{id:'a',name:'Alice Example',sourceCircuit:'tennis-europe',sourcePlayerId:native},{id:'b',name:'Bob Example',sourceCircuit:'fitp',sourcePlayerId:'1234567'}];
 try{
 d.execute("INSERT INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) VALUES('t','tennis-europe','T','2026-01-01','2026-01-08','{\"name\":\"Tournament\"}')");
 // Seed all fixtures in one SQL call to keep this regression bounded.
 d.execute(`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<260) INSERT INTO matches(id,tournament_id,circuit,played_date,payload) SELECT printf('m%04d',i),'t','tennis-europe','2026-01-02','{"event":"GS14","score":"6-2 6-3"}' FROM n`);
 d.execute(`INSERT INTO match_participants SELECT id,'self',?,'Alice Example','alice example','ITA',0,1,'{}' FROM matches`,[native]);
 d.execute(`INSERT INTO match_participants SELECT id,'opponent','other','Opponent','opponent','FRA',1,0,'{}' FROM matches`);
 d.execute(`INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES('m0261','t','tennis-europe','2026-01-03','{"event":"GS14","score":"6-0 6-0"}')`);
 d.execute(`INSERT INTO match_participants VALUES('m0261','self','49','Alice Example','alice example','ITA',0,1,'{}')`);
 d.execute(`INSERT INTO match_participants VALUES('m0261','opponent','other','Opponent','opponent','FRA',1,0,'{}')`);
 players[0].sourceKey=await participantSourceKey('tennis-europe',{payload:'{}',display_name:'Alice Example',source_player_id:'49',nationality:'ITA'});
 const baseline=d.writes(),directReads=[],groupedReads=[];
 function counted(log){return{prepare(sql){const stmt=params=>({bind:(...p)=>stmt(p),all:async()=>{log.push({sql,params});return d.db.prepare(sql).bind(...params).all()}});return stmt([])},batch(){throw Error('no native batches')}}}
 const direct=await Promise.all(players.map(p=>personalCircuitHistory(counted(directReads),p)));
 const shared=historyReadDb(counted(groupedReads));const grouped=await Promise.all(players.map(p=>personalCircuitHistory(shared,p)));
 assert.deepEqual(grouped,direct);assert.equal(grouped[0].matches.length,262);assert.equal(d.writes(),baseline);
 assert.ok(groupedReads.length<directReads.length);assert.ok(groupedReads.some(r=>r.sql.includes('__cw_history_slot')));
 // A grouped request stays within the D1 bind limit.
 for(const r of groupedReads)assert.ok(r.params.length<=90);
 }finally{d.close()}
});
