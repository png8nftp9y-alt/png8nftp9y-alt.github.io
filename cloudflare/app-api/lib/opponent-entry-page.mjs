// Seek through the existing composite primary key; do not revisit prior pages.
export function opponentEntryPageQuery(cursor=null,pageSize=5000){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>5000)throw Error('Invalid opponent page size');
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const where=cursor?` WHERE (circuit,source_player_id)>(${quote(cursor.circuit)},${quote(cursor.source_player_id)})`:'';
 return `SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles${where} ORDER BY circuit,source_player_id LIMIT ${pageSize}`;
}
