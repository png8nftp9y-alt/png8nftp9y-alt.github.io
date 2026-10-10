import test from 'node:test';import assert from 'node:assert/strict';
import {legacyAcceptanceCandidate,legacyAcceptanceProfiles} from '../lib/legacy-acceptance-profile-migration.mjs';
const id='12345678-1234-1234-1234-123456789abc',second='22345678-1234-1234-1234-123456789abc',t='32345678-1234-1234-1234-123456789abc';
const source={circuit:'tennis-europe',source_table:'observed_players',source_key:'legacy',official_id:'',display_name:'Example Person',nationality:'FRA'},entry={source_player_id:'name:EXAMPLE PERSON',display_name:'Example Person',payload:JSON.stringify({tournaments:[{competitionId:t}]})};
const doc={status:'tennis_europe_participant_cache_complete',tournaments:{[t]:{competitionId:t,participants:[{playerName:'Example Person',participantId:id,countryCode:'TUN',birthYear:2012}]}}};
test('same retained acceptance identity and native tournament membership bind the actual GUID across federation change',async()=>{
 assert.equal(legacyAcceptanceCandidate(source,[entry],doc).officialId,id);
 const get=async url=>new URL(url).pathname==='/find/player/DoSearch'?{url,text:new URL(url).searchParams.get('Page')==='1'?'<h5><a href="/player-profile/'+id+'">Example Person</a></h5>':''}:{url,text:'<img class="profile-head__nat" src="https://static.tournamentsoftware.com/content/images/flags/TUN.svg"><h2 class="media__title--large">Example Person</h2>'};
 const r=await legacyAcceptanceProfiles([source],async()=>[entry],get,doc),e=r.resolved.get('observed_players|legacy');assert.equal(e.officialId,id);assert.equal(e.historicalNationality,'FRA');assert.equal(e.nationality,'TUN');assert.equal(e.birthYear,2012);
});
test('unrelated entries, missing tournament overlap, competing native IDs and incompatible births remain unresolved',()=>{
 assert.equal(legacyAcceptanceCandidate(source,[{...entry,source_player_id:'name:Other Person'}],doc),null);
 assert.equal(legacyAcceptanceCandidate(source,[{...entry,payload:JSON.stringify({tournaments:[{competitionId:second}]})}],doc),null);
 assert.equal(legacyAcceptanceCandidate(source,[entry],{...doc,tournaments:{[t]:{competitionId:t,participants:[...doc.tournaments[t].participants,{playerName:'Example Person',participantId:second}]}}}),null);
 assert.equal(legacyAcceptanceCandidate({...source,birth_year:2011},[entry],doc),null);
 assert.throws(()=>legacyAcceptanceCandidate(source,[entry],{}),/incomplete/);
});
test('global directory homonyms do not permit choosing the active tournament entrant',async()=>{
 const get=async url=>new URL(url).pathname==='/find/player/DoSearch'?{url,text:new URL(url).searchParams.get('Page')==='1'?'<h5><a href="/player-profile/'+id+'">Example Person</a></h5><h5><a href="/player-profile/'+second+'">Example Person</a></h5>':''}:{url,text:'<img class="profile-head__nat" src="https://static.tournamentsoftware.com/content/images/flags/TUN.svg"><h2 class="media__title--large">Example Person</h2>'};
 const r=await legacyAcceptanceProfiles([source],async()=>[entry],get,doc);assert.equal(r.resolved.size,0);
});
