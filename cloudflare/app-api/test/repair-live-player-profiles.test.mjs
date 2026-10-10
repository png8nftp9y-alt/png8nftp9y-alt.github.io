import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itfSearchEvidence,teDirectoryEvidence,publicCookiePair,teSearchCandidates,teProfileEvidence,lookupTeDirectory} from '../lib/live-profile-evidence.mjs';
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
const teId='12345678-1234-1234-1234-123456789abc';
const card=(id,name)=>'<h5 class="media__title"><a href="/player-profile/'+id+'"><span>'+name+'</span></a></h5>';
const profile=(name,country)=>'<img class="profile-head__nat" src="//static.tournamentsoftware.com/content/images/flags/'+country+'.svg"><h2 class="media__title media__title--large"><span>'+name+'</span></h2><img src="//static.tournamentsoftware.com/content/images/flags/FRA.svg">';
test('numeric HTML entities preserve accented official names through search and profile verification',async()=>{
 const encoded='Ella Bal&#225;&#x17e;ov&#225;',candidate=teSearchCandidates(card(teId,encoded))[0];
 assert.equal(candidate.name,'Ella Balážová');
 assert.equal(teProfileEvidence(profile(encoded,'SVK'),{...candidate,name:'Ella Balážová'}).nationality,'SVK');
 const found=await lookupTeDirectory('Ella Balážová',async url=>({url,text:new URL(url).searchParams.has('Page')?(new URL(url).searchParams.get('Page')==='1'?card(teId,encoded):''):profile(encoded,'SVK')}));
 assert.equal(found.length,1);assert.equal(found[0].officialId,teId);
 assert.doesNotThrow(()=>teSearchCandidates(card(teId,'Bad &#x110000; Entity')));
});
test('native search cards require named official profile anchors and main-header nationality',()=>{
 const candidates=teSearchCandidates('<a href="/player-profile/'+teId+'">icon</a>'+card(teId,'Richie Kennedy')+'<h5><a href="https://example.com/player-profile/'+teId+'">Other Person</a></h5>');
 assert.equal(candidates.length,1);assert.equal(teProfileEvidence(profile('Richie Kennedy','IRL'),candidates[0]).nationality,'IRL');
 assert.equal(teProfileEvidence(profile('Other Person','IRL'),candidates[0]),null);
 assert.equal(teProfileEvidence('<h2 class="media__title--large">Richie Kennedy</h2><img src="//static.tournamentsoftware.com/content/images/flags/IRL.svg">',candidates[0]),null);
 assert.equal(teProfileEvidence(profile('Richie Kennedy','IRL'),candidates[0],'https://example.com/player-profile/'+teId),null);
});
test('native ROM and MGO profile flags match the equivalent acquired ROU and MNE countries',()=>{
 const candidate=teSearchCandidates(card(teId,'Known Europe Person'))[0];
 for(const [native,acquired]of [['ROM','ROU'],['MGO','MNE']]){
  const evidence=teProfileEvidence(profile('Known Europe Person',native),candidate),catalog=evidenceCatalog();catalog.add([evidence]);
  const source={circuit:'tennis-europe',official_id:'',display_name:'Known Europe Person',nationality:acquired,payload:'{}'};
  assert.equal(catalog.resolve(source)?.officialId,teId);
  assert.equal(catalog.resolve({...source,nationality:'FRA'}),null);
 }
});
test('directory paginates and retains conflicting exact-name GUIDs instead of choosing the first',async()=>{
 const second='12345678-1234-1234-1234-123456789abd',calls=[];
 const found=await lookupTeDirectory('Richie Kennedy',async(url,options)=>{calls.push(url);const u=new URL(url);return {url,text:u.searchParams.has('Page')?(u.searchParams.get('Page')==='1'?card(teId,'Richie Kennedy'):u.searchParams.get('Page')==='2'?card(second,'Richie Kennedy'):''):profile('Richie Kennedy','IRL')};});
 assert.equal(found.length,2);assert.equal(calls.length,5);
 const catalog=evidenceCatalog();catalog.add(found);assert.equal(catalog.resolve({circuit:'tennis-europe',official_id:'',display_name:'Richie Kennedy',nationality:'IRL',payload:'{}'}),null);
 await assert.rejects(lookupTeDirectory('Richie Kennedy',async url=>({url,text:card(teId,'Richie Kennedy')})),/pagination_repeated/);
});
test('an unreadable second candidate fails the lookup rather than inventing a unique match',async()=>{
 const second='12345678-1234-1234-1234-123456789abd';
 await assert.rejects(lookupTeDirectory('Richie Kennedy',async url=>{const u=new URL(url);return {url,text:u.searchParams.has('Page')?(u.searchParams.get('Page')==='1'?card(teId,'Richie Kennedy')+card(second,'Richie Kennedy'):''):u.pathname.endsWith(second)?profile('Wrong Person','IRL'):profile('Richie Kennedy','IRL')};}),/profile_unverified/);
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
