// D1_WRITE_POLICY: incremental
// buildIncrementalSyncPlan: immutable document versions, no replacement/deletion.
import fs from 'node:fs/promises';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {pathToFileURL} from 'node:url';
import {documentRecord,documentSQL,verifyDocument,digest} from './itf-draw-document-d1.mjs';
export const TARGETS=['J-J30-LTU-2026-003','J-J60-ESP-2026-007'].flatMap(competitionId=>['B-S-Q-KO','G-S-Q-KO'].map(event=>({competitionId,event,drawKey:competitionId+'|'+event})));
export async function savedSources(root){
 const found=new Map();
 async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){await walk(file);continue;}if(!item.name.endsWith('.json.gz'))continue;
  const bytes=await fs.readFile(file);if(path.basename(file)!==digest(bytes)+'.json.gz')throw Error('R2 compressed filename hash mismatch');
  const doc=JSON.parse(gunzipSync(bytes)),record=documentRecord(doc);if(!record||record.acquisitionState!=='complete'||!TARGETS.some(t=>t.drawKey===record.drawKey))continue;
  const previous=found.get(record.drawKey);if(!previous||record.observedAt>previous.observedAt||record.observedAt===previous.observedAt&&record.sha256>previous.sha256)found.set(record.drawKey,record);
 }}await walk(root);return found;
}
export async function repairDocuments({query,write,sources}){
 const report={status:'running',targets:[],matchesWritten:0,resultsWritten:0,insertedDocuments:0};
 for(const target of TARGETS){
  const existing=(await query('SELECT * FROM itf_current_draw_documents WHERE draw_key=?',[target.drawKey]))[0];
  if(existing){
   const chunks=await query('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? ORDER BY chunk_index',[target.drawKey,existing.content_sha256]);
   const doc=JSON.parse(chunks.map(c=>c.content).join('')),record=documentRecord(doc);if(!record||record.acquisitionState!=='complete'||record.drawKey!==target.drawKey||record.sha256!==existing.content_sha256)throw Error('Existing D1 document identity/hash mismatch: '+target.drawKey);verifyDocument(record,existing,chunks);report.targets.push({...target,status:'already_present_verified',sha256:record.sha256});continue;
  }
  const record=sources.get(target.drawKey);if(!record||record.drawKey!==target.drawKey||record.acquisitionState!=='complete')throw Error('No complete saved R2 source: '+target.drawKey);
  // Preflight partial immutable versions before any write to this document.
  const headers=await query('SELECT * FROM itf_draw_documents WHERE draw_key=? AND content_sha256=?',[record.drawKey,record.sha256]);
  const chunks=await query('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? ORDER BY chunk_index',[record.drawKey,record.sha256]);
  if(headers.some(h=>Number(h.content_bytes)!==record.bytes||Number(h.chunk_count)!==record.chunkCount||Number(h.player_count)!==record.playerCount||Number(h.match_count)!==record.matchCount)||chunks.some(c=>!Number.isInteger(c.chunk_index)||record.chunks[c.chunk_index]!==c.content))throw Error('Conflicting immutable D1 source: '+record.drawKey);
  for(const sql of documentSQL(record))await write(sql);
  const header=(await query('SELECT * FROM itf_draw_documents WHERE draw_key=? AND content_sha256=?',[record.drawKey,record.sha256]))[0];
  const stored=await query('SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? ORDER BY chunk_index',[record.drawKey,record.sha256]);verifyDocument(record,header,stored);
  report.insertedDocuments++;report.targets.push({...target,status:'restored_verified',sha256:record.sha256});
 }
 return{...report,status:'all_four_documents_verified'};
}
async function main(){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;if(!account||!token)throw Error('repair_credentials_missing');
 const base=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
 async function request(suffix,body){const r=await fetch(base+suffix,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});let data;try{data=await r.json();}catch{}if(!r.ok||!data?.success)throw Error('repair_d1_http_'+r.status+':codes_'+((data?.errors||[]).map(e=>e.code).filter(Number.isFinite).join(',')||'none'));return data.result;}
 const database=(await request('?name=courtwatch-app&per_page=100')).find(d=>d.name==='courtwatch-app');if(!database)throw Error('repair_database_missing');
 const execute=async(sql,params=[])=>{const rows=await request('/'+(database.uuid||database.id)+'/query',{sql,params});if(!rows.every(r=>r.success))throw Error('repair_query_failed');return rows[0]?.results||[];};
 const file='dist/v3/audits/itf-cached-qualification-repair.json';let report;
 try{report=await repairDocuments({query:execute,write:execute,sources:await savedSources(process.argv[2]||'/tmp/itf-qualification-raw')});}
 catch(error){report={status:'failed',error:error.message};process.exitCode=1;}
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main().catch(async error=>{const file='dist/v3/audits/itf-cached-qualification-repair.json';await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({status:'failed',error:error.message,finishedAt:new Date().toISOString()},null,2)+'\n');console.error(error.message);process.exitCode=1;});
