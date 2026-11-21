import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';import fs from 'node:fs';
import {opponentTournamentWindow} from '../../cloudflare/app-api/lib/opponent-tournament-window.mjs';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const body={setAttribute(){},innerHTML:'',insertAdjacentHTML(){}};
const context=vm.createContext({circuit:t=>t.circuit||'tennis-europe',iso:()=> '2026-11-21',Date,
 $:id=>id==='opponentTournamentHistory'?body:null,esc:x=>String(x),readableText:x=>x,
 withoutPucItfReferences:x=>x,state:{data:{tournaments:[]}},tournamentOfficialUrl:()=>'',tournamentSurfaceLabel:()=>'',
 opponentTournamentEventLinks:()=>'',opponentTournamentDateLabel:()=> '16–25 novembre',
 opponentHistoryMatchSectionsHtml:()=>'',bindParticipantNavigation:()=>{}});
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
vm.runInContext(extract('function opponentTournamentWindow(','function opponentFitpRankingText('),context);
vm.runInContext(extract('function opponentTournamentAcceptanceLabel(','function opponentHistoryKey('),context);
context.opponentTournamentAcceptanceLabel=()=> '';
const base={circuit:'tennis-europe',competitionId:'early',name:'Early',startDate:'2026-11-16',endDate:'2026-11-25',matches:[{event:'BS16',date:'2026-11-20',round:'R16',status:'completed',outcomeConfirmed:true,won:false}]};
test('actual page projects early completion identically to Worker and renders CONCLUSO before official end',()=>{
 const server=opponentTournamentWindow([base],'2026-11-21');
 const browser=context.opponentHistoryProjection({tournaments:server}).tournaments;
 assert.equal(browser[0].historyKind,'past');
 context.renderOpponentHistory({tournaments:server});
 assert.match(body.innerHTML,/CONCLUSO/);assert.doesNotMatch(body.innerHTML,/ongoingTournament/);
});
test('actual page retains both concurrent current tournaments after Worker and browser projection',()=>{
 const rows=[{circuit:'itf',competitionId:'z',name:'Zapopan',startDate:'2026-11-16',endDate:'2026-11-21',drawConfirmed:true,historyEvidence:'acquired_itf_draw_presence'},{circuit:'itf',competitionId:'m',name:'Merida',startDate:'2026-11-21',endDate:'2026-11-28'}];
 const server=opponentTournamentWindow(rows,'2026-11-21');
 context.renderOpponentHistory({tournaments:server});
 assert.equal((body.innerHTML.match(/class="opponentHistoryTournament ongoingTournament"/g)||[]).length,2);
 assert.match(body.innerHTML,/Zapopan/);assert.match(body.innerHTML,/Merida/);
});
