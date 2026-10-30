import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {snapshotHistoryPlayers,snapshotEntryPlayer} from '../lib/snapshot-history-players.mjs';
import worker from '../src/index.js';
import {readFileSync} from 'node:fs';

const user='user-federico-181099',native='800123456';
const configured={id:'configured-itf',name:'Configured Player',nationality:'ITA'};
const person={canonicalId:'person:configured',name:configured.name,worldTennisId:native};
function link(d){
 d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[person.canonicalId,'CONFIGURED PLAYER',JSON.stringify(person)]);
 d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['courtwatch|'+configured.id,person.canonicalId,'CONFIGURED PLAYER','courtwatch',configured.id,'CONFIGURED PLAYER',configured.name]);
}

test('configured ITF identity uses its exact CourtWatch link, not name matching or user additions',async()=>{
 const d=database({identityMapping:true});try{
  link(d);const before=d.writes();
  const personal={id:'personal',name:'Existing personal',sourceKey:'acquired|itf|id:800111111'};
  const result=await snapshotHistoryPlayers(d.db,[configured,{id:'homonym',name:configured.name},personal],[personal]);
  assert.deepEqual(result.players.map(p=>p.id),['personal',configured.id]);
  assert.equal(result.players[1].worldTennisId,native);
  assert.deepEqual(snapshotEntryPlayer(result.players[1],result.configuredIds),{id:configured.id,name:configured.name,sourceCircuit:'itf',sourcePlayerId:native});
  assert.equal(snapshotEntryPlayer(personal,result.configuredIds),personal);
  const conflict=await snapshotHistoryPlayers(d.db,[{...configured,worldTennisId:'800999999'}],[]);
  assert.equal(conflict.players.length,0);assert.equal(d.writes(),before);
 }finally{d.close()}
});

test('configured player snapshot includes every acquired ITF tournament and match, without additions, homonym leakage or replay writes',async()=>{
 const d=database({identityMapping:true});try{
  link(d);await d.query(readFileSync(new URL('../migrations/0022_opponent_entry_profiles.sql',import.meta.url),'utf8'));
  d.execute('INSERT INTO app_players(seq,id,payload) VALUES(?,?,?)',[1,configured.id,JSON.stringify(configured)]);
  d.execute('INSERT INTO user_app_players VALUES(?,?,?)',[user,configured.id,'2026-10-29']);
  assert.equal(d.execute('SELECT * FROM user_app_player_additions').length,0);
  const q=v=>"'"+String(v).replaceAll("'","''")+"'",sql=[];
  for(let i=0;i<10;i++){
   const tid='itf-t'+i,mid='itf-m'+i,date='2026-09-'+String(i+1).padStart(2,'0'),id=i===9?'800999999':native;
   sql.push(`INSERT INTO tournaments VALUES(${[tid,'itf','J-TEST-'+i,date,date,JSON.stringify({competitionId:'J-TEST-'+i,name:'ITF tournament '+i,startDate:date,endDate:date})].map(q).join(',')});`);
   sql.push(`INSERT INTO matches VALUES(${[mid,tid,'itf',date,JSON.stringify({event:'Girls Singles',score:'6-2 6-3',status:'completed'})].map(q).join(',')});`);
   for(const [key,pid,name,team,winner] of [['self',id,configured.name,0,1],['other','800888888','Opponent',1,0]])
    sql.push(`INSERT INTO match_participants VALUES(${[mid,key,pid,name,name.toLowerCase(),'ITA',team,winner,'{}'].map(q).join(',')});`);
  }
  await d.query(sql.join('\n'));
  d.execute('INSERT INTO app_matches(seq,player_id,competition_id,match_date,payload) VALUES(?,?,?,?,?)',[1,configured.id,'J-TEST-0','2026-09-01',JSON.stringify({id:'legacy-app-row',matchId:'itf-m0',playerId:configured.id,circuit:'itf',competitionId:'J-TEST-0',retainedField:'keep'})]);
  const entries=[{competitionId:'WITHDRAWN',name:'Withdrawn intention only',startDate:'2026-10-01',endDate:'2026-10-07',entryStatus:'withdrawn'},
   {competitionId:'FUTURE1',name:'Future one',startDate:'2026-11-01',endDate:'2026-11-07',entryStatus:'active',acceptanceCode:'Q'},
   {competitionId:'FUTURE2',name:'Future two',startDate:'2026-11-08',endDate:'2026-11-14',entryStatus:'active',acceptanceCode:'A'}];
  d.execute('INSERT INTO opponent_entry_profiles(circuit,source_player_id,normalized_name,display_name,payload,updated_at) VALUES(?,?,?,?,?,?)',['itf',native,'configured player',configured.name,JSON.stringify({tournaments:entries}),'2026-10-29']);
  const request=path=>worker.fetch(new Request('https://test/app/api/app-snapshot'+path,{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}}),{DB:d.db});
  const r=await request('?playerId='+configured.id);assert.equal(r.status,200,await r.clone().text());const scoped=await r.json();
  assert.equal(scoped.matches.find(m=>m.matchId==='itf-m0').retainedField,'keep');
  assert.equal(scoped.matches.length,9);assert.ok(scoped.matches.every(m=>m.playerId===configured.id&&m.matchId!=='itf-m9'));
  assert.equal(scoped.tournaments.filter(t=>t.entryStatus==='official_draw').length,9);
  for(const id of ['FUTURE1','FUTURE2'])assert.ok(scoped.tournaments.some(t=>t.competitionId===id));
  assert.equal(scoped.tournaments.find(t=>t.competitionId==='WITHDRAWN').entryStatus,'withdrawn');
  assert.ok(!scoped.tournaments.some(t=>t.competitionId==='J-TEST-9'));
  const before=d.writes();const replay=await request('?playerId='+configured.id);assert.equal(replay.status,200);assert.deepEqual((await replay.json()).tournaments,scoped.tournaments);assert.equal(d.writes(),before);
  const whole=await request('');assert.equal(whole.status,200);const broad=await whole.json();assert.deepEqual(broad.matches,scoped.matches);assert.deepEqual(broad.tournaments,scoped.tournaments);
 }finally{d.close()}
});
