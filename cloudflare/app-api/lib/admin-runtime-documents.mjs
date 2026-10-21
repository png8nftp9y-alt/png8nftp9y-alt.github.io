import {runtimeDocumentReader} from './runtime-document-reader.mjs';

// Share only verified, immutable diagnostic documents, never account/player data.
// Read the D1 release on EVERY request: a new hash bypasses this cache immediately.
const databases=new WeakMap();
const allowed=new Set(['diagnostics.json','sync_status.json','itf_system_diagnostics.json','source_itf_entries.json','tennis_europe_system_diagnostics.json','source_fitp_entries.json','operational_status.json','itf_t1_queue_status.json','itf_metadata_queue_status.json']);
const maxBytes=8*1024*1024,maxEntries=12;
export function adminRuntimeDocuments(db){
 let reader=runtimeDocumentReader(db);
 let cache=databases.get(db);if(!cache){cache=new Map();databases.set(db,cache);}
 return {release:()=>reader.release(),async preload(paths){
  paths=paths.filter(path=>path.startsWith('dist/v3/')&&allowed.has(path.slice(8)));
  if(!paths.length)return;
  if(cache.size){await reader.release();return;}
  // Cold opening: fetch the release and ONLY this area's chunks in one snapshot/SELECT.
  const sql=`WITH current AS (SELECT value FROM app_state WHERE key='runtimeDocumentRelease')
SELECT 'release' AS kind,'' AS path,-1 AS seq,value AS data FROM current
UNION ALL
SELECT 'chunk',c.path,c.seq,c.data FROM current
JOIN json_each(current.value,'$.documents') d
JOIN runtime_document_chunks c ON c.path=json_extract(d.value,'$.path') AND c.content_hash=json_extract(d.value,'$.hash')
WHERE c.path IN (${paths.map(()=>'?').join(',')})`;
  let rows;try{rows=(await db.prepare(sql).bind(...paths).all()).results||[];}catch(error){reader={release:async()=>{throw error},get:async()=>{throw error}};throw error;}
  // Reuse the existing full hash/size/chunk verification against the pinned snapshot.
  reader=runtimeDocumentReader({prepare(){return{
   first:async()=>{const row=rows.find(r=>r.kind==='release');return row?{value:row.data}:null;},
   bind(path){return{all:async()=>({results:rows.filter(r=>r.kind==='chunk'&&r.path===path).sort((a,b)=>a.seq-b.seq)})};}
  };}});
  await reader.release();
 },async get(path){
  if(!path.startsWith('dist/v3/')||!allowed.has(path.slice(8)))return reader.get(path);
  const release=await reader.release(),record=release.documents.find(d=>d.path===path);
  if(!record||!Number.isFinite(record.bytes)||record.bytes>maxBytes)return reader.get(path);
  const key=path+'|'+record.hash;
  if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit.value;}
  const entry={bytes:record.bytes,value:reader.get(path)};
  // Evict old versions of this document, including when the release changes.
  for(const old of cache.keys())if(old.startsWith(path+'|'))cache.delete(old);
  cache.set(key,entry);
  while(cache.size>maxEntries||[...cache.values()].reduce((sum,v)=>sum+v.bytes,0)>maxBytes)cache.delete(cache.keys().next().value);
  try{return await entry.value;}catch(error){if(cache.get(key)===entry)cache.delete(key);throw error;}
 }};
}
