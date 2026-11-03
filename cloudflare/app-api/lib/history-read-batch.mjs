import {assertReadOnlyQuery} from './read-only-d1-query.mjs';
// One snapshot only: group ready history SELECTs, never cache data or retry.
export function historyReadDb(db,{limit=6}={}){
 if(!Number.isInteger(limit)||limit<1)throw Error('history_batch_limit');
 const batch=typeof db.readOnlyBatch==='function'?s=>db.readOnlyBatch(s):typeof db.batch==='function'?s=>db.batch(s):null;
 if(!batch)return db;
 const queue=[];let scheduled=false,active=false,failure=null;
 const schedule=()=>{if(!scheduled&&!active&&queue.length){scheduled=true;queueMicrotask(flush)}};
 async function flush(){
  scheduled=false;if(active||!queue.length)return;active=true;
  const jobs=queue.splice(0,limit);
  try{
   const results=jobs.length===1?[await jobs[0].statement.all()]:await batch(jobs.map(j=>j.statement));
   if(!Array.isArray(results)||results.length!==jobs.length||results.some(r=>!r||r.success===false||!Array.isArray(r.results)))throw Error('history_batch_incomplete');
   jobs.forEach((job,i)=>job.resolve(results[i]));
  }catch(error){failure=error;for(const job of [...jobs,...queue.splice(0)])job.reject(error)}
  finally{active=false;schedule()}
 }
 function statement(sql,values=[]){
  const original=()=>db.prepare(sql).bind(...values);
  return{bind:(...params)=>statement(sql,[...params]),all(){
   try{assertReadOnlyQuery(sql)}catch{return Promise.reject(Error('history_read_only'))}
   // Optional identity lookups keep their original isolated error semantics.
   if(!/\bFROM match_participants\b/.test(sql))return original().all();
   if(failure)return Promise.reject(failure);
   return new Promise((resolve,reject)=>{queue.push({statement:original(),resolve,reject});schedule()});
  },async first(){return(await this.all()).results[0]||null},run(){throw Error('history_read_only')}};
 }
 return{prepare:sql=>statement(sql)};
}
