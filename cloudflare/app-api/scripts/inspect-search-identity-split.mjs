import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {normalizePlayerName,playerNameKey} from '../lib/player-circuit-profiles.mjs';
import {mergeSearchIdentities,paginatedPlayerSearch} from '../lib/paginated-player-search.mjs';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
// D1_READ_ONLY: guarded. One name, indexed source reads, no discovery or repairs.
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function inspectSearchIdentitySplit(query,db,name='David Dumitru'){
 const normalized=normalizePlayerName(name);if(!normalized||normalized.length>120)throw Error('invalid_identity_name');
 const names=[...new Set([normalized,normalized.toLowerCase(),normalized.split(' ').reverse().join(' '),normalized.split(' ').reverse().join(' ').toLowerCase()])],list=names.map(quote).join(','),key=playerNameKey(name);
 let sources=[];
 for(const table of ['observed_players','search_acquired_players'])sources.push(...await query(`SELECT '${table}' AS source_table,source_key,circuit,official_id,normalized_name,display_name,payload FROM ${table} WHERE normalized_name IN (${list})`));
 const selected=await query(`SELECT * FROM player_circuit_identities WHERE name_key=${quote(key)}`),canonicalIds=[...new Set(selected.map(r=>r.canonical_id))];
 let links=[...selected],people=[],aliases=[];
 if(canonicalIds.length>100||sources.length>500)throw Error('identity_target_scope_too_large');
 for(let i=0;i<canonicalIds.length;i+=40){const ids=canonicalIds.slice(i,i+40).map(quote).join(',');links.push(...await query(`SELECT * FROM player_circuit_identities WHERE canonical_id IN (${ids})`));people.push(...await query(`SELECT * FROM player_identity_people WHERE canonical_id IN (${ids})`));aliases.push(...await query(`SELECT * FROM player_identity_aliases WHERE canonical_id IN (${ids})`));}
 links=[...new Map(links.map(r=>[r.source_key,r])).values()];if(links.length>500)throw Error('identity_target_scope_too_large');
 const known=new Set(sources.map(r=>r.source_key));
 // Retain linked spelling variants, configured profiles and archived evidence.
 for(const link of links){if(known.has(link.source_key))continue;let found=[];
  for(const table of ['observed_players','search_acquired_players'])found.push(...await query(`SELECT '${table}' AS source_table,source_key,circuit,official_id,normalized_name,display_name,payload FROM ${table} WHERE source_key=${quote(link.source_key)}`));
  if(link.circuit==='courtwatch'){const id=quote(link.official_id);for(const [table,column]of [['app_players','id'],['user_app_player_additions','courtwatch_id']])found.push(...await query(`SELECT '${table}' AS source_table,'courtwatch|'||${column} AS source_key,'courtwatch' AS circuit,${column} AS official_id,UPPER(json_extract(payload,'$.name')) AS normalized_name,json_extract(payload,'$.name') AS display_name,payload FROM ${table} WHERE ${column}=${id}`));}
  if(!found.length)found=[{...link,source_table:'retained_mapping',payload:JSON.stringify({birthYear:link.birth_year,nationality:link.nationality,profileUrl:link.profile_url})}];sources.push(...found);
 }
 const rows=[...new Map(sources.map(r=>[r.source_key,r])).values()],confirmedLinks=(await query("SELECT value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key")).map(r=>JSON.parse(r.value)),mapped=await paginatedPlayerSearch(db,name,null),merged=mergeSearchIdentities([...rows],new Map());
 let projection;try{const p=buildIdentityMapping(rows,{currentLinks:links,currentPeople:people,currentAliases:aliases,confirmedLinks});projection={people:p.people.map(r=>({canonicalId:r.canonical_id,...JSON.parse(r.payload)})),links:p.links,changes:Object.fromEntries(Object.entries(p.plans).map(([k,v])=>[k,{inserts:v.inserts.length,updates:v.updates.length}]))};}catch(error){projection={error:error.message};}
 const pending=[];for(const table of ['observed_players','search_acquired_players']){const keys=sources.filter(r=>r.source_table===table).map(r=>r.source_key);for(let i=0;i<keys.length;i+=40)pending.push(...await query(`SELECT * FROM player_identity_pending_sources WHERE source_table=${quote(table)} AND source_key IN (${keys.slice(i,i+40).map(quote).join(',')})`));}
 return {status:'read_only_identity_evidence',checkedAt:new Date().toISOString(),name,sourceCount:rows.length,savedCanonicalIds:canonicalIds,search:mapped,sourceGrouping:merged,projection,pending,sources:sources.map(r=>({...r,payload:JSON.parse(r.payload||'{}')})),links};
}
async function main(){const metrics={queries:0,rowsRead:0,rowsWritten:0},client=await openReadOnlyD1({onMetrics:rows=>{metrics.queries++;for(const r of rows){metrics.rowsRead+=Number(r.meta?.rows_read||0);metrics.rowsWritten+=Number(r.meta?.rows_written||0);}}});const report=await inspectSearchIdentitySplit(client.query,client.db,process.argv[2]||'David Dumitru');if(metrics.rowsWritten)throw Error('identity_diagnostic_unexpected_write');report.metrics=metrics;await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/search-identity-split.json',JSON.stringify(report,null,2)+'\n');console.log('SEARCH_IDENTITY_SPLIT='+JSON.stringify(report));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
