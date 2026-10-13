import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const context={circuit:m=>m.circuit};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function agendaKey('),source.indexOf('function clearDemographicFilters(')),context);
const full={id:'complete',playerId:'virginia-cereghini',competitionId:'04DA84AF-89E2-4623-AEE5-EB00E7E6C90C',date:'2026-10-13',event:'GD14 - Girls Doubles 14 Main Draw',round:'Round of 16',partner:'Ivona Dirnbek',opponent:'Nadia Luczak / Amaliya Pismennyi',circuit:'tennis-europe'};
const pending={...full,id:'pending',partner:'',opponent:'',opponentPending:true};
test('complete doubles replaces provisional opponent with a different ID in either order',()=>{
 for(const rows of [[pending,full],[full,pending]]) assert.deepEqual(Array.from(context.mergeAgenda([],rows),m=>m.id),['complete']);
});
test('preserve manual entries, results, other players, rounds, events and dates',()=>{
 for(const change of [{manual:true},{score:'6-4'},{playerId:'other'},{round:'Quarter final'},{event:'GS14 - Girls Singles 14 Main Draw'},{date:'2026-10-14'},{competitionId:'other'},{partner:'Different partner'}]) assert.equal(context.mergeAgenda([],[{...pending,...change},full]).length,2);
 assert.equal(context.mergeAgenda([],[pending]).length,1);
});

const projectionHelpers=source.slice(source.indexOf('function canonicalPlayerMatches('),source.indexOf('function agendaMatchRows('));
const dedupeHelpers=source.slice(source.indexOf('function sameAgendaMatch('),source.indexOf('function canonicalPlayerMatches('));
Object.assign(context,{agendaCourtMatchNumber:m=>m.courtMatchNumber||0,matchMeta:m=>({isDouble:m.matchType==='doubles'}),agendaTeamNames:m=>[m.playerName,m.partner,m.opponent].filter(Boolean).sort()});
vm.runInContext(dedupeHelpers+projectionHelpers,context);
test('corrected Cereghini doubles replaces the false partner-as-opponent row in every shared projection',()=>{
 const correct={...full,matchType:'doubles',court:'Court 1',courtMatchNumber:2};
 const wrong={...correct,id:'wrong',partner:'',opponent:correct.partner};
 const data=context.normalizeMatchProjection({matches:[wrong,correct],agenda:[wrong,correct]});
 assert.deepEqual(Array.from(data.matches,m=>m.id),['complete']);
 assert.deepEqual(Array.from(data.agenda,m=>m.id),['complete']);
});
test('shared normalization preserves a second monitored player in the same doubles match',()=>{
 const correct={...full,matchType:'doubles',court:'Court 1',courtMatchNumber:2,matchId:'shared'};
 const other={...correct,playerId:'partner-player',partner:'Virginia Cereghini'};
 assert.equal(context.canonicalPlayerMatches([correct,other]).length,2);
});
test('a scored row or a different scheduled slot is never removed as a false double',()=>{
 const correct={...full,matchType:'doubles',court:'Court 1',courtMatchNumber:2};
 const wrong={...correct,id:'wrong',partner:'',opponent:correct.partner};
 for(const changed of [{score:'6-4'},{court:'Court 2'},{courtMatchNumber:3},{manual:true}]){
  const data=context.normalizeMatchProjection({matches:[{...wrong,...changed},correct]});
  assert.equal(data.matches.length,2);
 }
});

test('all shared views normalize legacy mixed-circuit caches to Europe only',()=>{
 const te={...full,id:'te'},fitp={...full,id:'fitp',circuit:'fitp'},itf={...full,id:'itf',circuit:'itf'};
 const data=context.normalizeMatchProjection({matches:[te,fitp,itf],agenda:[te,fitp,itf],results:[te,fitp,itf]});
 assert.deepEqual(Array.from(data.matches,m=>m.id),['te']);
 assert.deepEqual(Array.from(data.agenda,m=>m.id),['te']);
 assert.deepEqual(Array.from(data.results,m=>m.id),['te']);
});
