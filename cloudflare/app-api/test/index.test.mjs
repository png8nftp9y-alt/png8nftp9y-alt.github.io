import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
const owner='user-federico-181099';
const headers={'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','Origin':'https://courtwatch.example','Content-Type':'application/json'};
function setup(){
 const d=database({identityMapping:true});
 d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['itf|id:800000001','itf','800000001','TEST OTHER','Test Other','{}']);
 const request=(path,group='main',method='GET',body)=>worker.fetch(new Request('https://courtwatch.example/app/api'+path,{method,headers:{...headers,'X-CourtWatch-Group':group},...(body?{body:JSON.stringify(body)}:{})}),{DB:d.db});
 return{...d,request};
}
test('D1_TEST_INITIAL_IMPORT: Others POST is durable without creating a main selection',async()=>{
 const d=setup();try{
  const r=await d.request('/courtwatch-player','others','POST',{sourceKey:'itf|id:800000001'});assert.equal(r.status,200);
  assert.equal(d.execute('SELECT * FROM user_app_other_players WHERE user_id=?',[owner]).length,1);
  assert.equal(d.execute('SELECT * FROM user_app_players WHERE user_id=?',[owner]).length,0);
  const snapshot=await d.request('/app-snapshot','others');assert.equal(snapshot.status,200);assert.equal((await snapshot.json()).players.length,1);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated Others POST and scoped GET write nothing',async()=>{
 const d=setup();try{
  const body={sourceKey:'itf|id:800000001'};await d.request('/courtwatch-player','others','POST',body);
  const before=d.writes();assert.equal((await d.request('/courtwatch-player','others','POST',body)).status,200);
  assert.equal((await d.request('/app-snapshot','others')).status,200);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: remove Others membership preserves main and repeated removal writes nothing',async()=>{
 const d=setup();try{
  const body={sourceKey:'itf|id:800000001'};
  const r=await d.request('/courtwatch-player','others','POST',body),id=(await r.json()).playerId;
  await d.request('/courtwatch-player','main','POST',body);
  const before=d.writes();assert.equal((await d.request('/courtwatch-player?playerId='+id,'others','DELETE')).status,200);assert.equal(d.writes()-before,1);
  assert.equal(d.execute('SELECT * FROM user_app_players WHERE user_id=?',[owner]).length,1);
  const after=d.writes();assert.equal((await d.request('/courtwatch-player?playerId='+id,'others','DELETE')).status,404);assert.equal(d.writes(),after);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: unknown player and invalid group cannot create membership',async()=>{
 const d=setup();try{
  const before=d.writes();assert.equal((await d.request('/courtwatch-player','invalid','POST',{sourceKey:'itf|id:800000001'})).status,400);
  assert.equal((await d.request('/courtwatch-player','others','POST',{sourceKey:'missing'})).status,404);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('global manual overrides do not populate the empty Others list',async()=>{
 const d=setup();try{
  d.execute('INSERT INTO manual_overrides(id,entity_type,entity_id,action,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',['demo-player','player','unselected','upsert',JSON.stringify({id:'unselected',name:'Main Only'}),'now','now']);
  d.execute('INSERT INTO manual_overrides(id,entity_type,entity_id,action,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',['demo-tournament','tournament','unselected-tournament','upsert',JSON.stringify({id:'unselected-tournament',playerId:'unselected'}),'now','now']);
  const r=await d.request('/app-snapshot','others');assert.equal(r.status,200);
  const data=await r.json();assert.deepEqual(data.players,[]);assert.deepEqual(data.tournaments,[]);assert.deepEqual(data.matches,[]);
 }finally{d.close()}
});

test('unreleased ITF history never blocks the owned Others snapshot',async()=>{
 const d=setup();try{
  await d.request('/courtwatch-player','others','POST',{sourceKey:'itf|id:800000001'});
  const prepare=d.db.prepare.bind(d.db);d.db.prepare=sql=>{
   if(sql.startsWith('SELECT DISTINCT m.id AS match_id'))return{bind(){return{all:async()=>{throw Error('personal_history_identity_ambiguous')}}}};
   return prepare(sql);
  };
  const snapshot=await d.request('/app-snapshot','others');assert.equal(snapshot.status,200);assert.equal((await snapshot.json()).players.length,1);
 }finally{d.close()}
});

test('public personal projection does not read unreleased FITP or ITF matches',async()=>{
 const {personalCircuitHistory}=await import('../lib/personal-tennis-europe-history.mjs');
 const db={prepare(){throw Error('unreleased_history_was_queried')}};
 const history=await personalCircuitHistory(db,{name:'Pietro Sala',membershipCard:'4537099241',worldTennisId:'800638581'},{publishedCircuits:['tennis-europe']});
 assert.equal(history.matches.length,0);assert.equal(history.tournaments.length,0);
});
