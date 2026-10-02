import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {applyUserQualificationResolutions as resolve} from './itf-user-resolved-qualifications.mjs';
import {AUDIT_CRITERION,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
import {buildCoverageQueuePlan} from './itf-coverage-queue-plan.mjs';
import {reconcileCoverageAudit} from './reconcile-itf-coverage-audit.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('./itf-audit-baseline-20261001.json',import.meta.url)));
function fixture(){
 const tournaments=baseline.tournaments.map(t=>{
  const events=requiredAuditEvents(t.events||[]),checks=events.map(e=>({...e,acquired:true}));
  return{...t,classification:t.classification==='cancelled_no_draws'?'cancelled_no_draws':'complete',events,checks,declaredDraws:checks.length,acquiredDraws:checks.length,missingDraws:0,missingEvents:[]};
 });
 const row=tournaments.find(t=>t.competitionId==='J-J30-DOM-2026-001');
 const q=row.checks.find(e=>e.event==='G-S-Q-KO');assert.ok(q);q.acquired=false;q.reasonCode='empty_or_not_published';
 Object.assign(row,{classification:'missing_draws',acquiredDraws:row.checks.length-1,missingDraws:1,missingEvents:[q]});
 const sum=k=>tournaments.reduce((n,t)=>n+t[k],0);
 return{criterion:AUDIT_CRITERION,generatedAt:'2026-10-02T21:37:44.995Z',tournaments,summary:{declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:sum('missingDraws')}};
}
test('authorized Q resolved without fabricated acquisition; idempotent; source untouched',()=>{
 const audit=fixture(),out=resolve(audit),row=out.tournaments.find(t=>t.competitionId==='J-J30-DOM-2026-001');
 assert.equal(row.classification,'complete');assert.equal(row.missingDraws,0);assert.equal(row.checks.some(c=>c.event==='G-S-Q-KO'),false);
 assert.equal(out.summary.acquiredDraws,audit.summary.acquiredDraws);assert.equal(out.summary.declaredDraws,audit.summary.declaredDraws-1);
 assert.equal(row.resolvedEvents[0].resolution,'empty_singles_qualification');assert.equal(resolve(out),out);assert.equal(audit.summary.missingDraws,1);
});
test('missing main evidence and other tournament remain pending',()=>{
 for(const mode of ['main_missing','other_id']){
  const audit=fixture(),row=audit.tournaments.find(t=>t.competitionId==='J-J30-DOM-2026-001');
  if(mode==='main_missing')row.checks.find(c=>/^G-S-M-/.test(c.event)).acquired=false;
  else row.competitionId='J-J30-DOM-2026-002';
  assert.equal(resolve(audit),audit);
 }
});
test('old audit no longer schedules target; reconciliation with no requests persists resolution',()=>{
 const audit=fixture(),plan=buildCoverageQueuePlan(audit,baseline,'2026-10-02');
 assert.equal(plan.queues.extraordinaryA.length,0);assert.equal(plan.queues.extraordinaryB.length,0);
 assert.equal(plan.tasks.some(t=>t.competitionId==='J-J30-DOM-2026-001'),false);assert.equal(plan.windowEnd,'2026-10-05');
 const out=reconcileCoverageAudit(audit,[],{baseline,now:'2026-10-02T21:45:00Z'});
 assert.equal(out.newlyAcquired,0);assert.equal(out.audit.tournaments.find(t=>t.competitionId==='J-J30-DOM-2026-001').classification,'complete');
});
