import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConfirmedCancellations,resolveCancelledTournament} from './itf-cancelled-tournaments.mjs';
import {mergeCoverageCatalog} from './itf-incremental-coverage.mjs';
import {buildCoverageQueuePlan,coverageDiagnostic} from './itf-coverage-queue-plan.mjs';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
const id='J-J30-BRN-2026-004';
const cancelled={competitionId:id,tournamentName:'J30 Manama (CANCELLED)',sourceUrl:'https://www.itftennis.com/en/tournament/j30-manama-(cancelled)/brn/2026/j-j30-brn-2026-004/',startDate:'2026-11-23',endDate:'2026-11-28',classification:'unverifiable',declaredDraws:null,acquiredDraws:null,missingDraws:null,events:[],checks:[],missingEvents:[],error:'empty_inventory'};
test('Manama cancellation resolves empty inventory with source evidence and no acquisition claim',()=>{
 const row=resolveCancelledTournament(cancelled);
 assert.equal(row.classification,'cancelled_no_draws');assert.equal(row.acquiredDraws,0);assert.equal(row.missingDraws,0);assert.equal(row.inventoryRequired,false);
 assert.equal(row.cancellationProof.competitionId,id);assert.equal(row.cancellationPreviousAudit.error,'empty_inventory');assert.equal(cancelled.classification,'unverifiable');
 assert.equal(resolveCancelledTournament(row),row);
});
test('empty, blocked and not-yet-published tournaments remain pending without explicit cancellation',()=>{
 for(const error of ['empty_inventory','incapsula_blocked','technical_error']){
  const row={...cancelled,tournamentName:'J30 Manama',error};assert.equal(resolveCancelledTournament(row),row);
 }
 for(const sourceUrl of ['https://example.com/'+id,'https://itftennis.com.evil.test/'+id,'https://www.itftennis.com/en/tournament/another-id/']){
  const row={...cancelled,sourceUrl};assert.equal(resolveCancelledTournament(row),row);
 }
});
test('acquired draws and completed history are preserved despite a cancellation label',()=>{
 for(const extra of [{acquiredDraws:1},{checks:[{acquired:true}]},{classification:'complete'}]){
  const row={...cancelled,...extra};assert.equal(resolveCancelledTournament(row),row);
 }
});
test('missing draw tasks are retired but kept as cancellation audit evidence',()=>{
 const check={event:'B-S-M-KO',acquired:false,reasonCode:'not_published'};
 const row=resolveCancelledTournament({...cancelled,classification:'missing_draws',events:[check],checks:[check],missingEvents:[check],declaredDraws:1,acquiredDraws:0,missingDraws:1});
 assert.deepEqual(row.checks,[]);assert.deepEqual(row.cancellationPreviousAudit.checks,[check]);
 const audit=applyConfirmedCancellations({tournaments:[{...cancelled,classification:'missing_draws',missingDraws:1,declaredDraws:1}],summary:{missingDraws:1}});
 assert.equal(audit.summary.resolved,1);assert.equal(audit.summary.declaredDraws,0);assert.equal(audit.summary.missingDraws,0);
});
function fixture(){
 const tournaments=Array.from({length:1031},(_,i)=>({competitionId:`J-TEST-${i}`,startDate:'2026-09-01',endDate:'2026-09-07',classification:i<13?'cancelled_no_draws':'complete',events:[],checks:[],missingEvents:[],declaredDraws:0,acquiredDraws:0,missingDraws:0}));
 tournaments[13]={...cancelled};
 return {baseline:{tournaments:structuredClone(tournaments)},audit:{criterion:AUDIT_CRITERION,tournaments,summary:{declaredDraws:0,acquiredDraws:0,missingDraws:0}}};
}
test('Admin coverage counts new cancellations as resolved and excludes them from every queue',()=>{
 const {audit,baseline}=fixture();const plan=buildCoverageQueuePlan(audit,baseline,'2026-11-24');
 assert.equal(plan.summary.cancelledNoDraws,14);assert.equal(plan.summary.complete,1017);assert.equal(plan.summary.resolved,1031);
 assert.equal(plan.tasks.length,0);assert.ok(Object.values(plan.queues).every(rows=>rows.length===0));assert.equal(coverageDiagnostic(plan).coverage.cancelledNoDraws,14);
});
test('catalog refresh resolves existing pending rows and new cancelled tournaments without an inventory call',()=>{
 const {audit,baseline}=fixture();audit.tournaments[13]={...cancelled,tournamentName:'J30 Manama'};
 const next={...cancelled,competitionId:'J-J30-BRN-2026-005',startDate:'2026-11-30',endDate:'2026-12-05',sourceUrl:cancelled.sourceUrl.replaceAll('004','005')};
 const updated=mergeCoverageCatalog(audit,{status:'itf_global_tournament_map_complete',tournaments:[cancelled,next]});
 assert.equal(updated.summary.cancelledNoDraws,15);assert.equal(updated.summary.resolved,1032);
 const plan=buildCoverageQueuePlan(updated,baseline,'2026-11-24');assert.equal(plan.tasks.length,0);assert.equal(plan.summary.cancelledNoDraws,15);
});
