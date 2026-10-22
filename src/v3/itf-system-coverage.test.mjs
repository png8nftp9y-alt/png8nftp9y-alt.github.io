import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applySystemCoverage} from './itf-system-coverage.mjs';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
const future={competitionId:'J-FUTURE',needsInventory:true,missingDraws:null,missingEvents:[]};
const queue={version:5,generatedAt:'2026-10-22T20:31:07Z',today:'2026-10-22',criterion:AUDIT_CRITERION,
 coverage:{catalogChecked:15,complete:1,cancelledNoDraws:13,resolved:14,missingDrawsTournaments:0,unverifiable:1,declaredDraws:6,acquiredDraws:6,missingDraws:0,actionableUnverifiable:0,futureUnverifiable:1},
 ordinary:{tournaments:[],total:0,missingDraws:0},extraordinary:{tournaments:[],total:0,missingDraws:0},waiting:{tournaments:[future],total:1,missingDraws:0},audit:{actionableUnverifiable:0,blocked:0}};
const old={status:'itf_system_operational_not_certified',checks:{tMinus1:{globalPendingTechnical:33,globalPendingPublication:12}},warnings:[],errors:[]};
const copy=()=>structuredClone(queue);
test('current verified coverage replaces stale legacy pending counts without claiming future completion',()=>{
 const q=copy(),d=applySystemCoverage({...old,errors:[],warnings:['technical_draws_pending:33','official_draws_incomplete:12']},q,q.today);
 assert.equal(d.checks.tMinus1.globalCompleteTournaments,q.coverage.complete);
 assert.equal(d.checks.tMinus1.futureWaiting,q.waiting.total);
 assert.equal(d.coverageSource,'itf_t1_queue_status.json');
 assert.equal(d.status,'itf_system_complete');assert.equal(d.fullyCertified,true);
 assert.equal(d.checks.tMinus1.globalPendingTechnical,0);assert.deepEqual(d.warnings,[]);
});
function pending(reason){
 const q=copy(),r=q.waiting.tournaments.shift();
 q.waiting.total--;q.coverage.futureUnverifiable--;q.coverage.actionableUnverifiable++;q.audit.actionableUnverifiable++;
 r.missingEvents=[{event:'B-S-M-KO',reasonCode:reason}];
 q.ordinary.tournaments.push(r);q.ordinary.total++;
 return q;
}
test('new technical or unknown inventory remains uncertified',()=>{
 const q=pending('technical_error'),d=applySystemCoverage({...old,errors:[]},q,q.today);
 assert.equal(d.fullyCertified,false);assert.equal(d.status,'itf_system_operational_not_certified');
 assert.deepEqual(d.checks.tMinus1.technicalPendingCompetitionIds,[q.ordinary.tournaments[0].competitionId]);
});
test('only documented publication pending is allowed; no technical problem is hidden',()=>{
 const q=pending('empty_or_not_published'),r=q.ordinary.tournaments[0];
 r.needsInventory=false;r.missingDraws=1;q.ordinary.missingDraws=1;
 q.coverage.actionableUnverifiable=0;q.audit.actionableUnverifiable=0;
 q.coverage.unverifiable--;q.coverage.missingDrawsTournaments++;q.coverage.missingDraws++;q.coverage.declaredDraws++;
 const d=applySystemCoverage({...old,errors:[]},q,q.today);
 assert.equal(d.status,'itf_system_certified_with_incomplete_publication');assert.equal(d.checks.tMinus1.globalPendingPublication,1);
 r.missingEvents[0].reasonCode='never_processed';
 assert.equal(applySystemCoverage({...old,errors:[]},q,q.today).fullyCertified,false);
});
test('invalid, missing, stale or unbalanced queue cannot clear warnings; real errors remain blocking',()=>{
 for(const q of [null,{...copy(),today:'2000-01-01'}, {...copy(),criterion:'other'}]){
  assert.throws(()=>applySystemCoverage(old,q,queue.today),/invalid_or_stale/);
 }
 const q=copy();q.coverage.complete++;assert.throws(()=>applySystemCoverage(old,q,q.today));
 const d=applySystemCoverage({...old,errors:['database_incomplete']},copy(),queue.today);
 assert.equal(d.status,'itf_system_blocked');assert.equal(d.fullyCertified,false);
});
test('ordinary validator executes after official coverage reconciliation',()=>{
 const workflow=fs.readFileSync('.github/workflows/courtwatch-v3-itf-t-minus-one.yml','utf8');
 assert.ok(workflow.indexOf('node src/v3/validate-itf-system.mjs')>workflow.indexOf('node src/v3/reconcile-itf-t1-strict-audit.mjs /tmp/itf-audit-state.json draw-tasks'));
 for(const f of ['courtwatch-itf-incremental-status.yml','courtwatch-itf-t1-extraordinary.yml']){
  assert.match(fs.readFileSync('.github/workflows/'+f,'utf8'),/git add .*itf_system_diagnostics.json/);
 }
});
