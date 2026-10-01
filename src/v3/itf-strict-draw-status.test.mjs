import test from 'node:test';
import assert from 'node:assert/strict';
import {strictDrawStatus} from './itf-strict-draw-status.mjs';

test('KO completo e archiviato e bianco',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'complete',players:[{id:'1'}]}}).complete,true));
test('tabellone vuoto e nero',()=>assert.deepEqual(strictDrawStatus({competitionId:'X',event:'B-S-Q-KO',structure:'KO',artifact:{status:'retry',failureType:'not_published_or_incomplete'}}).reasonCode,'empty_or_not_published'));
test('Incapsula e nero',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'B-S-M-KO',structure:'KO',artifact:{status:'retry',error:'GetDrawsheet_incapsula_challenge'}}).reasonCode,'incapsula_blocked'));
test('RR parziale resta nero',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'G-S-M-RR',structure:'RR',artifact:{status:'complete',players:[{id:'1'}],roundRobin:{declaredGroups:8,completeGroups:7,missingGroups:[8],certified:false}}}).complete,false));
test('RR e bianco solo con tutti i gironi certificati',()=>assert.equal(strictDrawStatus({competitionId:'X',event:'G-S-M-RR',structure:'RR',artifact:{status:'complete',players:[{id:'1'}],roundRobin:{declaredGroups:8,completeGroups:8,missingGroups:[],missingKnockoutSections:[],certified:true}}}).complete,true));
test('correzioni manuali restano complete',()=>assert.equal(strictDrawStatus({competitionId:'J-J200-TUR-2026-002',event:'G-S-Q-KO',structure:'KO'}).complete,true));
