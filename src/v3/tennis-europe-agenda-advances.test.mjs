import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseDrawWalkovers,recoverDrawWalkovers} from './tennis-europe-draw-walkovers.mjs';
import {agendaAdvancementRows} from '../../cloudflare/app-api/lib/tennis-europe-agenda-advances.mjs';
const competitionId='D930BD92-1CF3-4D67-BA61-BF8F35C6263D',drawId='23',event='GD12 - Girls Doubles 12 Main Draw',sourceUrl=`https://te.tournamentsoftware.com/tournament/${competitionId}/draw/${drawId}`;
const p=(id,name)=>({id,name,nationality:'CYP'}),team=[p('4','Evelina KYRIACOU'),p('17','Yinuo LIU')];
const row=(people,won=false,label='')=>'<div class="match__row '+(won?'has-won':'')+'">'+people.map(p=>`<a data-player-id="${p.id}" data-nationality-id="${p.nationality}">${p.name}</a>`).join('')+label+'</div>';
const match=(a,b,{wo=false,date=''}={})=>'<div class="match">'+a+b+(wo?'<span>Walkover</span>':'')+(date?'<div class="match__footer">'+date+'</div>':'')+'</div>';
function board({cancelled=false,firstEmpty=false,proof=true,date='Thu 05/03/2026'}={}){
 const bye=match(row([],false,'Bye Cancelled'),row([],false,'Bye Cancelled'));
 const withdrawn=match(row([p('8','A'),p('9','B')],false,'Cancelled'),row([p('10','C'),p('11','D')],false,proof?'Cancelled':''));
 const branch=cancelled?withdrawn:proof?bye:match(row([],false,'TBA'),row([],false,'TBA'));
 const own=match(row(team,true),row([p('20','X'),p('21','Y')]),{date:'Wed 04/03/2026'});
 const prev=firstEmpty?branch+own:own+branch;
 const current=match(firstEmpty?row([]):row(team,true),firstEmpty?row(team,true):row([]),{wo:true,date});
 return '<div class="js-bracket">'+['Quarter final','Semi final','Final'].map(r=>'<div class="js-subheading">'+r+'</div>').join('')+'<swiper-slide>'+prev+'</swiper-slide><swiper-slide>'+current+'</swiper-slide><swiper-slide></swiper-slide></div>';
}
const opts={competitionId,drawId,event,sourceUrl,startDate:'2026-03-03',endDate:'2026-03-09'};
function parse(options={}){return parseDrawWalkovers({...opts,html:board(options)});}
test('both cancelled and both bye branches create separate dated agenda advances, never matches/results',()=>{
 for(const cancelled of [false,true])for(const firstEmpty of [false,true]){
  const r=parse({cancelled,firstEmpty});assert.deepEqual(r.issues,[]);assert.equal(r.matches.length,0);assert.equal(r.advancements.length,1);const a=r.advancements[0];assert.equal(a.agendaOnly,true);assert.equal(a.score,'');assert.equal(a.status,'advancement');assert.equal(a.date,'2026-03-05');assert.equal(a.advancementEvidence.missingTeamIndex,firstEmpty?0:1);
 }
});
test('missing structural proof and malformed winner stay flagged, never guessed',()=>{
 assert(parse({proof:false}).issues.length);const malformed=board().replace('match__row has-won','match__row');
 const r=parseDrawWalkovers({...opts,html:malformed.replaceAll('match__row has-won','match__row')});assert(r.issues.length);assert.equal(r.advancements.length,0);
});
test('undated advancement uses existing own previous-match date policy',()=>{
 const r=parse({date:''});assert.equal(r.advancements[0].date,'2026-03-05');assert.equal(r.advancements[0].dateSource,'previous_match_plus_one_day');assert.equal(r.pending.length,0);
});
test('real two-sided W/O keeps its existing record and policy',()=>{
 // Construct a complete independent first-round W/O to avoid relying on replacement.
 const ordinary='<div class="js-bracket"><div class="js-subheading">Final</div><swiper-slide>'+match(row(team,true),row([p('22','Opponent One'),p('23','Opponent Two')]),{wo:true,date:'Thu 05/03/2026'})+'</swiper-slide></div>';
 const r=parseDrawWalkovers({...opts,html:ordinary});assert.equal(r.matches.length,1);assert.equal(r.advancements.length,0);assert.equal(r.matches[0].sourceKind,'official_draw_walkover');assert.equal(r.matches[0].date,'2026-03-05');
});
test('recovery retains normal OOP bytes and returns advancements separately on replay',async()=>{
 const matches=[{id:'existing',competitionId,date:'20260304',event,round:'Quarter final',players:team,teams:[team.map(p=>p.id)],status:'scheduled'}],before=JSON.stringify(matches);
 const get=async u=>u.endsWith('/draws')?`<a href="${sourceUrl}">${event}</a>`:board();
 for(let i=0;i<2;i++){const r=await recoverDrawWalkovers({tournament:{...opts},matches,get});assert.equal(r.advancements.length,1);assert.deepEqual(r.issues,[]);assert.equal(JSON.stringify(matches),before);}
});
test('runtime projection requires an existing authorized same-tournament player association and cannot leak by name alone',()=>{
 const a={...parse().advancements[0],tournamentName:'Baghdatis'},players=[{id:'owner',name:'Evelina KYRIACOU',nationality:'CYP'}],matches=[{playerId:'owner',playerName:'Evelina KYRIACOU',competitionId,sourceNationality:'CYP'}];
 const rows=agendaAdvancementRows([a],players,matches);assert.equal(rows.length,1);assert.equal(rows[0].opponent,'Avversario non definito');assert.equal(rows[0].partner,'Yinuo LIU');assert.equal(rows[0].agendaOnly,true);
 assert.equal(agendaAdvancementRows([a],players,[]).length,0);assert.equal(agendaAdvancementRows([a],[],matches).length,0);assert.equal(agendaAdvancementRows([a],players,[{...matches[0],competitionId:'OTHER'}]).length,0);assert.equal(agendaAdvancementRows([a],players,[{...matches[0],sourceNationality:'ITA'}]).length,0);
 assert.equal(agendaAdvancementRows([{...a,sourceUrl:'https://evil.example'}],players,matches).length,0);assert.equal(agendaAdvancementRows([a,a],players,matches).length,1);
});
const frontend=await fs.readFile(new URL('../../v3.js',import.meta.url),'utf8');
const fn=name=>frontend.slice(frontend.indexOf('function '+name+'('),frontend.indexOf('\nfunction ',frontend.indexOf('function '+name+'(')+1));
test('actual frontend normalization keeps advancement only in agenda through repeated normalization; exact non-clickable opponent label',()=>{
 const context=vm.createContext({canonicalPlayerMatches:r=>r,circuit:m=>m.circuit});vm.runInContext(fn('agendaKey')+'\n'+fn('mergeAgenda')+'\n'+fn('normalizeMatchProjection')+'\n'+fn('pendingOpponentHtml'),context);
 const advance={...agendaAdvancementRows([{...parse().advancements[0],tournamentName:'Baghdatis'}],[{id:'owner',name:'Evelina KYRIACOU'}],[{playerId:'owner',playerName:'Evelina KYRIACOU',competitionId}])[0]},ordinary={id:'normal',playerId:'owner',circuit:'tennis-europe',opponent:'Real opponent',result:'6-0 6-0'};
 context.input={matches:[ordinary,advance],agenda:[],results:[advance,ordinary]};vm.runInContext('output=normalizeMatchProjection(input);again=normalizeMatchProjection(output)',context);
 assert.equal(context.output.matches.length,1);assert.equal(context.output.results.length,1);assert.equal(context.output.agenda.length,2);assert.equal(context.again.agenda.length,2);assert.equal(context.pendingOpponentHtml(advance),'Avversario non definito');assert.equal(context.output.matches[0],ordinary);
});
test('six DOM-observed source cases plus archived date anchors produce six agenda entries and zero ordinary matches',async()=>{
 const fixtures=JSON.parse(await fs.readFile(new URL('./fixtures/te-six-empty-advances.json',import.meta.url),'utf8'));
 for(const {input,expectedDate} of fixtures){const r=parseDrawWalkovers(input);assert.deepEqual(r.issues,[]);assert.deepEqual(r.pending,[]);assert.equal(r.matches.length,0);assert.equal(r.advancements.length,1);assert.equal(r.advancements[0].date,expectedDate);assert.equal(r.advancements[0].agendaOnly,true);}
});
