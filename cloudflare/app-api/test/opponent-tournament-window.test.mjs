import test from 'node:test';import assert from 'node:assert/strict';import {opponentTournamentWindow} from '../lib/opponent-tournament-window.mjs';
test('selects latest three past and prefers ongoing over upcoming',()=>{const rows=[1,2,3,4].map(i=>({id:'p'+i,circuit:'itf',startDate:'2026-09-0'+i,endDate:'2026-09-0'+i,matches:[{id:'played'+i}]}));rows.push({id:'far',startDate:'2026-12-01'},{id:'next',startDate:'2026-10-10'},{id:'withdrawn',startDate:'2026-10-09',acceptanceCode:'W'},{id:'ongoing',startDate:'2026-10-01',endDate:'2026-10-12'});const a=opponentTournamentWindow(rows,'2026-10-08');assert.deepEqual(a.map(t=>t.id),['ongoing','p4','p3','p2']);assert.equal(a[0].historyKind,'current');assert.equal(a[1].historyKind,'past')});
test('absence is not filled with invented tournaments; entry and matches merge once',()=>{const a=opponentTournamentWindow([{id:'entry',competitionId:'ABC',circuit:'itf',startDate:'2026-09-01',matches:[]},{id:'history',competitionId:'abc',circuit:'itf',startDate:'2026-09-01',matches:[{id:'m'}]}],'2026-10-08');assert.equal(a.length,1);assert.equal(a[0].matches.length,1);assert.equal(opponentTournamentWindow([],'2026-10-08').length,0)});
test('uses nearest future when no tournament is ongoing, skipping withdrawals',()=>{
 const rows=[{id:'far',startDate:'2026-11-01'},{id:'withdrawn',startDate:'2026-10-09',acceptanceCode:'W'},{id:'next',startDate:'2026-10-10'}];
 const a=opponentTournamentWindow(rows,'2026-10-08');assert.deepEqual(a.map(t=>t.id),['next']);assert.equal(a[0].historyKind,'upcoming');
});
test('start and end days count as ongoing and become past only the following day',()=>{
 const rows=[{id:'now',startDate:'2026-10-08',endDate:'2026-10-10',matches:[{id:'played'}]},{id:'next',startDate:'2026-10-12'}];
 for(const day of ['2026-10-08','2026-10-10'])assert.equal(opponentTournamentWindow(rows,day)[0].historyKind,'current');
 assert.deepEqual(opponentTournamentWindow(rows,'2026-10-11').map(t=>[t.id,t.historyKind]),[['next','upcoming'],['now','past']]);
});
test('duplicate entry/history retains dates, labels and each acquired match once',()=>{
 const rows=[{competitionId:'ABC',entryStatus:'iscritto',startDate:'2026-10-08',endDate:'',matches:[]},{competitionId:'abc',startDate:'2026-10-08',endDate:'2026-10-15',matches:[{id:'m',score:'6-2'}]},{competitionId:'ABC',startDate:'2026-10-08',matches:[{id:'m',score:'6-2'}]}];
 const a=opponentTournamentWindow(rows,'2026-10-14');assert.equal(a.length,1);assert.equal(a[0].endDate,'2026-10-15');assert.equal(a[0].entryStatus,'iscritto');assert.equal(a[0].matches.length,1);
});

test('past acceptance lists cannot displace Europe tournaments with the player matches',()=>{
 const played=[1,2,3,4].map(i=>({id:'played'+i,circuit:'tennis-europe',startDate:'2026-09-0'+i,endDate:'2026-09-0'+i,matches:[{id:'single'+i},{id:'double'+i}]}));
 const entries=[1,2,3].map(i=>({id:'entry'+i,circuit:'tennis-europe',startDate:'2026-10-0'+i,endDate:'2026-10-0'+i,entryStatus:'confirmed_on_acceptance_list',matches:[]}));
 const rows=[...played,...entries,{id:'current',startDate:'2026-10-12',endDate:'2026-10-18',matches:[]}];
 const selected=opponentTournamentWindow(rows,'2026-10-15');
 assert.deepEqual(selected.map(t=>t.id),['current','played4','played3','played2']);
 assert.equal(selected.slice(1).flatMap(t=>t.matches).length,6);
 assert.ok(selected.slice(1).every(t=>t.historyKind==='past'&&t.matches.length===2));
 assert.equal(opponentTournamentWindow(entries,'2026-10-15').length,0);
});

test('ITF withdrawn acceptance without matches never occupies a history slot; actual match history remains',()=>{
 const rows=[1,2,3,4].map(i=>({competitionId:'played'+i,circuit:'itf',startDate:'2026-09-0'+i,endDate:'2026-09-0'+i,matches:[{id:'m'+i}]}));
 rows.push({competitionId:'withdrawn',circuit:'itf',startDate:'2026-10-20',endDate:'2026-10-25',entryStatus:'withdrawn',matches:[]});
 rows.push({competitionId:'intent-only',circuit:'itf',startDate:'2026-10-21',endDate:'2026-10-26',entryStatus:'confirmed_on_official_acceptance_list',acceptanceCode:'MD',matches:[]});
 rows.push({competitionId:'played4',circuit:'itf',startDate:'2026-09-04',endDate:'2026-09-04',entryStatus:'withdrawn',matches:[]});
 const selected=opponentTournamentWindow(rows,'2026-10-29');
 assert.deepEqual(selected.map(t=>t.competitionId),['played4','played3','played2']);
 assert.ok(selected.every(t=>t.matches.length===1));
});
