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
async function main(){
 const {query}=await openReadOnlyD1();
 const state=await exportOpponentEntryState(query);
 const output='tmp/opponent-entry-remote.json';
 await fs.mkdir('tmp',{recursive:true});await fs.writeFile(output,JSON.stringify(state,null,2)+'\n');
 console.log(JSON.stringify({status:'opponent_entry_remote_state_ready',profiles:state.rows.length,output}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
