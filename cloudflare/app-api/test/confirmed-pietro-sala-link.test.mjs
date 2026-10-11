import test from 'node:test';import assert from 'node:assert/strict';import {database} from './search-sqlite-fixture.mjs';
import {selectPietroSalaLink,saveConfirmedPietroSalaLink,linkKey} from '../lib/confirmed-pietro-sala-link.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';import {storedIdentity} from '../lib/player-identity-lookup.mjs';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';import {otherCircuitOpponentHistory} from '../lib/opponent-canonical-history.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
const rows=[
 {source_table:'search_acquired_players',source_key:'sardegna',circuit:'fitp',official_id:'123456789',display_name:'Pietro Sala',payload:JSON.stringify({nationality:'ITA',birthYear:2009,club:'Circolo Tennis Decimomannu'})},
 {source_table:'search_acquired_players',source_key:'homonym',circuit:'fitp',official_id:'987654321',display_name:'Pietro Sala',payload:JSON.stringify({nationality:'ITA',birthYear:1964,club:'Circolo Tennis Giussano'})},
 {source_table:'search_acquired_players',source_key:'itf',circuit:'itf',official_id:'800638581',display_name:'Pietro Sala',payload:JSON.stringify({nationality:'SUI',birthYear:2009})},
 {source_table:'search_acquired_players',source_key:'itf-old',circuit:'itf',official_id:'800229374',display_name:'Pietro Sala',payload:JSON.stringify({nationality:'ITA',birthYear:1964})}
];
function insert(d,row){d.execute('INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[row.source_key,row.circuit,row.official_id,'PIETRO SALA',row.display_name,row.payload]);}
test('exact confirmed native profiles link across country differences; both homonyms stay separate, later deltas preserve link and replay is zero writes',async()=>{
 const d=database({identityMapping:true});try{
  rows.forEach(r=>insert(d,r));await syncPlayerIdentities(d.query);assert.notEqual((await storedIdentity(d.db,'sardegna')).canonicalId,(await storedIdentity(d.db,'itf')).canonicalId);
  const beforeMatches=d.execute('SELECT * FROM matches'),rule=selectPietroSalaLink(rows);await saveConfirmedPietroSalaLink(d.query,rule,rows);await syncPlayerIdentities(d.query);
  const person=await storedIdentity(d.db,'sardegna');assert.equal(person.canonicalId,(await storedIdentity(d.db,'itf')).canonicalId);assert.equal(person.circuitProfiles.length,2);
  assert.notEqual(person.canonicalId,(await storedIdentity(d.db,'homonym')).canonicalId);assert.notEqual(person.canonicalId,(await storedIdentity(d.db,'itf-old')).canonicalId);assert.deepEqual(d.execute('SELECT * FROM matches'),beforeMatches);
  const writes=d.writes();assert.equal((await saveConfirmedPietroSalaLink(d.query,rule,rows)).changed,false);await syncPlayerIdentities(d.query);assert.equal(d.writes(),writes);
  d.execute('UPDATE search_acquired_players SET payload=? WHERE source_key=?',[JSON.stringify({nationality:'SUI',birthYear:2009,club:'New metadata'}),'itf']);await syncPlayerIdentities(d.query);assert.equal((await storedIdentity(d.db,'itf')).canonicalId,person.canonicalId);
 }finally{d.close()}
});
test('absent Sardegna affiliation, two cards in the same club, changed approval, and inconsistent age fail closed',async()=>{
 assert.throws(()=>selectPietroSalaLink(rows.filter(r=>r.source_key!=='sardegna')),/not_verified/);
 assert.throws(()=>selectPietroSalaLink([...rows,{...rows[0],official_id:'123456788'}]),/not_verified/);
 assert.throws(()=>selectPietroSalaLink(rows.map(r=>r.source_key==='sardegna'?{...r,payload:JSON.stringify({club:'Tennis Decimomannu',birthYear:1964})}:r)),/birth_conflict/);
 const d=database({identityMapping:true});try{const rule=selectPietroSalaLink(rows);await saveConfirmedPietroSalaLink(d.query,rule,rows);await assert.rejects(saveConfirmedPietroSalaLink(d.query,{...rule,reason:'changed'},rows),/changed/);assert.ok(d.execute('SELECT value FROM app_state WHERE key=?',[linkKey])[0]);}finally{d.close()}
});
test('followed ITF profile exposes all ten acquired tournaments by native ID despite homonyms and circuit nationalities; opponent keeps three genuine recent tournaments',async()=>{
 const d=database({identityMapping:true});try{
  const player={id:'cw-sala',name:'Pietro Sala',membershipCard:'123456789',worldTennisId:'800638581',nationality:'ITA'};
  for(let i=0;i<12;i++){
   const wrong=i>=10,tid='t'+i,mid='m'+i,date='2026-09-'+String(i+1).padStart(2,'0');
   d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',[tid,'itf','ITF'+i,date,date,JSON.stringify({name:'Event '+i,startDate:date,endDate:date})]);
   d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[mid,tid,'itf','',JSON.stringify({score:'6-2 6-3',status:'completed'})]);
   d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,'self',wrong?'800229374':'800638581','Pietro Sala','pietro sala',wrong?'ITA':'SUI',1,0,'{}']);
   d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,'other','800111111','Other Player','other player','ITA',0,1,'{}']);
  }
  const writes=d.writes(),all=await personalCircuitHistory(d.db,player);assert.equal(all.tournaments.length,10);assert.equal(all.matches.length,10);assert.ok(all.matches.every(m=>m.score==='2-6 3-6'));
  const recent=await otherCircuitOpponentHistory(d.db,{name:player.name,asOf:'2026-10-11',identity:player});assert.deepEqual(new Set(recent.map(t=>t.id)),new Set(['t7','t8','t9']));assert.equal(d.writes(),writes);
 }finally{d.close()}
});

import {recoverPietroSalaFitpClubs} from '../lib/confirmed-pietro-sala-link.mjs';
test('missing acquired clubs resolve from the exact official card sheet and keep the Giussano homonym separate',async()=>{
 const candidates=[{...rows[0],official_id:'4537099241',payload:'{}'},{...rows[1],official_id:'0264379435',payload:'{}'},rows[2]];
 let requests=0;const fetcher=async(url,options)=>{requests++;assert.equal(url,'https://dp-myfit-test-function-v2.azurewebsites.net/api/v1/tesserati/dettaglio/semplice');const card=atob(JSON.parse(options.body).cardNumber);return {ok:true,json:async()=>({player:{name:'PIETRO',surname:'SALA',membershipCard:'*******'+card.slice(-3),tennis_club_name:card==='4537099241'?'AS DILETTANTISTICA CIRCOLO TENNIS DECIMOMANNU':'CIRCOLO TENNIS GIUSSANO'}})}};
 const enriched=await recoverPietroSalaFitpClubs(candidates,{fetcher});assert.equal(requests,2);assert.equal(selectPietroSalaLink(enriched).identities[0].officialId,'4537099241');assert.equal(candidates[0].payload,'{}');
 await assert.rejects(recoverPietroSalaFitpClubs(candidates,{fetcher:async()=>({ok:true,json:async()=>({player:{name:'Other',surname:'Player',membershipCard:'*******241',tennis_club_name:'Decimomannu'}})})}),/mismatch/);
 await assert.rejects(recoverPietroSalaFitpClubs(candidates,{fetcher:async()=>({ok:false})}),/unavailable/);
});
