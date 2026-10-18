// Read only the projection IDs being compared; never scan unrelated match history.
const tables=new Set(['players','entries','schedules','matches','results']);
export async function readProjectionRows(query,table,expectedIds){
 if(!tables.has(table))throw Error('invalid_audit_projection_table');
 if(expectedIds.some(id=>typeof id!=='string'||!id))throw Error('invalid_audit_projection_id');
 const ids=[...new Set(expectedIds)],rows=[];
 for(let offset=0;offset<ids.length;offset+=20){
  const batch=ids.slice(offset,offset+20);
  rows.push(...await query(`SELECT id,payload FROM ${table} WHERE id IN (${batch.map(()=>'?').join(',')})`,batch));
 }
 return rows;
}
