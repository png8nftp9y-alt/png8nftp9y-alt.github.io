// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan contract: stable IDs, guarded upserts, identical rows write zero.
export function tournamentSeedStatements(rows,{batchSize=100}={}){
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>100)throw Error('invalid_tournament_batch_size');
 const statements=[],columns=['circuit','source_tournament_id','start_date','end_date','payload'];
 const different=columns.map(c=>`tournaments.${c} IS NOT excluded.${c}`).join(' OR ');
 for(let i=0;i<rows.length;i+=batchSize){
  const batch=rows.slice(i,i+batchSize);if(batch.some(r=>!r.id||!r.circuit||!r.sourceTournamentId))throw Error('invalid_tournament_seed_row');
  const json="'"+JSON.stringify(batch).replaceAll("'","''")+"'";
  statements.push(`INSERT INTO tournaments(id,circuit,source_tournament_id,start_date,end_date,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.circuit'),json_extract(value,'$.sourceTournamentId'),COALESCE(json_extract(value,'$.startDate'),''),COALESCE(json_extract(value,'$.endDate'),''),value FROM json_each(${json}) WHERE 1 ON CONFLICT(id) DO UPDATE SET circuit=excluded.circuit,source_tournament_id=excluded.source_tournament_id,start_date=excluded.start_date,end_date=excluded.end_date,payload=excluded.payload WHERE ${different};`);
 }
 return statements;
}
