import test from 'node:test';import assert from 'node:assert/strict';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
import {sourceAcceptanceReferences,acceptanceContactRole,acceptanceRowProfiles,acceptanceSourceProfiles,originalAcceptancePage} from '../lib/acceptance-source-profile-provenance.mjs';
const id='12345678-1234-1234-1234-123456789abc',t='22345678-1234-1234-1234-123456789abc',other='32345678-1234-1234-1234-123456789abc';
const p={playerName:'Example Person',countryCode:'FRA',event:'BS14',participantId:'',birthYear:2012},row=acquiredPlayer('tennis-europe',{name:p.playerName,nationality:p.countryCode,birthYear:p.birthYear}),source={source_key:'acceptance|'+row.sourceKey,source_table:'observed_players',circuit:'tennis-europe',official_id:'',display_name:p.playerName,nationality:'FRA',birth_year:2012},doc={status:'tennis_europe_participant_cache_complete',tournaments:{[t]:{competitionId:t,participants:[p]}}};
const header='<img class="profile-head__nat" src="https://static.tournamentsoftware.com/content/images/flags/TUN.svg"><h2 class="media__title--large">Example Person</h2>';
const acceptance='<h1>Acceptance list</h1><select name="event"><option selected value="1">BS14</option></select><table><tr><td>1</td><td>[TUN]</td><td>Example Person</td><td>2012</td><td><a href="/player-profile/'+id+'"><svg></svg></a></td></tr></table>';
test('original acceptance source hash binds exact country and birth metadata; no generic name shortcut',()=>{
 assert.equal(sourceAcceptanceReferences(source,doc).length,1);
 assert.equal(sourceAcceptanceReferences(source,{...doc,tournaments:{[t]:{competitionId:t,participants:[{...p,countryCode:'ITA'}]}}}).length,0);
 assert.equal(sourceAcceptanceReferences({...source,source_key:'tennis-europe|name:EXAMPLE PERSON'},doc).length,1);
 assert.throws(()=>sourceAcceptanceReferences(source,{}),/incomplete/);
});
test('exact original acceptance row reveals native profile across nationality change, independent of global homonyms',async()=>{
 const get=async url=>({url,text:url.includes('acceptancelist')?acceptance:header});const result=await acceptanceSourceProfiles([source],doc,get);assert.equal(result.report.verified,1);const e=result.resolved.get(source.source_table+'|'+source.source_key);assert.equal(e.officialId,id);assert.equal(e.historicalNationality,'FRA');assert.equal(e.nationality,'TUN');assert.equal(e.birthYear,2012);
 assert.equal(acceptanceRowProfiles(acceptance,'Other Person').length,0);
});
test('missing, duplicate, conflicting original native profiles and wrong birth or redirect stay unresolved',async()=>{
 for(const html of [acceptance.replace('Example Person','Other Person'),acceptance.replace('2012','2010'),acceptance.replace('</table>',acceptance.match(/<tr>[\s\S]*?<\/tr>/)[0]+'</table>')]){const r=await acceptanceSourceProfiles([source],doc,async url=>({url,text:url.includes('acceptancelist')?html:header}));assert.equal(r.report.verified,0)}
 const second={...doc,tournaments:{...doc.tournaments,[other]:{competitionId:other,participants:[{...p,participantId:other}]}}};assert.equal((await acceptanceSourceProfiles([source],second,async url=>({url,text:url.includes('acceptancelist')?acceptance:header}))).report.verified,0);
 assert.equal((await acceptanceSourceProfiles([source],doc,async url=>({url:'https://example.com/player-profile/'+id,text:header}))).report.verified,0);
});
test('event switch must be verified before participant rows are used',async()=>{
 const base={url:'https://te.tournamentsoftware.com/sport/acceptancelist.aspx?id='+t,text:acceptance.replace('selected value="1">BS14','value="1">BS14')};await assert.rejects(originalAcceptancePage({competitionId:t,event:'BS14'},async()=>base),/switch_unverified/);
});

test('legacy observed name source traces its certified participant index references rather than requiring an acceptance hash',async()=>{
 const observed={...source,source_key:'tennis-europe|name:EXAMPLE PERSON'},empty={...doc,tournaments:{[t]:{competitionId:t,participants:[]}}},index={status:'tennis_europe_participant_index_complete',byName:{'EXAMPLE PERSON':[{competitionId:t,event:'BS14',playerName:'Example Person',participantId:''}]}};
 assert.equal(sourceAcceptanceReferences(observed,empty,index).length,1);
 const result=await acceptanceSourceProfiles([observed],empty,async url=>({url,text:url.includes('acceptancelist')?acceptance:header}),index);assert.equal(result.report.verified,1);
 assert.equal(sourceAcceptanceReferences({...observed,source_key:'tennis-europe|name:OTHER PERSON'},empty,index).length,0);
 assert.throws(()=>sourceAcceptanceReferences(observed,empty,{...index,byName:{'EXAMPLE PERSON':[{competitionId:t,event:'BS14',playerName:'Other Person'}]}}),/incomplete/);
});

test('explicit tournament contact role is diagnostic evidence and never a player ID',async()=>{
 const contact='<h1>Acceptance list</h1><select name="event"><option selected value="1">BS14</option></select><table><tr><td>Tournament director</td><td>Example Person</td></tr></table>';
 assert.equal(acceptanceContactRole(contact,source.display_name),true);assert.equal(acceptanceContactRole(contact,'Other Person'),false);
 const result=await acceptanceSourceProfiles([source],doc,async url=>({url,text:contact}));assert.equal(result.report.verified,0);assert.equal(result.report.originalContactOnlyReferences,1);assert.equal(result.resolved.size,0);
});
