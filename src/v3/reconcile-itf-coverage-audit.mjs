import {AUDIT_CRITERION,acquiredDrawStatus,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';
import {normalizedEvent} from './itf-t1-acquisition-state.mjs';
import {buildCoverageQueuePlan} from './itf-coverage-queue-plan.mjs';
export function reconcileCoverageAudit(audit,documents,{inventories=[],baseline,now=new Date().toISOString()}={}){
 if(audit.criterion!==AUDIT_CRITERION)throw new Error('ITF_new_coverage_audit_required');
 const incoming=new Map(),byInventory=new Map(inventories.map(doc=>[doc.competitionId,doc]));
 for(const document of documents){
  const key=document.competitionId+'|'+document.event,status=acquiredDrawStatus({competitionId:document.competitionId,event:document.event,structure:document.event?.split('-').at(-1),artifact:document});
  if(!incoming.has(key)||status.complete)incoming.set(key,{status,document});
 }
 let newlyAcquired=0;
 const tournaments=audit.tournaments.map(row=>{
  if(['complete','cancelled_no_draws'].includes(row.classification))return row;
  const inventory=byInventory.get(row.competitionId),known=row.classification==='missing_draws',events=known?row.events:inventory&&!inventory.inventoryError?(inventory.sourceEvents||inventory.sections?.map(s=>s.combo)||[]):[];
  if(!events.length)return row;
  const normalized=events.map(normalizedEvent),required=requiredAuditEvents(normalized),old=new Map((row.checks||[]).map(c=>[c.event,c]));
  const checks=required.map(event=>{
   const previous=old.get(event.event),result=incoming.get(row.competitionId+'|'+event.event);
   if(previous?.acquired===true)return previous;
   if(result?.status.complete)newlyAcquired++;
   const status=result?.status||{complete:false,reasonCode:previous?.reasonCode||'never_processed',detail:previous?.detail||'mai processato'};
   return{event:event.event,family:event.family,structure:event.structure,acquired:status.complete,reasonCode:status.reasonCode,detail:status.detail,rowParity:null,sources:result?.status.complete?[...new Set([...(previous?.sources||[]),'t1_acquisition'])]:previous?.sources||[]};
  }),missingEvents=checks.filter(c=>!c.acquired);
  return{...row,status:'inventoried',error:null,events:normalized,excludedEvents:normalized.filter(e=>!required.includes(e)),checks,declaredDraws:checks.length,acquiredDraws:checks.length-missingEvents.length,missingDraws:missingEvents.length,missingEvents,classification:missingEvents.length?'missing_draws':'complete',reconciledAt:now};
 });
 const sum=key=>tournaments.reduce((n,t)=>n+Number(t[key]||0),0),complete=tournaments.filter(t=>t.classification==='complete').length,cancelledNoDraws=tournaments.filter(t=>t.classification==='cancelled_no_draws').length;
 const summary={...audit.summary,catalogChecked:tournaments.length,complete,cancelledNoDraws,resolved:complete+cancelledNoDraws,missingDrawsTournaments:tournaments.filter(t=>t.classification==='missing_draws').length,unverifiable:tournaments.filter(t=>t.classification==='unverifiable').length,declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:sum('missingDraws'),missingByReason:tournaments.flatMap(t=>t.missingEvents||[]).reduce((out,e)=>(out[e.reasonCode]=(out[e.reasonCode]||0)+1,out),{})};
 const updated={...audit,reconciledAt:now,summary,tournaments},plan=buildCoverageQueuePlan(updated,baseline,new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)));
 Object.assign(summary,{readyForT1:plan.readyForT1,actionableUnverifiable:plan.summary.actionableUnverifiable,futureUnverifiable:plan.summary.futureUnverifiable,concludedUnverifiable:[...plan.queues.extraordinaryA,...plan.queues.extraordinaryB].filter(t=>t.needsInventory).length,activeD3Unverifiable:plan.queues.ordinary.filter(t=>t.needsInventory).length});
 return{audit:updated,newlyAcquired};
}
