import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {addCourtWatchPlayer,personalPlayerAdditions} from '../lib/courtwatch-player-additions.mjs';
import worker from '../src/index.js';

const python=`import json,sqlite3,sys
p=json.load(sys.stdin)
c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON')
if 'schema' in p:c.executescript(p['schema'])
rows=[]
with c:
 for item in p.get('statements',[]):
  cursor=c.execute(item['sql'],item['values'])
  rows=[dict(row) for row in cursor.fetchall()] if cursor.description else []
print(json.dumps({'rows':rows,'writes':c.total_changes}))
`;
function database(){
 const directory=mkdtempSync(path.join(tmpdir(),'courtwatch-add-player-')),file=path.join(directory,'db.sqlite');
 const call=body=>{const result=spawnSync('python3',['-c',python],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)};
 let schema=['0002_app_compatibility.sql','0004_observed_players.sql','0005_user_control_foundation.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
 schema+='\nCREATE TABLE match_analyses(match_key TEXT,analysis TEXT,updated_at TEXT);\n';
 schema+=['0012_single_account_ownership.sql','0024_user_player_removals.sql','0027_user_player_additions.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
 call({schema});let writes=0;
 const db={prepare(sql){const statement={sql,values:[],bind(...values){return {...statement,values,first:async()=>call({statements:[{sql,values}]}).rows[0]||null,all:async()=>({results:call({statements:[{sql,values}]}).rows})}}};return statement},async batch(statements){const result=call({statements});writes+=result.writes;return result}};
 const execute=(sql,values=[])=>call({statements:[{sql,values}]});
 execute("INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)",['itf|id:101','itf','101','TEST PLAYER','Test Player','{}']);
 return{env:{DB:db},execute,writes:()=>writes,close:()=>rmSync(directory,{recursive:true,force:true})};
}
const user={id:'user-federico-181099'};
test('D1_TEST_INITIAL_IMPORT: selected official identity becomes a persistent personal player',async()=>{
 const db=database();try{
  const result=await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101',name:'Test Player'});
  assert.equal(result.added,true);assert.equal(result.player.worldTennisId,'101');assert.equal(result.changed,true);
  assert.equal((await personalPlayerAdditions(db.env,user.id))[0].id,result.playerId);
  // A global app_players rebuild cannot erase the personal selection.
  db.execute('DELETE FROM app_players');assert.equal((await personalPlayerAdditions(db.env,user.id)).length,1);
 }finally{db.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeating the same selection performs zero new writes',async()=>{
 const db=database();try{
  const first=await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101'}),before=db.writes();
  const replay=await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101'});
  assert.equal(replay.playerId,first.playerId);assert.equal(replay.changed,false);assert.equal(db.writes(),before);
 }finally{db.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: remove and re-add restores only membership and clears removal',async()=>{
 const db=database();try{
  const first=await addCourtWatchPlayer(db.env,user,{identity:'101',name:'Test Player'});
  db.execute('INSERT INTO user_app_player_removals VALUES(?,?,?)',[user.id,first.playerId,'2026-10-06']);
  db.execute('DELETE FROM user_app_players WHERE user_id=? AND courtwatch_id=?',[user.id,first.playerId]);
  assert.deepEqual(await personalPlayerAdditions(db.env,user.id),[]);
  const before=db.writes();await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101'});
  assert.equal(db.writes()-before,2);assert.equal((await personalPlayerAdditions(db.env,user.id)).length,1);
 }finally{db.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing or ambiguous identities cannot create a player',async()=>{
 const db=database();try{
  await assert.rejects(addCourtWatchPlayer(db.env,user,{identity:'unknown',name:'Unknown Player'}),/player_not_found/);
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:101','fitp','101','TEST PLAYER','Test Player','{}']);
  await assert.rejects(addCourtWatchPlayer(db.env,user,{identity:'101',name:'Test Player'}),/player_identity_ambiguous/);
  assert.equal(db.writes(),0);
  const a=await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101'}),b=await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:101'},{fetchClub:async()=> 'Known Club'});
  assert.notEqual(a.playerId,b.playerId);
 }finally{db.close()}
});
test('configured player is reused by exact official ID; selections are private to their owner',async()=>{
 const db=database();try{
  db.execute('INSERT INTO app_players(seq,id,payload) VALUES(?,?,?)',[1,'configured-player',JSON.stringify({id:'configured-player',name:'Test Player',worldTennisId:'101'})]);
  const added=await addCourtWatchPlayer(db.env,user,{sourceKey:'itf|id:101'});assert.equal(added.playerId,'configured-player');
  assert.deepEqual(await personalPlayerAdditions(db.env,'another-user'),[]);
 }finally{db.close()}
});
test('protected POST requires an authenticated account and rejects a different origin',async()=>{
 const db=database();try{
  const url='https://courtwatch.example/app/api/courtwatch-player',body=JSON.stringify({sourceKey:'itf|id:101'});
  const unauthorized=await worker.fetch(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body}),db.env);
  assert.equal(unauthorized.status,401);assert.equal(db.writes(),0);
  const headers={'Content-Type':'application/json','Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','Origin':'https://other.example'};
  const forbidden=await worker.fetch(new Request(url,{method:'POST',headers,body}),db.env);assert.equal(forbidden.status,403);assert.equal(db.writes(),0);
  headers.Origin='https://courtwatch.example';
  const saved=await worker.fetch(new Request(url,{method:'POST',headers,body}),db.env);
  assert.equal(saved.status,200);assert.equal(saved.headers.get('Cache-Control'),'no-store');assert.equal((await saved.json()).added,true);
 }finally{db.close()}
});
test('opponent without an official ID resolves only an exact unambiguous indexed name',async()=>{
 const db=database();try{
  const added=await addCourtWatchPlayer(db.env,user,{identity:'local-draw-id',name:'Player Test'});
  assert.equal(added.player.worldTennisId,'101');
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['itf|id:202','itf','202','TEST PLAYER','Test Player','{}']);
  await assert.rejects(addCourtWatchPlayer(db.env,user,{identity:'another-local-id',name:'Test Player'}),/player_identity_ambiguous/);
 }finally{db.close()}
});

