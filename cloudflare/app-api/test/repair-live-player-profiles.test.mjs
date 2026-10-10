import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itfSearchEvidence,teDirectoryEvidence,publicCookiePair} from '../lib/live-profile-evidence.mjs';
import {evidenceCatalog} from '../lib/archived-profile-evidence.mjs';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import './archived-profile-evidence.test.mjs';
test('official search exact ID selects nationality from the same player object',()=>{
 const p={players:[{playerId:'800000001',givenName:'Other',familyName:'Person',nationalityCode:'ITA'},{playerId:'800659492',givenName:'Rohan',familyName:'Mishra',nationalityCode:'USA'}]};
 assert.equal(itfSearchEvidence(p,'800659492').length,1);
 assert.match(itfSearchEvidence(p,'800659492')[0].profileUrl,/800659492\/usa/);
 assert.equal(itfSearchEvidence(p,'800999999').length,0);
 assert.equal(itfSearchEvidence({playerId:'800659492',name:'Rohan Mishra'},'800659492').length,0);
});
test('native ITF search fields recover exact official ID, country and relative profile',()=>{
 const p={players:[{playerId:800825359,givenName:'Takatoshi',familyName:'Sakai',playerNationalityCode:'THA',playerProfileLink:'/en/players/takatoshi-sakai/800825359/tha/'}]};
 const hit=itfSearchEvidence(p,'800825359');assert.equal(hit.length,1);assert.equal(hit[0].nationality,'THA');assert.equal(hit[0].profileUrl,'https://www.itftennis.com/en/players/takatoshi-sakai/800825359/tha/');
 assert.equal(itfSearchEvidence(p,'800814282').length,0);
});
test('public consent cookies retain equals signs in their values',()=>{
 assert.deepEqual(publicCookiePair('st=l=2057&exp=46610&c=1&cp=1; path=/'),['st','l=2057&exp=46610&c=1&cp=1']);
 assert.deepEqual(publicCookiePair('token=abc==; Secure'),['token','abc==']);
 assert.equal(publicCookiePair('not-a-cookie'),null);
});
test('directory requires per-row country and rejects tournament IDs and foreign domains',()=>{
 const id='12345678-1234-1234-1234-123456789abc',p=teDirectoryEvidence('<table><tr><td>[IRL]</td><td><a href="/profile/default.aspx?id='+id+'">Richie KENNEDY</a></td></tr><tr><td>[IRL]</td><td><a href="/sport/player.aspx?id='+id+'&amp;player=1">Other Person</a></td></tr><tr><td><a href="/player-profile/'+id+'">No Country</a></td></tr></table>');
 assert.equal(p.length,1);assert.equal(p[0].nationality,'IRL');
 const catalog=evidenceCatalog();catalog.add(p);assert.equal(catalog.resolve({circuit:'tennis-europe',official_id:'',display_name:'Richie Kennedy',nationality:'FRA',payload:'{}'}),null);
});
test('reviewed official sources have matching ID and no duplicates',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/verified-profile-evidence-20261010.json',import.meta.url)));
 assert.equal(new Set(data.map(p=>p.officialId)).size,data.length);
 for(const p of data){assert.ok(p.profileUrl.includes('/'+p.officialId+'/'));assert.equal(new URL(p.evidenceSource).hostname,'www.itftennis.com');}
});
test('acceptance ingestion never promotes a tournament UUID to a global player ID',()=>{
 const p=acquiredPlayer('tennis-europe',{name:'Test Person',participantId:'12345678-1234-1234-1234-123456789abc',profileUrl:'https://te.tournamentsoftware.com/sport/player.aspx?id=12345678-1234-1234-1234-123456789abc&player=42'});
 assert.equal(p.officialId,'');assert.equal(p.payload.profileUrl,'');
});
