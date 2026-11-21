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

import vm from 'node:vm';import fs from 'node:fs';
const browserSource=fs.readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const browserContext=vm.createContext({});
vm.runInContext(browserSource.slice(browserSource.indexOf('function opponentTournamentWindow('),browserSource.indexOf('function opponentHistoryProjection(')),browserContext);
const active={circuit:'tennis-europe',competitionId:'playing',startDate:'2026-11-16',endDate:'2026-11-25'};
const result=(event,won,date='2026-11-20',round='Quarter-finals')=>({event,won,date,round,status:'completed',outcomeConfirmed:true});
for(const [implementation,select] of [['Worker',opponentTournamentWindow],['browser',browserContext.opponentTournamentWindow]]){
 test(implementation+': Stan Put keeps both Zapopan and Merida with unavailable results',()=>{
  const rows=[{circuit:'itf',competitionId:'Zapopan',startDate:'2026-11-16',endDate:'2026-11-21',drawConfirmed:true,historyEvidence:'acquired_itf_draw_presence',matches:[]},{circuit:'itf',competitionId:'Merida',startDate:'2026-11-21',endDate:'2026-11-28',entryStatus:'active',matches:[]}];
  const before=JSON.stringify(rows),out=select(rows,'2026-11-21');
  assert.deepEqual(Array.from(out,t=>[t.competitionId,t.historyKind]),[['Merida','current'],['Zapopan','current']]);
  assert.deepEqual(Array.from(select(out,'2026-11-21'),t=>[t.competitionId,t.historyKind]),Array.from(out,t=>[t.competitionId,t.historyKind]));
  assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(Array.from(select(rows,'2026-11-22'),t=>[t.competitionId,t.historyKind]),[['Merida','current'],['Zapopan','past']]);
 });
 test(implementation+': a completed knockout loss ends participation before the tournament end',()=>{
  const out=select([{...active,matches:[result('BS16',false)]}],'2026-11-21');
  assert.equal(out[0].historyKind,'past');
  assert.equal(out[0].endDate,'2026-11-25');
  assert.equal(select([{...active,matches:[result('BS16',true)]}],'2026-11-21')[0].historyKind,'current');
 });
 test(implementation+': singles elimination does not finish a player still active in doubles',()=>{
  const rows=[result('BS16',false),result('BD16',true)];
  assert.equal(select([{...active,matches:rows}],'2026-11-21')[0].historyKind,'current');
  rows.push(result('BD16',false,'2026-11-21','Semi-finals'));
  assert.equal(select([{...active,matches:rows}],'2026-11-21')[0].historyKind,'past');
  assert.equal(select([{...active,matches:[result('BS16',false)],event:'BD16'}],'2026-11-21')[0].historyKind,'current');
 });
 test(implementation+': pending outcomes, RR losses and qualifying-only losses never fabricate elimination',()=>{
  const unknown={...result('BS16',false),outcomeConfirmed:false};
  const pending={...result('BD16',false),status:'scheduled',outcomeConfirmed:false,score:''};
  for(const matches of [[unknown],[{...result('BS16',false),roundRobin:true}],[result('B-S-Q-KO',false)],[result('BS16',false),pending],[{...result('BS16',false),status:'scheduled'}],[result('BS16',false,'2026-11-22')]]){
   assert.equal(select([{...active,matches}],'2026-11-21')[0].historyKind,'current');
  }
  for(const circuit of ['itf','fitp'])assert.equal(select([{...active,circuit,matches:[]}],'2026-11-21')[0].historyKind,'current');
 });
 test(implementation+': main-draw evidence supersedes qualifying losses and final victories end participation',()=>{
  assert.equal(select([{...active,matches:[result('B-S-Q-KO',false),result('B-S-M-KO',true,'2026-11-21','R16')]}],'2026-11-21')[0].historyKind,'current');
  assert.equal(select([{...active,matches:[result('BS16',true,'2026-11-21','Final')]}],'2026-11-21')[0].historyKind,'past');
 });
 test(implementation+': early finishes share the three history slots, ordered by actual finish day',()=>{
  const rows=[{...active,competitionId:'early',matches:[result('BS16',false,'2026-11-19')]},...[18,17,16].map(day=>({...active,competitionId:'ended'+day,startDate:'2026-11-10',endDate:'2026-11-'+day,matches:[result('BS16',false,'2026-11-'+day)]})),{...active,competitionId:'still',matches:[result('BS16',true)]}];
  assert.deepEqual(Array.from(select(rows,'2026-11-21'),t=>[t.competitionId,t.historyKind]),[['still','current'],['early','past'],['ended18','past'],['ended17','past']]);
 });
}

test('uncertain or qualifying results on the same day preserve the date fallback in both implementations',()=>{
 for(const select of [opponentTournamentWindow,browserContext.opponentTournamentWindow]){
  for(const matches of [[result('BS16',false,'2026-11-20','Q1')],[result('BS16',false),{...result('BS16',false),date:'',status:'scheduled',outcomeConfirmed:false}]])assert.equal(select([{...active,matches}],'2026-11-21')[0].historyKind,'current');
  const sameDay=[result('BS16',true,'2026-11-20','Quarter-finals'),result('BS16',false,'2026-11-20','Semi-finals')];
  for(const matches of [sameDay,[...sameDay].reverse()])assert.equal(select([{...active,matches}],'2026-11-21')[0].historyKind,'past');
 }
});
