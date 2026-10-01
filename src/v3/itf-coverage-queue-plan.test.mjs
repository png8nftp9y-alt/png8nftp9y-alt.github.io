import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {buildCoverageQueuePlan,coverageDiagnostic} from './itf-coverage-queue-plan.mjs';

function fixture(){
 const tournaments=Array.from({length:1031},(_,i)=>({competitionId:`J-TEST-${String(i).padStart(4,'0')}`,startDate:'2026-09-01',endDate:'2026-09-07',classification:i<13?'cancelled_no_draws':'complete',events:[],checks:[],missingEvents:[],declaredDraws:0,acquiredDraws:0,missingDraws:0}));
 return{baseline:{tournaments:structuredClone(tournaments)},audit:{criterion:AUDIT_CRITERION,generatedAt:'2026-10-01T21:21:46.918Z',tournaments,summary:{declaredDraws:0,acquiredDraws:0,missingDraws:0}}};
}
function missing(f,i,startDate,endDate){
 const row=f.audit.tournaments[i],event={event:'B-S-Q-KO',family:'B-S-Q',structure:'KO',tournamentId:123},check={...event,acquired:false,reasonCode:'incomplete_draw'};
 Object.assign(row,{startDate,endDate,classification:'missing_draws',events:[event],checks:[check],missingEvents:[check],declaredDraws:1,acquiredDraws:0,missingDraws:1});
 f.audit.summary.declaredDraws++;f.audit.summary.missingDraws++;
 return row;
}
test('D+3 includes the third upcoming day; later dates wait; concluded go to disjoint A/B lanes',()=>{
 const f=fixture();missing(f,13,'2026-10-04','2026-10-10');missing(f,14,'2026-10-05','2026-10-11');missing(f,15,'2026-09-20','2026-09-27');missing(f,16,'2026-09-20','2026-09-27');missing(f,17,'2026-09-28','2026-10-04');
 const plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01');
 assert.equal(plan.windowEnd,'2026-10-04');assert.equal(plan.queues.ordinary.length,2);assert.equal(plan.queues.waiting.length,1);assert.equal(plan.queues.extraordinaryA.length,1);assert.equal(plan.queues.extraordinaryB.length,1);assert.equal(plan.tasks.length,4);assert.equal(new Set(plan.tasks.map(t=>t.taskId)).size,4);assert.ok(!plan.tasks.some(t=>t.competitionId===f.audit.tournaments[14].competitionId));
});
test('future empty inventories do not block readiness, but become actionable precisely at D+3',()=>{
 const f=fixture(),row=f.audit.tournaments[13];Object.assign(row,{classification:'unverifiable',startDate:'2026-10-05',endDate:'2026-10-11',declaredDraws:null,acquiredDraws:null,missingDraws:null});
 let plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01');assert.equal(plan.readyForT1,true);assert.equal(plan.summary.futureUnverifiable,1);assert.equal(plan.tasks.length,0);assert.equal(plan.queues.waiting[0].missingDraws,null);
 plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-02');assert.equal(plan.readyForT1,false);assert.equal(plan.summary.actionableUnverifiable,1);assert.equal(coverageDiagnostic(plan).audit.urgentUnverifiable,1);
});
test('resolved tournaments and confirmed cancellations never enter a queue',()=>{
 const f=fixture(),plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01');assert.equal(plan.summary.resolved,1031);assert.equal(plan.summary.cancelledNoDraws,13);assert.equal(plan.tasks.length,0);assert.ok(Object.values(plan.queues).every(rows=>rows.length===0));
});
test('RR excludes only the main singles KO for its family; qualifying and opposite sex stay required',()=>{
 const f=fixture(),row=missing(f,13,'2026-10-01','2026-10-08');
 row.events.push({event:'B-S-M-RR',family:'B-S-M',structure:'RR',tournamentId:123},{event:'B-S-M-KO',family:'B-S-M',structure:'KO',tournamentId:123},{event:'G-S-M-KO',family:'G-S-M',structure:'KO',tournamentId:123});
 for(const e of row.events.filter(e=>['B-S-M-RR','G-S-M-KO'].includes(e.event))){const c={...e,acquired:false,reasonCode:'incomplete_draw'};row.checks.push(c);row.missingEvents.push(c)}
 row.declaredDraws=3;row.missingDraws=3;f.audit.summary.declaredDraws=3;f.audit.summary.missingDraws=3;
 const plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01');assert.deepEqual(plan.tasks.map(t=>t.event),['B-S-Q-KO','B-S-M-RR','G-S-M-KO']);
});
test('duplicate scope, contradictory acquisition counts and missing event proofs fail closed',()=>{
 const f=fixture();missing(f,13,'2026-10-01','2026-10-08');
 const bad=structuredClone(f.audit);bad.tournaments[14].competitionId=bad.tournaments[15].competitionId;assert.throws(()=>buildCoverageQueuePlan(bad,f.baseline,'2026-10-01'),/scope_changed/);
 f.audit.tournaments[13].acquiredDraws=1;assert.throws(()=>buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01'),/proof_do_not_balance/);
 f.audit.tournaments[13].acquiredDraws=0;f.audit.tournaments[13].checks=[];assert.throws(()=>buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01'),/required_draws_do_not_balance/);
});
test('unusable dates block readiness instead of silently dropping a missing tournament',()=>{
 const f=fixture();missing(f,13,'','2026-10-08');const plan=buildCoverageQueuePlan(f.audit,f.baseline,'2026-10-01');assert.equal(plan.readyForT1,false);assert.equal(plan.queues.blocked.length,1);assert.equal(plan.tasks.length,0);
});
