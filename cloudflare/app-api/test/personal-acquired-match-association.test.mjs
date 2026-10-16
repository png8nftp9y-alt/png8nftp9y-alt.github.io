import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';
import worker from '../src/index.js';
const guid='12345678-1234-1234-1234-123456789abc';
const otherGuid='abcdefab-1234-1234-1234-123456789abc';
const player={id:'person:test',canonicalId:'person:test',name:'Case Player',nationality:'SUI',sourceCircuit:'tennis-europe',profileSync:{tennisEurope:{profileId:guid}},membershipCard:'123456',worldTennisId:'800123456'};
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
test('all 270 local-ID TE matches and both other circuits attach, same-name local-ID reuse stays separate, replay writes zero',async()=>{
 const d=database({identityMapping:true});
 try{
  const raw={id:'78',name:player.name,nationality:'SUI'},source=acquiredPlayer('tennis-europe',raw);
  player.sourceKey=source.sourceKey;
  const otherRaw={...raw,birthYear:2011},otherSource=acquiredPlayer('tennis-europe',otherRaw);
  const other={id:'person:other',canonicalId:'person:other',name:player.name,nationality:'SUI',profileSync:{tennisEurope:{profileId:otherGuid}}};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[player.id,'CASE PLAYER',JSON.stringify(player)]);
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[other.id,'CASE PLAYER',JSON.stringify(other)]);
  for(const [sourceKey,person,id] of [[source.sourceKey,player,guid],[otherSource.sourceKey,other,otherGuid]])
   d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[sourceKey,person.id,'CASE PLAYER','tennis-europe',id,'CASE PLAYER',player.name]);
  const statements=[];
  function addMatch(mid,tid,circuit,native,raw,doubles=false){
   const date='2026-01-02';
   statements.push(`INSERT OR IGNORE INTO tournaments VALUES(${q(tid)},${q(circuit)},${q(tid)},${q(date)},${q(date)},${q(JSON.stringify({name:tid,competitionId:tid,startDate:date,endDate:date}))});`);
   statements.push(`INSERT INTO matches VALUES(${q(mid)},${q(tid)},${q(circuit)},${q(date)},${q(JSON.stringify({event:doubles?'GD14':'GS14',score:'6-2 6-3',status:'completed'}))});`);
   const people=[['self',native,player.name,0,1,raw],['opponent','other','Other Player',1,0,{}]];
   if(doubles)people.push(['partner','77','Partner Player',0,1,{}],['opponent2','76','Second Opponent',1,0,{}]);
   for(const [key,id,name,team,winner,payload] of people)
    statements.push(`INSERT INTO match_participants VALUES(${[mid,key,id,name,name.toLowerCase(),'SUI',team,winner,JSON.stringify(payload)].map(q).join(',')});`);
  }
  for(let i=0;i<270;i++)addMatch('m'+String(i).padStart(4,'0'),'t'+i%8,'tennis-europe','78',raw,i%2===0);
  addMatch('wrong','wrong-tournament','tennis-europe','78',otherRaw);
  addMatch('fitp-match','fitp-tournament','fitp','123456',{});
  addMatch('itf-match','itf-tournament','itf','800123456',{});
  await d.query(statements.join('\n'));
  const before=d.writes(),history=await personalCircuitHistory(d.db,player);
  assert.equal(history.matches.length,272);
  assert.equal(history.tournaments.length,10);
  assert.equal(history.matches.filter(m=>m.matchType==='doubles').length,135);
  assert.ok(history.matches.every(m=>m.playerId===player.id&&m.matchId!=='wrong'));
  assert.deepEqual(new Set(history.matches.map(m=>m.circuit)),new Set(['fitp','itf','tennis-europe']));
  assert.equal((await personalCircuitHistory(d.db,player)).matches.length,272);
  assert.equal(d.writes(),before);
  d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',['user-federico-181099',player.id,source.sourceKey,JSON.stringify(player),'2026-10-12']);
  d.execute('INSERT INTO user_app_other_players VALUES(?,?,?)',['user-federico-181099',player.id,'2026-10-12']);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
  try{
   const response=await worker.fetch(new Request('https://example.test/app/api/app-snapshot?group=others',{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','X-CourtWatch-Group':'others'}}),{DB:d.db});
   assert.equal(response.status,200,await response.clone().text());
   const snapshot=await response.json();
   assert.equal(snapshot.matches.length,272);
   assert.ok(snapshot.matches.every(m=>m.playerId===player.id&&m.matchId!=='wrong'));
   const scopedResponse=await worker.fetch(new Request('https://example.test/app/api/app-snapshot?playerId='+encodeURIComponent(player.id),{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','X-CourtWatch-Group':'others'}}),{DB:d.db});
   assert.equal(scopedResponse.status,200);const scoped=await scopedResponse.json();
   assert.deepEqual(scoped.matches,snapshot.matches);assert.deepEqual(scoped.tournaments,snapshot.tournaments);
   assert.equal(scoped.playerId,player.id);

  }finally{globalThis.fetch=originalFetch;}

 }finally{d.close()}
});
test('unmapped local IDs do not attach to a global profile by name alone',async()=>{
 const d=database({identityMapping:true});
 try{
  d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['t','tennis-europe','t','2026-01-01','2026-01-01','{}']);
  d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',['m','t','tennis-europe','2026-01-01','{}']);
  d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',['m','self','78',player.name,'case player','SUI',0,1,'{}']);
  assert.equal((await personalCircuitHistory(d.db,{...player,sourceKey:undefined,canonicalId:undefined})).matches.length,0);
 }finally{d.close()}
});
