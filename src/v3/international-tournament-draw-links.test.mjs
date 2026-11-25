import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../v3.css',import.meta.url),'utf8');
const esc=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function renderer(){
 const ctx={URL,Map,Set,circuit:t=>t.circuit,readableText:value=>String(value||''),esc,fitpInlineDrawSlot:()=>'<fitp-existing-slot>'};
 vm.createContext(ctx);
 vm.runInContext(js.slice(js.indexOf('function agendaGenderClass('),js.indexOf('function agendaRoundCode(')),ctx);
 vm.runInContext(js.slice(js.indexOf('function tournamentOfficialUrl('),js.indexOf('function tournamentAcceptanceUrl(')),ctx);
 return ctx;
}
const te={circuit:'tennis-europe',competitionId:'5C795C29-2EB4-40E7-B1EB-F49A08231149'};
const itf={circuit:'itf',competitionId:'J-J30-SRB-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-nis/srb/2026/j-j30-srb-2026-002/'};
test('Europe uses FITP age rows, gender colors and SM/SF/DM/DF ordering',()=>{
 const c=renderer();const html=c.tournamentDrawLinks(te,[{event:'GD14'},{event:'BD12'},{event:'GS14'},{event:'BS14'},{event:'BD14'},{event:'BS12'}]);
 assert.deepEqual([...html.matchAll(/data-international-draw-age="([^"]+)"/g)].map(m=>m[1]),['U12','U14']);
 const row=html.slice(html.indexOf('data-international-draw-age="U14"'));
 assert(row.indexOf('>SM14 ')<row.indexOf('>SF14 '));assert(row.indexOf('>SF14 ')<row.indexOf('>DM14 '));assert(row.indexOf('>DM14 ')<row.indexOf('>DF14 '));
 assert.match(row,/fitpDrawFemale/);assert.match(row,/fitpDrawMale/);assert.equal((html.match(/<a /g)||[]).length,6);
});
test('ITF native main and qualifying codes are visible without an age in the event code',()=>{
 const c=renderer();const html=c.tournamentDrawLinks(itf,[{event:'G-D-M-KO'},{event:'B-S-M-KO'},{event:'G-S-M-KO'},{event:'B-S-Q-KO'}]);
 assert.match(html,/Under 18/);assert.match(html,/>SM18 Qualificazioni<\/a>/);assert.match(html,/>SM18 Tabellone principale<\/a>/);
 assert(html.indexOf('>SM18 Qualificazioni')<html.indexOf('>SM18 Tabellone principale'));
 assert.match(html,/>SF18 Tabellone principale/);assert.match(html,/>DF18 Tabellone principale/);assert.equal((html.match(/<a /g)||[]).length,4);
});
test('actual ITF entry draw strings work when no player match is present',()=>{
 const c=renderer();const html=c.tournamentDrawLinks({...itf,people:[{draws:['Girls Doubles Main Draw','Girls Singles Main Draw','Girls Singles Qualifying']}]},[]);
 assert.match(html,/>SF18 Qualificazioni/);assert.match(html,/>SF18 Tabellone principale/);assert.match(html,/>DF18 Tabellone principale/);
 assert.equal((html.match(/<a /g)||[]).length,3);
});
test('match duplicates collapse, direct Europe draw links win over tournament fallbacks',()=>{
 const c=renderer(),direct='https://te.tournamentsoftware.com/sport/draw.aspx?id='+te.competitionId+'&draw=7';
 const html=c.tournamentDrawLinks({...te,people:[{draws:['BS14']}]},[{event:'BS14'},{event:'BS14',drawUrl:direct},{event:'BS14',drawUrl:direct}]);
 assert.equal((html.match(/<a /g)||[]).length,1);assert.match(html,/draw=7/);assert.match(html,/&amp;/);
});
test('round robins and qualifying keep separate identities',()=>{
 const html=renderer().tournamentDrawLinks(itf,[{event:'G-S-M-RR'},{event:'G-S-M-KO'},{event:'G-S-Q-KO'}]);
 assert.equal((html.match(/<a /g)||[]).length,3);assert.match(html,/Gironi/);assert.match(html,/Qualificazioni/);
});
test('ITF official URL is not duplicated when it already ends with draws or acceptance',()=>{
 const c=renderer();
 for(const suffix of ['draws-and-results/','acceptance-list/']){
  const html=c.tournamentDrawLinks({...itf,sourceUrl:itf.sourceUrl+suffix},[{event:'B-S-M-KO'}]);
  assert.equal((html.match(/draws-and-results/g)||[]).length,1);assert.doesNotMatch(html,/acceptance-list/);
 }
});
test('unknown draws, unfounded age and unsafe links do not create draw links; FITP and camps retain behavior',()=>{
 const c=renderer();assert.equal(c.tournamentDrawLinks({circuit:'fitp'},[]),'<fitp-existing-slot>');assert.equal(c.tournamentDrawLinks({...itf,manualEvent:true},[]),'');
 for(const row of [{event:'Boys Singles'},{event:'BS14',drawUrl:'javascript:alert(1)'},{event:'BS14',drawUrl:'https://evil.test/draw'}]){
  if(row.event==='Boys Singles')assert.doesNotMatch(c.tournamentDrawLinks(te,[row]),/<a /);
  else assert.doesNotMatch(c.tournamentDrawLinks(te,[row]),/javascript:|evil\.test/);
 }
 assert.doesNotMatch(c.tournamentDrawLinks({...itf,competitionId:'M-OTHER'},[{event:'B-S-M-KO'}]),/<a /);
 assert.doesNotMatch(c.tournamentDrawLinks(itf,[]),/<a |Nessun|Caricamento|aggiornamento/);
});
test('same layout rules apply to international and FITP wrappers without any network acquisition',()=>{
 assert.match(css,/:is\(\[data-fitp-draw-links\],\[data-international-draw-links\]\)/);
 const code=js.split('// INTERNATIONAL_TOURNAMENT_DRAW_LINKS_START')[1].split('// INTERNATIONAL_TOURNAMENT_DRAW_LINKS_END')[0];
 assert.doesNotMatch(code,/fetch\(|setInterval|setTimeout/);
});

test('Europe catalog age is used only when unambiguous, never the first age of a multi-age tournament',()=>{
 const c=renderer();
 assert.match(c.tournamentDrawLinks({...te,tournamentCategory:'14 & Under'},[{event:'Girls Singles'}]),/>SF14 /);
 assert.doesNotMatch(c.tournamentDrawLinks({...te,tournamentCategory:'U12 · Category 1 / U14 · Category 2'},[{event:'Girls Singles'}]),/<a /);
 assert.match(c.tournamentDrawLinks({...te,tournamentCategory:'U12 / U14'},[{event:'GS14'}]),/>SF14 /);
});
