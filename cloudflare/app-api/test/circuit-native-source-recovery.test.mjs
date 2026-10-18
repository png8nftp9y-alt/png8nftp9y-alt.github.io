import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {circuitAcceptanceRecovery,circuitOfficialJson,recoverCircuitNativeSources,recoverOriginalParticipant} from '../lib/circuit-native-source-recovery.mjs';
import {acceptanceNativeIdRecovery} from '../lib/acceptance-native-id-recovery.mjs';
import {syncAcceptanceProfiles} from '../scripts/sync-acceptance-player-profiles.mjs';
import {syncAcquiredSearch} from '../scripts/sync-acquired-player-search.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {loadPlayerIdDiagnostics} from '../lib/admin-player-id-diagnostics.mjs';
import {database} from './search-sqlite-fixture.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
const fitpCompetition='12345678-1234-1234-1234-123456789abc',itfCompetition='J-J30-ITA-2026-001';
const fitp={full1:'Example Person',draw:'Under 14',subscriptionDate:'2026-10-10T12:00:00'},itf={name:'Example Person',nationalityCode:'ITA',competitionId:itfCompetition,playerTypeCode:'B',acceptanceCode:'MD',acceptancePosition:1};
const fitpDoc=p=>({tournaments:{[fitpCompetition]:{competitionId:fitpCompetition,participants:[p]}}}),itfDoc=p=>({participants:[p]});
const api=(c,id='')=>c==='fitp'?{CompetitionUid:fitpCompetition,Tournaments:[{TournamentDescription:'Under 14',Participants:[{Name:'Example',Surname:'Person',MembershipCard:id||'123456789',SubscriptionDate:fitp.subscriptionDate}]}]}:[{playerTypeCode:'B',entryClassifications:[{entryClassificationCode:'M',entries:[{positionDisplay:'1',players:[{givenName:'Example',familyName:'Person',playerId:id||'800123456',nationalityCode:'ITA'}]}]}]}];
function fetchApi(requests,options={}){return async(url,init)=>{requests.push({url,init});if(options.fail)return new Response('',{status:503});return new Response(JSON.stringify(api(url.includes('azurewebsites')?'fitp':'itf')),{status:200});};}
test('both circuits resolve a new acceptance participant from its original event and replay requests/writes are zero',async()=>{
 for(const [c,p,doc,id]of [['fitp',fitp,fitpDoc(fitp),'123456789'],['itf',itf,itfDoc(itf),'800123456']]){
  const d=database({identityMapping:true});try{
   const requests=[],recoverMissing=acceptanceNativeIdRecovery(doc,{fetchPage:fetchApi(requests)});
   const result=await syncAcceptanceProfiles(d.query,c,doc,{recoverMissing});assert.equal(result.recoveredCircuitIds,1);assert.equal(result.changed,1);
   assert.equal(d.execute('SELECT official_id FROM observed_players')[0].official_id,id);assert.equal(requests.length,1);
   const writes=d.writes();await syncAcceptanceProfiles(d.query,c,doc,{recoverMissing});assert.equal(d.writes(),writes);assert.equal(requests.length,1);
   const newer={...p,...(c==='fitp'?{full1:'Later Player',subscriptionDate:'2026-10-11T12:00:00'}:{name:'Later Player',acceptancePosition:2})};
   const nextDoc=c==='fitp'?fitpDoc(newer):itfDoc(newer),nextId=c==='fitp'?'987654321':'800654321';
   const fresh=api(c,nextId);if(c==='fitp')Object.assign(fresh.Tournaments[0].Participants[0],{Name:'Later',Surname:'Player',SubscriptionDate:newer.subscriptionDate});else Object.assign(fresh[0].entryClassifications[0].entries[0],{positionDisplay:'2',players:[{givenName:'Later',familyName:'Player',playerId:nextId,nationalityCode:'ITA'}]});
   await syncAcceptanceProfiles(d.query,c,nextDoc,{recoverMissing:acceptanceNativeIdRecovery(nextDoc,{fetchPage:async()=>new Response(JSON.stringify(fresh))})});assert.equal(d.execute('SELECT * FROM observed_players').length,2);
  }finally{d.close()}
 }
});
test('name-only references, shifted positions, mismatched countries, homonyms, and conflicting tournaments stay unresolved',async()=>{
 assert.equal(await recoverOriginalParticipant('fitp',{competitionId:fitpCompetition,participant:{full1:'Example Person',draw:'Under 14'}},()=>{throw Error('name only HTTP')}),null);
 for(const c of ['fitp','itf']){
  const p=c==='fitp'?fitp:itf,ref={competitionId:c==='fitp'?fitpCompetition:itfCompetition,participant:p};
  const duplicate=api(c);if(c==='fitp')duplicate.Tournaments[0].Participants.push({...duplicate.Tournaments[0].Participants[0],MembershipCard:'987654321'});else duplicate[0].entryClassifications[0].entries[0].players.push({...duplicate[0].entryClassifications[0].entries[0].players[0],playerId:'800654321'});
  assert.equal(await recoverOriginalParticipant(c,ref,async()=>duplicate),null);
 }
 const position=api('itf');position[0].entryClassifications[0].entries[0].positionDisplay='2';assert.equal(await recoverOriginalParticipant('itf',{competitionId:itfCompetition,participant:itf},async()=>position),null);
 const nation=api('itf');nation[0].entryClassifications[0].entries[0].players[0].nationalityCode='FRA';assert.equal(await recoverOriginalParticipant('itf',{competitionId:itfCompetition,participant:itf},async()=>nation),null);
 const docs={participants:[itf,{...itf,competitionId:'J-J30-ITA-2026-002'}]},source=(await import('../scripts/sync-acceptance-player-profiles.mjs')).acceptancePlayers('itf',docs)[0];
 const result=await circuitAcceptanceRecovery(docs,{officialJson:async(c,t)=>api(c,t.endsWith('002')?'800654321':'800123456')})([source]);assert.equal(result.size,0);
});
test('failed evidence blocks import, preserves diagnostics, never checkpoints, and is retried successfully',async()=>{
 for(const [c,doc]of [['fitp',fitpDoc(fitp)],['itf',itfDoc(itf)]]){
  const d=database({identityMapping:true});try{
   await assert.rejects(syncAcceptanceProfiles(d.query,c,doc,{recoverMissing:acceptanceNativeIdRecovery(doc,{fetchPage:fetchApi([],{fail:true})})}),/player_circuit_id_required/);
   assert.equal(d.execute('SELECT * FROM observed_players').length,0);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'acceptanceProfiles:%'").length,0);
   const diagnostic=JSON.parse(d.execute('SELECT value FROM app_state WHERE key=?',['acceptanceDiagnostics:'+c])[0].value);assert.equal(diagnostic.unsaved.length,1);
   await syncAcceptanceProfiles(d.query,c,doc,{recoverMissing:acceptanceNativeIdRecovery(doc,{fetchPage:fetchApi([])})});assert.equal(d.execute('SELECT * FROM observed_players').length,1);
  }finally{d.close()}
 }
});
test('original API requests are cached per tournament, bounded, and refuse redirects and HTML challenges',async()=>{
 const requests=[],read=circuitOfficialJson({fetchPage:fetchApi(requests)});await read('fitp',fitpCompetition);await read('fitp',fitpCompetition);assert.equal(requests.length,1);assert.equal(requests[0].init.redirect,'manual');assert.ok(requests[0].init.signal);assert.equal(JSON.parse(requests[0].init.body).competitionUid,fitpCompetition);
 await assert.rejects(read('fitp','bad'),/invalid/);assert.equal(requests.length,1);
 for(const response of [new Response('',{status:302,headers:{location:'https://example.com'}}),new Response('<html>challenge</html>')])await assert.rejects(circuitOfficialJson({fetchPage:async()=>response})('itf',itfCompetition));
});
test('missing match sources use the exact acquired hash, preserve history, and replay makes no requests/writes',async()=>{
 const d=database({identityMapping:true});try{
  for(const [n,c,competition,raw]of [[1,'fitp',fitpCompetition,fitp],[2,'itf',itfCompetition,itf]]){
   d.execute('INSERT INTO tournaments(id,circuit,source_tournament_id,payload) VALUES(?,?,?,?)',['t'+n,c,competition,'{}']);
   d.execute('INSERT INTO matches(id,tournament_id,circuit,payload) VALUES(?,?,?,?)',['m'+n,'t'+n,c,'{}']);
   d.execute('INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload) VALUES(?,?,?,?,?,?,?,?,?)',['m'+n,'p'+n,'local'+n,'Example Person','example person',c==='itf'?'ITA':'',0,0,JSON.stringify(raw)]);
  }
  await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);const history=d.execute('SELECT * FROM match_participants');let requests=0;
  const result=await recoverCircuitNativeSources(d.query,{officialJson:async c=>{requests++;return api(c)}});assert.equal(result.repaired,2);assert.equal(result.unresolved,0);
  await syncPlayerIdentities(d.query);assert.ok((await loadPlayerIdDiagnostics(d.db)).filter(r=>r.circuit!=='tennis-europe').every(r=>r.missing===0));assert.deepEqual(d.execute('SELECT * FROM match_participants'),history);
  const writes=d.writes();assert.equal((await recoverCircuitNativeSources(d.query,{officialJson:()=>{throw Error('replay fetch')}})).examined,0);assert.equal(d.writes(),writes);assert.equal(requests,2);
 }finally{d.close()}
});
test('ordinary cycle and acceptance importer both run FITP/ITF recovery without new schedules',()=>{
 const y=readFileSync(new URL('../../../.github/workflows/courtwatch-acquired-player-search.yml',import.meta.url),'utf8');assert.match(y,/node scripts\/recover-circuit-native-profiles.mjs/);assert.match(y,/workflow_run:/);assert.doesNotMatch(y,/schedule:/);
 const loader=readFileSync(new URL('../lib/acceptance-native-id-recovery.mjs',import.meta.url),'utf8');assert.match(loader,/otherCircuits\(rows\)/);
});
test('native aliases and relative official links are preserved at indexing, including draw-only players',async()=>{
 const {acquiredPlayer}=await import('../lib/acquired-player-index.mjs');
 assert.equal(acquiredPlayer('fitp',{name:'Example Person',MembershipCard:'123456789'}).officialId,'123456789');
 assert.equal(acquiredPlayer('itf',{name:'Example Person',PlayerId:'800123456',nationalityCode:'ITA'}).officialId,'800123456');
 assert.equal(acquiredPlayer('itf',{name:'Example Person',profileLink:'/en/players/example-person/800123456/ita/jt/s/overview/'}).officialId,'800123456');
 assert.equal(acquiredPlayer('itf',{name:'Example Person',profileLink:'https://example.com/en/players/example-person/800123456/ita/jt/s/overview/'}).officialId,'');
});
test('explicit native ID conflicts never borrow another ID from the roster or indexing',async()=>{
 const {acquiredPlayer}=await import('../lib/acquired-player-index.mjs');
 const p={...itf,worldTennisId:'800123456',profileLink:'/en/players/example-person/800654321/ita/jt/s/overview/'};
 assert.equal(acquiredPlayer('itf',p).officialId,'');
 assert.equal(await recoverOriginalParticipant('itf',{competitionId:itfCompetition,participant:p},()=>{throw Error('conflict fetched')}),null);
});
test('legacy hash survives normalization changes; already covered canonical people never trigger recovery',async()=>{
 const {acquiredPlayer}=await import('../lib/acquired-player-index.mjs');
 const d=database({identityMapping:true});try{
  const raw={name:'Example Person',MembershipCard:'123456789'},old=acquiredPlayer('fitp',{...raw,source_player_id:'local'},{nativeFields:false});assert.equal(old.officialId,'');
  d.execute('INSERT INTO tournaments(id,circuit,source_tournament_id,payload) VALUES(?,?,?,?)',['t','fitp',fitpCompetition,'{}']);
  d.execute('INSERT INTO matches(id,tournament_id,circuit,payload) VALUES(?,?,?,?)',['m','t','fitp','{}']);
  d.execute('INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload) VALUES(?,?,?,?,?,?,?,?,?)',['m','p','local','Example Person','example person','',0,0,JSON.stringify(raw)]);
  d.execute('INSERT INTO search_acquired_players(source_key,circuit,official_id,display_name,normalized_name,payload) VALUES(?,?,?,?,?,?)',[old.sourceKey,'fitp','','Example Person',old.normalizedName,JSON.stringify(old.payload)]);
  await syncPlayerIdentities(d.query);assert.equal((await recoverCircuitNativeSources(d.query,{officialJson:()=>{throw Error('native ID needs no HTTP')}})).repaired,1);await syncPlayerIdentities(d.query);
  const person=d.execute('SELECT canonical_id FROM player_circuit_identities')[0].canonical_id;
  d.execute('INSERT INTO search_acquired_players(source_key,circuit,official_id,display_name,normalized_name,payload) VALUES(?,?,?,?,?,?)',['acquired|fitp|name:older','fitp','','Example Person','EXAMPLE PERSON','{}']);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['acquired|fitp|name:older',person,'EXAMPLE PERSON','fitp','','EXAMPLE PERSON','Example Person']);
  const writes=d.writes();assert.equal((await recoverCircuitNativeSources(d.query,{officialJson:()=>{throw Error('identified person fetched')}})).examined,0);assert.equal(d.writes(),writes);
 }finally{d.close()}
});
