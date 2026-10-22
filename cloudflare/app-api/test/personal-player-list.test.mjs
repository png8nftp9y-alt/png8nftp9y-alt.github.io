import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {personalPlayerList} from '../lib/personal-player-list.mjs';
import worker from '../src/index.js';
const user='user-federico-181099',p={id:'cw-list-new',name:'List New',userAdded:true,club:'Saved Club',fitpRanking:'3.1'};
function seed(d,owner=user,group='others'){
 d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',[owner,p.id,'fitp|id:123456',JSON.stringify(p),'2026-10-22']);
 d.execute('INSERT INTO '+(group==='others'?'user_app_other_players':'user_app_players')+' VALUES(?,?,?)',[owner,p.id,'2026-10-22']);
}
test('second device reads saved additions immediately, one indexed query, no history and zero writes',async()=>{
 const d=database({identityMapping:true});try{
  assert.deepEqual((await personalPlayerList(d.db,user,'others')).players,[]);
  seed(d);const before=d.writes(),queries=[];
  const db={prepare(sql){queries.push(sql);return d.db.prepare(sql)}};
  assert.deepEqual((await personalPlayerList(db,user,'others')).players,[p]);
  assert.equal(queries.length,1);assert.doesNotMatch(queries[0],/FROM matches|FROM tournaments|runtime_document|search_acquired/);
  const plan=d.execute('EXPLAIN QUERY PLAN '+queries[0],[user]);
  assert.ok(!plan.some(r=>/SCAN [uap](?:$| )/.test(r.detail)),JSON.stringify(plan));
  assert.equal(d.writes(),before);
  assert.deepEqual((await personalPlayerList(d.db,'other-account','others')).players,[]);
  assert.ok(!(await personalPlayerList(d.db,user,'main')).players.some(r=>r.id===p.id));
 }finally{d.close()}
});
test('main removals, malformed stored membership and database failures never become a valid empty list',async()=>{
 const d=database({identityMapping:true});try{
  seed(d,user,'main');
  assert.ok((await personalPlayerList(d.db,user,'main')).players.some(r=>r.id===p.id));
  d.execute('INSERT INTO user_app_player_removals VALUES(?,?,?)',[user,p.id,'2026-10-22']);
  assert.ok(!(await personalPlayerList(d.db,user,'main')).players.some(r=>r.id===p.id));
  d.execute('INSERT INTO user_app_other_players VALUES(?,?,?)',[user,'missing-payload','2026-10-22']);
  await assert.rejects(personalPlayerList(d.db,user,'others'),/unavailable/);
  await assert.rejects(personalPlayerList({prepare:()=>({bind:()=>({all:async()=>({success:false})})})},user,'others'),/unavailable/);
 }finally{d.close()}
});
test('API remains authenticated, private, scoped and reads no history/metadata',async()=>{
 const d=database({identityMapping:true});try{
  seed(d);const before=d.writes(),queries=[];
  const db={prepare(sql){queries.push(sql);if(/FROM matches|FROM tournaments|runtime_document|match_participants/.test(sql))throw Error('History forbidden');return d.db.prepare(sql)},batch:s=>d.db.batch(s)};
  const req=auth=>new Request('https://test/app/api/player-list',{headers:{...(auth?{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}:{}),'X-CourtWatch-Group':'others'}});
  assert.equal((await worker.fetch(req(false),{DB:db})).status,401);
  const r=await worker.fetch(req(true),{DB:db});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
  const body=await r.json();assert.deepEqual(body.players,[p]);assert.deepEqual(body.membershipIds,[p.id]);assert.equal(body.group,'others');
  assert.equal(d.writes(),before);
 }finally{d.close()}
});
