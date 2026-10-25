import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseDrawWalkovers,recoverDrawWalkovers,discoverDraws,isRecoveredDrawWalkover,drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const id='079DE5F9-FF49-47F1-A29D-92AB44CDD455',url='https://te.tournamentsoftware.com/tournament/'+id+'/draw/7';
const html=await fs.readFile(new URL('./fixtures/te-avvenire-bd14-walkovers.html',import.meta.url),'utf8');
const options={html,event:'BD14 - Boys Doubles 14 Main Draw',competitionId:id,drawId:'7',endDate:'2026-06-06',sourceUrl:url};
const parsed=parseDrawWalkovers(options),last=parsed.matches.find(m=>m.round==='Final');
test('real Avvenire bracket: all seven W/O found, intermediate dates preserved, undated final uses tournament end',()=>{
 assert.equal(parsed.walkovers,7);assert.equal(parsed.matches.length,6);assert.equal(parsed.pending.length,1);assert.deepEqual(parsed.issues,[]);
 assert.equal(last.date,'2026-06-06');assert.equal(last.dateSource,'tournament_end_date_final_policy');assert.deepEqual(last.winnerPlayerIds,['2','73']);assert(last.players.some(p=>p.name==='Richard MITCHELL'));
 assert.equal(parsed.matches.find(m=>m.round==='Quarter final').date,'2026-06-05');assert(parsed.matches.every(isRecoveredDrawWalkover));
});
test('missing tournament start stays pending; explicit final date takes precedence',()=>{
 assert.equal(parsed.pending[0].round,'Round of 32');assert.equal(parsed.pending[0].date,'');assert.equal(parsed.pending[0].reason,'tournament_start_date_missing');
 const withDate=html.replace(/(<span class="tag--warning tag match__message">Walkover<\/span>[\s\S]*?)(<\/swiper-slide>\s*<\/div>\s*$)/,'$1<div class="match__footer">Fri 05/06/2026</div>$2');
 const p=parseDrawWalkovers({...options,html:withDate});assert.equal(p.matches.find(m=>m.round==='Final').date,'2026-06-05');assert.equal(p.matches.find(m=>m.round==='Final').dateSource,'official_draw_date');
});
test('undated first round uses tournament start; a middle round uses its own preceding dated match plus one day',()=>{
 const full=parseDrawWalkovers({...options,startDate:'2026-05-30'});assert.equal(full.matches.length,7);assert.equal(full.pending.length,0);
 const first=full.matches.find(m=>m.players.some(p=>p.name==='Max KARKKAINEN'));assert.equal(first.date,'2026-05-30');assert.equal(first.dateSource,'tournament_start_date_first_round_policy');assert(isRecoveredDrawWalkover(first));
 const quarter=[...html.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)][2][0];
 const undated=html.replace(quarter,quarter.replace(/<div class="match__footer">[\s\S]*$/,'</swiper-slide>'));
 const middle=parseDrawWalkovers({...options,html:undated,startDate:'2026-05-30'}).matches.find(m=>m.round==='Quarter final');
 assert.equal(middle.date,'2026-06-05');assert.equal(middle.dateSource,'previous_match_plus_one_day');assert.equal(middle.previousMatchDate,'2026-06-04');assert(middle.previousMatchIds.length);assert(isRecoveredDrawWalkover(middle));
});
test('preceding match must be the same team and draw; inferred date cannot exceed tournament end',()=>{
 const slides=[...html.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)].map(m=>m[1]);
 const board='<div class="js-bracket">'+['Round of 32','Round of 16','Quarter final','Semi final','Final'].map(r=>`<div class="js-subheading">${r}</div>`).join('')+slides.map((s,i)=>'<swiper-slide>'+(i===2?s.replace(/<div class="match__footer">[\s\S]*$/,''):'')+'</swiper-slide>').join('')+'</div>';
 const player=parsed.matches.find(m=>m.round==='Quarter final').players;
 const previous={...parsed.matches.find(m=>m.round==='Round of 16'&&m.players.some(p=>p.name===player[0].name)),date:'2026-06-04'};
 const p=parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[previous]});assert.equal(p.matches[0].date,'2026-06-05');
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,drawId:'99'}]}).pending.length,1);
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,date:'2026-06-06'}]}).pending.length,1);
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,players:previous.players.map(p=>({...p,name:'Other '+p.name}))}]}).pending.length,1);
});
test('wrong date, unsupported layout, missing winner and BYE are never certified recoveries',()=>{
 assert(parseDrawWalkovers({...options,html:'<div>Walkover</div>'}).issues.length);
 const p=parseDrawWalkovers({...options,html:html.replaceAll('has-won','')});assert.equal(p.matches.length,0);assert(p.issues.length);
 assert(!isRecoveredDrawWalkover({...last,sourceUrl:'https://evil.example/draw/7'}));assert(!isRecoveredDrawWalkover({...last,date:'2026-02-30'}));assert(!isRecoveredDrawWalkover({...last,round:'Semi final'}));assert(!isRecoveredDrawWalkover({...last,winnerPlayerIds:['nobody']}));
 const bye=html.replaceAll('Richard MITCHELL [1, DA]','Bye');assert(parseDrawWalkovers({...options,html:bye}).issues.length);
});
test('discovery validates host and tournament and collapses legacy/canonical URLs',()=>{
 const links=discoverDraws(`<a href="${url}">BD14</a><a href="https://te.tournamentsoftware.com/sport/draw.aspx?id=${id}&amp;draw=7">BD14</a><a href="https://evil.example/tournament/${id}/draw/8">Bad</a><a href="/tournament/OTHER/draw/9">Bad</a>`,id);assert.equal(links.length,1);assert.equal(links[0].number,'7');
});
const tournament={competitionId:id,tournamentName:'Avvenire',endDate:'2026-06-06'};
const get=async(u,headers)=>u.endsWith('/draws')?`<a href="${url}">BD14 - Boys Doubles 14 Main Draw</a>`:u===url?`<span>BD14 - Boys Doubles 14 Main Draw</span><form action="/tournament/${id}/Draw/7/GetDrawContent"></form>`:(assert.equal(headers?.['x-requested-with'],'XMLHttpRequest'),html);
test('replay and OOP rows with different draw-local IDs do not duplicate; phase remains distinct',async()=>{
 const stored=parsed.matches.filter(m=>m!==last).map((m,i)=>({...m,id:'oop'+i,players:m.players.map(p=>({...p,id:'local-'+p.id})),teams:m.teams.map(t=>t.map(id=>'local-'+id)),winnerPlayerIds:m.winnerPlayerIds.map(id=>'local-'+id)}));
 const r=await recoverDrawWalkovers({tournament,matches:stored,get});assert.equal(r.cases.filter(c=>c.disposition==='recovered').length,1);assert.equal(stored.length,6);assert.equal(r.pending.length,1);
 const again=await recoverDrawWalkovers({tournament,matches:stored,get});assert.equal(again.cases.filter(c=>c.disposition==='recovered').length,0);assert.equal(stored.length,6);
 assert.notEqual(drawMatchKey(last),drawMatchKey({...last,event:'BD14 Bonus Draw'}));
});
test('existing scheduled OOP gets the W/O result with its own IDs/date; conflicting completed result stays flagged',async()=>{
 const m={...last,id:'scheduled-oop',status:'scheduled',score:'',date:'2026-06-05',winnerTeamIndex:-1,winnerPlayerIds:[]};const rows=[m];
 const report=await recoverDrawWalkovers({tournament,matches:rows,get});assert.equal(m.status,'completed');assert.equal(m.score,'W/O');assert.equal(m.date,'2026-06-05');assert(report.cases.some(c=>c.disposition==='updated_oop_result_from_draw'));
 const conflict={...last,id:'conflict',score:'6-0 6-0',winnerTeamIndex:1};const again=await recoverDrawWalkovers({tournament,matches:[conflict],get});assert.equal(conflict.score,'6-0 6-0');assert(again.issues.some(i=>i.reason==='walkover_completed_result_conflict'));
});
test('manual record remains authoritative and is not inserted again',async()=>{
 const manual={matchId:'manual',competitionId:id,event:last.event,round:'Finale',playerName:last.players[0].name,partner:last.players[1].name,opponentOptions:last.players.slice(2).map(p=>p.name),date:'2026-06-06'};
 const rows=parsed.matches.filter(m=>m!==last);const r=await recoverDrawWalkovers({tournament,matches:rows,get,manualMatches:[manual]});assert.equal(rows.length,5);assert(r.cases.some(c=>c.disposition==='already_in_manual_override'&&c.matchId==='manual'));
});
test('failed official content is reported while existing OOP stays intact',async()=>{
 const rows=[last];const r=await recoverDrawWalkovers({tournament,matches:rows,get:async()=>{throw Error('503')}});assert.equal(rows.length,1);assert.equal(r.status,'needs_attention');assert(r.issues.length);
});
test('real Kufstein final remains the existing Grimoldi manual record',async()=>{
 const competitionId='72B85BEB-F56D-48F3-AA67-88C1F293C970',u='https://te.tournamentsoftware.com/tournament/'+competitionId+'/draw/2';
 const document=await fs.readFile(new URL('./fixtures/te-kufstein-bonus-final-walkover.html',import.meta.url),'utf8');
 const p=parseDrawWalkovers({html:document,event:'BS12 - Boys Singles 12 Bonus Draw',competitionId,drawId:'2',endDate:'2026-07-25',sourceUrl:u});
 assert.equal(p.matches.length,1);assert.deepEqual(p.issues,[]);assert.equal(p.matches[0].date,'2026-07-25');assert.deepEqual(p.matches[0].winnerPlayerIds,['106']);
 const rows=[],manual={matchId:'te-manual-kufstein-2026-bonus-final',competitionId,event:'BS12 - Boys Singles 12 Bonus Draw',round:'Finale',playerName:'Edoardo Grimoldi',opponent:'Lucca Becerra',date:'2026-07-25'};
 const read=async target=>target.endsWith('/draws')?`<a href="${u}">BS12 - Boys Singles 12 Bonus Draw</a>`:target===u?`<span>BS12 - Boys Singles 12 Bonus Draw</span><form action="/tournament/${competitionId}/Draw/2/GetDrawContent"></form>`:document;
 const audit=await recoverDrawWalkovers({tournament:{competitionId,endDate:'2026-07-25'},matches:rows,get:read,manualMatches:[manual]});assert.equal(rows.length,0);assert.equal(audit.cases[0].disposition,'already_in_manual_override');
});
