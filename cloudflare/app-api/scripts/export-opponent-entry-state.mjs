import {bucketSql,bucketKey,desiredBucketHashes} from '../lib/opponent-entry-buckets.mjs';
import {opponentEntryPageQuery} from '../lib/opponent-entry-page.mjs';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// D1_READ_ONLY: guarded
// Preserve indexed pages and complete payloads without starting a CLI per page.
export async function exportOpponentEntryState(query,{pageSize=5000}={}){
 const rows=[],seen=new Set();let cursor=null;
 for(;;){
  const page=await query(opponentEntryPageQuery(cursor,pageSize));
  if(!Array.isArray(page)||page.length>pageSize)throw Error('Invalid opponent entry page');
  for(const row of page){
   if(!row||typeof row.circuit!=='string'||typeof row.source_player_id!=='string'||typeof row.payload!=='string')throw Error('Invalid opponent entry row');
   const key=JSON.stringify([row.circuit,row.source_player_id]);
   if(seen.has(key))throw Error('Opponent page cursor did not advance');
   seen.add(key);rows.push(row);
  }
  if(page.length<pageSize)break;
  const last=page.at(-1);cursor={circuit:last.circuit,source_player_id:last.source_player_id};
 }
 return{rows};
}
export async function exportChangedOpponentEntries(query,desired,{force=false}={}){
 if(!desired.complete||!Array.isArray(desired.rows)||!['fitp','itf','tennis-europe'].every(c=>desired.rows.some(r=>r.circuit===c)))throw Error('Opponent entry source incomplete');
 const schema=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='opponent_entry_bucket_checks'");
 if(!schema.length)return exportOpponentEntryState(query);
 const previous=await query('SELECT circuit,bucket,digest FROM opponent_entry_bucket_checks');
 const hashes=desiredBucketHashes(desired.rows),known=new Map(previous.map(r=>[bucketKey(r.circuit,r.bucket),r]));
 // Unknown legacy circuits are preserved; their buckets still get checked.
 for(const r of previous)if(!hashes.has(bucketKey(r.circuit,r.bucket)))hashes.set(bucketKey(r.circuit,r.bucket),'legacy-preserved-v1');
 const rows=[],scopeBuckets=[];
 for(const [key,hash] of hashes){
  const [circuit,bucket]=JSON.parse(key);if(!force&&known.get(key)?.digest===hash)continue;
  const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
  let last=null;
  for(;;){
   const page=await query(`SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles WHERE circuit=${quote(circuit)} AND ${bucketSql()}=${bucket} ${last===null?'':`AND source_player_id>${quote(last)}`} ORDER BY source_player_id LIMIT 1000`);
   if(!Array.isArray(page)||page.some(r=>r.circuit!==circuit||typeof r.source_player_id!=='string'||typeof r.payload!=='string'))throw Error('Invalid opponent bucket');
   rows.push(...page);if(page.length<1000)break;
   const next=page.at(-1).source_player_id;if(last!==null&&next<=last)throw Error('Opponent bucket cursor did not advance');last=next;
  }
  scopeBuckets.push({circuit,bucket,hash});
 }
 return {rows,scopeBuckets};
}
async function main(){
 const metrics={queries:0,rowsRead:0,rowsWritten:0};
 const {query}=await openReadOnlyD1({onMetrics:results=>{for(const r of results){if(!Number.isFinite(r.meta?.rows_read)||!Number.isFinite(r.meta?.rows_written))throw Error('opponent_export_metrics_unavailable');metrics.queries++;metrics.rowsRead+=r.meta.rows_read;metrics.rowsWritten+=r.meta.rows_written;}}});
 let desired;try{desired=JSON.parse(await fs.readFile('tmp/opponent-entry-desired.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const state=desired?await exportChangedOpponentEntries(query,desired,{force:process.env.D1_FULL_VERIFICATION==='1'}):await exportOpponentEntryState(query);
 const output='tmp/opponent-entry-remote.json';
 await fs.mkdir('tmp',{recursive:true});await fs.writeFile(output,JSON.stringify(state,null,2)+'\n');
 console.log(JSON.stringify({status:'opponent_entry_remote_state_ready',profiles:state.rows.length,output,metrics}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
