import fs from 'node:fs/promises';
import path from 'node:path';
import {writeJson} from './itf-common.mjs';

const root=process.argv[2]||'/tmp/itf-rr-groups',files=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.json'))files.push(full)}}
await walk(root);
const rows=[];for(const file of files){const doc=JSON.parse(await fs.readFile(file,'utf8'));rows.push(...(doc.outcomes||[]))}
const events=new Map();
for(const row of rows){if(!row.event)continue;const key=`${row.competitionId}|${row.event}`,value=events.get(key)||{competitionId:row.competitionId,event:row.event,declaredGroups:0,groups:[],errors:[]};value.declaredGroups=Math.max(value.declaredGroups,Number(row.declaredGroups||0));if(row.present)value.groups.push({group:row.group,matches:row.matches,data:row.data});if(row.error)value.errors.push({group:row.group,error:row.error});events.set(key,value)}
const results=[...events.values()].map(value=>{const groups=value.groups.sort((a,b)=>a.group-b.group),expected=Array.from({length:value.declaredGroups},(_,index)=>index+1),present=new Set(groups.map(item=>item.group)),missingGroups=expected.filter(group=>!present.has(group));return{...value,groups,missingGroups,matches:groups.reduce((sum,item)=>sum+item.matches,0),complete:value.declaredGroups>0&&!missingGroups.length&&groups.every(item=>item.matches>0)}});
const report={generatedAt:new Date().toISOString(),branches:8,events:results,status:results.length>0&&results.every(row=>row.complete)?'green':'red'};
await writeJson('dist/v3/audits/itf-round-robin-8-branch.json',report);
console.log(JSON.stringify(report,null,2));
if(report.status!=='green')process.exitCode=2;
