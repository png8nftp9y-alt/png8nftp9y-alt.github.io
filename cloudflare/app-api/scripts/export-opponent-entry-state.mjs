import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const output='tmp/opponent-entry-remote.json',pageSize=5000,rows=[],seen=new Set();
const collect=value=>{if(Array.isArray(value)){for(const item of value)collect(item);return}if(!value||typeof value!=='object')return;if(typeof value.circuit==='string'&&typeof value.source_player_id==='string'&&typeof value.payload==='string'){const key=`${value.circuit}|${value.source_player_id}`;if(!seen.has(key)){seen.add(key);rows.push(value)}return}for(const item of Object.values(value))collect(item)};
for(let offset=0;;offset+=pageSize){
  const sql=`SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles ORDER BY circuit,source_player_id LIMIT ${pageSize} OFFSET ${offset}`;
  const result=spawnSync('npx',['wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--json','--command',sql],{encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)throw new Error(`Unable to export opponent profile state: ${String(result.stderr||result.stdout).slice(0,1000)}`);
  const before=rows.length;collect(JSON.parse(result.stdout||'[]'));const added=rows.length-before;
  if(added<pageSize)break;
}
await fs.mkdir('tmp',{recursive:true});await fs.writeFile(output,JSON.stringify({rows},null,2)+'\n');
console.log(JSON.stringify({status:'opponent_entry_remote_state_ready',profiles:rows.length,output}));
