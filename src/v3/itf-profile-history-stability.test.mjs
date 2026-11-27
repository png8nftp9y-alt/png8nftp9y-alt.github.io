import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const ctx={iso:()=> '2026-11-27',Date,active:t=>!['withdrawn','excluded','eliminated'].includes(t.status)};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function tournamentConcluded'),source.indexOf('function groups(')),ctx);
const confirmed={playerId:'aila',circuit:'itf',competitionId:'J-J30-SUI-2026-006',startDate:'2026-11-01',endDate:'2026-11-07',entryStatus:'draw_confirmed'};
const stale={...confirmed,entryStatus:'confirmed_on_official_acceptance_list',acceptanceCode:'A',acceptancePosition:19};
test('reproduces confirmed Aila disappearing under old last-row-wins and preserves eligibility through repeated refresh',()=>{
 assert.equal(ctx.playerTournamentEligible(stale),false);
 let rows=[confirmed];for(let n=0;n<20;n++){rows=ctx.mergeVerifiedItfTournamentRows([...rows,stale]);assert.equal(rows.length,1);assert.equal(ctx.playerTournamentEligible(rows[0]),true);}
});
test('snapshot order, player, circuit and competition remain scoped; no alternate is promoted without evidence',()=>{
 assert.equal(ctx.playerTournamentEligible(ctx.mergeVerifiedItfTournamentRows([stale])[0]),false);
 assert.equal(ctx.mergeVerifiedItfTournamentRows([confirmed,{...stale,playerId:'other'}]).length,2);
 assert.equal(ctx.mergeVerifiedItfTournamentRows([confirmed,{...stale,circuit:'fitp'}])[1].entryStatus,stale.entryStatus);
 assert.equal(ctx.mergeVerifiedItfTournamentRows([stale,confirmed])[0].entryStatus,'draw_confirmed');
});
test('automatic cancellation and future withdrawal cannot erase a draw confirmation',()=>{
 assert.equal(ctx.playerTournamentEligible(ctx.mergeVerifiedItfTournamentRows([confirmed,{...stale,status:'cancelled'}])[0]),true);
 assert.equal(ctx.mergeVerifiedItfTournamentRows([{...confirmed,startDate:'2026-12-01'},{...stale,startDate:'2026-12-01',entryStatus:'withdrawn',acceptanceCode:'W'}])[0].entryStatus,'official_draw');
});
test('scoped and complete reloads both use the verified-history merger',()=>{
 assert.match(source,/const tournaments = mergeVerifiedItfTournamentRows\(\[\.\.\.retained, \.\.\.data\.tournaments\]\)/);
 assert.match(source,/tournaments: mergeVerifiedItfTournamentRows\(\[\s*\.\.\.retainedTournaments/);
});
