import fs from 'node:fs/promises';
const targets=[
 ['FITP pubblicazione catalogo','courtwatch-v3-fitp-tournaments-sharded.yml',1560],
 ['FITP motore live','courtwatch-v3-fitp-entries.yml',45],
 ['Europe motore live','courtwatch-v3-tennis-europe-live.yml',45],
 ['ITF discovery e R2','courtwatch-v3-itf-live.yml',45],
 ['ITF labels e R2','courtwatch-v3-itf-known-fast.yml',45],
 ['ITF T−1 e R2','courtwatch-v3-itf-t-minus-one.yml',45],
 ['Agenda/OOP Europe','courtwatch-tennis-europe-oop-live.yml',45],
 ['D1 generale','courtwatch-cloudflare-app-api.yml',45],
 ['D1 agenda Europe','courtwatch-tennis-europe-agenda.yml',45]
];
const items=await Promise.all(targets.map(async([label,workflow,maxAge])=>{
 try{
  const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?branch=main&per_page=30`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('GitHub HTTP '+response.status);
  const runs=(await response.json()).workflow_runs||[];
  const completed=runs.find(r=>r.status==='completed'&&!['cancelled','skipped'].includes(r.conclusion));
  const active=runs.find(r=>r.status!=='completed');
  const age=completed?(Date.now()-Date.parse(completed.updated_at))/60000:Infinity;
  const status=!completed?'yellow':completed.conclusion!=='success'?'red':age>maxAge?'yellow':'green';
  return {label,status,critical:true,workflow,runId:completed?.id||null,url:completed?.html_url||null,checkedAt:new Date().toISOString(),detail:`${completed?.conclusion||'nessuna verifica'} · ${Number.isFinite(age)?Math.round(age)+' min fa':'data n/d'}${active?' · nuova esecuzione in corso':''}`};
 }catch(error){return {label,status:'yellow',critical:true,workflow,detail:String(error)}}
}));
await fs.mkdir('dist/v3',{recursive:true});
await fs.writeFile('dist/v3/operational_status.json',JSON.stringify({generatedAt:new Date().toISOString(),items},null,2)+'\n');
console.log(JSON.stringify(items));
