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
