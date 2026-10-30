import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {addCourtWatchPlayer,personalPlayerAdditions} from '../lib/courtwatch-player-additions.mjs';
import worker from '../src/index.js';
import {paginatedPlayerSearch} from '../lib/paginated-player-search.mjs';

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
function database({identityMapping=false}={}){
 const directory=mkdtempSync(path.join(tmpdir(),'courtwatch-add-player-')),file=path.join(directory,'db.sqlite');
 const call=body=>{const result=spawnSync('python3',['-c',python],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)};
 let schema=['0001_universal_schema.sql','0002_app_compatibility.sql','0004_observed_players.sql','0005_user_control_foundation.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
 schema+='\nCREATE TABLE match_analyses(match_key TEXT,analysis TEXT,updated_at TEXT);\n';
 schema+=['0012_single_account_ownership.sql','0024_user_player_removals.sql','0027_user_player_additions.sql','0035_other_player_list.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
 if(identityMapping)schema+=['0028_acquired_player_search.sql','0029_player_circuit_identities.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
 if(!identityMapping)schema+='\nCREATE TABLE player_identity_aliases(alias_id TEXT PRIMARY KEY,canonical_id TEXT NOT NULL);\n';
 schema+=readFileSync(new URL('../migrations/0048_observed_player_birth_metadata.sql',import.meta.url),'utf8');
 call({schema});let writes=0;
 const db={prepare(sql){const statement={sql,values:[],first:async()=>call({statements:[{sql,values:[]}]}).rows[0]||null,all:async()=>({results:call({statements:[{sql,values:[]}]}).rows}),bind(...values){return {...statement,values,first:async()=>call({statements:[{sql,values}]}).rows[0]||null,all:async()=>({results:call({statements:[{sql,values}]}).rows})}}};return statement},async batch(statements){const result=call({statements});writes+=result.writes;return result}};
 const execute=(sql,values=[])=>call({statements:[{sql,values}]});
 execute("INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)",['itf|id:101','itf','101','TEST PLAYER','Test Player','{}']);
 return{env:{DB:db},execute,writes:()=>writes,close:()=>rmSync(directory,{recursive:true,force:true})};
}
const user={id:'user-federico-181099'};
test('actual canonical search result remains addable after its upstream source row disappears; replay writes zero',async()=>{
 const d=database({identityMapping:true});try{
  const key='fitp|id:123456789',id='cw-retained',name='Retained Player',person={canonicalId:id,name,sourceKey:key,identity:'123456789',circuit:'fitp',nationality:'ITA',club:'Tennis Club Lecco'};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'PLAYER RETAINED',JSON.stringify(person)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,display_name,normalized_name,nationality) VALUES(?,?,?,?,?,?,?,?)',[key,id,'PLAYER RETAINED','fitp','123456789',name,'RETAINED PLAYER','ITA']);
  d.execute("INSERT INTO player_identity_sync(id,status) VALUES('current','ready')");
  const result=(await paginatedPlayerSearch(d.env.DB,'Retained',user.id)).results[0];assert.equal(result.sourceKey,key);
  const first=await addCourtWatchPlayer(d.env,user,result,{fetchClub:async()=>''});assert.equal(first.added,true);assert.equal(first.playerId,id);assert.equal(first.player.membershipCard,'123456789');
  const before=d.writes();assert.equal((await addCourtWatchPlayer(d.env,user,result,{fetchClub:async()=>''})).changed,false);assert.equal(d.writes(),before);
  await assert.rejects(addCourtWatchPlayer(d.env,user,{...result,name:'Different Player'}),/player_not_found/);
 }finally{d.close()}
});
test('canonical search spelling is verified through the exact mapping rather than rejected as missing',async()=>{
 const d=database({identityMapping:true});try{
  const key='itf|id:800123456',id='cw-corrected',name='Corrected Full Name';
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[key,'itf','800123456','OLD NAME','Old Name','{}']);
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'CORRECTED FULL NAME',JSON.stringify({canonicalId:id,name,sourceKey:key,identity:'800123456',circuit:'itf'})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,display_name,normalized_name) VALUES(?,?,?,?,?,?,?)',[key,id,'CORRECTED FULL NAME','itf','800123456','Old Name','OLD NAME']);
  d.execute("INSERT INTO player_identity_sync(id,status) VALUES('current','ready')");
  const selected=(await paginatedPlayerSearch(d.env.DB,'Corrected',user.id)).results[0];assert.equal((await addCourtWatchPlayer(d.env,user,selected)).added,true);
 }finally{d.close()}
});
test('saved personal player can be added to Others by its exact owned ID; another owner cannot reuse private data',async()=>{
 const d=database();try{
  const first=await addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101'});
  const other=await addCourtWatchPlayer(d.env,user,{courtwatchId:first.playerId,name:'Test Player',group:'others'});assert.equal(other.playerId,first.playerId);
  const before=d.writes();assert.equal((await addCourtWatchPlayer(d.env,user,{identity:first.playerId,name:'Test Player',group:'others'})).changed,false);assert.equal(d.writes(),before);
  await assert.rejects(addCourtWatchPlayer(d.env,{id:'another-user'},{courtwatchId:first.playerId,name:'Test Player',group:'others'}),/player_not_found/);
  await assert.rejects(addCourtWatchPlayer(d.env,user,{courtwatchId:first.playerId,name:'Wrong Name',group:'others'}),/player_identity_ambiguous/);
 }finally{d.close()}
});
test('other list starts empty and persists independently from Main',async()=>{
 const d=database();try{
  const first=await addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101'});
  assert.deepEqual(await personalPlayerAdditions(d.env,user.id,'others'),[]);
  const other=await addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101',group:'others'});
  assert.equal(other.playerId,first.playerId);
  assert.equal((await personalPlayerAdditions(d.env,user.id)).length,1);
  assert.equal((await personalPlayerAdditions(d.env,user.id,'others')).length,1);
  const before=d.writes();
  assert.equal((await addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101',group:'others'})).changed,false);
  assert.equal(d.writes(),before);
  assert.deepEqual(await personalPlayerAdditions(d.env,'another-user','others'),[]);
 }finally{d.close()}
});
test('Others-only addition does not create a main membership; invalid groups do not write',async()=>{
 const d=database();try{
  await assert.rejects(addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101',group:'invalid'}),/invalid_player_group/);
  assert.equal(d.writes(),0);
  const other=await addCourtWatchPlayer(d.env,user,{sourceKey:'itf|id:101',group:'others'});
  assert.deepEqual(await personalPlayerAdditions(d.env,user.id),[]);
  assert.equal((await personalPlayerAdditions(d.env,user.id,'others'))[0].id,other.playerId);
 }finally{d.close()}
});
test('protected snapshots and removals are scoped; main removal does not hide Others',async()=>{
 const d=database({identityMapping:true});try{
  const id='configured-test',player={id,name:'Test Player',worldTennisId:'101'};
  d.execute('INSERT INTO app_players(seq,id,payload) VALUES(?,?,?)',[1,id,JSON.stringify(player)]);
  await addCourtWatchPlayer(d.env,user,{courtwatchId:id});
  const headers={'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'};
  const request=async(group,path='/app-snapshot',method='GET')=>worker.fetch(new Request('https://courtwatch.example/app/api'+path,{method,headers:{...headers,'X-CourtWatch-Group':group}}),d.env);
  const empty=await request('others');assert.equal(empty.status,200);assert.deepEqual((await empty.json()).players,[]);
  await addCourtWatchPlayer(d.env,user,{courtwatchId:id,group:'others'});
  const others=await request('others');assert.equal(others.status,200);assert.equal((await others.json()).players[0].id,id);
  const removed=await request('main','/courtwatch-player?playerId='+id,'DELETE');assert.equal(removed.status,200);
  assert.deepEqual((await (await request('main')).json()).players,[]);
  assert.equal((await (await request('others')).json()).players[0].id,id);
  assert.equal((await request('others','/courtwatch-player?playerId='+id,'DELETE')).status,200);
  assert.deepEqual((await (await request('others')).json()).players,[]);
 }finally{d.close()}
});
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
test('unavailable FITP club does not block durable addition or fabricate metadata',async()=>{
 const db=database();try{
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:888','fitp','888','NEW PLAYER','NEW PLAYER','{}']);
  const result=await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:888'},{fetchClub:async()=>''});
  assert.equal(result.added,true);assert.equal(result.player.club,'');assert.ok(db.writes()>0);
  const before=db.writes(),again=await addCourtWatchPlayer(db.env,user,{sourceKey:'fitp|id:888'},{fetchClub:async()=>{throw Error('unavailable')}});assert.equal(again.added,true);assert.equal(db.writes(),before);
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

test('opponent identity of configured player adds exact app player and replay writes zero',async()=>{
 const db=database();try{
  db.execute('INSERT INTO app_players(id,payload,seq) VALUES(?,?,?)',['configured-new',JSON.stringify({id:'configured-new',name:'Configured New',circuits:[],nationality:'SUI'}),1]);
  const first=await addCourtWatchPlayer(db.env,user,{identity:'configured-new',name:'Configured New'});assert.equal(first.playerId,'configured-new');
  const before=db.writes(),again=await addCourtWatchPlayer(db.env,user,{identity:'configured-new',name:'Configured New'});assert.equal(again.changed,false);assert.equal(db.writes(),before);
  await assert.rejects(addCourtWatchPlayer(db.env,user,{identity:'configured-new',name:'Another Person'}),/player_identity_ambiguous/);
 }finally{db.close()}
});


test('Europe addition recovers the club through its verified canonical FITP identity before saving',async()=>{
 const db=database({identityMapping:true});try{
  const guid='12345678-1234-1234-1234-123456789abc',key='tennis-europe|id:'+guid;
  const profiles=[{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('123456')},{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/'+guid}];
  db.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[key,'tennis-europe',guid,'TEST PLAYER','Test Player','{}']);
  db.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['person:test','PLAYER TEST',JSON.stringify({canonicalId:'person:test',name:'Test Player',circuitProfiles:profiles})]);
  db.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,'person:test','PLAYER TEST','tennis-europe',guid,'TEST PLAYER','Test Player']);
  let release,started;const began=new Promise(resolve=>started=resolve);
  const pending=addCourtWatchPlayer(db.env,user,{sourceKey:key},{fetchClub:card=>{assert.equal(card,'123456');started();return new Promise(resolve=>release=resolve)}});
  await began;assert.equal(db.writes(),0);release('A.S.D. TENNIS CLUB LECCO');
  const result=await pending;
  assert.equal(result.playerId,'person:test');assert.equal(result.player.membershipCard,'123456');assert.equal(result.player.club,'Tennis Club Lecco');
  assert.deepEqual(result.player.circuits,['tennis-europe','fitp']);
  const before=db.writes();const replay=await addCourtWatchPlayer(db.env,user,{sourceKey:key},{fetchClub:()=>{throw Error('must reuse club')}});
  assert.equal(replay.changed,false);assert.equal(db.writes(),before);
  const read=await personalPlayerAdditions(db.env,user.id);assert.equal(read[0].club,'Tennis Club Lecco');assert.equal(db.writes(),before);
 }finally{db.close()}
});

test('addition reuses the identity it just verified instead of resolving the same source twice',async()=>{
 const d=database({identityMapping:true});try{
  const key='itf|id:101',id='person:reuse',person={id,canonicalId:id,name:'Test Player',sourceKey:key,sourceCircuit:'itf',worldTennisId:'101'};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'TEST PLAYER',JSON.stringify(person)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,id,'TEST PLAYER','itf','101','TEST PLAYER',person.name]);
  let lookups=0;const db={prepare(sql){if(sql.startsWith('SELECT p.payload FROM player_identity_people'))lookups++;return d.env.DB.prepare(sql)},batch:s=>d.env.DB.batch(s)};
  const result=await addCourtWatchPlayer({DB:db},user,{sourceKey:key,name:person.name});
  assert.equal(result.playerId,id);assert.equal(result.player.worldTennisId,'101');assert.equal(lookups,1);
  const before=d.writes();lookups=0;const replay=await addCourtWatchPlayer({DB:db},user,{sourceKey:key,name:person.name});
  assert.equal(replay.changed,false);assert.equal(d.writes(),before);assert.equal(lookups,1);
 }finally{d.close()}
});

function interceptedDatabase(db,intercept){
 return{prepare(sql){const wrap=statement=>({
  ...statement,
  bind(...values){return wrap(statement.bind(...values))},
  first:()=>intercept(sql,()=>statement.first()),
  all:()=>intercept(sql,()=>statement.all())
 });return wrap(db.prepare(sql))},batch:statements=>db.batch(statements)};
}

test('first addition overlaps exact configured, canonical and personal lookups without extra reads or writes',async()=>{
 const d=database({identityMapping:true});let release,operation;
 try{
  const key='itf|id:101',id='person:parallel';
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'TEST PLAYER',JSON.stringify({canonicalId:id,name:'Test Player',sourceKey:key,worldTennisId:'101'})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,id,'TEST PLAYER','itf','101','TEST PLAYER','Test Player']);
  const gate=new Promise(resolve=>release=resolve);let canonicalStarted;
  const started=new Promise(resolve=>canonicalStarted=resolve),counts=new Map();
  const DB=interceptedDatabase(d.env.DB,async(sql,read)=>{
   counts.set(sql,(counts.get(sql)||0)+1);
   if(sql.startsWith('SELECT p.payload FROM player_identity_people')){canonicalStarted();await gate}
   return read();
  });
  operation=addCourtWatchPlayer({DB},user,{sourceKey:key,group:'others'});
  await started;await new Promise(setImmediate);
  assert.equal([...counts.keys()].some(sql=>sql.includes('WHERE user_id=? AND observed_source_key=?')),true);
  assert.equal([...counts.keys()].some(sql=>sql.includes('CAST(json_extract(payload,?)')),true);
  assert.equal(d.writes(),0);release();
  const first=await operation;assert.equal(first.playerId,id);assert.equal(first.player.worldTennisId,'101');
  assert.equal([...counts].find(([sql])=>sql.startsWith('SELECT p.payload FROM player_identity_people'))[1],1);
  const writes=d.writes();assert.equal(writes,3); // Includes the existing identity-queue trigger.
  assert.equal((await addCourtWatchPlayer({DB},user,{sourceKey:key,group:'others'})).changed,false);
  assert.equal(d.writes(),writes);
 }finally{release?.();if(operation)await operation.catch(()=>{});d.close()}
});

