// D1_WRITE_POLICY: incremental; SELECT-only indexed recovery, no mutations.
const indexes=new Set(['identity_invalid_native','identity_invalid_europe']);
export function indexedRecoverySql(sql,index){
 if(!indexes.has(index))throw Error('invalid_recovery_index');
 return sql.replace(/FROM player_circuit_identities( l\b)?/,(_,alias='')=>'FROM player_circuit_identities'+alias+' INDEXED BY '+index);
}
export async function recoveryReadQuery(query,sql,index){
 if(!indexes.has(index))throw Error('invalid_recovery_index');
 const present=await query("SELECT name FROM sqlite_master WHERE type='index' AND name='"+index+"'");
 // Libraries remain usable before the additive migration; no false zero result.
 return query(present.length?indexedRecoverySql(sql,index):sql);
}
