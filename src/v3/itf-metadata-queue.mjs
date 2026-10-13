import {futureMetadataTargets} from './recover-all-itf-metadata.mjs';
export const USER_RESOLVED_METADATA_IDS=new Set(['J-GC-EGY-07A-2026','J-GC-EGY-03A-2026']);
export const FIELDS=['venueName','address','qualificationStartDate'];
export const missingMetadata=row=>FIELDS.filter(f=>!String(row?.[f]||'').trim()||(f==='qualificationStartDate'&&!/^\d{4}-\d{2}-\d{2}$/.test(row[f])));
export function reconcileMetadataQueue(state,catalogue,saved,today,now,previous=catalogue){
 const next=structuredClone(state||{version:1,seenIds:(previous.tournaments||[]).map(t=>t.competitionId.toUpperCase()),tournaments:{}});
 const seen=new Set(next.seenIds),future=futureMetadataTargets(catalogue,saved,today),eligible=new Set(future.map(t=>t.competitionId.toUpperCase()));
 next.tournaments||={};next.newIds=[];
 for(const t of future){const id=t.competitionId.toUpperCase(),old=next.tournaments[id];
  const metadata={...t,...saved[id]},missing=missingMetadata(metadata);
  if(!seen.has(id))next.newIds.push(id);
  next.tournaments[id]={...old,competitionId:id,tournamentName:t.tournamentName||t.name,sourceUrl:t.sourceUrl,startDate:t.startDate,endDate:t.endDate,firstSeenAt:old?.firstSeenAt||now,missing,acquired:FIELDS.filter(f=>!missing.includes(f)),resolvedByUser:USER_RESOLVED_METADATA_IDS.has(id),status:USER_RESOLVED_METADATA_IDS.has(id)?'user_resolved':missing.length?(old?.status==='ordinary'?'ordinary':!seen.has(id)?'ordinary':'extraordinary'):'complete'};
 }
 for(const [id,row]of Object.entries(next.tournaments))if(!eligible.has(id)&&['ordinary','extraordinary'].includes(row.status))row.status='out_of_scope';
 for(const t of catalogue.tournaments||[])seen.add(t.competitionId.toUpperCase());
 next.seenIds=[...seen].sort();next.generatedAt=now;return next;
}
export function selectMetadataBatch(state,mode,limit=8){
 return Object.values(state.tournaments||{}).filter(t=>t.status===mode).sort((a,b)=>(a.checkedAt||'').localeCompare(b.checkedAt||'')||a.startDate.localeCompare(b.startDate)||a.competitionId.localeCompare(b.competitionId)).slice(0,limit);
}
export function applyMetadataBatch(state,result,now){
 const next=structuredClone(state);
 for(const checked of result.attempts||[]){const row=next.tournaments[checked.competitionId];if(!row)continue;row.checkedAt=checked.checkedAt;row.attempts=(row.attempts||0)+1;row.reason=checked.reason||'';row.lastError=checked.error||'';if(row.status==='ordinary')row.status='extraordinary';}
 next.generatedAt=now;return next;
}
export function metadataQueueStatus(state){
 const rows=Object.values(state.tournaments||{}),group=status=>{const tournaments=rows.filter(t=>t.status===status);return {total:tournaments.length,missingFields:tournaments.reduce((n,t)=>n+t.missing.length,0),tournaments};};
 return {generatedAt:state.generatedAt,criterion:'Sede, indirizzo e data qualificazioni ufficiali · solo tornei non iniziati',ordinary:group('ordinary'),extraordinary:group('extraordinary'),coverage:{resolved:group('complete').total+group('user_resolved').total,userResolved:group('user_resolved').total,outOfScope:group('out_of_scope').total}};
}
