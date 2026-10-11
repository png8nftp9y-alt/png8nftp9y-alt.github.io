import test from 'node:test';import assert from 'node:assert/strict';
import {acceptanceNativeIdRecovery} from '../lib/acceptance-native-id-recovery.mjs';
import {syncAcceptanceProfiles} from '../scripts/sync-acceptance-player-profiles.mjs';
import {database} from './search-sqlite-fixture.mjs';
const id='12345678-1234-1234-1234-123456789abc',t='22345678-1234-1234-1234-123456789abc';
const player={playerName:'Example Person',countryCode:'ITA',birthYear:2012,event:'BS14'},doc={status:'tennis_europe_participant_cache_complete',tournaments:{[t]:{competitionId:t,participants:[player]}}};
const html='<h1>Acceptance list</h1><select name="event"><option selected value="1">BS14</option></select><table><tr><td>1</td><td>[ITA]</td><td>Example Person</td><td>2012</td><td><a href="/player-profile/'+id+'"><svg></svg></a></td></tr></table>';
const header='<img class="profile-head__nat" src="https://static.tournamentsoftware.com/content/images/flags/ITA.svg"><h2 class="media__title--large">Example Person</h2>';
test('new Europe participant acquires its ID from the exact list row before D1 insertion; replay makes zero requests/writes',async()=>{
 const d=database({identityMapping:true});try{
  const urls=[],recoverMissing=acceptanceNativeIdRecovery(doc,{fetchPage:async url=>{urls.push(url);return new Response(url.includes('acceptancelist')?html:url.includes('player-profile')?header:'',{status:200});}});
  const r=await syncAcceptanceProfiles(d.query,'tennis-europe',doc,{recoverMissing});assert.equal(r.recoveredCircuitIds,1);assert.equal(r.participants,1);
  const saved=d.execute('SELECT official_id FROM observed_players');assert.equal(saved[0].official_id,id);assert.equal(urls.length,3);
  const writes=d.writes(),requests=urls.length;const replay=await syncAcceptanceProfiles(d.query,'tennis-europe',doc,{recoverMissing});assert.equal(replay.unchanged,true);assert.equal(d.writes(),writes);assert.equal(urls.length,requests);
 }finally{d.close()}
});
test('unavailable or foreign official profiles do not write a name-only player or complete a checkpoint',async()=>{
 for(const response of [()=>new Response('',{status:503}),()=>new Response('',{status:302,headers:{location:'https://example.com/'}})]){
  const d=database({identityMapping:true});try{
   let foreign=0;const recoverMissing=acceptanceNativeIdRecovery(doc,{fetchPage:async url=>{if(url.includes('example.com'))foreign++;return response();}});
   await assert.rejects(syncAcceptanceProfiles(d.query,'tennis-europe',doc,{recoverMissing}),/player_circuit_id_required/);assert.equal(d.execute('SELECT * FROM observed_players').length,0);
   assert.equal(d.execute('SELECT * FROM player_identity_people').length,0);
   assert.equal(d.execute('SELECT * FROM player_circuit_identities').length,0);
   assert.equal(d.execute("SELECT * FROM app_state WHERE key='acceptanceProfiles:tennis-europe'").length,0);
   const diagnostic=JSON.parse(d.execute("SELECT value FROM app_state WHERE key='acceptanceDiagnostics:tennis-europe'")[0].value);
   assert.equal(diagnostic.status,'blocked');assert.equal(diagnostic.reason,'id_required');assert.equal(diagnostic.unsaved.length,1);assert.equal(diagnostic.unsaved[0].name,player.playerName);
   assert.equal(d.writes(),1);assert.equal(foreign,0);
   const writes=d.writes();
   await assert.rejects(syncAcceptanceProfiles(d.query,'tennis-europe',doc,{recoverMissing}),/player_circuit_id_required/);
   assert.equal(d.writes(),writes);
  }finally{d.close()}
 }
});

