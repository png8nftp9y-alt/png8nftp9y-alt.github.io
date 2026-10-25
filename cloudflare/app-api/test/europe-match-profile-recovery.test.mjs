import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
import {syncAcquiredSearch} from '../scripts/sync-acquired-player-search.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {europeMatchProfileEvidence,recoverEuropeMatchProfiles,europePublicPages} from '../lib/europe-match-profile-recovery.mjs';
import {europeMissingIdOriginsSql,europeMissingIdOriginsResult} from '../lib/europe-missing-id-origins.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
const tournament='12345678-1234-1234-1234-123456789abc',guid=n=>String(n).padStart(8,'0')+'-1234-1234-1234-123456789abc',host='https://te.tournamentsoftware.com';
function fixture(d,n=1,{nation='POL',name='Test Player '+n}={}){
 const href='/sport/player.aspx?id='+tournament+'&player='+n,raw={id:String(n),name,nationality:nation,href};
 d.execute('INSERT OR IGNORE INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) VALUES(?,?,?,?,?,?)',['t','tennis-europe',tournament,'2026-10-10','2026-10-18','{}']);
 d.execute('INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(?,?,?,?,?)',['m'+n,'t','tennis-europe','2026-10-12',JSON.stringify({players:[raw]})]);
 d.execute('INSERT INTO match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload) VALUES(?,?,?,?,?,?,?,?,?)',['m'+n,'p'+n,String(n),name,name.toLowerCase(),nation,0,0,JSON.stringify(raw)]);
 return raw;
}
function officialPages(calls=[],{wrongName=false,wrongNation=false,fail=false}={}){
 return async url=>{
  calls.push(url);if(fail)throw Error('offline');
  const u=new URL(url,host),n=Number(u.searchParams.get('player')||u.pathname.match(/player-profile\/(\d+)/)?.[1]);
  if(u.pathname==='/sport/player.aspx')return{url:host+'/tournament/'+tournament+'/player/'+n,text:'<h4 class="media__title--large"><a href="/player-profile/'+guid(n)+'">Test Player '+n+'</a></h4>'};
  return{url,text:'<img class="profile-head__nat" src="//static.tournamentsoftware.com/content/images/flags/'+(wrongNation?'ITA':'POL')+'.svg"><h2 class="media__title--large">'+(wrongName?'Someone Else':'Test Player '+n)+'</h2>'};
 };
}
test('24 OOP-only players acquire global IDs, map to profiles, preserve history, and replay makes no requests or writes',async()=>{
 const d=database({identityMapping:true});try{
  for(let n=1;n<=24;n++)fixture(d,n);
  await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);
  assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,24);
  const history=await d.query('SELECT * FROM match_participants ORDER BY match_id'),calls=[];
  const result=await recoverEuropeMatchProfiles(d.query,{publicPage:officialPages(calls)});
  assert.equal(result.repaired,24);assert.equal(result.unresolved,0);assert.equal(calls.length,48);
  await syncPlayerIdentities(d.query);
  assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,0);
  assert.deepEqual(await d.query('SELECT * FROM match_participants ORDER BY match_id'),history);
  const saved=await d.query('SELECT official_id,payload FROM search_acquired_players');assert.ok(saved.every(p=>p.official_id&&JSON.parse(p.payload).profileUrl));
  const writes=d.writes();assert.equal((await recoverEuropeMatchProfiles(d.query,{publicPage:async()=>{throw Error('replay fetch')}})).examined,0);assert.equal(d.writes(),writes);
  // A later OOP update without GUID must preserve the resolved identity.
  d.execute("UPDATE matches SET payload=payload||' ' WHERE id='m1'");await syncAcquiredSearch(d.query);
  assert.equal((await d.query('SELECT COUNT(*) AS n FROM search_acquired_players WHERE official_id<>\'\''))[0].n,24);
 }finally{d.close()}
});
test('new OOP player is resolved on the next ordinary cycle; older resolved players are never fetched again',async()=>{
 const d=database({identityMapping:true});try{
  fixture(d);await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);await recoverEuropeMatchProfiles(d.query,{publicPage:officialPages()});await syncPlayerIdentities(d.query);
  fixture(d,2);await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);const calls=[];
  assert.equal((await recoverEuropeMatchProfiles(d.query,{publicPage:officialPages(calls)})).repaired,1);assert.equal(calls.length,2);assert.ok(calls.every(url=>!url.endsWith('player=1')&&!url.endsWith(guid(1))));
 }finally{d.close()}
});
test('legacy name source already covered by an exact canonical native profile does not cause HTTP or a false residual',async()=>{
 const d=database({identityMapping:true});try{
  fixture(d);await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);
  const person=(await d.query('SELECT canonical_id,payload FROM player_identity_people'))[0],payload=JSON.parse(person.payload);
  payload.circuitProfiles=[{circuit:'tennis-europe',url:host+'/player-profile/'+guid(1)}];
  d.execute('UPDATE player_identity_people SET payload=? WHERE canonical_id=?',[JSON.stringify(payload),person.canonical_id]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,display_name,normalized_name) VALUES(?,?,?,?,?,?,?)',['courtwatch|configured',person.canonical_id,'1 PLAYER TEST','courtwatch','configured','Test Player 1','TEST PLAYER 1']);
  assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,0);
  const writes=d.writes(),result=await recoverEuropeMatchProfiles(d.query,{publicPage:async()=>{throw Error('already identified person fetched')}});
  assert.deepEqual(result,{examined:0,repaired:0,unresolved:0,requests:0});assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('exact acquired hash rejects homonyms with different nationality; wrong global names/countries and unavailable pages remain unresolved without writes',async()=>{
 for(const options of [{wrongName:true},{wrongNation:true},{fail:true}]){
  const d=database({identityMapping:true});try{
   fixture(d);await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);const writes=d.writes();
   const result=await recoverEuropeMatchProfiles(d.query,{publicPage:officialPages([],options)});assert.equal(result.repaired,0);assert.equal(result.unresolved,1);assert.equal(d.writes(),writes);
   // Unavailable evidence is not permanently checkpointed: a working page resolves it.
   assert.equal((await recoverEuropeMatchProfiles(d.query,{publicPage:officialPages()})).repaired,1);
  }finally{d.close()}
 }
 const raw={name:'Test Player 1',nationality:'ITA',href:'/sport/player.aspx?id='+tournament+'&player=1'};
 const source=acquiredPlayer('tennis-europe',raw),row={source_key:source.sourceKey,source_table:'search_acquired_players',circuit:'tennis-europe',normalized_name:source.normalizedName,display_name:source.displayName,payload:JSON.stringify(source.payload)};
 const result=await europeMatchProfileEvidence([row],async()=>[{match_id:'m',participant_key:'p',display_name:raw.name,source_player_id:'1',nationality:'POL',source_tournament_id:tournament,payload:JSON.stringify({...raw,nationality:'POL'})}],async()=>{throw Error('wrong-source fetch')});assert.equal(result.resolved.size,0);assert.equal(result.report.requests,0);
});
test('multiple source-bound global IDs cannot be resolved by the first successful reference',async()=>{
 const raw={name:'Test Player 1',nationality:'POL'},source=acquiredPlayer('tennis-europe',raw),row={source_key:source.sourceKey,source_table:'search_acquired_players',circuit:'tennis-europe',normalized_name:source.normalizedName,display_name:raw.name,payload:JSON.stringify(source.payload)};
 const participants=[1,2].map(n=>({match_id:'m'+n,participant_key:'p'+n,display_name:raw.name,source_player_id:String(n),nationality:'POL',source_tournament_id:tournament,payload:JSON.stringify({...raw,href:'/sport/player.aspx?id='+tournament+'&player='+n})}));
 const result=await europeMatchProfileEvidence([row],async()=>participants,async url=>{const response=await officialPages()(url);return{...response,text:response.text.replace('Test Player 2','Test Player 1')}});assert.equal(result.resolved.size,0);
});
test('public session is lazy, preserves cookies, and blocks foreign redirects',async()=>{
 let calls=0;const publicPage=europePublicPages({fetchPage:async url=>{calls++;return{status:302,headers:new Headers({location:'https://foreign.example/'}),text:async()=>''}}});
 assert.equal(calls,0);await assert.rejects(publicPage(host+'/sport/player.aspx?id='+tournament+'&player=1'),/foreign_url/);assert.equal(calls,1);
});

