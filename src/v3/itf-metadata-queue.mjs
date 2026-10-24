import {futureMetadataTargets,requiredMetadataFields} from './recover-all-itf-metadata.mjs';
export const USER_RESOLVED_METADATA_IDS=new Set(['J-GC-EGY-07A-2026','J-GC-EGY-03A-2026','J-JM-CHN-2026-001']);
export const FIELDS=['venueName','address','qualificationStartDate'];
export const missingMetadata=row=>requiredMetadataFields(row).filter(f=>!String(row?.[f]||'').trim()||(f==='qualificationStartDate'&&!/^\d{4}-\d{2}-\d{2}$/.test(row[f])));
// Calendar-month boundaries: June 1 => daily from March 1, alert from April 1.
function monthsBefore(value, months) {
 const d=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(+d))return null;
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,last));return +d;
}
export function metadataRetrySchedule(row,now) {
 if(!['ordinary','extraordinary'].includes(row.status))return {};
 const clock=Date.parse(now),dailyFrom=monthsBefore(row.startDate,3),alertFrom=monthsBefore(row.startDate,2);
 const weekly=dailyFrom!==null&&clock<dailyFrom;
 const checked=Date.parse(row.checkedAt||'');
 let due=Number.isFinite(checked)?Date.parse(new Date(checked).toISOString().slice(0,10)+'T00:00:00Z')+(weekly?7:1)*86400000:null;
 // A weekly wait must not postpone the first daily attempt beyond the threshold.
 if(weekly&&due!==null)due=Math.min(due,dailyFrom);
 return {retryCadence:weekly?'weekly':'daily',nextCheckAt:due===null?null:new Date(due).toISOString(),alert:alertFrom!==null&&clock>=alertFrom,alertAt:alertFrom===null?null:new Date(alertFrom).toISOString()};
}
const withRetrySchedule=(row,now)=>{
 const {retryCadence,nextCheckAt,alert,alertAt,...base}=row;
 return {...base,...metadataRetrySchedule(base,now)};
};
export function reconcileMetadataQueue(state,catalogue,saved,today,now,previous=catalogue){
 const next=structuredClone(state||{version:1,seenIds:(previous.tournaments||[]).map(t=>t.competitionId.toUpperCase()),tournaments:{}});
 const seen=new Set(next.seenIds),future=futureMetadataTargets(catalogue,saved,today),eligible=new Set(future.map(t=>t.competitionId.toUpperCase()));
 next.tournaments||={};next.newIds=[];
 for(const t of future){const id=t.competitionId.toUpperCase(),old=next.tournaments[id];
  const metadata={...t,...saved[id]},missing=missingMetadata(metadata);
  if(!seen.has(id))next.newIds.push(id);
  next.tournaments[id]={...old,competitionId:id,tournamentName:t.tournamentName||t.name,sourceUrl:t.sourceUrl,startDate:t.startDate,endDate:t.endDate,firstSeenAt:old?.firstSeenAt||now,missing,acquired:requiredMetadataFields(metadata).filter(f=>!missing.includes(f)),resolvedByUser:USER_RESOLVED_METADATA_IDS.has(id),status:USER_RESOLVED_METADATA_IDS.has(id)?'user_resolved':missing.length?(old?.status==='ordinary'?'ordinary':!seen.has(id)?'ordinary':'extraordinary'):'complete'};
 }
 for(const [id,row]of Object.entries(next.tournaments))if(!eligible.has(id)&&['ordinary','extraordinary'].includes(row.status))row.status='out_of_scope';
 for(const t of catalogue.tournaments||[])seen.add(t.competitionId.toUpperCase());
 for(const [id,row] of Object.entries(next.tournaments))next.tournaments[id]=withRetrySchedule(row,now);
 next.seenIds=[...seen].sort();next.generatedAt=now;return next;
}
export function selectMetadataBatch(state,mode,limit=8){
 return Object.values(state.tournaments||{}).filter(t=>t.status===mode&&(mode==='ordinary'||!t.nextCheckAt||Date.parse(t.nextCheckAt)<=Date.parse(state.generatedAt))).sort((a,b)=>(a.checkedAt||'').localeCompare(b.checkedAt||'')||a.startDate.localeCompare(b.startDate)||a.competitionId.localeCompare(b.competitionId)).slice(0,limit);
}
export function applyMetadataBatch(state,result,now){
 const next=structuredClone(state);
 for(const checked of result.attempts||[]){const row=next.tournaments[checked.competitionId];if(!row)continue;row.checkedAt=checked.checkedAt;row.attempts=(row.attempts||0)+1;row.reason=checked.reason||'';row.lastError=checked.error||'';if(row.status==='ordinary')row.status='extraordinary';}
 for(const [id,row] of Object.entries(next.tournaments))next.tournaments[id]=withRetrySchedule(row,now);
 next.generatedAt=now;return next;
}
export function metadataQueueStatus(state){
 const rows=Object.values(state.tournaments||{}),group=status=>{const tournaments=rows.filter(t=>t.status===status);return {total:tournaments.length,missingFields:tournaments.reduce((n,t)=>n+t.missing.length,0),tournaments};};
 return {generatedAt:state.generatedAt,criterion:'Sede e data qualificazioni ufficiali; indirizzo solo per tornei in Italia · solo tornei non iniziati',ordinary:group('ordinary'),extraordinary:group('extraordinary'),alerts:{total:rows.filter(t=>t.alert).length,tournaments:rows.filter(t=>t.alert)},coverage:{resolved:group('complete').total+group('user_resolved').total,userResolved:group('user_resolved').total,outOfScope:group('out_of_scope').total}};
}
