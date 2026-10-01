import {AUDIT_CRITERION,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const validDate=value=>datePattern.test(value||'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(Date.parse(value+'T00:00:00Z')).toISOString().slice(0,10)===value;
export const extraordinaryLane=id=>[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%2===0?'a':'b';
export function buildCoverageQueuePlan(audit,baseline,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 if(!validDate(today))throw new Error('ITF_invalid_today');
 if(audit?.criterion!==AUDIT_CRITERION)throw new Error('ITF_wrong_coverage_policy');
 const ids=new Set((baseline?.tournaments||[]).map(t=>t.competitionId));
 if(baseline.tournaments?.length!==1031||ids.size!==1031||audit.tournaments?.length!==1031||new Set(audit.tournaments.map(t=>t.competitionId)).size!==1031||audit.tournaments.some(t=>!ids.has(t.competitionId)))throw new Error('ITF_coverage_scope_changed');
 const windowEnd=new Date(Date.parse(today+'T00:00:00Z')+3*864e5).toISOString().slice(0,10);
 const queues={ordinary:[],extraordinaryA:[],extraordinaryB:[],waiting:[],blocked:[]},resolved=[],missing=[],unknown=[];
 const sum=(rows,key)=>rows.reduce((n,t)=>n+Number(t[key]||0),0);
 for(const row of audit.tournaments){
  const {classification,competitionId:id}=row;
  if(!['complete','cancelled_no_draws','missing_draws','unverifiable'].includes(classification))throw new Error(`ITF_unknown_classification:${id}`);
  if(classification==='cancelled_no_draws'){
   if(baseline.tournaments.find(t=>t.competitionId===id)?.classification!=='cancelled_no_draws'||row.declaredDraws!==0||row.acquiredDraws!==0||row.missingDraws!==0)throw new Error(`ITF_unconfirmed_cancellation:${id}`);
   resolved.push(row);continue;
  }
  if(classification!=='unverifiable'){
   const required=requiredAuditEvents(row.events||[]),checks=row.checks||[],names=new Set(checks.map(c=>c.event));
   if(names.size!==checks.length||checks.length!==required.length||checks.some(c=>typeof c.acquired!=='boolean')||required.some(e=>!names.has(e.event)))throw new Error(`ITF_required_draws_do_not_balance:${id}`);
   const absent=checks.filter(c=>!c.acquired),reported=row.missingEvents||[];
   if(checks.length!==row.declaredDraws||checks.length-absent.length!==row.acquiredDraws||absent.length!==row.missingDraws||reported.length!==absent.length||new Set(reported.map(c=>c.event)).size!==absent.length||absent.some(c=>!reported.some(r=>r.event===c.event))||(classification==='complete')!==(absent.length===0))throw new Error(`ITF_draw_proof_do_not_balance:${id}`);
  }
  if(classification==='complete'){resolved.push(row);continue}
  (classification==='missing_draws'?missing:unknown).push(row);
  const item={competitionId:id,tournamentName:row.tournamentName,startDate:row.startDate,endDate:row.endDate,status:classification==='unverifiable'?(row.error==='empty_inventory'?'inventory_empty':'inventory_required'):'missing',inventoryError:classification==='unverifiable'?(row.error||null):null,knownDraws:row.declaredDraws,acquiredDraws:row.acquiredDraws,missingDraws:row.missingDraws,missingEvents:row.missingEvents||[],resolvedEvents:row.resolvedEvents||[],needsInventory:classification==='unverifiable',checkedAt:row.lastAttemptAt||row.reconciledAt||audit.generatedAt};
  if(!validDate(row.startDate)||!validDate(row.endDate)||row.endDate<row.startDate){queues.blocked.push({...item,blockingReason:'invalid_tournament_dates'});continue}
  item.eligibleFrom=new Date(Date.parse(row.startDate+'T00:00:00Z')-864e5).toISOString().slice(0,10);
  if(row.startDate>windowEnd)queues.waiting.push(item);
  else if(row.endDate<today)queues[extraordinaryLane(id)==='a'?'extraordinaryA':'extraordinaryB'].push(item);
  else queues.ordinary.push(item);
 }
 const cancelled=resolved.filter(t=>t.classification==='cancelled_no_draws');
 if(cancelled.length!==13)throw new Error('ITF_cancelled_count_changed');
 const requiredDraws=sum(audit.tournaments,'declaredDraws'),acquiredDraws=sum(audit.tournaments,'acquiredDraws'),missingDraws=sum(missing,'missingDraws');
 if(requiredDraws!==acquiredDraws+missingDraws||audit.summary?.declaredDraws!==requiredDraws||audit.summary?.acquiredDraws!==acquiredDraws||audit.summary?.missingDraws!==missingDraws)throw new Error('ITF_coverage_totals_changed');
 for(const rows of Object.values(queues))rows.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.competitionId.localeCompare(b.competitionId));
 const eligible=[...queues.ordinary,...queues.extraordinaryA,...queues.extraordinaryB],dueUnknown=eligible.filter(t=>t.needsInventory),readyForT1=dueUnknown.length===0&&queues.blocked.length===0;
 const tasks=eligible.flatMap(t=>t.missingEvents.map(e=>{
  const declared=audit.tournaments.find(r=>r.competitionId===t.competitionId).events.find(r=>r.event===e.event),[playerTypeCode,matchTypeCode,eventClassificationCode,drawsheetStructureCode]=e.event.split('-');
  if(!/^[BG]-[SD]-[MQ]-(KO|RR)$/.test(e.event)||!(Number(declared.tournamentId)>0))throw new Error(`ITF_invalid_task_parameters:${t.competitionId}:${e.event}`);
  return{competitionId:t.competitionId,event:e.event,taskId:t.competitionId+'__'+e.event,lane:t.endDate<today?extraordinaryLane(t.competitionId):'ordinary',tournamentId:declared.tournamentId,tourType:declared.tourType||'N',weekNumber:declared.weekNumber??0,playerTypeCode,matchTypeCode,eventClassificationCode,drawsheetStructureCode,reasonCode:e.reasonCode};
 }));
 if(new Set(tasks.map(t=>t.taskId)).size!==tasks.length)throw new Error('ITF_duplicate_prepared_tasks');
 const summarize=rows=>({total:rows.length,missingDraws:sum(rows,'missingDraws'),inventoryRequired:rows.filter(t=>t.needsInventory).length});
 return{version:1,generatedAt:new Date().toISOString(),auditGeneratedAt:audit.generatedAt,today,windowEnd,windowDays:3,criterion:AUDIT_CRITERION,readyForT1,activation:'prepared_only',summary:{catalogChecked:1031,complete:resolved.length-13,cancelledNoDraws:13,resolved:resolved.length,missingDrawsTournaments:missing.length,unverifiable:unknown.length,declaredDraws:requiredDraws,acquiredDraws,missingDraws,actionableUnverifiable:dueUnknown.length,futureUnverifiable:queues.waiting.filter(t=>t.needsInventory).length,ordinary:summarize(queues.ordinary),extraordinaryA:summarize(queues.extraordinaryA),extraordinaryB:summarize(queues.extraordinaryB),waiting:summarize(queues.waiting),blocked:summarize(queues.blocked)},queues,tasks};
}

export function coverageDiagnostic(plan){
 const group=rows=>({tournaments:rows,total:rows.length,missingDraws:rows.reduce((n,t)=>n+Number(t.missingDraws||0),0),acquiredDraws:rows.reduce((n,t)=>n+Number(t.acquiredDraws||0),0),missingByReason:rows.flatMap(t=>t.missingEvents).reduce((out,e)=>(out[e.reasonCode]=(out[e.reasonCode]||0)+1,out),{}),byStatus:rows.reduce((out,t)=>(out[t.status]=(out[t.status]||0)+1,out),{})});
 return{version:5,generatedAt:plan.generatedAt,today:plan.today,windowEnd:plan.windowEnd,criterion:plan.criterion,readyForT1:plan.readyForT1,activation:plan.activation,coverage:plan.summary,ordinary:group(plan.queues.ordinary),extraordinary:group([...plan.queues.extraordinaryA,...plan.queues.extraordinaryB]),waiting:group(plan.queues.waiting),audit:{urgentUnverifiable:plan.queues.ordinary.filter(t=>t.needsInventory).length,concludedUnverifiable:[...plan.queues.extraordinaryA,...plan.queues.extraordinaryB].filter(t=>t.needsInventory).length,actionableUnverifiable:plan.summary.actionableUnverifiable,futureUnverifiable:plan.summary.futureUnverifiable,blocked:plan.queues.blocked.length}};
}
