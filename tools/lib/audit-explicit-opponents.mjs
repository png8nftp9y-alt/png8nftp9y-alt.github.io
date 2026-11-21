// Exact native ID lookup for explicit read-only audits outside the observed scope.
export async function explicitAuditOpponents(query, opponents, input='') {
 const text=String(input).trim();if(!text)return opponents;
 if(!/^800\d{6}(?:\s*,\s*800\d{6})*$/.test(text))throw Error('audit_invalid_explicit_itf_ids');
 const ids=[...new Set(text.split(',').map(x=>x.trim()))];
 if(ids.length>10)throw Error('audit_explicit_scope_too_large');
 const result=new Map(opponents);
 for(const id of ids){
  if(result.has(id))continue;
  const rows=await query("SELECT display_name FROM observed_players WHERE circuit='itf' AND official_id=? AND display_name<>'' UNION SELECT display_name FROM search_acquired_players WHERE circuit='itf' AND official_id=? AND display_name<>'' ORDER BY display_name LIMIT 1",[id,id]);
  if(!rows[0]?.display_name)throw Error('audit_explicit_itf_identity_missing:'+id);
  result.set(id,rows[0].display_name);
 }
 return result;
}
