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

// Screenshot replay: stale Court 2 #5 and completed Court 3 #5 are the same round.
test('13 October Marsa false Cereghini row is removed across changed courts and cached-only projections',()=>{
 const correct={...full,matchType:'doubles',court:'Court 3',courtMatchNumber:5,score:'6-0 7-5',result:'6-0 7-5'};
 const stale={...full,id:'wrong',partner:'',opponent:'Ivona Dirnbek',opponentOptions:['Ivona Dirnbek'],matchType:'singles',court:'Court 2',courtMatchNumber:5};
 const tomorrow={...correct,id:'tomorrow',date:'2026-10-14',round:'Quarter final',opponent:'Vittoria Fredduzzi / Lucilla Lolli',score:'',result:''};
 const single={...full,id:'single',event:'GS14 - Girls Singles 14 Main Draw',partner:'',opponent:'Stasiya Pavlova',score:'6-2 6-0'};
 for(const rows of [[stale,correct,tomorrow,single],[correct,stale,tomorrow,single]]){
  const projection=context.normalizeMatchProjection({matches:rows,agenda:rows});
  for(const field of ['matches','agenda']) assert.deepEqual(Array.from(projection[field],m=>m.id),['complete','tomorrow','single']);
 }
 const cached=context.normalizeMatchProjection({matches:[stale],agenda:[stale]});
 assert.equal(cached.matches.length,0);assert.equal(cached.agenda.length,0);
});
test('one-off Marsa repair preserves other dates, players, tournaments, rounds, manual and scored matches',()=>{
 const stale={...full,id:'wrong',partner:'',opponent:'Ivona Dirnbek',court:'Court 2',courtMatchNumber:5};
 for(const change of [{date:'2026-10-14'},{playerId:'another-player'},{competitionId:'another-event'},{round:'Quarter final'},{event:'GS14'},{opponent:'Another Opponent'},{partner:'Another Partner'},{manual:true},{score:'6-4'},{result:'W/O'},{opponentPending:true}]){
  assert.equal(context.canonicalPlayerMatches([{...stale,...change}]).length,1,JSON.stringify(change));
 }
});

// Screenshot: Cernat, Buzau, 25 September; placeholder plus completed semifinal.
const cernatFull={id:'cernat-completed',matchId:'official-result',playerId:'cernat',competitionId:'buzau-2026',date:'2026-09-25',event:'GS12 - Girls Singles 12 Main Draw',round:'Semi final',circuit:'tennis-europe',opponent:'Niya Prodanova',score:'6-2 6-1',result:'6-2 6-1',advances:false};
const cernatPending={...cernatFull,id:'cernat-provisional',matchId:'old-schedule',opponent:'Avversario da definire',opponentPending:true,score:'',result:'scheduled'};
test('Cernat completed semifinal replaces obsolete singles schedule across caches and shared projections',()=>{
 for(const rows of [[cernatPending,cernatFull],[cernatFull,cernatPending]]){
  assert.deepEqual(Array.from(context.mergeAgenda([],rows),m=>m.id),['cernat-completed']);
  assert.deepEqual(Array.from(context.mergeKnownMatches(rows),m=>m.id),['cernat-completed']);
  const projection=context.normalizeMatchProjection({matches:rows,agenda:rows});
  for(const field of ['matches','agenda'])assert.deepEqual(Array.from(projection[field],m=>m.id),['cernat-completed']);
 }
});
test('unresolved singles remain visible without evidence that the same match has been resolved',()=>{
 assert.equal(context.mergeAgenda([],[cernatPending]).length,1);
 for(const change of [{manual:true},{score:'6-4'},{result:'W/O'},{playerId:'another'},{competitionId:'another'},{date:'2026-09-26'},{date:''},{round:'Quarter final'},{round:''},{event:'GS12 Qualifying'},{event:''},{event:'GD12 - Girls Doubles 12 Main Draw',matchType:'doubles',partner:'Partner'},{circuit:'fitp'}]){
  assert.equal(context.mergeAgenda([],[{...cernatPending,...change},cernatFull]).length,2,JSON.stringify(change));
 }
});
test('all player history sections reconcile a provisional singles match before rendering',()=>{
 const local={...context,groupedMatchSections:matches=>matches,matchHistoryRowHtml(){},matchMeta:()=>({isDouble:false}),doublesPartnerGroupKey:()=>''};vm.createContext(local);
 vm.runInContext(source.slice(source.indexOf('function matchHistorySectionsHtml('),source.indexOf('function tournamentOfficialUrl(')),local);
 assert.deepEqual(Array.from(local.matchHistorySectionsHtml([cernatPending,cernatFull]),m=>m.id),['cernat-completed']);
});

test('opponent page replaces the Cernat placeholder using the actual opponents-array payload',()=>{
 const local={...context,groupedMatchSections:matches=>matches};vm.createContext(local);
 vm.runInContext(source.slice(source.indexOf('function opponentHistoryMatchSectionsHtml('),source.indexOf('function opponentTournamentWindow(')),local);
 const pending={date:'2026-09-25',event:'GS12',round:'Semi final',status:'scheduled',opponents:[],partners:[]};
 const completed={...pending,status:'completed',score:'6-2 6-1',opponents:[{name:'Niya Prodanova'}]};
 assert.deepEqual(Array.from(local.opponentHistoryMatchSectionsHtml([pending,completed])),[completed]);
 assert.deepEqual(Array.from(local.opponentHistoryMatchSectionsHtml([pending])),[pending]);
});
