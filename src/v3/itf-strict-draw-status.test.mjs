import test from 'node:test';
import assert from 'node:assert/strict';
import {strictDrawStatus} from './itf-strict-draw-status.mjs';

const player=name=>({players:[{name}],entryStatus:''}),bye=()=>({players:[],entryStatus:'BYE',isBye:true}),empty=()=>({players:[],entryStatus:''});
const koArtifact=rows=>({status:'complete',players:rows.flatMap(row=>row.players),matches:[{roundNumber:1,round:'Final',teams:rows}]});

test('KO e bianco solo quando ogni riga contiene un giocatore o un BYE',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:koArtifact([player('A'),bye()])}).complete,true));
test('KO con una riga vuota resta nero',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:koArtifact([player('A'),empty()])}).complete,false));
test('KO da 32 righe con 28 giocatori e 4 vuote resta nero',()=>{const rows=Array.from({length:32},(_,index)=>index<28?player(`P${index}`):empty()),matches=[];for(let round=1;round<=5;round++)for(let index=0;index<2**(5-round);index++)matches.push({roundNumber:round,teams:round===1?rows.slice(index*2,index*2+2):[empty(),empty()]});const status=strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'complete',matches}});assert.equal(status.complete,false);assert.equal(status.rowParity.emptyRows,4)});
test('KO da 32 righe con 28 giocatori e 4 BYE e bianco',()=>{const rows=Array.from({length:32},(_,index)=>index<28?player(`P${index}`):bye()),matches=[];for(let round=1;round<=5;round++)for(let index=0;index<2**(5-round);index++)matches.push({roundNumber:round,teams:round===1?rows.slice(index*2,index*2+2):[empty(),empty()]});assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'complete',matches}}).complete,true)});
test('status complete e un giocatore non certificano piu un KO',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'complete',players:[{name:'A'}]}}).complete,false));
test('tabellone vuoto e nero',()=>assert.deepEqual(strictDrawStatus({competitionId:'X',event:'B-S-Q-KO',structure:'KO',artifact:{status:'retry',failureType:'not_published_or_incomplete'}}).reasonCode,'empty_or_not_published'));
test('Incapsula e nero',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'retry',error:'GetDrawsheet_incapsula_challenge'}}).reasonCode,'incapsula_blocked'));
test('RR parziale resta nero',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'G-S-M-RR',structure:'RR',artifact:{status:'complete',players:[{id:'1'}],roundRobin:{declaredGroups:8,completeGroups:7,missingGroups:[8],certified:false}}}).complete,false));
test('RR e bianco solo con tutte le righe di tutti i gironi',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'G-S-M-RR',structure:'RR',artifact:{status:'complete',players:[{name:'A'},{name:'B'}],matches:[{group:'A',structure:'RR',teams:[player('A'),player('B')]}]}}).complete,true));
test('correzioni manuali restano complete',()=>assert.equal(strictDrawStatus({competitionId:'J-J200-TUR-2026-002',event:'G-S-Q-KO',structure:'KO'}).complete,true));
