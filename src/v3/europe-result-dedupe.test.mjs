import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const ctx={URL,Date,circuit:m=>m.circuit,agendaCourtMatchNumber:m=>m.courtMatchNumber||0,matchMeta:m=>({isDouble:m.matchType==='doubles'}),agendaTeamNames:m=>[m.playerName,m.partner,m.opponent].filter(Boolean).sort()};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function agendaKey('),source.indexOf('function clearDemographicFilters(')),ctx);
vm.runInContext(source.slice(source.indexOf('function sameAgendaMatch('),source.indexOf('function agendaMatchRows(')),ctx);
// Reconstruct the reported screenshot; source IDs are deliberately distinct test values.
const base={playerId:'ghiselli',playerName:'Edoardo Ghiselli',circuit:'tennis-europe',competitionId:'DA00A8E4-7C0B-4038-AAE0-D299E94C5330',event:'BD16 - Boys Doubles 16 Main Draw',draw:'BD16',matchType:'doubles',round:'Quarter final',partner:'Mikael Lehtinen',opponent:'Gustav Vurm / Lukas Hron',opponentOptions:['Gustav Vurm','Lukas Hron'],score:'W/O',result:'W/O',won:false,advances:false,status:'completed'};
const undated={...base,id:'draw-source',matchId:'draw-source',date:'',sourceKind:'official_draw_result'};
const dated={...base,id:'oop-source',matchId:'oop-source',date:'2026-01-07',sourceKind:'official_oop_result',opponentTeRankings:[294,659]};
const single={...base,id:'single',matchId:'single',date:'2026-01-06',event:'BS16',draw:'BS16',matchType:'singles',round:'Round of 32',partner:'',opponent:'Dominik Klar',opponentOptions:['Dominik Klar'],score:'6-3 6-3',result:'6-3 6-3'};
const ids=rows=>Array.from(rows,m=>m.id);
test('Ghiselli Prague: completed draw plus dated OOP counts as one doubles match and preserves date/rankings in either order',()=>{
 for(const rows of [[single,undated,dated],[single,dated,undated]]) {
  const data=ctx.normalizeMatchProjection({matches:rows,agenda:rows,results:rows});
  assert.deepEqual(ids(data.matches),['single','oop-source']);assert.equal(data.matches.length,2);assert.equal(data.matches.filter(m=>m.advances===false).length,2);
  const double=data.matches.find(m=>m.id==='oop-source');assert.equal(double.date,'2026-01-07');assert.equal(double.opponentTeRankings[0],294);
  assert.deepEqual(ids(data.agenda),['single','oop-source']);assert.equal(undated.date,'');
 }
});
test('different IDs on the same day also merge for a completed identical knockout encounter',()=>{
 assert.deepEqual(ids(ctx.canonicalPlayerMatches([{...undated,date:dated.date},dated])),['oop-source']);
 assert.equal(ctx.canonicalPlayerMatches([dated,{...dated,id:'other-player',matchId:'other-player',playerId:'another'}]).length,2);
});
test('same teams in group and final, different draw/group/round/score/native identity/outcome remain separate',()=>{
 const guid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',other='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
 for(const change of [{round:'Final'},{event:'BD16 - Boys Doubles 16 Qualifying',draw:'BD16'},{event:'BD14',draw:'BD14'},{score:'6-1 6-2'},{groupName:'B',drawId:'other'},
  {partner:'Another Partner'},{opponent:'Other Player / Lukas Hron',opponentOptions:['Other Player','Lukas Hron']},{won:true},
  {opponentTeProfileIds:[other]},{date:'2026-01-08'},{manual:true},{manualEvent:true},{competitionId:'other'}]) {
  const a={...dated,drawId:'1',groupName:'A',opponentTeProfileIds:[guid]},b={...a,id:'other',matchId:'other',...change};
  assert.equal(ctx.canonicalPlayerMatches([a,b]).length,2,JSON.stringify(change));
 }
 const a={...dated,round:'Round robin'},b={...a,id:'second',matchId:'second'};assert.equal(ctx.canonicalPlayerMatches([a,b]).length,2);
});
test('ambiguous dates remain separate; repeated refreshes never invent a date or remove a second real encounter',()=>{
 const next={...dated,id:'another-day',matchId:'another-day',date:'2026-01-08'};
 const rows=[undated,dated,next];for(let i=0;i<5;i++)assert.deepEqual(ids(ctx.canonicalPlayerMatches(rows)),['draw-source','oop-source','another-day']);
 assert.equal(ctx.canonicalPlayerMatches([undated]).length,1);
 assert.equal(ctx.canonicalPlayerMatches([{...undated,date:'2026-02-31'},dated]).length,2);
});
test('unknown opponents, pending schedules and incomplete identity are never collapsed by result matching',()=>{
 for(const change of [{score:'',result:'scheduled'},{opponent:'Vurm / Hron',opponentOptions:['Vurm','Hron']},{partner:''},{event:'',draw:''},{round:''},{agendaOnly:true}]) {
  assert.equal(ctx.dedupeVerifiedEuropeResults([{...undated,...change},dated]).length,2,JSON.stringify(change));
 }
});
test('conflicting native draw URLs never collapse; QF and Quarter final / W.O forms normalize conservatively',()=>{
 const a={...dated,drawUrl:'https://te.tournamentsoftware.com/sport/draw.aspx?id=x&draw=1'},b={...dated,id:'other',matchId:'other',drawUrl:'https://te.tournamentsoftware.com/sport/draw.aspx?id=x&draw=2'};
 assert.equal(ctx.canonicalPlayerMatches([a,b]).length,2);
 for(const score of ['Walkover','W.O.','W/O','WO']) {const normalized={...undated,round:'QF',score,result:score};assert.deepEqual(ids(ctx.canonicalPlayerMatches([normalized,dated])),['oop-source']);}
});
