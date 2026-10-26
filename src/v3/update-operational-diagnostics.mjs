import fs from 'node:fs/promises';
import {collectWorkflowStatus} from './operational-workflow-status.mjs';
const catalog=[];
for(const workflow of (await fs.readdir('.github/workflows')).filter(p=>p.endsWith('.yml')||p.endsWith('.yaml')).sort()){
 const source=await fs.readFile('.github/workflows/'+workflow,'utf8');const label=source.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'')||workflow;catalog.push({workflow,label});
}
const read=async(path,fallback)=>{try{return JSON.parse(await fs.readFile(path,'utf8'))}catch{return fallback}};
const previous=await read('dist/v3/operational_status.json',{}),event=process.env.GITHUB_EVENT_PATH?await read(process.env.GITHUB_EVENT_PATH,{}):{};
const report=await collectWorkflowStatus({catalog,previous,event,repo:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN});
await fs.mkdir('dist/v3',{recursive:true});await fs.writeFile('dist/v3/operational_status.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({items:report.items,workflows:report.workflowStates.length,runsError:report.runsError}));
