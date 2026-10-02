import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeCoverageCatalog} from './itf-incremental-coverage.mjs';
import {AUDIT_CRITERION,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
import {buildCoverageQueuePlan} from './itf-coverage-queue-plan.mjs';
import {reconcileCoverageAudit} from './reconcile-itf-coverage-audit.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('./itf-audit-baseline-20261001.json',import.meta.url))),now='2026-10-03T00:00:00Z';
function fixture(){const tournaments=baseline.tournaments.map(t=>{const events=requiredAuditEvents(t.events||[]),checks=events.map(e=>({...e,acquired:true}));return{...t,classification:t.classification==='cancelled_no_draws'?'cancelled_no_draws':'complete',events,checks,declaredDraws:checks.length,acquiredDraws:checks.length,missingDraws:0,missingEvents:[]}});const sum=k=>tournaments.reduce((n,t)=>n+t[k],0);return{criterion:AUDIT_CRITERION,generatedAt:now,tournaments,summary:{declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:0}}}
const row=(id,startDate='2026-10-06',endDate='2026-10-11',extra={})=>({competitionId:id,startDate,endDate,tournamentName:'New tournament',...extra}),catalog=tournaments=>({status:'itf_global_tournament_map_complete',generatedAt:now,tournaments});
test('new IDs enter ordinary and waiting; evidence preserved, repeated discovery is idempotent',()=>{
 const a=fixture(),c=catalog([row('J-J30-ZZZ-2026-001'),row('J-J30-ZZZ-2026-002','2026-11-01','2026-11-06')]),b=mergeCoverageCatalog(a,c,{now});
 assert.equal(b.tournaments.length,1033);assert.equal(b.summary.acquiredDraws,a.summary.acquiredDraws);for(const t of a.tournaments)assert.deepEqual(b.tournaments.find(r=>r.competitionId===t.competitionId),t);
 assert.deepEqual(mergeCoverageCatalog(b,c,{now}),b);const p=buildCoverageQueuePlan(b,baseline,'2026-10-03');assert.equal(p.summary.catalogChecked,1033);
 assert.ok(p.queues.ordinary.some(r=>r.competitionId==='J-J30-ZZZ-2026-001'));assert.ok(p.queues.waiting.some(r=>r.competitionId==='J-J30-ZZZ-2026-002'));assert.equal(p.windowEnd,'2026-10-06');assert.equal(b.tournaments.find(r=>r.competitionId==='J-J30-ZZZ-2026-001').missingDraws,null);
});
test('blocked catalog, teams, invalid dates excluded; previously added IDs are retained',()=>{
 const a=fixture();assert.deepEqual(mergeCoverageCatalog(a,{status:'blocked',tournaments:[row('J-J30-ZZZ-2026-001')]}),a);
 const b=mergeCoverageCatalog(a,catalog([row('J-J30-ZZZ-2026-003','2026-10-06','2026-10-11',{category:'GC'}),row('J-J30-ZZZ-2026-004','2026-02-30','2026-03-03')]),{now});assert.equal(b.tournaments.length,1031);assert.equal(b.catalogRejected.length,1);
 const c=mergeCoverageCatalog(a,catalog([row('J-J30-ZZZ-2026-005')]),{now});assert.equal(mergeCoverageCatalog(c,catalog([]),{now}).tournaments.length,1032);
});
test('new tournament inventory and acquisition reconcile; completed draw is no longer scheduled',()=>{
 const id='J-J30-ZZZ-2026-006',a=mergeCoverageCatalog(fixture(),catalog([row(id)]),{now}),e={event:'G-S-M-KO',family:'G-S-M',structure:'KO',tournamentId:999};
 const inv={competitionId:id,inventorySource:'official_api',sourceEvents:[e]},d={competitionId:id,event:e.event,status:'complete',matches:[{teams:[{players:[{name:'Player'}]}]}]};
 const b=reconcileCoverageAudit(a,[d],{inventories:[inv],baseline,now}).audit;assert.equal(b.tournaments.find(r=>r.competitionId===id).classification,'complete');assert.equal(buildCoverageQueuePlan(b,baseline,'2026-10-03').tasks.some(t=>t.competitionId===id),false);
});
test('Punta Cana resolution corrects old audit without fictitious acquisition',()=>{
 const a=fixture(),r=a.tournaments.find(t=>t.competitionId==='J-J30-DOM-2026-001'),q=r.checks.find(e=>e.event==='G-S-Q-KO');q.acquired=false;q.reasonCode='empty_or_not_published';r.classification='missing_draws';r.missingEvents=[q];r.missingDraws=1;r.acquiredDraws--;a.summary.acquiredDraws--;a.summary.missingDraws++;
 const b=mergeCoverageCatalog(a,catalog([]),{now});assert.equal(b.tournaments.find(t=>t.competitionId===r.competitionId).classification,'complete');assert.equal(b.summary.acquiredDraws,a.summary.acquiredDraws);assert.equal(buildCoverageQueuePlan(b,baseline,'2026-10-03').summary.extraordinaryA.total,0);
});
test('baseline removal and unregistered additions still fail validation',()=>{
 const a=fixture();a.tournaments.pop();assert.throws(()=>buildCoverageQueuePlan(a,baseline,'2026-10-03'),/scope_changed/);
 const b=fixture();b.tournaments.push({...row('J-J30-ZZZ-2026-009'),classification:'unverifiable'});assert.throws(()=>buildCoverageQueuePlan(b,baseline,'2026-10-03'),/scope_changed/);
});
