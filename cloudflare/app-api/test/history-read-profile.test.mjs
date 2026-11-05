import test from 'node:test';
import assert from 'node:assert/strict';
import {historyReadProfile} from '../lib/history-read-profile.mjs';
import {historyReadDb} from '../lib/history-read-batch.mjs';
import {playerLoadTiming} from '../lib/player-load-timing.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function dbFixture(){const calls=[];return{calls,db:{prepare(sql){const stmt=values=>({bind:(...p)=>stmt(p),all(){return new Promise((resolve,reject)=>calls.push({sql,values,resolve,reject}))}});return stmt([])}}}}
test('profiling preserves exact SQL, bindings, result identity and overlapping execution; aggregates contain no private values',async()=>{
 let clock=0;const fixture=dbFixture(),p=historyReadProfile(fixture.db,()=>clock);
 const matchSql='WITH candidate_matches AS MATERIALIZED (SELECT 1) SELECT * FROM candidate_matches',aliasSql='SELECT p.match_id FROM match_participants p CROSS JOIN matches m ON m.id=p.match_id',identitySql='SELECT payload FROM player_identity_people';
 const a=p.player(()=>p.db.prepare(matchSql).bind('private-card').all());clock=5;
 const b=p.player(()=>p.db.prepare(aliasSql).bind('Private Name').all());const c=p.db.prepare(identitySql).bind('private-id').all();assert.equal(fixture.calls.length,3);
 assert.deepEqual(fixture.calls.map(c=>[c.sql,c.values]),[[matchSql,['private-card']],[aliasSql,['Private Name']],[identitySql,['private-id']]]);
 const body={results:[{payload:'private payload'}],meta:{timings:{sql_duration_ms:2},rows_read:7}};
 clock=10;fixture.calls[1].resolve(body);assert.equal(await b,body);fixture.calls[2].resolve({results:[]});await c;clock=20;fixture.calls[0].resolve(body);assert.equal(await a,body);
 const timing=playerLoadTiming(true);p.report(timing);const header=timing.response(new Response()).headers.get('Server-Timing');
 assert.match(header,/hist_matches;dur=20.0;desc="requests=1 reads=1 maxMs=20.0 dbMs=2.0 dbSamples=1 rowsRead=7 rowSamples=1 errors=0"/);assert.match(header,/hist_aliases;dur=5.0/);assert.match(header,/hist_identities;dur=5.0;desc="requests=1 reads=1 maxMs=5.0 dbMs=0.0 dbSamples=0 rowsRead=0 rowSamples=0 errors=0"/);assert.match(header,/hist_last_start;dur=5.0;desc="players=2 peak=2 errors=0"/);assert.match(header,/ioPeak=3/);
 for(const value of ['private','Private','SELECT','candidate_matches','payload'])assert.ok(!header.includes(value),value);
});
test('read failures are propagated unchanged with no retry, new request or error text in the header',async()=>{
 const f=dbFixture(),p=historyReadProfile(f.db),error=Error('private sql failure 7500');const result=p.player(()=>p.db.prepare('SELECT * FROM match_participants').all());f.calls[0].reject(error);await assert.rejects(result,e=>e===error);assert.equal(f.calls.length,1);
 const timing=playerLoadTiming(true);p.report(timing);const header=timing.response(new Response()).headers.get('Server-Timing');assert.match(header,/errors=1/);assert.ok(!header.includes('private'));assert.ok(!header.includes('7500'));
});
test('profile and existing SQL grouping issue the same requests and preserve grouped output',async()=>{
 async function run(profiled){const f=dbFixture(),p=historyReadProfile(f.db),db=historyReadDb(profiled?p.db:f.db);const sql='SELECT display_name FROM match_participants WHERE source_player_id=?';const result=Promise.all(Array.from({length:6},(_,i)=>db.prepare(sql).bind(i).all()));await tick();for(const c of f.calls)c.resolve({results:c.values.length===1?[{display_name:c.values[0]}]:c.values.map((v,i)=>({__cw_history_slot:i,display_name:v}))});const output=await result;if(profiled){const timing=playerLoadTiming(true);p.report(timing);assert.match(timing.response(new Response()).headers.get('Server-Timing'),/requests=2 reads=6/)}return{calls:f.calls.map(c=>[c.sql,c.values]),result:output}}
 assert.deepEqual(await run(true),await run(false));
});
