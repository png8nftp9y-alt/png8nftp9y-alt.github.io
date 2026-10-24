// Only verified public tournament catalogues are shared between requests.
// The release pointer is always read from D1; content hashes select the exact version.
const cataloguePaths=new Set(['dist/v3/tournaments.json','dist/v3/source_fitp_tournaments.json','dist/v3/source_tennis_europe_tournaments_sharded.json','dist/v3/source_itf_history_tournaments.json','dist/v3/source_itf_tournaments.json','history/itf_official_metadata.json']);
const catalogueCache=new Map(),catalogueLimit=8*1024*1024;
let catalogueBytes=0;
function rememberCatalogue(key,text){
 const size=text.length*2;
 if(size>catalogueLimit)return;
 while(catalogueBytes+size>catalogueLimit&&catalogueCache.size){const oldest=catalogueCache.keys().next().value;catalogueBytes-=catalogueCache.get(oldest).length*2;catalogueCache.delete(oldest);}
 catalogueCache.set(key,text);catalogueBytes+=size;
}
// Request-scoped D1-only reader. Never uses an HTTP or R2 fallback.
export function runtimeDocumentReader(db){
 let manifest;const pending=new Map();
 const release=()=>manifest??=(async()=>{const row=await db.prepare("SELECT value FROM app_state WHERE key='runtimeDocumentRelease'").first();if(!row?.value)throw Error('runtime_release_not_ready');const doc=JSON.parse(row.value);if(doc.version!==1||!Array.isArray(doc.documents)||doc.documents.length!==23)throw Error('runtime_release_incomplete');return doc;})();
 return {release,get(path){if(pending.has(path))return pending.get(path);const result=(async()=>{
  const snapshot=await release(),record=snapshot.documents.find(d=>d.path===path);if(!record)throw Error('runtime_document_not_published:'+path);
  const cacheKey=cataloguePaths.has(path)?path+'|'+record.hash+'|'+record.bytes:null;
  if(cacheKey&&catalogueCache.has(cacheKey)){const text=catalogueCache.get(cacheKey);catalogueCache.delete(cacheKey);catalogueCache.set(cacheKey,text);return JSON.parse(text);}
  const rows=(await db.prepare('SELECT seq,data FROM runtime_document_chunks WHERE path=? AND content_hash=? ORDER BY seq').bind(path,record.hash).all()).results||[];
  if(rows.length!==record.chunks||rows.some((r,i)=>r.seq!==i))throw Error('runtime_document_incomplete:'+path);
  const binary=atob(rows.map(r=>r.data).join('')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const decoded=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',decoded))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(decoded.length!==record.bytes||digest!==record.hash)throw Error('runtime_document_corrupt:'+path);
  const text=new TextDecoder().decode(decoded),document=JSON.parse(text);
  if(cacheKey&&!catalogueCache.has(cacheKey))rememberCatalogue(cacheKey,text);
  return document;
 })();pending.set(path,result);return result;}};
}
export const FRONTEND_DOCUMENTS=new Set(['players.json','tournaments.json','matches.json','agenda.json','results.json','opponents.json','tournament_entries.json','sync_status.json','diagnostics.json','manual_matches.json']);
