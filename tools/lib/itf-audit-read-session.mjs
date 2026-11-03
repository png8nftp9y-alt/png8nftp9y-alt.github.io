import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
import {createHash} from 'node:crypto';
// Only exact content-addressed draw chunk reads may survive a verified checkpoint.
function immutableDraw(sql,params,rows){
 if(sql!== 'SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? ORDER BY chunk_index'||params.length!==2||!/^([a-f0-9]{64})$/.test(params[1])||!rows.length||rows.some((r,i)=>Number(r.chunk_index)!==i||typeof r.content!=='string'))return false;
 return createHash('sha256').update(rows.map(r=>r.content).join('')).digest('hex')===params[1];
}
// Scoped to this audit process. Live application reads and source markers are not cached.
export function auditReadSession(execute,{minimumIntervalMs=100,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),onFailure=()=>{}}={}){
 const cache=new Map(),immutable=new Set(),documents=new Map(),metrics={requested:0,executed:0,cacheHits:0,immutableCacheHits:0,failed:0};let tail=Promise.resolve(),lastStart=-Infinity;
 const perform=(sql,params=[])=>{
  metrics.requested++;const key=JSON.stringify([sql,params]);
  if(cache.has(key)){metrics.cacheHits++;if(immutable.has(key))metrics.immutableCacheHits++;return cache.get(key).then(structuredClone);}
  const task=tail.then(async()=>{const delay=minimumIntervalMs-(now()-lastStart);if(delay>0)await wait(delay);lastStart=now();metrics.executed++;try{const rows=await execute(sql,params);if(immutableDraw(sql,params,rows))immutable.add(key);
    const pageSql='SELECT chunk_index,content FROM itf_draw_document_chunks WHERE draw_key=? AND content_sha256=? AND chunk_index>=? ORDER BY chunk_index LIMIT 8';
    if(sql===pageSql&&params.length===3&&/^[a-f0-9]{64}$/.test(params[1])&&Number.isInteger(params[2])&&params[2]>=0&&rows.length<=8&&rows.every((r,i)=>Number(r.chunk_index)===params[2]+i&&typeof r.content==='string')){
     const docKey=JSON.stringify(params.slice(0,2)),pages=documents.get(docKey)||new Map();pages.set(params[2],{key,rows});documents.set(docKey,pages);
     const chunks=[],keys=[];let offset=0,complete=false;
     while(pages.has(offset)){const page=pages.get(offset);chunks.push(...page.rows);keys.push(page.key);if(page.rows.length<8){complete=true;break;}offset+=8;}
     if(complete&&createHash('sha256').update(chunks.map(r=>r.content).join('')).digest('hex')===params[1])for(const k of keys)immutable.add(k);
    }
    return rows;}catch(error){metrics.failed++;onFailure({queryHash:createHash('sha256').update(sql).digest('hex').slice(0,16),error:String(error.message)});throw error;}});
  cache.set(key,task);tail=task.then(()=>{},()=>{});
  return task.then(structuredClone);
 };
 const {query,db}=createReadOnlyD1Client(perform);
 return{query,db,metrics,clear:({retainVerifiedDraws=false}={})=>{documents.clear();for(const key of cache.keys())if(!retainVerifiedDraws||!immutable.has(key)){cache.delete(key);immutable.delete(key);}}};
}
