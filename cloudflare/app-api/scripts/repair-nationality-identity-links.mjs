import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. Source payloads are never rewritten. Reconcile
// affected identity groups through syncPlayerIdentities and its write budget.
const marker='identityNationalityAliases:ROM-ROU:MGO-MNE:v1';
export async function repairNationalityIdentityLinks(query){
 const prior=await query('SELECT key,value FROM app_state WHERE key='+sqlString(marker));
 if(prior[0]?.value==='complete')return{status:'already_reconciled',groups:0,writes:0};
 const affected=await query("SELECT source_key,name_key FROM player_circuit_identities WHERE UPPER(TRIM(nationality)) IN ('ROM','MGO') ORDER BY name_key,source_key"),names=[...new Set(affected.map(r=>r.name_key))],batches=[];
 for(let offset=0;offset<names.length;offset+=25){
  const batch=names.slice(offset,offset+25),wanted=new Set(batch),candidates=affected.filter(r=>wanted.has(r.name_key)),available=new Map();
  for(const table of ['observed_players','search_acquired_players'])for(let i=0;i<candidates.length;i+=40){const keys=candidates.slice(i,i+40).map(r=>sqlString(r.source_key)).join(',');for(const r of await query(`SELECT source_key FROM ${table} WHERE source_key IN (${keys})`))available.set(r.source_key,table);}
  const scope=batch.map(name=>{const row=candidates.find(r=>r.name_key===name&&available.has(r.source_key));if(!row)throw Error('nationality_repair_original_source_missing:'+name);return{source_table:available.get(row.source_key),source_key:row.source_key};});
  const counts=()=>query(`SELECT name_key,COUNT(DISTINCT canonical_id) AS people FROM player_circuit_identities WHERE name_key IN (${batch.map(sqlString).join(',')}) GROUP BY name_key`),before=await counts();
  for(const r of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${sqlString(r.source_table)},${sqlString(r.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
  const sync=await syncPlayerIdentities(query,{pendingSources:scope});
  const pending=await query(`SELECT source_table,source_key FROM player_identity_pending_sources WHERE (source_table,source_key) IN (${scope.map(r=>'('+sqlString(r.source_table)+','+sqlString(r.source_key)+')').join(',')})`);
  if(pending.length)throw Error('nationality_repair_sources_still_pending');
  batches.push({names:batch,before,after:await counts(),sync});
 }
 // This exact production regression must be fixed before the checkpoint is saved.
 const david=await query("SELECT circuit,official_id,canonical_id FROM player_circuit_identities WHERE (circuit='fitp' AND official_id='2543087015') OR (circuit='itf' AND official_id='800695612') OR (circuit='tennis-europe' AND official_id IN ('d583abbf-29a7-4963-a408-6591f34c34db','D583ABBF-29A7-4963-A408-6591F34C34DB'))");
 const circuits=new Set(david.map(r=>r.circuit));if(circuits.size!==3||new Set(david.map(r=>r.canonical_id)).size!==1)throw Error('david_dumitru_three_profiles_not_reconciled');
 const plan=buildIncrementalSyncPlan({current:prior,incoming:[{key:marker,value:'complete'}],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[marker,'complete',new Date().toISOString()].map(sqlString).join(',')+') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;');
 if((await query('SELECT value FROM app_state WHERE key='+sqlString(marker)))[0]?.value!=='complete')throw Error('nationality_repair_checkpoint_not_verified');
 return{status:'nationality_identity_groups_reconciled',groups:names.length,batches,david};
}
async function main(){const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0};
 async function query(sql){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(r=>r.success))throw Error('nationality_repair_d1_failed_http_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[];}
 const report={checkedAt:new Date().toISOString(),metrics};await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await repairNationalityIdentityLinks(query));}catch(e){report.status='failed';report.error=e.message;throw e;}finally{await fs.writeFile('tmp/nationality-identity-repair.json',JSON.stringify(report,null,2)+'\n');console.log('NATIONALITY_IDENTITY_REPAIR='+JSON.stringify(report));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