test('unresolved diagnostics retain exact source, name, tournament and safe failure reason without assigning an ID',async()=>{
 const d=database({identityMapping:true});try{
  fixture(d);await syncAcquiredSearch(d.query);await syncPlayerIdentities(d.query);const details=[],writes=d.writes();
  const result=await recoverEuropeMatchProfiles(d.query,{publicPage:async()=>{throw Error('europe_profile_http_403')},onDetail:d=>details.push(d)});
  assert.equal(result.unresolved,1);assert.equal(result.repaired,0);assert.equal(d.writes(),writes);
  assert.equal(details[0].name,'Test Player 1');assert.equal(details[0].reason,'official_profile_evidence_incomplete');
  assert.equal(details[0].references[0].tournamentId,tournament);assert.equal(details[0].references[0].localPlayerId,'1');assert.equal(details[0].references[0].reason,'europe_profile_http_403');
 }finally{d.close()}
});
test('diagnostics distinguish missing provenance from conflicting official IDs',async()=>{
 const raw={name:'Test Player 1',nationality:'POL'},source=acquiredPlayer('tennis-europe',raw),row={source_key:source.sourceKey,source_table:'search_acquired_players',circuit:'tennis-europe',normalized_name:source.normalizedName,display_name:raw.name,payload:JSON.stringify(source.payload)};
 const result=await europeMatchProfileEvidence([row],async()=>[],async()=>{throw Error('unexpected source fetch')});
 assert.equal(result.report.details[0].reason,'exact_acquired_match_source_missing');assert.equal(result.report.requests,0);assert.equal(result.resolved.size,0);
});

