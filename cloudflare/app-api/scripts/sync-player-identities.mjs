import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildIdentityMapping,identityMappingSql} from '../lib/player-identity-mapping.mjs';
import {playerNameKey} from '../lib/player-circuit-profiles.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan is enforced by buildIdentityMapping; checkpoint follows writes.
const sources=[['observed_players','source_key'],['search_acquired_players','source_key'],['app_players','id'],['user_app_player_additions','courtwatch_id']];
const projection=table=>table==='app_players'||table==='user_app_player_additions'?`'courtwatch|'||${table==='app_players'?'id':'courtwatch_id'} AS source_key,'courtwatch' AS circuit,${table==='app_players'?'id':'courtwatch_id'} AS official_id,json_extract(payload,'$.name') AS display_name,UPPER(json_extract(payload,'$.name')) AS normalized_name,payload`:'source_key,circuit,official_id,display_name,normalized_name,payload';
async function write(query,statements){let batch=[],bytes=0;for(const sql of statements){const size=Buffer.byteLength(sql);if(size>90000)throw Error('identity_statement_too_large');if(batch.length&&(batch.length>=20||bytes+size>90000)){await query(batch.join('\n'));batch=[];bytes=0}batch.push(sql);bytes+=size}if(batch.length)await query(batch.join('\n'));}
async function allRows(query,table,key){const result=[];let after='';while(true){const batch=await query(`SELECT ${projection(table)},${key} AS scan_key FROM ${table} WHERE ${key}>${sqlString(after)} ORDER BY ${key} LIMIT 1000`);result.push(...batch);if(batch.length<1000)break;const next=batch.at(-1).scan_key;if(next<=after)throw Error('identity_scan_cursor_failed');after=next;}return result;}
async function byKeys(query,table,key,keys){const result=[];for(let i=0;i<keys.length;i+=40)result.push(...await query(`SELECT ${projection(table)} FROM ${table} WHERE ${key} IN (${keys.slice(i,i+40).map(sqlString).join(',')})`));return result;}
export async function syncPlayerIdentities(query){
 const pending=[];for(const [table]of sources){let after='';while(true){const batch=await query(`SELECT * FROM player_identity_pending_sources WHERE source_table=${sqlString(table)} AND source_key>${sqlString(after)} ORDER BY source_key LIMIT 1000`);pending.push(...batch);if(batch.length<1000)break;after=batch.at(-1).source_key;}}
 if(!pending.length){const counts=await query('SELECT (SELECT COUNT(*) FROM player_identity_people) AS people,(SELECT COUNT(*) FROM player_circuit_identities) AS links');return{status:'unchanged',writes:0,pending:0,...counts[0]};}
 const full=pending.length>500,rows=[];
 for(const [table,key]of sources){const keys=pending.filter(p=>p.source_table===table).map(p=>p.source_key);if(full)rows.push(...await allRows(query,table,key));else if(keys.length)rows.push(...await byKeys(query,table,key,keys));}
 let currentLinks=[],currentPeople=[],currentAliases=[];
 if(full){for(const [table,key,target]of [['player_circuit_identities','source_key',currentLinks],['player_identity_people','canonical_id',currentPeople],['player_identity_aliases','alias_id',currentAliases]]){let after='';while(true){const batch=await query(`SELECT * FROM ${table} WHERE ${key}>${sqlString(after)} ORDER BY ${key} LIMIT 1000`);target.push(...batch);if(batch.length<1000)break;after=batch.at(-1)[key];}}}
 else{
  const names=[...new Set(rows.map(r=>playerNameKey(r.display_name)))];
  for(let i=0;i<names.length;i+=40)currentLinks.push(...await query(`SELECT * FROM player_circuit_identities WHERE name_key IN (${names.slice(i,i+40).map(sqlString).join(',')})`));
  for(let i=0;i<rows.length;i+=40){const chunk=rows.slice(i,i+40);currentLinks.push(...await query(`SELECT * FROM player_circuit_identities WHERE source_key IN (${chunk.map(r=>sqlString(r.source_key)).join(',')}) OR (${chunk.filter(r=>r.official_id).map(r=>`(circuit=${sqlString(r.circuit)} AND official_id=${sqlString(r.official_id)})`).join(' OR ')||'0'})`));}
  const ids=[...new Set(currentLinks.map(r=>r.canonical_id))];for(let i=0;i<ids.length;i+=40){const chunk=ids.slice(i,i+40).map(sqlString).join(',');currentLinks.push(...await query(`SELECT * FROM player_circuit_identities WHERE canonical_id IN (${chunk})`));currentPeople.push(...await query(`SELECT * FROM player_identity_people WHERE canonical_id IN (${chunk})`));currentAliases.push(...await query(`SELECT * FROM player_identity_aliases WHERE canonical_id IN (${chunk})`));}
 }
 currentLinks=[...new Map(currentLinks.map(r=>[r.source_key,r])).values()];
 // Reload original retained records so metadata is preserved during small delta updates.
 if(!full){const known=new Set(rows.map(r=>r.source_key));for(const [table,key]of sources){const keys=currentLinks.filter(r=>!known.has(r.source_key)&&(table==='app_players'||table==='user_app_player_additions'?r.source_key.startsWith('courtwatch|'):true)).map(r=>table==='app_players'||table==='user_app_player_additions'?r.source_key.slice(11):r.source_key);if(keys.length)rows.push(...await byKeys(query,table,key,keys));}}
 const loaded=new Set(rows.map(r=>r.source_key));
 // Preserve retained acquired evidence, including sources no longer in current indexes.
 for(const r of currentLinks)if(!loaded.has(r.source_key))rows.push({...r,payload:JSON.stringify({birthYear:r.birth_year,nationality:r.nationality,profileUrl:r.profile_url})});
 const plan=buildIdentityMapping(rows,{currentLinks,currentPeople,currentAliases,sourceComplete:true}),statements=identityMappingSql(plan);await write(query,statements);
 // Revision predicate retains a source changed while this snapshot was processed.
 const clears=[];for(let i=0;i<pending.length;i+=100)clears.push(`DELETE FROM player_identity_pending_sources WHERE (source_table,source_key,revision) IN (${pending.slice(i,i+100).map(p=>'('+sqlString(p.source_table)+','+sqlString(p.source_key)+','+Number(p.revision)+')').join(',')});`);await write(query,clears);
 const remaining=Number((await query('SELECT COUNT(*) AS total FROM player_identity_pending_sources'))[0].total);
 const status=remaining?'pending':'ready';await query(`INSERT INTO player_identity_sync(id,status) VALUES('current',${sqlString(status)}) ON CONFLICT(id) DO UPDATE SET status=excluded.status WHERE status IS NOT excluded.status;`);
 const audit=(await query(`SELECT (SELECT COUNT(*) FROM player_identity_people p WHERE EXISTS(SELECT 1 FROM player_circuit_identities l WHERE l.canonical_id=p.canonical_id)) AS people,(SELECT COUNT(*) FROM player_circuit_identities) AS links,(SELECT COUNT(*) FROM player_circuit_identities WHERE circuit IN ('fitp','tennis-europe','itf') AND profile_url='') AS sources_without_official_profile,(SELECT COUNT(*) FROM observed_players o WHERE NOT EXISTS(SELECT 1 FROM player_circuit_identities l WHERE l.source_key=o.source_key)) AS missing_observed,(SELECT COUNT(*) FROM search_acquired_players s WHERE NOT EXISTS(SELECT 1 FROM player_circuit_identities l WHERE l.source_key=s.source_key)) AS missing_acquired`))[0];
 if(audit.missing_observed||audit.missing_acquired){await query("UPDATE player_identity_sync SET status='pending' WHERE id='current' AND status<>'pending'");throw Error('identity_mapping_coverage_failed');}
 return{status,writes:statements.length,pending:remaining,...audit};
}
async function main(){const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
 async function query(sql){for(let attempt=0;attempt<3;attempt++)try{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),result=await response.json();if(!response.ok||result.success!==true||!result.result?.every(r=>r.success))throw Error('identity_D1_query_failed_HTTP_'+response.status);return result.result[0].results||[]}catch(error){if(attempt===2)throw error}}
 const audit=await syncPlayerIdentities(query);await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/player-identity-sync.json',JSON.stringify(audit)+'\n');console.log(JSON.stringify(audit));if(audit.status==='pending')throw Error('identity_mapping_pending_sources');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
