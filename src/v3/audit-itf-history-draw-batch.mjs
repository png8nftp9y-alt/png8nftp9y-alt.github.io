import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=process.env.ITF_DRAW_TASK_DIR||'dist/v3/shards/itf/draw-tasks';
const expected=Number(process.env.ITF_EXPECTED_TASKS||0);
const batch=String(process.env.ITF_BATCH||'');
const files=[];
async function walk(dir){
  let entries=[];
  try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{return}
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(full);
    else if(entry.name.endsWith('.json.gz'))files.push(full);
  }
}
await walk(root);
const docs=[],unreadable=[];
for(const file of files){
  try{docs.push(JSON.parse(gunzipSync(await fs.readFile(file))))}
  catch(error){unreadable.push({file,error:error.message})}
}
const byTask=new Map(docs.filter(d=>d?.taskId).map(d=>[d.taskId,d]));
const complete=[...byTask.values()].filter(d=>d.status==='complete');
const retry=[...byTask.values()].filter(d=>d.status!=='complete');
const causes=Object.entries(retry.reduce((a,d)=>{const k=d.error||d.status||'unknown';a[k]=(a[k]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).map(([error,count])=>({error,count}));
const audit={version:1,generatedAt:new Date().toISOString(),batch,expected,artifacts:files.length,uniqueTasks:byTask.size,complete:complete.length,retry:retry.length,missing:Math.max(0,expected-byTask.size),unreadable:unreadable.length,causes,retryTasks:retry.map(d=>({taskId:d.taskId,competitionId:d.competitionId,event:d.event,error:d.error||''})),unreadableFiles:unreadable};
await fs.mkdir('dist/v3/audits',{recursive:true});
await fs.writeFile(`dist/v3/audits/itf-history-draw-batch-${batch}.json`,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({...audit,retryTasks:undefined,unreadableFiles:undefined}));
if(audit.retry||audit.missing||audit.unreadable)process.exitCode=2;
