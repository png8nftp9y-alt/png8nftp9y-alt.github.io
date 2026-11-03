import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
import {createHash} from 'node:crypto';
// Scoped to this audit process. Live application reads and source markers are not cached.
export function auditReadSession(execute,{minimumIntervalMs=100,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now(),onFailure=()=>{}}={}){
 const cache=new Map(),metrics={requested:0,executed:0,cacheHits:0,failed:0};let tail=Promise.resolve(),lastStart=-Infinity;
 const perform=(sql,params=[])=>{
  metrics.requested++;const key=JSON.stringify([sql,params]);
  if(cache.has(key)){metrics.cacheHits++;return cache.get(key).then(structuredClone);}
  const task=tail.then(async()=>{const delay=minimumIntervalMs-(now()-lastStart);if(delay>0)await wait(delay);lastStart=now();metrics.executed++;try{return await execute(sql,params);}catch(error){metrics.failed++;onFailure({queryHash:createHash('sha256').update(sql).digest('hex').slice(0,16),error:String(error.message)});throw error;}});
  cache.set(key,task);tail=task.then(()=>{},()=>{});
  return task.then(structuredClone);
 };
 const {query,db}=createReadOnlyD1Client(perform);
 return{query,db,metrics,clear:()=>cache.clear()};
}
