import {AUDIT_CRITERION,acquiredDrawStatus,requiredAuditEvents,emptySinglesQualificationResolutions} from './itf-audit-acquisition-policy.mjs';
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
  const attempted=[...incoming.values()].map(r=>r.document).filter(d=>d.competitionId===row.competitionId);
  const inventory=byInventory.get(row.competitionId);
  if(!attempted.length&&(!inventory||inventory.inventorySource==='coverage_audit'||inventory.inventorySource==='persisted_parameters')&&row.classification==='missing_draws')return row;
  const known=row.classification==='missing_draws',events=known?row.events:inventory&&!inventory.inventoryError?(inventory.sourceEvents||inventory.sections?.map(s=>s.combo)||[]):[];
  if(!events.length){
   if(!inventory)return row;
   const checkedAt=inventory.inventoryCheckedAt||inventory.generatedAt||now;
   return{...row,status:'inventory_retry',error:inventory.inventoryError||'empty_inventory',lastAttemptAt:checkedAt,lastInventoryAttemptAt:checkedAt,reconciledAt:row.reconciledAt||audit.generatedAt};
  }
  const normalized=events.map(normalizedEvent),required=requiredAuditEvents(normalized),old=new Map((row.checks||[]).map(c=>[c.event,c]));
  let checks=required.map(event=>{
   const previous=old.get(event.event),result=incoming.get(row.competitionId+'|'+event.event);
   if(previous?.acquired===true)return previous;
   if(result?.status.complete)newlyAcquired++;
   const status=result?.status||{complete:false,reasonCode:previous?.reasonCode||'never_processed',detail:previous?.detail||'mai processato'};
   return{event:event.event,family:event.family,structure:event.structure,acquired:status.complete,reasonCode:status.reasonCode,detail:status.detail,lastError:result?.document.error||(!result?previous?.lastError:'')||'',lastAttemptAt:result?.document.generatedAt||previous?.lastAttemptAt||null,rowParity:null,sources:result?.status.complete?[...new Set([...(previous?.sources||[]),'t1_acquisition'])]:previous?.sources||[]};
  });
  const resolutions=emptySinglesQualificationResolutions(normalized,checks,[...incoming.values()].map(r=>r.document).filter(d=>d.competitionId===row.competitionId));
  for(const resolution of resolutions)Object.assign(normalized.find(e=>e.event===resolution.event),resolution);
  const finalRequired=requiredAuditEvents(normalized),names=new Set(finalRequired.map(e=>e.event));checks=checks.filter(c=>names.has(c.event));
  const missingEvents=checks.filter(c=>!c.acquired),resolvedEvents=normalized.filter(e=>e.resolution==='empty_singles_qualification').map(({event,resolution,mainEvents,detail})=>({event,resolution,mainEvents,detail}));
  return{...row,status:'inventoried',error:null,events:normalized,excludedEvents:normalized.filter(e=>!finalRequired.includes(e)),resolvedEvents,checks,declaredDraws:checks.length,acquiredDraws:checks.length-missingEvents.length,missingDraws:missingEvents.length,missingEvents,classification:missingEvents.length?'missing_draws':'complete',lastAttemptAt:attempted.map(d=>d.generatedAt).filter(t=>Number.isFinite(Date.parse(t))).sort().at(-1)||(attempted.length?now:inventory?.inventoryCheckedAt||inventory?.generatedAt||row.lastAttemptAt||row.reconciledAt||audit.generatedAt),reconciledAt:attempted.length?now:(row.reconciledAt||now)};
 });
 const sum=key=>tournaments.reduce((n,t)=>n+Number(t[key]||0),0),complete=tournaments.filter(t=>t.classification==='complete').length,cancelledNoDraws=tournaments.filter(t=>t.classification==='cancelled_no_draws').length;
 const summary={...audit.summary,catalogChecked:tournaments.length,complete,cancelledNoDraws,resolved:complete+cancelledNoDraws,missingDrawsTournaments:tournaments.filter(t=>t.classification==='missing_draws').length,unverifiable:tournaments.filter(t=>t.classification==='unverifiable').length,declaredDraws:sum('declaredDraws'),acquiredDraws:sum('acquiredDraws'),missingDraws:sum('missingDraws'),missingByReason:tournaments.flatMap(t=>t.missingEvents||[]).reduce((out,e)=>(out[e.reasonCode]=(out[e.reasonCode]||0)+1,out),{})};
 const updated={...audit,reconciledAt:now,summary,tournaments},plan=buildCoverageQueuePlan(updated,baseline,new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)));
 Object.assign(summary,{readyForT1:plan.readyForT1,actionableUnverifiable:plan.summary.actionableUnverifiable,futureUnverifiable:plan.summary.futureUnverifiable,concludedUnverifiable:[...plan.queues.extraordinaryA,...plan.queues.extraordinaryB].filter(t=>t.needsInventory).length,activeD3Unverifiable:plan.queues.ordinary.filter(t=>t.needsInventory).length});
 return{audit:updated,newlyAcquired};
}
