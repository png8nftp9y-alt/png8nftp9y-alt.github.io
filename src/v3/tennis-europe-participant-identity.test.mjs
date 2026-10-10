import test from 'node:test';import assert from 'node:assert/strict';
import {participantIdentity} from './tennis-europe-participant-identity.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const cells=['9','[ITA]','Example Person','Italy','2012','#996'];
test('a blank profile icon is associated with the name, country and year in its acceptance row',()=>{
 const p=participantIdentity({cells,rowHtml:'<a href="/player-profile/'+id+'"><svg><use href="#icon-player"></use></svg></a>'});
 assert.equal(p.playerName,'Example Person');assert.equal(p.participantId,id.toUpperCase());assert.equal(p.countryCode,'ITA');assert.equal(p.birthYear,2012);
 assert.equal(p.profileUrl,'https://te.tournamentsoftware.com/player-profile/'+id);
});
test('conflicting or foreign profile links cannot identify a row; a tournament UUID is never a player ID',()=>{
 assert.equal(participantIdentity({cells,rowHtml:'<a href="https://example.com/player-profile/'+id+'"></a>'}).participantId,'');
 assert.equal(participantIdentity({cells,rowHtml:'<a href="/player-profile/'+id+'">Other Person</a>'}).participantId,'');
 assert.equal(participantIdentity({cells,rowHtml:'<a href="/player-profile/'+id+'"></a><a href="/player-profile/22345678-1234-1234-1234-123456789abc"></a>'}).participantId,'');
 assert.equal(participantIdentity({cells,rowHtml:'<a href="/sport/player.aspx?id='+id+'&amp;player=2">Example Person</a>'}).participantId,'');
 assert.equal(participantIdentity({cells:['[ITA]','Example Person','Italy','#2012'],rowHtml:''}).birthYear,undefined);
});
