import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileStrictAudit} from './reconcile-itf-t1-strict-audit.mjs';

const parity={declaredRows:32,filledRows:30,byeRows:2,emptyRows:0,certified:true};
const base={summary:{},tournaments:[{competitionId:'J-TEST',startDate:'2026-09-20',endDate:'2026-09-27',classification:'missing_draws',declaredDraws:2,acquiredDraws:0,missingDraws:2,checks:[{event:'B-S-M-KO',structure:'KO',acquired:false,reasonCode:'never_processed'},{event:'G-S-M-KO',structure:'KO',acquired:false,reasonCode:'never_processed'}],missingEvents:[{event:'B-S-M-KO',structure:'KO',acquired:false},{event:'G-S-M-KO',structure:'KO',acquired:false}]}]};

test('newly certified T-1 documents immediately reduce strict diagnostic counters',()=>{
 const document={competitionId:'J-TEST',event:'B-S-M-KO',status:'complete',rowParity:parity,matches:[]};
 const {audit,newlyAcquired}=reconcileStrictAudit(base,[document],{now:'2026-10-01T10:00:00.000Z'});
 assert.equal(newlyAcquired,1);assert.equal(audit.tournaments[0].acquiredDraws,1);assert.equal(audit.tournaments[0].missingDraws,1);assert.equal(audit.summary.acquiredDraws,1);assert.equal(audit.summary.missingDraws,1);
});

test('incomplete documents do not reduce missing counters',()=>{
 const document={competitionId:'J-TEST',event:'B-S-M-KO',status:'retry',rowParity:{...parity,certified:false,emptyRows:1},matches:[]};
 const {audit,newlyAcquired}=reconcileStrictAudit(base,[document],{now:'2026-10-01T10:00:00.000Z'});
 assert.equal(newlyAcquired,0);assert.equal(audit.tournaments[0].acquiredDraws,0);assert.equal(audit.tournaments[0].missingDraws,2);
});

test('all certified draws move the tournament out of the missing queue',()=>{
 const documents=['B-S-M-KO','G-S-M-KO'].map(event=>({competitionId:'J-TEST',event,status:'complete',rowParity:parity,matches:[]}));
 const {audit}=reconcileStrictAudit(base,documents,{now:'2026-10-01T10:00:00.000Z'});
 assert.equal(audit.tournaments[0].classification,'complete');assert.equal(audit.tournaments[0].missingDraws,0);assert.deepEqual(audit.tournaments[0].missingEvents,[]);
});
