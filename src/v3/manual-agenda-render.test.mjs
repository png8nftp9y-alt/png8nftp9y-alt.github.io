import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function createMatchTournamentResolver('),source.indexOf('function matchTournament('))+source.slice(source.indexOf('function renderAgenda()'),source.indexOf('function tournamentKey('))+source.slice(source.indexOf('function manualCalendarAgendaHtml('),source.indexOf('function wireCalendarEvents('));
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const mode of ['tournament','chronological'])for(const withManual of [false,true])test(`actual agenda renders three matches once: ${mode}, manual=${withManual}`,()=>{
 const day='2026-11-22',players=['p1','p2','p3'],t={competitionId:'official',name:'Automatic',circuit:'tennis-europe',people:players.map(playerId=>({playerId,playerName:playerId}))};
 const manual={competitionId:'manual-event',manualEvent:true,eventColor:'red',name:'Gara a squadre',location:'Monza',startDate:day,endDate:day,circuit:'manual',people:t.people.slice(0,2)};
 const matches=players.map((playerId,i)=>({id:'match'+i,playerId,date:day,circuit:'tennis-europe',competitionId:'official',tournamentName:'Automatic',playerName:playerId}));
 const nodes={},node=id=>nodes[id]??=(id==='weeklyAgendaPanel'?{hidden:true}:{querySelectorAll:()=>[]});let calls=0;
 const context={state:{data:{agenda:matches},selected:new Set(players),agenda:new Date(day+'T12:00:00'),agendaMode:mode},$:node,groups:()=>{calls++;return withManual?[t,manual]:[t]},iso:()=>day,agendaBtnFmt:()=>day,dedupeAgendaMatches:x=>x,agendaChronologicalCompare:()=>0,circuit:x=>x?.circuit||'fitp',readableText:x=>String(x||''),agendaEstimatedMinutes:()=>600,agendaTime:()=> '10:00',agendaTournamentCategoryPlan:()=>({header:'',matchCategories:new Map()}),tournamentKey:t=>t.competitionId,tournamentDisplayName:t=>t?.name||'Automatic',agendaTournamentLocation:()=> 'Monza',tournamentSurfaceLabel:()=>'',agendaMatchRows:x=>[x],agendaCircuitBadges:()=>'',matchMeta:()=>({}),agendaCourtMatchNumber:()=>'',agendaRoundCode:()=>'',agendaSchedule:()=>({timeText:'10:00'}),agendaOrderOfPlayUrl:()=>'',agendaLongCourt:()=>false,agendaDrawCodeHtml:()=>'',agendaPlayerTeamLinksHtml:m=>m.playerName,opponentHtml:()=> 'Opponent',agendaResultHtml:()=>'',overlap:()=>true,esc,updateDailyAgenda:(node,markup)=>{node.innerHTML=markup;return true},bindParticipantNavigation:()=>{}};
 vm.createContext(context);vm.runInContext(functions,context);
 context.renderAgenda();assert.equal(calls,1);assert.equal((node('dailyAgenda').innerHTML.match(/class="agendaItem/g)||[]).length,3);assert.equal((node('dailyAgenda').innerHTML.match(/class="manualAgendaEvent/g)||[]).length,withManual?1:0);
 context.state.selected=new Set(['p1']);calls=0;context.renderAgenda();assert.equal(calls,1);assert.equal((node('dailyAgenda').innerHTML.match(/class="agendaItem/g)||[]).length,1);
 context.state.selected.clear();calls=0;context.renderAgenda();assert.equal(calls,1);assert.doesNotMatch(node('dailyAgenda').innerHTML,/class="agendaItem|class="manualAgendaEvent/);
});
