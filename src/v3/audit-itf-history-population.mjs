import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=process.env.ITF_HISTORY_AUDIT_ROOT||'dist/v3/shards/itf/draw-tasks',expected=Number(process.env.ITF_EXPECTED_TASKS||4291),files=[];
async function walk(dir){let items=[];try{items=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const item of items){const full=path.join(dir,item.name);if(item.isDirectory())await walk(full);else if(item.name.endsWith('.json.gz'))files.push(full)}}
await walk(root);
const byTask=new Map(),unreadable=[];
for(const file of files)try{const doc=JSON.parse(gunzipSync(await fs.readFile(file)));if(doc?.taskId)byTask.set(doc.taskId,doc);else unreadable.push({file,error:'taskId_missing'})}catch(error){unreadable.push({file,error:error.message})}
const docs=[...byTask.values()],retry=docs.filter(doc=>doc.status!=='complete'),complete=docs.filter(doc=>doc.status==='complete'),emptyPlayers=complete.filter(doc=>!(doc.players||[]).length),emptyPlayersAndMatches=emptyPlayers.filter(doc=>!(doc.matches||[]).length),playersWithoutMatches=complete.filter(doc=>(doc.players||[]).length&&!(doc.matches||[]).length),missing=Math.max(0,expected-byTask.size);
const item=doc=>({taskId:doc.taskId,competitionId:doc.competitionId,event:doc.event,players:(doc.players||[]).length,matches:(doc.matches||[]).length,status:doc.status,error:doc.error||''});
const report={version:1,generatedAt:new Date().toISOString(),criterion:'populated_requires_at_least_one_player',status:missing||retry.length||unreadable.length?'history_population_audit_incomplete_inputs':emptyPlayers.length?'history_contains_empty_draws':'history_all_draws_populated',expected,files:files.length,uniqueTasks:byTask.size,complete:complete.length,retry:retry.length,missing,unreadable:unreadable.length,populated:complete.length-emptyPlayers.length,emptyPlayers:emptyPlayers.length,emptyPlayersAndMatches:emptyPlayersAndMatches.length,playersWithoutMatches:playersWithoutMatches.length,emptyDraws:emptyPlayers.map(item),retryTasks:retry.map(item),unreadableFiles:unreadable};
await fs.mkdir('dist/v3/audits',{recursive:true});await fs.writeFile('dist/v3/audits/itf-history-population-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,emptyDraws:undefined,retryTasks:undefined,unreadableFiles:undefined},null,2));
if(missing||retry.length||unreadable.length)process.exitCode=2;
