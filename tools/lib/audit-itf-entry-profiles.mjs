// Scope-only bounded exact-ID reads. Never a full-table or multi-payload IN query.
export const itfEntryProfileSql="SELECT source_player_id,payload FROM opponent_entry_profiles WHERE circuit='itf' AND source_player_id=? LIMIT 2";
export async function auditItfEntryProfiles(query,ids){
 const profiles=new Map();
 for(const id of new Set(ids)){
  if(typeof id!=='string'||!id||id.length>160)throw Error('audit_invalid_itf_entry_id');
  const rows=await query(itfEntryProfileSql,[id]);
  if(!Array.isArray(rows)||rows.length>1||rows.some(r=>String(r.source_player_id)!==id))throw Error('audit_itf_entry_identity_mismatch');
  if(rows.length)profiles.set(id,JSON.parse(rows[0].payload));
 }
 return profiles;
}
