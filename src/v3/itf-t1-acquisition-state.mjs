import {AUDIT_CRITERION,acquiredDrawStatus,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';

export const isCoverageAudit=audit=>audit?.criterion===AUDIT_CRITERION;
export function normalizedEvent(item){
 const event=String(item.event||'').toUpperCase(),[playerTypeCode,matchTypeCode,eventClassificationCode,drawsheetStructureCode]=event.split('-');
 return{...item,event,family:event.split('-').slice(0,3).join('-'),structure:drawsheetStructureCode,playerTypeCode,matchTypeCode,eventClassificationCode,drawsheetStructureCode};
}
export function reusableInventory({competitionId,tournament={},auditRow,previous={}}){
 const inventoried=['complete','missing_draws'].includes(auditRow?.classification),source=inventoried?auditRow.events:(previous.eventInventory||[]).map(item=>({...item.combo,event:item.event}));
 const events=(source||[]).map(item=>({...normalizedEvent(item),competitionId,sourceUrl:item.sourceUrl||tournament.sourceUrl||previous.sourceUrl||''}));
 if(!events.length||events.some(item=>!Number(item.tournamentId)||!item.sourceUrl||!/^[BG]-[SD]-[MQ]-(KO|RR)$/.test(item.event)))return null;
 return{version:2,generatedAt:new Date().toISOString(),status:'complete',competitionId,tournament,eventCount:events.length,events,error:'',inventorySource:inventoried?'coverage_audit':'persisted_parameters'};
}
export function eventAcquired({auditRow,previous={},event,document}){
 if(document&&acquiredDrawStatus({competitionId:document.competitionId,event,structure:event.split('-').at(-1),artifact:document}).complete)return true;
 if(auditRow?.checks?.some(check=>check.event===event&&check.acquired===true))return true;
 const proof=previous.eventCache?.[event]?.acquisitionProof;
 return proof?.criterion===AUDIT_CRITERION&&proof.complete===true;
}
export function coverageSections(doc,auditRow,previous={}){
 return requiredAuditEvents((doc.events||[]).map(normalizedEvent)).map((event,index)=>({index,event:event.event,acquired:eventAcquired({auditRow,previous,event:event.event}),resolved:eventAcquired({auditRow,previous,event:event.event}),status:eventAcquired({auditRow,previous,event:event.event})?'acquired':'pending',proofCriterion:AUDIT_CRITERION,combo:event}));
}