test('all user-confirmed exact sources resolve without HTTP or name-only lookup',async()=>{
 const {userConfirmedEuropeProfiles}=await import('../lib/europe-match-profile-recovery.mjs');
 const rows=userConfirmedEuropeProfiles.map(p=>({source_key:p.sourceKey,source_table:'search_acquired_players',circuit:'tennis-europe',official_id:'',display_name:p.name,payload:JSON.stringify({nationality:p.nationality})}));
 const result=await europeMatchProfileEvidence(rows,async()=>{throw Error('unexpected query')},async()=>{throw Error('unexpected HTTP')});
 assert.equal(result.resolved.size,7);assert.equal(new Set([...result.resolved.values()].map(p=>p.officialId)).size,6);assert.equal(result.report.requests,0);
 for(const r of rows)assert.equal(result.resolved.get(r.source_table+'|'+r.source_key).profileEvidenceProvenance.type,'user_confirmed_exact_source_profile');
});
test('confirmed bindings reject changed records, conflicting IDs and same-name other sources',async()=>{
 const {userConfirmedEuropeProfiles,userConfirmedEuropeProfile}=await import('../lib/europe-match-profile-recovery.mjs'),p=userConfirmedEuropeProfiles[0];
 const row={source_key:p.sourceKey,source_table:'search_acquired_players',circuit:'tennis-europe',official_id:'',display_name:p.name,payload:JSON.stringify({nationality:p.nationality})};
 assert.throws(()=>userConfirmedEuropeProfile({...row,display_name:'Another Person'}),/source_changed/);
 assert.throws(()=>userConfirmedEuropeProfile({...row,official_id:guid(99)}),/existing_id_conflict/);
 assert.throws(()=>userConfirmedEuropeProfile({...row,payload:JSON.stringify({nationality:'RUS'})}),/source_changed/);
 assert.equal(userConfirmedEuropeProfile({...row,source_key:row.source_key+'other'}),null);
});
test('confirmed profiles persist through the production flow and replay has zero reads from public sources or writes',async()=>{
 const {userConfirmedEuropeProfiles}=await import('../lib/europe-match-profile-recovery.mjs');
 const d=database({identityMapping:true});try{
  for(const p of userConfirmedEuropeProfiles)d.execute('INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[p.sourceKey,'tennis-europe','',p.name.toUpperCase(),p.name,JSON.stringify({nationality:p.nationality})]);
  await syncPlayerIdentities(d.query);const result=await recoverEuropeMatchProfiles(d.query,{publicPage:async()=>{throw Error('unexpected HTTP')}});
  assert.equal(result.repaired,7);assert.equal(result.unresolved,0);await syncPlayerIdentities(d.query);
  assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,0);
  for(const p of userConfirmedEuropeProfiles){const row=d.execute('SELECT official_id,payload FROM search_acquired_players WHERE source_key=?',[p.sourceKey])[0];assert.equal(row.official_id,p.officialId);assert.equal(JSON.parse(row.payload).nationality,p.nationality);}
  const writes=d.writes();assert.equal((await recoverEuropeMatchProfiles(d.query,{publicPage:async()=>{throw Error('replay HTTP')}})).examined,0);assert.equal(d.writes(),writes);
 }finally{d.close()}
});

test('Demyanko retained BLR source binds only its exact key and preserves affiliation',async()=>{
 const {userConfirmedEuropeProfile}=await import('../lib/europe-match-profile-recovery.mjs');
 const row={source_key:'acquired|tennis-europe|name:9d640088a5e2ad49a1a7168a',source_table:'search_acquired_players',circuit:'tennis-europe',official_id:'',display_name:'Kristina DEMYANKO',payload:JSON.stringify({nationality:'BLR'})};
 assert.equal(userConfirmedEuropeProfile(row).officialId,'9ab1a4e8-a38c-40ee-aecc-f6da91a50767');
 assert.equal(JSON.parse(row.payload).nationality,'BLR');
 assert.throws(()=>userConfirmedEuropeProfile({...row,official_id:'95304d41-5692-47e7-b0e1-d1d685a93ca9'}),/existing_id_conflict/);
 assert.equal(userConfirmedEuropeProfile({...row,source_key:row.source_key+'x'}),null);
});
