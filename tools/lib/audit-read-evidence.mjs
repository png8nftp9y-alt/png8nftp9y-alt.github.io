import {createHash} from 'node:crypto';
import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Evidence contains hashes only; SQL, private parameters and rows are never published.
export function auditReadEvidence(execute,{recoverD1Reset:recoverAllReads=false,recoveryBudget=1,wait:recoveryWait=ms=>new Promise(r=>setTimeout(r,ms)),onRecovery:recoveryNotice=()=>{}}={}){
 if(!Number.isInteger(recoveryBudget)||recoveryBudget<0||recoveryBudget>3)throw Error('invalid_audit_recovery_budget');
 const recoveryMetrics={used:0,budget:recoveryBudget};
 async function executeRead(sql,params,phase){
  try{return await execute(sql,params);}catch(error){
   if(!recoverAllReads||recoveryMetrics.used>=recoveryBudget||String(error?.message)!=='diagnostic_d1_request_failed:http_500:codes_7500')throw error;
   recoveryMetrics.used++;
   recoveryNotice({phase,queryHash:hash(JSON.stringify([sql,params])),attempt:recoveryMetrics.used,reason:'D1_7500'});
   await recoveryWait(250);
   return execute(sql,params);
  }
 }
 const reads=new Map();
 const {query,db}=createReadOnlyD1Client(async(sql,params=[])=>{
  const rows=await executeRead(sql,params,'capture'),key=JSON.stringify([sql,params]);
  if(!reads.has(key))reads.set(key,{sql,params:structuredClone(params),hash:hash(rows)});
  return rows;
 });
 async function verify({wait=ms=>new Promise(r=>setTimeout(r,ms)),onProgress=()=>{},recoverD1Reset=false,onRecovery=()=>{},clearAfterVerification=false,concurrency=1}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('invalid_verification_concurrency');
  const changed=[],changedReads=[];let checked=0,recoveries=0;
  const pending=[...reads];let cursor=0,failure;
  async function work(){while(!failure&&cursor<pending.length){
   const index=cursor++,[key,r]=pending[index];
   if(index)await wait(100);
   if(failure)return;
   try{
   let rows;
   try{rows=await executeRead(r.sql,r.params,'verification');}catch(error){
    if(recoverAllReads||!recoverD1Reset||recoveries!==0||String(error.message)!=='diagnostic_d1_request_failed:http_500:codes_7500')throw error;
    recoveries++;onRecovery({queryHash:hash(key),attempt:recoveries,reason:'D1_7500'});
    await wait(250);
    rows=await execute(r.sql,r.params);
   }
   if(hash(rows)!==r.hash){const queryHash=hash(key);changed.push(queryHash);changedReads.push({queryHash,tables:[...new Set([...r.sql.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g,' ').matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)].map(m=>m[1]))].sort()});}
   checked++;if(checked%100===0)onProgress({checked,total:reads.size});
   }catch(error){failure??=error;}
  }}
  await Promise.all(Array.from({length:Math.min(concurrency,pending.length)},()=>work()));
  if(failure)throw failure;
  if(clearAfterVerification)reads.clear();
  return{checked,changedQueries:changed,changedReads,stable:changed.length===0,recoveries:recoverAllReads?recoveryMetrics.used:recoveries};
 }
 return{query,db,verify,recoveryMetrics};
}
