import {cachedReadCheck,readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {acquiredPlayer,documentPlayers,searchPlayerSql,acquiredSearchPlan} from '../lib/acquired-player-index.mjs';
import {verifyDocument,sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental
// acquiredSearchPlan uses buildIncrementalSyncPlan; checkpoints follow verified writes.
export async function syncAcquiredSearch(query){
 let documentsProcessed=0,matchesProcessed=0,playerWritesRequested=0;
 const incrementalMatches=(await query("SELECT name FROM sqlite_master WHERE type='table' AND name='search_pending_matches'")).length>0;
 async function batchWrite(statements){let batch=[],bytes=0;for(const sql of statements){const size=Buffer.byteLength(sql);if(size>90000)throw Error('Search SQL statement exceeds safe size');if(batch.length&&(batch.length>=20||bytes+size>90000)){await query(batch.join('\n'));batch=[];bytes=0}batch.push(sql);bytes+=size+1}if(batch.length)await query(batch.join('\n'));}
 async function add(players){const keys=[...new Set(players.filter(Boolean).map(r=>r.sourceKey))],current=[];for(let i=0;i<keys.length;i+=40)current.push(...await query(`SELECT * FROM search_acquired_players WHERE source_key IN (${keys.slice(i,i+40).map(sqlString).join(',')})`));const plan=acquiredSearchPlan(current,players);const delta=[...plan.inserts,...plan.updates.map(r=>r.after)];await batchWrite(delta.map(searchPlayerSql));playerWritesRequested+=delta.length;}
 while(true){
  const docs=await query('SELECT d.* FROM itf_current_draw_documents d WHERE NOT EXISTS(SELECT 1 FROM search_draw_indexed_versions s WHERE s.draw_key=d.draw_key AND s.content_sha256=d.content_sha256) ORDER BY d.draw_key LIMIT 20');if(!docs.length)break;
  const players=[],checkpoints=[];
  for(const d of docs){const chunks=[];for(let offset=0;offset<Number(d.chunk_count);offset+=40)chunks.push(...await query(`SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=${sqlString(d.draw_key)} AND content_sha256=${sqlString(d.content_sha256)} AND chunk_index>=${offset} AND chunk_index<${offset+40} ORDER BY chunk_index`));const row={drawKey:d.draw_key,sha256:d.content_sha256,chunkCount:Number(d.chunk_count),bytes:Number(d.content_bytes),playerCount:Number(d.player_count),matchCount:Number(d.match_count),acquisitionState:'complete'};
   verifyDocument(row,d,chunks);players.push(...documentPlayers(JSON.parse(chunks.map(x=>x.content).join(''))).map(p=>acquiredPlayer('itf',p)));
   checkpoints.push(`INSERT INTO search_draw_indexed_versions(draw_key,content_sha256) VALUES(${sqlString(d.draw_key)},${sqlString(d.content_sha256)}) ON CONFLICT DO NOTHING;`);
  }
  await add(players);await batchWrite(checkpoints);documentsProcessed+=docs.length;console.log(`ITF_SEARCH_DOCUMENTS_INDEXED=${documentsProcessed}`);
 }
 while(true){
  const matches=await query(incrementalMatches?'SELECT m.id,m.circuit,m.payload,p.revision FROM search_pending_matches p CROSS JOIN matches m ON m.id=p.match_id ORDER BY p.match_id LIMIT 100':'SELECT m.id,m.circuit,m.payload FROM matches m LEFT JOIN search_match_indexed s ON s.match_id=m.id WHERE s.source_payload IS NOT m.payload ORDER BY m.id LIMIT 100');if(!matches.length)break;
  const participants=await query(`SELECT match_id,display_name,source_player_id,nationality,payload FROM match_participants WHERE match_id IN (${matches.map(m=>sqlString(m.id)).join(',')})`),circuits=new Map(matches.map(m=>[m.id,m.circuit]));
  await add(participants.map(p=>{let raw={};try{raw=JSON.parse(p.payload||'{}')}catch{}return acquiredPlayer(circuits.get(p.match_id),{...raw,name:p.display_name,source_player_id:p.source_player_id,nationality:p.nationality||raw.nationality})}));
  await batchWrite(matches.map(m=>`INSERT INTO search_match_indexed(match_id,source_payload) VALUES(${sqlString(m.id)},${sqlString(m.payload)}) ON CONFLICT(match_id) DO UPDATE SET source_payload=excluded.source_payload WHERE source_payload IS NOT excluded.source_payload;`));if(incrementalMatches)await batchWrite(matches.map(m=>`DELETE FROM search_pending_matches WHERE match_id=${sqlString(m.id)} AND revision=${Number(m.revision)};`));matchesProcessed+=matches.length;console.log(`CANONICAL_SEARCH_MATCHES_INDEXED=${matchesProcessed}`);
 }
 return{status:'verified_indexed_sources',documentsProcessed,matchesProcessed,playerWritesRequested,generatedAt:new Date().toISOString()};
}
async function main(){
 const metrics={queries:0,rowsRead:0,rowsWritten:0};
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(x=>x.binding==='DB').database_id;
 async function query(sql){for(let attempt=0;attempt<3;attempt++)try{const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(x=>x.success))throw Error('D1 search sync failed: HTTP '+r.status);for(const r of j.result){metrics.rowsRead+=Number(r.meta?.rows_read||0);metrics.rowsWritten+=Number(r.meta?.rows_written||0)}metrics.queries+=j.result.length;return j.result[0].results||[]}catch(e){if(attempt===2)throw e}}
 const checked=await cachedReadCheck(query,'search-sources',await readCheckVersion(import.meta.url),()=>syncAcquiredSearch(query));const audit=checked.reused?{status:'verified_unchanged_sources',documentsProcessed:0,matchesProcessed:0,playerWritesRequested:0,verifiedAt:checked.verifiedAt}:checked.value;audit.cache={reused:checked.reused,saved:checked.cacheSaved,verifiedAt:checked.verifiedAt};audit.d1Metrics=metrics;await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/acquired-search-sync.json',JSON.stringify(audit)+'\n');console.log(JSON.stringify(audit));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
