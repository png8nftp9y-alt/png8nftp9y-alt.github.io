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