test('official club and membership reads overlap, but both finish before any durable write',async()=>{
 const d=database();let release,operation;
 try{
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:777','fitp','777','TEST PLAYER','Test Player','{}']);
  let membershipStarted,clubStarted=false;const started=new Promise(resolve=>membershipStarted=resolve),gate=new Promise(resolve=>release=resolve);
  const DB=interceptedDatabase(d.env.DB,async(sql,read)=>{
   if(sql.startsWith('SELECT courtwatch_id FROM user_app_other_players WHERE')){membershipStarted();await gate}
   return read();
  });
  operation=addCourtWatchPlayer({DB},user,{sourceKey:'fitp|id:777',group:'others'},{fetchClub:async()=>{clubStarted=true;return 'Tennis Club Lecco'}});
  await started;await new Promise(setImmediate);
  assert.equal(clubStarted,true);assert.equal(d.writes(),0);release();
  const result=await operation;assert.equal(result.player.club,'Tennis Club Lecco');assert.equal(d.writes(),2);
 }finally{release?.();if(operation)await operation.catch(()=>{});d.close()}
});

test('retained personal ID is checked directly for membership with no redundant canonical-ID read',async()=>{
 const d=database({identityMapping:true});try{
  const key='itf|id:101',canonicalId='person:current',retainedId='cw-retained-personal';
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[canonicalId,'TEST PLAYER',JSON.stringify({canonicalId,name:'Test Player',sourceKey:key,worldTennisId:'101'})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,canonicalId,'TEST PLAYER','itf','101','TEST PLAYER','Test Player']);
  const first=await addCourtWatchPlayer(d.env,user,{sourceKey:key,group:'others'});
  const saved={...first.player,id:retainedId};
  d.execute('UPDATE user_app_player_additions SET courtwatch_id=?,payload=? WHERE courtwatch_id=?',[retainedId,JSON.stringify(saved),canonicalId]);
  d.execute('UPDATE user_app_other_players SET courtwatch_id=? WHERE courtwatch_id=?',[retainedId,canonicalId]);
  const membershipIds=[];
  const DB={prepare(sql){const statement=d.env.DB.prepare(sql);if(!sql.startsWith('SELECT courtwatch_id FROM user_app_other_players WHERE'))return statement;return{...statement,bind(...values){membershipIds.push(values[1]);return statement.bind(...values)}}},batch:statements=>d.env.DB.batch(statements)};
  const before=d.writes(),result=await addCourtWatchPlayer({DB},user,{sourceKey:key,group:'others'});
  assert.equal(result.playerId,retainedId);assert.equal(result.changed,false);assert.equal(d.writes(),before);
  assert.deepEqual(membershipIds,[retainedId]);
 }finally{d.close()}
});

