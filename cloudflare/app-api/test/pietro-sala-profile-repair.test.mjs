import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {savePietroSalaMetadata,recoverPietroSalaFitpClubs,saveConfirmedPietroSalaLink,selectPietroSalaLink} from '../lib/confirmed-pietro-sala-link.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {storedIdentity} from '../lib/player-identity-lookup.mjs';
import {hydratePersonalCircuitIdentity} from '../lib/courtwatch-player-additions.mjs';
import {itfParticipantSQL,itfMatchScore} from '../../../src/v3/itf-match-participants.mjs';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
test('official metadata survives canonical merge and ITF-first personal selection; identical replay has zero writes',async()=>{
 const d=database({identityMapping:true});try{
  const row={source_table:'search_acquired_players',source_key:'fitp|id:4537099241',circuit:'fitp',official_id:'4537099241',display_name:'Pietro Sala',payload:'{}'};
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[row.source_key,row.circuit,row.official_id,'PIETRO SALA',row.display_name,row.payload]);
  const itf={...row,source_key:'itf|id:800638581',circuit:'itf',official_id:'800638581',payload:JSON.stringify({nationality:'SUI'})};d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[itf.source_key,itf.circuit,itf.official_id,'PIETRO SALA',itf.display_name,itf.payload]);
  const fetcher=async()=>({ok:true,json:async()=>({player:{name:'PIETRO',surname:'SALA',membershipCard:'*******241',tennis_club_name:'AS DILETTANTISTICA CIRCOLO TENNIS DECIMOMANNU',ranking:'3.2'}})});
  const enriched=await recoverPietroSalaFitpClubs([row],{fetcher});await savePietroSalaMetadata(d.query,[row],enriched);await syncPlayerIdentities(d.query);const rule=selectPietroSalaLink([...enriched,itf]);await saveConfirmedPietroSalaLink(d.query,rule,[row,itf]);await syncPlayerIdentities(d.query);
  const person=await storedIdentity(d.db,itf.source_key);assert.equal(person.ranking,'3.2');assert.match(person.club,/DECIMOMANNU/);assert.equal(person.birthYear,2009);assert.ok(!person.birthDate);
  const selected=await hydratePersonalCircuitIdentity(d.db,{id:person.canonicalId,sourceKey:itf.source_key,sourceCircuit:'itf',name:'Pietro Sala',ranking:'',club:''});assert.equal(selected.ranking,'3.2');assert.match(selected.club,/Decimomannu/);assert.equal(selected.birthYear,2009);
  const writes=d.writes();await savePietroSalaMetadata(d.query,enriched,enriched);await syncPlayerIdentities(d.query);assert.equal(d.writes(),writes);
  await assert.rejects(savePietroSalaMetadata(async()=>{throw Error('write_unavailable')},enriched,[{...enriched[0],payload:JSON.stringify({...JSON.parse(enriched[0].payload),ranking:'3.1'})}]),/write_unavailable/);
  assert.equal((await storedIdentity(d.db,itf.source_key)).ranking,'3.2');
 }finally{d.close()}
});
test('acquired ITF match participants unlock history, preserve doubles partner and score, ignore an older version, replay writes zero',async()=>{
 const d=database();try{
  const p={id:'800638581',name:'Pietro Sala',nationalityCode:'SUI'},partner={id:'800111111',name:'Partner',nationalityCode:'ITA'};
  const m={id:'match_itf_example',competitionId:'J-J30-SUI-2026-004',event:'B-D-M-KO',round:'Quarter final',winnerTeam:1,teams:[{players:[{id:'800222222',name:'Opponent'}],score:'6 3 8'},{players:[p,partner],score:'4 6 10',isWinner:true}],_itfDrawObservedAt:'2026-10-11'};
  d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['t','itf',m.competitionId,'2026-08-01','2026-08-07',JSON.stringify({name:'Agno',startDate:'2026-08-01',endDate:'2026-08-07'})]);
  d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[m.id,'t','itf','2026-08-05',JSON.stringify(m)]);
  assert.equal((await personalCircuitHistory(d.db,{name:p.name,worldTennisId:p.id})).matches.length,0);
  for(const sql of itfParticipantSQL(m))await d.query(sql);
  const history=await personalCircuitHistory(d.db,{name:p.name,worldTennisId:p.id});assert.equal(history.tournaments.length,1);assert.equal(history.matches[0].partner,'Partner');assert.equal(history.matches[0].score,'4-6 6-3 10-8');assert.equal(history.matches[0].advances,true);
  const writes=d.writes();for(const sql of itfParticipantSQL(m))await d.query(sql);assert.equal(d.writes(),writes);
  for(const sql of itfParticipantSQL({...m,_itfDrawObservedAt:'2026-01-01',winnerTeam:0}))await d.query(sql);assert.equal(d.writes(),writes);
  assert.equal(itfMatchScore({...m,teams:[]}), '');
 }finally{d.close()}
});
