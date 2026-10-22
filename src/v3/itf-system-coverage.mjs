import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';

// Use the same validated official coverage projection as the acquisition queues.
// The legacy draw-target database is not the current coverage authority.
export function applySystemCoverage(diagnostic,queue,today){
 const fail=()=>{throw Error('ITF_current_coverage_invalid_or_stale')};
 if(queue?.version!==5||queue.criterion!==AUDIT_CRITERION||queue.today!==today||!Number.isFinite(Date.parse(queue.generatedAt)))fail();
 const c=queue.coverage,a=queue.audit;
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(!c||!a||!['catalogChecked','complete','cancelledNoDraws','resolved','missingDrawsTournaments','unverifiable','declaredDraws','acquiredDraws','missingDraws','actionableUnverifiable','futureUnverifiable'].every(k=>integer(c[k]))||!integer(a.blocked))fail();
 const groups=['ordinary','extraordinary','waiting'].map(k=>{
  const g=queue[k];if(!g||!Array.isArray(g.tournaments)||g.total!==g.tournaments.length||!integer(g.missingDraws))fail();
  for(const r of g.tournaments)if(!r.competitionId||!Array.isArray(r.missingEvents)||typeof r.needsInventory!=='boolean'||(!r.needsInventory&&(!integer(r.missingDraws)||r.missingDraws!==r.missingEvents.length)))fail();
  if(g.missingDraws!==g.tournaments.reduce((n,r)=>n+Number(r.missingDraws||0),0))fail();
  return g.tournaments;
 });
 const [ordinary,extraordinary,waiting]=groups,active=[...ordinary,...extraordinary];
 if(new Set(groups.flat().map(r=>r.competitionId)).size!==groups.flat().length||c.complete+c.cancelledNoDraws!==c.resolved||c.resolved+c.missingDrawsTournaments+c.unverifiable!==c.catalogChecked||c.acquiredDraws+c.missingDraws!==c.declaredDraws||c.actionableUnverifiable!==active.filter(r=>r.needsInventory).length||a.actionableUnverifiable!==c.actionableUnverifiable||c.futureUnverifiable!==waiting.filter(r=>r.needsInventory).length||c.resolved+groups.flat().length+a.blocked!==c.catalogChecked)fail();
 const technical=active.filter(r=>r.needsInventory||r.missingEvents.some(e=>e.reasonCode!=='empty_or_not_published'));
 const publication=active.filter(r=>!technical.includes(r));
 const errors=[...(diagnostic.errors||[])].filter(e=>e!=='current_coverage_unavailable'&&!e.startsWith('current_coverage_blocked:'));
 if(a.blocked)errors.push('current_coverage_blocked:'+a.blocked);
 const warnings=(diagnostic.warnings||[]).filter(w=>!/^technical_draws_pending:|^official_draws_incomplete:/.test(w));
 if(technical.length)warnings.push('technical_draws_pending:'+technical.length);
 if(publication.length)warnings.push('official_draws_incomplete:'+publication.length);
 const previous=diagnostic.checks?.tMinus1||{};
 return {...diagnostic,generatedAt:queue.generatedAt,status:errors.length?'itf_system_blocked':technical.length?'itf_system_operational_not_certified':publication.length?'itf_system_certified_with_incomplete_publication':'itf_system_complete',fullyCertified:!errors.length&&!technical.length,certificationScope:'current_eligible_official_coverage',coverageSource:'itf_t1_queue_status.json',coverageCheckedAt:queue.generatedAt,
 checks:{...diagnostic.checks,tMinus1:{...previous,globalCompleteTournaments:c.complete,globalCancelledNoDraws:c.cancelledNoDraws,globalPendingTotal:active.length,globalPendingTechnical:technical.length,globalPendingPublication:publication.length,technicalPendingCompetitionIds:technical.map(r=>r.competitionId),publicationPendingCompetitionIds:publication.map(r=>r.competitionId),futureWaiting:waiting.length,coverage:c}},warnings,errors};
}
