import {createHash} from 'node:crypto';
// CLI replay only. One attempt per SELECT, with bounded REST pressure.
export function readOnlyReplayDb(execute,{limit=2,log=()=>{}}={}){
 if(!Number.isInteger(limit)||limit<1)throw Error('invalid_read_concurrency');
 let active=0,queries=0,failure=null;const queue=[];
 const emit=value=>{try{log(value)}catch{}};
 function pump(){
  while(!failure&&active<limit&&queue.length){
   const job=queue.shift(),query=++queries,started=Date.now();active++;
   const tag={query,table:job.sql.match(/\bFROM\s+([\w]+)/i)?.[1]||'select',fingerprint:createHash('sha256').update(job.sql).digest('hex').slice(0,16),params:job.params.length,sqlBytes:Buffer.byteLength(job.sql),queueMs:started-job.queuedAt,active};
   Promise.resolve().then(()=>execute(job.sql,job.params)).then(result=>{
    emit({...tag,status:'success',ms:Date.now()-started,rows:result.results?.length||0});job.resolve(result);
   },error=>{
    failure=error;emit({...tag,status:'failure',code:error?.code===7500||/\b7500\b/.test(String(error?.message||''))?7500:'query_failed',ms:Date.now()-started});
    job.reject(error);for(const queued of queue.splice(0))queued.reject(error);
   }).finally(()=>{active--;pump()});
  }
 }
 function select(sql,params){
  if(!/^\s*(SELECT|WITH)\b/i.test(sql))return Promise.reject(Error('read_only_guard'));
  if(failure)return Promise.reject(failure);
  return new Promise((resolve,reject)=>{queue.push({sql,params:[...params],queuedAt:Date.now(),resolve,reject});pump()});
 }
 function statement(sql,params=[]){return{bind:(...values)=>statement(sql,values),all:()=>select(sql,params),first:async()=>(await select(sql,params)).results?.[0]||null,run(){throw Error('read_only_guard')}};}
 return {prepare:sql=>statement(sql),batch(){throw Error('read_only_guard')},get queries(){return queries},get failure(){return failure}};
}
