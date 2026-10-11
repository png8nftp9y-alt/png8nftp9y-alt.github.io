import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {displayPlayerClub} from '../lib/personal-player-metadata.mjs';
import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
import {officialPlayerUrl,playerCircuitIdentities} from '../lib/player-circuit-profiles.mjs';
const guid='12345678-1234-1234-1234-123456789abc';
const ids=[['fitp','123456'],['tennis-europe',guid],['itf','800123456']];
const player={id:'person:test',canonicalId:'person:test',name:'Test Player',circuit:'tennis-europe',sourceCircuit:'tennis-europe',sourceKey:'selected',sourcePlayerId:guid,nationality:'ITA',birthYear:2010,circuitProfiles:ids.map(([circuit,officialId])=>({circuit,url:officialPlayerUrl(circuit,{name:'Test Player',nationality:'ITA',officialId})}))};
test('circuit identities use native links and reject conflicting IDs and foreign URLs',()=>{
 assert.deepEqual(playerCircuitIdentities(player),ids.map(([circuit,profileId])=>({circuit,profileId})));
 assert.deepEqual(playerCircuitIdentities({...player,membershipCard:'654321'}).map(p=>p.circuit),['tennis-europe','itf']);
 assert.deepEqual(playerCircuitIdentities({circuits:['fitp','itf'],circuitProfiles:[{circuit:'fitp',url:'https://evil.example/Pagina-Giocatore/?cardNumber=MTIzNDU2'}]}),[]);
});
test('search opponent and followed snapshot use all three circuits; only opponent limits the combined window',async()=>{
 const d=database({identityMapping:true}),fetchBefore=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try{
  await d.query(readFileSync(new URL('../migrations/0022_opponent_entry_profiles.sql',import.meta.url),'utf8'));
  await d.query(readFileSync(new URL('../migrations/0003_manual_overrides.sql',import.meta.url),'utf8'));
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[player.id,'PLAYER TEST',JSON.stringify(player)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['selected',player.id,'PLAYER TEST','tennis-europe',guid,'TEST PLAYER',player.name]);
  const dates=[['2026-09-29','2026-10-15'],['2026-10-02','2026-10-20'],['2026-10-05','2026-10-12']];
  for(const [i,[circuit,id]] of ids.entries())d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?,?)',[circuit,id,'test player',player.name,JSON.stringify({tournaments:dates[i].map((date,j)=>({competitionId:circuit+j,startDate:date,endDate:date,entryStatus:'iscritto'}))}),'2026-10-11']);
  d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?,?)',['fitp','654321','test player',player.name,JSON.stringify({tournaments:[{competitionId:'homonym',startDate:'2026-10-11'}]}),'2026-10-11']);
  for(const [i,[circuit,id]] of ids.entries()){
   const tid='history:'+circuit,mid='match:'+circuit,date=dates[i][0],competitionId=circuit+'0';
   d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',[tid,circuit,competitionId,date,date,JSON.stringify({name:'History '+circuit,competitionId,startDate:date,endDate:date})]);
   d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[mid,tid,circuit,date,JSON.stringify({competitionId,event:'GS14',score:'6-2 6-3',status:'completed'})]);
   for(const [key,native,name,team,winner] of [['self',id,player.name,0,1],['opponent','other','Other Player',1,0]])d.execute('INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload) VALUES(?,?,?,?,?,?,?,?,?)',[mid,key,native,name,name.toLowerCase(),'ITA',team,winner,'{}']);
  }
  const env={DB:d.db},headers={'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'};
  const read=async path=>{const response=await worker.fetch(new Request('https://example.test/app/api/'+path,{headers}),env);assert.equal(response.status,200,await response.clone().text());return response.json()};
  const beforeWrites=d.writes();
  const opponent=await read('opponent-profile?name=Test%20Player&profileId=selected&asOf=2026-10-11');
  assert.deepEqual(opponent.tournaments.map(t=>t.competitionId),['itf1','itf0','tennis-europe0','fitp0']);
  assert.deepEqual(new Set(opponent.sources),new Set(ids.map(([c])=>c)));
  assert.equal(d.writes(),beforeWrites);
  d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',['user-federico-181099',player.id,'selected',JSON.stringify({...player,circuitProfiles:undefined}),'2026-10-11']);
  d.execute('INSERT INTO user_app_players VALUES(?,?,?)',['user-federico-181099',player.id,'2026-10-11']);
  const afterAddWrites=d.writes(),snapshot=await read('app-snapshot');
  assert.equal(snapshot.players[0].id,player.id);
  assert.equal(snapshot.tournaments.length,6);
  assert.equal(snapshot.matches.length,3);
  assert.ok(opponent.tournaments.filter(t=>t.historyKind==='past').every(t=>t.matches.length===1));
  assert.ok(snapshot.tournaments.filter(t=>t.startDate<'2026-10-11').every(t=>t.calendarState==='draw_confirmed'));
  assert.deepEqual(new Set(snapshot.tournaments.map(t=>t.circuit)),new Set(ids.map(([c])=>c)));
  assert.ok(snapshot.tournaments.every(t=>t.competitionId!=='homonym'));
  assert.ok(opponent.tournaments.every(t=>snapshot.tournaments.some(s=>s.competitionId===t.competitionId&&s.circuit===t.circuit)));
  assert.equal(d.writes(),afterAddWrites);
 }finally{globalThis.fetch=fetchBefore;d.close()}
});

test('club display removes legal designation and uses lowercase in API and UI',()=>{
 const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),context={};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function displayPlayerClub('),source.indexOf('function personalPlayerAffiliationHtml(')),context);
 for(const [input,expected] of [['ASSOCIAZIONE SPORTIVA DILETTANTISTICA Tennis Club Lecco','tennis club lecco'],['Tennis Milano Associazione Sportiva Dilettantistica','tennis milano'],['A.S.D.  Tennis Roma','tennis roma'],['ASD Tennis Genova','tennis genova'],['Tennis Àquila','tennis àquila']]){
  assert.equal(displayPlayerClub(input),expected);assert.equal(context.displayPlayerClub(input),expected);
 }
});
