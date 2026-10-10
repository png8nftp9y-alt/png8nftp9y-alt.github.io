import {includedPlayerIdSourceSql} from '../lib/player-id-audit-scope.mjs';
// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan: only changed source metadata; source keys are retained.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {archivedCandidates,evidenceCatalog} from '../lib/archived-profile-evidence.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {syncPlayerIdentities,profileRecoveryAudit,addD1Metrics} from './sync-player-identities.mjs';
import {sqlString,verifyDocument} from '../../../src/v3/itf-draw-document-d1.mjs';

export async function unresolvedSources(query){
 const rows=[];
 for(const table of ['observed_players','search_acquired_players']){let after='';while(true){
  const batch=await query(`SELECT s.*,l.nationality,l.birth_year FROM ${table} s JOIN player_circuit_identities l ON l.source_key=s.source_key WHERE l.profile_url='' AND ${includedPlayerIdSourceSql('s')} AND s.source_key>${sqlString(after)} AND s.circuit IN ('itf','tennis-europe') ORDER BY s.source_key LIMIT 1000`);
  rows.push(...batch.map(r=>({...r,source_table:table})));if(batch.length<1000)break;after=batch.at(-1).source_key;
 }}return rows;
}
export async function applyArchiveEvidence(query,rows,catalog){
 let repaired=0;const records=[];
 for(let i=0;i<rows.length;i+=100){const batch=rows.slice(i,i+100);
  const incoming=batch.map(r=>{const evidence=catalog.resolve(r);return evidence?{...r,official_id:evidence.officialId,payload:JSON.stringify({...JSON.parse(r.payload),...evidence})}:r;});
  const plan=buildIncrementalSyncPlan({current:batch,incoming,keyOf:r=>r.source_table+'|'+r.source_key,sourceComplete:true});
  for(let j=0;j<plan.updates.length;j+=20){const changes=plan.updates.slice(j,j+20);await query(changes.map(({before,after:r})=>`UPDATE ${r.source_table} SET official_id=${sqlString(r.official_id)},payload=${sqlString(r.payload)} WHERE source_key=${sqlString(r.source_key)} AND payload=${sqlString(before.payload)} AND official_id IS ${before.official_id==null?'NULL':sqlString(before.official_id)} AND (official_id IS NOT ${sqlString(r.official_id)} OR payload IS NOT ${sqlString(r.payload)});`).join('\n'));}
  const verified=new Map();for(const table of ['observed_players','search_acquired_players']){const changed=plan.updates.filter(u=>u.after.source_table===table);for(let j=0;j<changed.length;j+=40)for(const r of await query(`SELECT source_key,official_id,payload FROM ${table} WHERE source_key IN (${changed.slice(j,j+40).map(u=>sqlString(u.after.source_key)).join(',')})`))verified.set(table+'|'+r.source_key,r);}
  for(const {after:r}of plan.updates){const actual=verified.get(r.source_table+'|'+r.source_key);const applied=actual?.payload===r.payload&&actual?.official_id===r.official_id;records.push({sourceKey:r.source_key,circuit:r.circuit,officialId:r.official_id,profileUrl:JSON.parse(r.payload).profileUrl,status:applied?'verified':'concurrent_change'});if(applied)repaired++;}
  console.log('ARCHIVE_PROFILE_PROGRESS='+JSON.stringify({examined:Math.min(i+100,rows.length),repaired}));
 }return {repaired,records};
}
export async function addStoredDrawEvidence(query,catalog){
 let after='',documents=0;
 while(true){const batch=await query(`SELECT * FROM itf_current_draw_documents WHERE draw_key>${sqlString(after)} ORDER BY draw_key LIMIT 20`);if(!batch.length)break;
  for(const d of batch){const chunks=[];for(let offset=0;offset<Number(d.chunk_count);offset+=40)chunks.push(...await query(`SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=${sqlString(d.draw_key)} AND content_sha256=${sqlString(d.content_sha256)} AND chunk_index>=${offset} AND chunk_index<${offset+40} ORDER BY chunk_index`));
   verifyDocument({drawKey:d.draw_key,sha256:d.content_sha256,chunkCount:Number(d.chunk_count),bytes:Number(d.content_bytes),playerCount:Number(d.player_count),matchCount:Number(d.match_count),acquisitionState:'complete'},d,chunks);
   catalog.add(archivedCandidates('itf',JSON.parse(chunks.map(x=>x.content).join(''))));documents++;
  }after=batch.at(-1).draw_key;console.log('ARCHIVE_DOCUMENTS_VERIFIED='+documents);
 }return documents;
}
async function addRankingEvidence(query,catalog){
 let afterId='',afterName='';while(true){const rows=await query(`SELECT profile_id,normalized_name,nationality FROM tennis_europe_player_aliases WHERE (profile_id,normalized_name)>(${sqlString(afterId)},${sqlString(afterName)}) ORDER BY profile_id,normalized_name LIMIT 1000`);if(!rows.length)break;catalog.add(archivedCandidates('tennis-europe',rows.map(r=>({profileId:r.profile_id,name:r.normalized_name,nationality:r.nationality}))));afterId=rows.at(-1).profile_id;afterName=rows.at(-1).normalized_name;if(rows.length<1000)break;}
}
async function main(){
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
 const metrics={rowsWritten:0,rowsRead:0};
 async function query(sql){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});const result=await response.json();if(!response.ok||result.success!==true||!result.result?.every(r=>r.success))throw Error('archive_profile_D1_query_failed_'+response.status);addD1Metrics(metrics,result);return result.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});const report={startedAt:new Date().toISOString(),target:'zero_verified_missing_profiles',archives:[],metrics};
 try{
  const before=await profileRecoveryAudit(query);report.before={unresolved:before.unresolved,byCircuit:before.byCircuit};const rows=await unresolvedSources(query),catalog=evidenceCatalog();
  for(const [circuit,name]of [['tennis-europe','tennis_europe_participant_cache.json.gz'],['itf','itf_participant_cache.json.gz'],['itf','itf_players_database.json.gz'],['itf','itf_results_database.json.gz']]){const file='../../history/'+name;const payload=JSON.parse(gunzipSync(await fs.readFile(file)).toString());catalog.add(archivedCandidates(circuit,payload));report.archives.push(name);}
  await addRankingEvidence(query,catalog);
  // Replay the retained official documents once, rather than requesting draws again.
  if(rows.some(r=>r.circuit==='itf'&&!catalog.resolve(r)))report.documentsVerified=await addStoredDrawEvidence(query,catalog);
  report.evidenceEntries=catalog.entries;Object.assign(report,await applyArchiveEvidence(query,rows,catalog));
  report.mapping=await syncPlayerIdentities(query,{allowBulk:true});const after=await profileRecoveryAudit(query);report.after={unresolved:after.unresolved,byCircuit:after.byCircuit};report.status=after.unresolved===0?'complete_zero_verified':'unresolved_official_evidence';report.finishedAt=new Date().toISOString();
  await fs.writeFile('tmp/player-profile-unresolved.json',JSON.stringify(after)+'\n');console.log(JSON.stringify({...report,records:undefined}));
 }catch(error){report.status='failed';report.error=error.message;throw error;}
 finally{await fs.writeFile('tmp/player-profile-archive-repair.json',JSON.stringify(report)+'\n');console.log('ARCHIVE_PROFILE_D1_METRICS='+JSON.stringify(metrics));}
 if(report.status!=='complete_zero_verified')throw Error('official_profiles_still_unresolved:'+report.after.unresolved);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
