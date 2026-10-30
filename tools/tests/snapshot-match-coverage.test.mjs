import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {snapshotMatchCoverage} from '../lib/snapshot-match-coverage.mjs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const ctx={circuit:m=>m.circuit,agendaCourtMatchNumber:m=>m.courtMatchNumber||0,
 matchMeta:m=>({isDouble:m.matchType==='doubles'}),
 agendaTeamNames:m=>[m.playerName,m.partner,m.opponent].filter(Boolean).sort()};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function agendaKey('),source.indexOf('function clearDemographicFilters(')),ctx);
vm.runInContext(source.slice(source.indexOf('function sameAgendaMatch('),source.indexOf('function agendaMatchRows(')),ctx);
const ordinary={id:'official-64',matchId:'official-64',playerId:'julian',playerName:'Julian Letsch',circuit:'tennis-europe',competitionId:'0EAA6B10-22C1-4079-BEFF-DC5815760B0C',date:'2026-10-05',event:'BS14 - Boys Singles 14 Main Draw',round:'Round of 64',opponent:'Francisco Sosa Grassi',score:'6-4 6-1',result:'6-4 6-1'};
const advance={...ordinary,id:'advance-32',matchId:'advance-32',date:'2026-10-06',round:'Round of 32',agendaOnly:true,sourceKind:'official_draw_empty_advance',status:'advancement',opponentPending:true,opponent:'Avversario non definito',score:'W/O',result:'W/O'};
function coverage(rows,projection){
 const expectedMatches=ctx.canonicalPlayerMatches(rows.filter(m=>!m.agendaOnly));
 const expectedAdvances=ctx.canonicalPlayerMatches(ctx.mergeAgenda(rows.filter(m=>m.agendaOnly===true),expectedMatches)).filter(m=>m.agendaOnly===true);
 return snapshotMatchCoverage({expectedMatches,expectedAdvances,actualMatches:projection.matches,actualAgenda:projection.agenda,actualResults:projection.results});
}
function project(rows){return ctx.normalizeMatchProjection({matches:rows,agenda:[],results:rows});}
test('real normalization moves dated empty-opponent advancement to agenda: old history-only audit fails, both-projection audit passes',()=>{
 const rows=[ordinary,advance],p=project(rows),actual=new Set(p.matches.map(m=>m.matchId));
 assert.equal(ctx.canonicalPlayerMatches(rows).filter(m=>!actual.has(m.matchId)).length,1);
 assert.equal(p.matches.length,1);assert.equal(p.agenda.length,2);assert.equal(p.results.length,1);
 const r=coverage(rows,p);assert.equal(r.missingSnapshotMatches,0);assert.equal(r.missingAgendaAdvances,0);assert.equal(r.leakedAgendaAdvances,0);assert.equal(r.expectedAgendaAdvances,1);
});
test('missing real match still fails with exact player and match details',()=>{
 const p=project([ordinary,advance]);p.matches=[];
 const r=coverage([ordinary,advance],p);assert.equal(r.missingSnapshotMatches,1);assert.equal(r.missingMatchDetails[0].matchId,'official-64');assert.equal(r.missingMatchDetails[0].playerName,'Julian Letsch');
});
test('missing advancement fails even if all ordinary matches are retained',()=>{
 const p=project([ordinary,advance]);p.agenda=p.agenda.filter(m=>!m.agendaOnly);
 const r=coverage([ordinary,advance],p);assert.equal(r.missingSnapshotMatches,0);assert.equal(r.missingAgendaAdvances,1);assert.equal(r.missingAdvanceDetails[0].date,'2026-10-06');
});
test('advancement leaking into history or results always fails',()=>{
 for(const field of ['matches','results']){const p=project([ordinary,advance]);p[field].push(advance);assert.equal(coverage([ordinary,advance],p).leakedAgendaAdvances,1);}
});
test('normal two-sided W/O is still mandatory history, not treated as an empty advancement',()=>{
 const wo={...ordinary,id:'wo',matchId:'wo',score:'W/O',result:'W/O',status:'completed'};
 const p=project([wo]);assert.equal(coverage([wo],p).missingSnapshotMatches,0);
 p.matches=[];assert.equal(coverage([wo],p).missingSnapshotMatches,1);
});
test('stripping the agenda-only flag cannot hide a leaked advancement',()=>{
 const p=project([ordinary,advance]);p.matches.push({...advance,agendaOnly:false});
 assert.equal(coverage([ordinary,advance],p).leakedAgendaAdvances,1);
});
test('same match IDs belonging to different observed players remain independently required',()=>{
 const other={...ordinary,playerId:'another',playerName:'Another player'},p=project([ordinary,other]);
 p.matches=p.matches.filter(m=>m.playerId==='julian');
 assert.equal(coverage([ordinary,other],p).missingSnapshotMatches,1);
});
test('repeated normalization keeps advancement and real match coverage intact',()=>{
 const p=ctx.normalizeMatchProjection(project([ordinary,advance]));
 const r=coverage([ordinary,advance],p);assert.equal(r.missingSnapshotMatches+r.missingAgendaAdvances+r.leakedAgendaAdvances,0);
});