test('FITP addition waits for official club before persisting or confirming',async()=>{
 const db=database();try{
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:777','fitp','777','RICCARDO GALBIATI','RICCARDO GALBIATI','{}']);
  let release,started;const began=new Promise(resolve=>started=resolve);
  const operation=addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:777'},{fetchClub:card=>{assert.equal(card,'777');started();return new Promise(resolve=>release=resolve)}});
  await began;assert.equal(db.writes(),0);
  release('ASSOCIAZIONE SPORTIVA DILETTANTISTICA TENNIS CLUB LECCO');
  const result=await operation;assert.equal(result.player.club,'Tennis Club Lecco');assert.equal(result.player.name,'Riccardo Galbiati');
  const before=db.writes();await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:777'},{fetchClub:()=>{throw Error('must reuse stored club')}});
  assert.equal(db.writes(),before);
 }finally{db.close()}
});
test('unavailable FITP club does not save an incomplete new selection',async()=>{
 const db=database();try{
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:888','fitp','888','NEW PLAYER','NEW PLAYER','{}']);
  await assert.rejects(addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:888'},{fetchClub:async()=>''}),/player_club_unavailable/);
  assert.equal(db.writes(),0);
 }finally{db.close()}
});

test('FITP selection carries ranking and old saved selections recover it by exact source identity',async()=>{
 const db=database();try{
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:999','fitp','999','RICCARDO GALBIATI','RICCARDO GALBIATI',JSON.stringify({ranking:'4.2',club:'Tennis Club Lecco'})]);
  const result=await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:999'});
  assert.equal(result.player.ranking,'4.2');
  assert.equal((await personalPlayerAdditions(db.env,user.id))[0].ranking,'4.2');
  const old={...result.player};delete old.ranking;
  db.execute('UPDATE user_app_player_additions SET payload=? WHERE courtwatch_id=?',[JSON.stringify(old),result.playerId]);
  const before=db.writes();const restored=await personalPlayerAdditions(db.env,user.id);
  assert.equal(restored[0].ranking,'4.2');assert.equal(db.writes(),before);
 }finally{db.close()}
});

test('new and existing personal selections carry complete indexed demographics without readback writes',async()=>{
 const db=database();
 try{
  db.execute("INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)",['fitp|id:000123','fitp','000123','TEST PLAYER','Test Player',JSON.stringify({club:'Tennis Club Lecco',ranking:'4.2',birthYear:2010,sex:'F',nationality:'ITA'})]);
  const result=await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:000123',name:'Test Player'});
  assert.equal(result.player.birthYear,2010);assert.equal(result.player.sex,'F');assert.equal(result.player.nationality,'ITA');
  db.execute("UPDATE user_app_player_additions SET payload=json_remove(payload,'$.birthYear','$.sex','$.nationality')");
  const before=db.writes(),rows=await personalPlayerAdditions(db.env,user.id);
  assert.equal(rows[0].birthYear,2010);assert.equal(rows[0].sex,'F');assert.equal(rows[0].nationality,'ITA');assert.equal(db.writes(),before);
 }finally{db.close()}
});
test('acquired search selection can be promoted from its exact source key or opponent identity',async()=>{const d=database();try{d.execute(readFileSync(new URL('../migrations/0028_acquired_player_search.sql',import.meta.url),'utf8').split(';')[0]);d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['acquired|itf|id:800671267','itf','800671267','SEARCH PLAYER','Search Player','{"nationality":"NED","birthYear":2009}']);const r=await addCourtWatchPlayer(d.env,user,{identity:'800671267',name:'Search Player'});assert.equal(r.player.birthYear,2009);assert.equal(r.player.nationality,'NED');assert.equal(r.player.sourceKey,'acquired|itf|id:800671267');assert.equal((await personalPlayerAdditions(d.env,user.id))[0].id,r.playerId)}finally{d.close()}});
