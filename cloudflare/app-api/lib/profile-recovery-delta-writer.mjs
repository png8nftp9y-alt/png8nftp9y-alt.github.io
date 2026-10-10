import {applyArchiveEvidence} from '../scripts/repair-archived-player-profiles.mjs';
export function profileRecoveryDeltaWriter(query,catalog){
 const verified=new Set(),key=row=>row.source_table+'|'+row.source_key;
 return async rows=>{
  const pending=rows.filter(row=>!verified.has(key(row))),result=await applyArchiveEvidence(query,pending,catalog);
  const applied=new Set(result.records.filter(r=>r.status==='verified').map(r=>r.sourceKey));
  for(const row of pending)if(applied.has(row.source_key))verified.add(key(row));
  return result;
 };
}
