// D1_READ_ONLY: paginated immutable document metadata, no raw chunks or writes.
// D1_WRITE_POLICY: incremental. The plan gates document reuse; this helper issues no writes.
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
export async function existingDocumentManifest(query){
 const documents=[];
 for(const table of ['itf_draw_documents','itf_draw_unverified_documents']){
  let key='',sha='';
  for(;;){
   const rows=await query(`SELECT draw_key,content_sha256,competition_id,event,content_bytes,chunk_count,player_count,match_count,observed_at FROM ${table} WHERE (draw_key,content_sha256)>(${sqlString(key)},${sqlString(sha)}) ORDER BY draw_key,content_sha256 LIMIT 500`);
   if(rows.length>500)throw Error('Invalid document manifest page');
   for(const row of rows){if(row.draw_key<key||(row.draw_key===key&&row.content_sha256<=sha))throw Error('Unordered document manifest');documents.push({...row,table});key=row.draw_key;sha=row.content_sha256;}
   if(rows.length<500)break;
  }
 }
 return {version:1,documents};
}
export function storedDocumentMatches(row,stored){
 if(!stored)return false;
 const expected={table:row.acquisitionState==='complete'?'itf_draw_documents':'itf_draw_unverified_documents',draw_key:row.drawKey,content_sha256:row.sha256,competition_id:row.competitionId,event:row.event,content_bytes:row.bytes,chunk_count:row.chunkCount,player_count:row.playerCount,match_count:row.matchCount};
 const normalize=value=>Object.fromEntries(Object.keys(expected).map(k=>[k,['content_bytes','chunk_count','player_count','match_count'].includes(k)?Number(value[k]):value[k]]));
 const plan=buildIncrementalSyncPlan({current:[stored],incoming:[expected],keyOf:r=>r.draw_key+'|'+r.content_sha256,normalize,sourceComplete:true});
 return plan.writes===0;
}
