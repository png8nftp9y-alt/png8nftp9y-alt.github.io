import {assertReadOnlyQuery} from './read-only-d1-query.mjs';
// Snapshot-local grouping only. No in-flight barrier, cache, timer or retry.
export function historyReadDb(db,{limit=6}={}){
 if(!Number.isInteger(limit)||limit<1)throw Error('history_batch_limit');
 const ready=new Map();let scheduled=false;
 async function dispatch(sql,jobs){
  try{
   if(jobs.length===1){jobs[0].resolve(await db.prepare(sql).bind(...jobs[0].params).all());return}
   const combined=jobs.map((_,i)=>`SELECT ${i} AS __cw_history_slot,h.* FROM (${sql}) h`).join(' UNION ALL ');
   const result=await db.prepare(combined).bind(...jobs.flatMap(j=>j.params)).all();
   if(result.success===false||!Array.isArray(result.results))throw Error('history_group_incomplete');
   const rows=jobs.map(()=>[]);
   for(const item of result.results){const {__cw_history_slot:slot,...row}=item;if(!Number.isInteger(slot)||!rows[slot])throw Error('history_group_incomplete');rows[slot].push(row)}
   jobs.forEach((job,i)=>job.resolve({success:true,results:rows[i]}));
  }catch(error){for(const job of jobs)job.reject(error)}
 }
 function flush(){
  scheduled=false;const groups=[...ready];ready.clear();
  for(const [sql,jobs]of groups){
   let group=[],params=0;
   for(const job of jobs){
    if(group.length&&(group.length>=limit||params+job.params.length>90||(sql.length+80)*(group.length+1)>80000)){void dispatch(sql,group);group=[];params=0}
    group.push(job);params+=job.params.length;
   }
   if(group.length)void dispatch(sql,group);
  }
 }
 function statement(sql,params=[]){return{
  bind:(...values)=>statement(sql,[...values]),all(){
   try{assertReadOnlyQuery(sql)}catch{return Promise.reject(Error('history_read_only'))}
   if(!/\bFROM match_participants\b/.test(sql))return db.prepare(sql).bind(...params).all();
   return new Promise((resolve,reject)=>{const jobs=ready.get(sql)||[];jobs.push({params,resolve,reject});ready.set(sql,jobs);if(!scheduled){scheduled=true;queueMicrotask(flush)}});
  },async first(){return(await this.all()).results[0]||null},run(){throw Error('history_read_only')}
 }};
 return{prepare:sql=>statement(sql)};
}
