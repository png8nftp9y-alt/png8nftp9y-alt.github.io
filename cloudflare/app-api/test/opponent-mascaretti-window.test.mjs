import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {opponentTournamentWindow} from '../lib/opponent-tournament-window.mjs';
const source=fs.readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const start=source.indexOf('function opponentTournamentWindow('),end=source.indexOf('function opponentHistoryProjection(',start);
const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
const rows=[
 {circuit:'fitp',competitionId:'67860D2D-870B-46F1-B66D-1641B1D51F4B',name:'OLTREPO TENNIS ACADEMY',startDate:'2026-10-10',endDate:'2026-10-25'},
 {circuit:'fitp',competitionId:'D68FF8C1-29AE-470E-9C38-5349DB8BBE07',name:'CAMPIONATI REGIONALI LOMBARDIA',startDate:'2026-10-03',endDate:'2026-10-18'},
 {circuit:'fitp',competitionId:'330D8929-B0D4-4298-869B-6497337D7288',name:'ITF J60 BARI',startDate:'2026-10-05',endDate:'2026-10-11'},
 {circuit:'itf',competitionId:'J-J60-ITA-2026-002',name:'J60 Bari',startDate:'2026-10-03',endDate:'2026-10-11',drawConfirmed:true,historyEvidence:'acquired_itf_draw_presence',matches:[]},
 {circuit:'itf',competitionId:'J-J60-ROU-2026-001',name:'J60 Bistrita',startDate:'2026-06-16',endDate:'2026-06-21',drawConfirmed:true,historyEvidence:'acquired_itf_draw_presence',matches:[]}
];
for(const [label,select] of [['backend',opponentTournamentWindow],['browser',context.opponentTournamentWindow]]){
 test(label+': Mascaretti keeps native Bari as third history item before hidden PUC copies consume slots',()=>{
 const before=JSON.stringify(rows),out=select(rows,'2026-11-21');assert.deepEqual(Array.from(out,t=>t.competitionId),[rows[0].competitionId,rows[1].competitionId,'J-J60-ITA-2026-002']);assert.equal(out[2].drawConfirmed,true);assert.equal(JSON.stringify(rows),before);
 });
 test(label+': hidden upcoming FITP ITF copy cannot displace the real upcoming tournament',()=>{
 const out=select([{circuit:'fitp',competitionId:'puc',name:'CHALLENGER TEST',startDate:'2026-12-01'},{circuit:'itf',competitionId:'real',name:'J60 Test',startDate:'2026-12-02'}],'2026-11-21');assert.deepEqual(Array.from(out,t=>t.competitionId),['real']);
 });
}