test('exact observed and acquired selections use a unique index despite many unrelated rows and blank official IDs',async()=>{
 for(const table of ['observed_players','search_acquired_players']){
  const d=database({identityMapping:true});try{
   d.execute(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<15000)
    INSERT INTO ${table}(source_key,circuit,official_id,normalized_name,display_name,payload)
    SELECT 'unrelated|'||i,'fitp','','UNRELATED','Unrelated Player','{}' FROM n`);
   const key=(table==='search_acquired_players'?'acquired|':'')+'fitp|id:998877';
   d.execute(`INSERT INTO ${table}(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)`,[key,'fitp','998877','SELECTED PLAYER','Selected Player',JSON.stringify({club:'Tennis Club Lecco',ranking:'3.2',birthYear:2011})]);
   const sourceQueries=[],stages=[];
   const DB=interceptedDatabase(d.env.DB,(sql,read)=>{
    if(sql.startsWith('SELECT source_key,circuit,official_id,display_name,payload FROM '))sourceQueries.push(sql);
    return read();
   });
   const result=await addCourtWatchPlayer({DB},user,{sourceKey:key,name:'Selected Player',group:'others'},{measure:(stage,operation)=>{stages.push(stage);return operation()}});
   assert.equal(result.player.name,'Selected Player');assert.equal(result.player.sourceKey,key);
   assert.equal(result.player.membershipCard,'998877');assert.equal(result.player.club,'Tennis Club Lecco');assert.equal(result.player.ranking,'3.2');assert.equal(result.player.birthYear,2011);
   assert.equal(sourceQueries.length,1);assert.match(sourceQueries[0],/WHERE source_key=\? LIMIT 20$/);assert.doesNotMatch(sourceQueries[0],/ OR /);
   const plan=d.execute('EXPLAIN QUERY PLAN '+sourceQueries[0],[key]).rows.map(row=>row.detail).join('\n');
   assert.match(plan,/SEARCH .* USING INDEX .*source_key=\?/);assert.doesNotMatch(plan,/SCAN /);
   for(const stage of ['source_lookup','identity_mapping','personal_selection','configured_identity','identity_hydration','membership_read','membership_write'])assert.ok(stages.includes(stage),stage);
   const before=d.writes(),replay=await addCourtWatchPlayer({DB},user,{sourceKey:key,name:'Selected Player',group:'others'});
   assert.equal(replay.changed,false);assert.equal(d.writes(),before);
  }finally{d.close()}
 }
});

test('saved acquired-player metadata and exact canonical identity load together with unchanged precedence',async()=>{
 const sourceKey='acquired|itf|id:800123456',player={id:'cw-parallel-read',name:'Case Person',sourceKey,sourceCircuit:'itf',worldTennisId:'800123456'};
 const canonical={canonicalId:'person:parallel-read',name:player.name,circuitProfiles:[{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('1234567890')}]};
 let release,overlap=false;const calls=[];
 const db={prepare(sql){return {bind(){return {all:async()=>{
  calls.push(sql);
  if(sql.startsWith('SELECT a.payload'))return {results:[{payload:JSON.stringify(player)}]};
  if(sql.startsWith('SELECT source_key,payload'))return new Promise(resolve=>{release=()=>resolve({results:[{source_key:sourceKey,payload:'{"birthYear":2012,"nationality":"ITA"}'}]})});
  if(sql.includes('WITH requested AS')){overlap=Boolean(release);release();return {results:[{lookup_key:sourceKey,canonical_id:canonical.canonicalId,payload:JSON.stringify(canonical)}]}}
  if(sql.startsWith('SELECT official_id,payload'))return {results:[{official_id:'1234567890',payload:'{"club":"Verified Club","ranking":"3.1"}'}]};
  throw Error('unexpected read '+sql);
 }}}}}};
 const result=await personalPlayerAdditions({DB:db},'owner','others',player.id);
 assert.equal(overlap,true);assert.equal(calls.length,4);assert.equal(result.length,1);
 assert.equal(result[0].id,player.id);assert.equal(result[0].membershipCard,'1234567890');assert.equal(result[0].club,'Verified Club');assert.equal(result[0].ranking,'3.1');assert.equal(result[0].birthYear,2012);
});
