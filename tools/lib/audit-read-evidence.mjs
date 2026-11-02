import {createHash} from 'node:crypto';
import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Evidence contains hashes only; SQL, private parameters and rows are never published.
export function auditReadEvidence(execute){
 const reads=new Map();
 const {query,db}=createReadOnlyD1Client(async(sql,params=[])=>{
  const rows=await execute(sql,params),key=JSON.stringify([sql,params]);
  if(!reads.has(key))reads.set(key,{sql,params:structuredClone(params),hash:hash(rows)});
  return rows;
 });
 async function verify({wait=ms=>new Promise(r=>setTimeout(r,ms)),onProgress=()=>{},recoverD1Reset=false,onRecovery=()=>{}}={}){
  const changed=[];let checked=0,recoveries=0;
  for(const [key,r] of reads){
   if(checked)await wait(100);
   let rows;
   try{rows=await execute(r.sql,r.params);}catch(error){
    if(!recoverD1Reset||recoveries!==0||String(error.message)!=='diagnostic_d1_request_failed:http_500:codes_7500')throw error;
    recoveries++;onRecovery({queryHash:hash(key),attempt:recoveries,reason:'D1_7500'});
    await wait(250);
    rows=await execute(r.sql,r.params);
   }
   if(hash(rows)!==r.hash)changed.push(hash(key));
   checked++;if(checked%100===0)onProgress({checked,total:reads.size});
  }
  return{checked,changedQueries:changed,stable:changed.length===0,recoveries};
 }
 return{query,db,verify};
}
