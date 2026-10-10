import test from 'node:test';import assert from 'node:assert/strict';
import {retainedPlayerReference,tournamentProfileAnchor,retainedTournamentProfiles} from '../lib/retained-tournament-profile-evidence.mjs';
const t='12345678-1234-1234-1234-123456789abc',id='22345678-1234-1234-1234-123456789abc',other='32345678-1234-1234-1234-123456789abc';
const href='/sport/player.aspx?id='+t+'&player=7',final='https://te.tournamentsoftware.com/tournament/'+t+'/player/7';
const html=guid=>'<h4 class="media__title media__title--large"><a href="/player-profile/'+guid+'">Corrected full name</a></h4><a href="/player-profile/'+other+'">Opponent</a>';
test('exact retained tournament/player and main header exclude opponents and foreign IDs',()=>{
 assert.ok(retainedPlayerReference({href},t,'7'));assert.equal(retainedPlayerReference({href},t,'8'),null);assert.equal(retainedPlayerReference({href:'https://foreign.example'+href},t,7),null);
 assert.equal(tournamentProfileAnchor(html(id),final,t,7).officialId,id);assert.equal(tournamentProfileAnchor(html(id),final,t,8),null);assert.equal(tournamentProfileAnchor(html(id),final.replace('te.tournamentsoftware.com','foreign.example'),t,7),null);
 assert.equal(tournamentProfileAnchor('<h4 class="media__title--large"><a href="/player-profile/'+id+'">one</a><a href="/player-profile/'+other+'">two</a></h4>',final,t,7),null);
});
test('source-bound evidence preserves affiliation, refuses conflicts/unreadable references, and reuses page requests',async()=>{
 const row={source_table:'observed_players',source_key:'one',circuit:'tennis-europe',official_id:'',display_name:'Truncated Name',nationality:'RTF'};
 const participant={source_player_id:'7',source_tournament_id:t,payload:JSON.stringify({href,nationality:'RUS'})};let calls=0;
 const result=await retainedTournamentProfiles([row,{...row,source_key:'two'}],async()=>[participant],async()=>{calls++;return{url:final,text:html(id)}});
 assert.equal(result.resolved.size,2);assert.equal(calls,1);assert.deepEqual(result.resolved.get('observed_players|one'),{officialId:id,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+id});
 assert.equal((await retainedTournamentProfiles([{...row,nationality:'ITA'}],async()=>[participant],async()=>{throw Error('unexpected')})).resolved.size,0);
 const second={...participant,source_player_id:'8',payload:JSON.stringify({href:href.replace('player=7','player=8'),nationality:'RUS'})};
 const conflict=await retainedTournamentProfiles([row],async()=>[participant,second],async url=>({url:final.replace('/7',url.endsWith('8')?'/8':'/7'),text:html(url.endsWith('8')?other:id)}));assert.equal(conflict.resolved.size,0);
 const unreadable=await retainedTournamentProfiles([row],async()=>[participant,second],async url=>{if(url.endsWith('8'))throw Error('offline');return{url:final,text:html(id)}});assert.equal(unreadable.resolved.size,0);
});
