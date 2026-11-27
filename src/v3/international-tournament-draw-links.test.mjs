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
 assert(row.indexOf('>SM14<')<row.indexOf('>SF14<'));assert(row.indexOf('>SF14<')<row.indexOf('>DM14<'));assert(row.indexOf('>DM14<')<row.indexOf('>DF14<'));
 assert.match(row,/fitpDrawFemale/);assert.match(row,/fitpDrawMale/);assert.equal((html.match(/<a /g)||[]).length,6);
});
test('ITF has exactly one immediate all-draw link regardless of matches or acquired events',()=>{
 const c=renderer();for(const rows of [[],[{event:'G-S-M-RR',group:'A'}],[{event:'B-S-Q-KO'},{event:'G-D-M-KO'}]]){
  const html=c.tournamentDrawLinks(itf,rows);assert.equal((html.match(/<a /g)||[]).length,1);assert.match(html,/>Tabelloni<\/a>/);assert.match(html,/j-j30-srb-2026-002\/draws-and-results\//);assert.doesNotMatch(html,/Under|RR Group|print\/|app\/api/);
 }
});
test('ITF catalogue-only tournaments have their all-draw link without an acquired inventory',()=>{
 const c=renderer();assert.match(c.tournamentDrawLinks({...itf,catalogueOnly:true,draws:[],people:[]},[]),/>Tabelloni<\/a>/);
 assert.match(c.tournamentDrawLinks({...itf,sourceUrl:'',source:{url:itf.sourceUrl}},[]),/draws-and-results/);
});
test('match duplicates collapse, direct Europe draw links win over tournament fallbacks',()=>{
 const c=renderer(),direct='https://te.tournamentsoftware.com/sport/draw.aspx?id='+te.competitionId+'&draw=7';
 const html=c.tournamentDrawLinks({...te,people:[{draws:['BS14']}]},[{event:'BS14'},{event:'BS14',drawUrl:direct},{event:'BS14',drawUrl:direct}]);
 assert.equal((html.match(/<a /g)||[]).length,1);assert.match(html,/draw=7/);assert.match(html,/&amp;/);
});
test('Europe compact labels distinguish qualification, main draw and RR without long phase text',()=>{
 const c=renderer(),row=(event,n)=>({event,drawUrl:`https://te.tournamentsoftware.com/tournament/${te.competitionId}/draw/${n}`});
 const html=c.tournamentDrawLinks(te,[row('BS12 - Boys Singles 12 Qualifying',1),row('BS12 - Group A',2),row('BS12 - Boys Singles 12 Playoff',3),row('BD12',4)]);
 assert.match(html,/>SQ12<\/a>/);assert.match(html,/>SM12 RR Group A<\/a>/);assert.match(html,/>SM12 Playoff<\/a>/);assert.match(html,/>DM12<\/a>/);assert.doesNotMatch(html,/<b[^>]*>Under/);
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
 assert.match(c.tournamentDrawLinks(itf,[]),/>Tabelloni<\/a>/);assert.doesNotMatch(c.tournamentDrawLinks({...itf,sourceUrl:'javascript:alert(1)'},[]),/<a /);
});
test('same layout rules apply to international and FITP wrappers without any network acquisition',()=>{
 assert.match(css,/:is\(\[data-fitp-draw-links\],\[data-international-draw-links\]\)/);
 const code=js.split('// INTERNATIONAL_TOURNAMENT_DRAW_LINKS_START')[1].split('// INTERNATIONAL_TOURNAMENT_DRAW_LINKS_END')[0];
 assert.doesNotMatch(code,/fetch\(|setInterval|setTimeout/);
});

test('Europe catalog age is used only when unambiguous, never the first age of a multi-age tournament',()=>{
 const c=renderer();
 assert.match(c.tournamentDrawLinks({...te,tournamentCategory:'14 & Under'},[{event:'Girls Singles'}]),/>SF14</);
 assert.doesNotMatch(c.tournamentDrawLinks({...te,tournamentCategory:'U12 · Category 1 / U14 · Category 2'},[{event:'Girls Singles'}]),/<a /);
 assert.match(c.tournamentDrawLinks({...te,tournamentCategory:'U12 / U14'},[{event:'GS14'}]),/>SF14</);
});
test('Forli categories have stable rows and RR groups use natural numeric order',()=>{
 const c=renderer(),t={circuit:'tennis-europe',competitionId:'00523E1D-06C9-430A-B8B9-851B401381E3'},make=(event,n)=>({event,drawUrl:`https://te.tournamentsoftware.com/tournament/${t.competitionId}/draw/${n}`});
 const html=c.internationalTournamentDrawHtml(t,[make('GS12 - Group 10',10),make('BS12 - Group 2',2),make('BS12 - Group 1',1),make('GS12 - Group 2',12),make('BD12',3),make('GD12',4)]);
 assert.deepEqual([...html.matchAll(/data-international-draw-category="([^"]+)"/g)].map(m=>m[1]),['SM12','SF12','DM12','DF12']);assert(html.indexOf('SM12 RR Group 1')<html.indexOf('SM12 RR Group 2'));assert(html.indexOf('SF12 RR Group 2')<html.indexOf('SF12 RR Group 10'));
});
test('single-age Europe omits age heading; a multi-age draw list keeps headings',()=>{
 const c=renderer();assert.doesNotMatch(c.tournamentDrawLinks(te,[{event:'BS12'},{event:'GS12'}]),/fitpDrawAgeLabel/);
 const multi=c.tournamentDrawLinks(te,[{event:'BS12'},{event:'GS14'}]);assert.match(multi,/>Under 12</);assert.match(multi,/>Under 14</);
});
