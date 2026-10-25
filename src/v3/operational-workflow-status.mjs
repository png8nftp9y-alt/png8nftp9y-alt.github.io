export const operationalTargets=[
 ['Deploy watchdog Cloudflare','courtwatch-cloudflare-watchdog-deploy.yml',1e9],['ITF sicurezza 120 giorni','courtwatch-v3-itf-safety-120d.yml',1800],['FITP pubblicazione catalogo','courtwatch-v3-fitp-tournaments-sharded.yml',1560],['FITP motore live','courtwatch-v3-fitp-entries.yml',45],['Europe motore live','courtwatch-v3-tennis-europe-live.yml',45],['ITF discovery e R2','courtwatch-v3-itf-live.yml',45],['ITF labels e R2','courtwatch-v3-itf-known-fast.yml',45],['ITF T−1 e R2','courtwatch-v3-itf-t-minus-one.yml',45],['Agenda/OOP Europe','courtwatch-tennis-europe-oop-live.yml',45],['D1 generale','courtwatch-cloudflare-app-api.yml',45],['D1 agenda Europe','courtwatch-tennis-europe-agenda.yml',45]
];
const compact=run=>run?Object.fromEntries(['id','name','path','status','conclusion','created_at','updated_at','html_url','display_title'].map(k=>[k,run[k]??null])):null;
const file=r=>String(r?.path||'').split('/').at(-1);
const newer=(a,b)=>!b||Date.parse(a.created_at||'')>Date.parse(b.created_at||'')||a.id>b.id;
export async function collectWorkflowStatus({catalog,previous={},event={},repo,token,fetcher=fetch,now=new Date().toISOString()}){
 const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json'};
 async function request(path){const r=await fetcher('https://api.github.com/repos/'+repo+path,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub HTTP '+r.status);return r.json();}
 let recent=[],runsError=null;try{recent=(await request('/actions/runs?branch=main&per_page=100')).workflow_runs||[];}catch(e){runsError=e.message;}
 const old=new Map((previous.workflowStates||previous.items||[]).map(x=>[x.workflow,x]));
 const observed=new Map();for(const run of [...recent,...(event.workflow_run?[event.workflow_run]:[])]){const key=file(run);if(!observed.has(key)||newer(run,observed.get(key))||run.id===observed.get(key).id)observed.set(key,run);}
 const core=new Map(operationalTargets.map(x=>[x[1],x]));let next=0;const states=new Array(catalog.length);
 async function worker(){while(next<catalog.length){const index=next++,entry=catalog[index],prior=old.get(entry.workflow),target=core.get(entry.workflow);let run=prior?.latestRun,checkedAt=prior?.checkedAt,error=null,completed=prior?.completedRun;
  const current=observed.get(entry.workflow);if(current&&(!run||newer(current,run)||current.id===run.id)){run=current;checkedAt=now;}
  // Core motors retain exact per-workflow checks. Other workflows are seeded once;
  // later event/recent evidence updates them without re-fetching the whole archive.
  if(target||!prior){try{const list=(await request('/actions/workflows/'+entry.workflow+'/runs?branch=main&per_page='+(target?'30':'1'))).workflow_runs||[];
   if(list[0]&&(!run||newer(list[0],run)||list[0].id===run.id))run=list[0];
   completed=list.find(x=>x.status==='completed'&&!['cancelled','skipped'].includes(x.conclusion))||completed;checkedAt=now;
  }catch(e){error=e.message;}}
  if(run?.status==='completed'&&!['cancelled','skipped'].includes(run.conclusion)&&(!completed||newer(run,completed)||run.id===completed.id))completed=run;
  states[index]={workflow:entry.workflow,label:target?.[0]||entry.label,latestRun:compact(run),completedRun:compact(completed),checkedAt,error};
 }}
 await Promise.all(Array.from({length:Math.min(4,catalog.length)},worker));
 const items=operationalTargets.map(([label,workflow,maxAge])=>{const state=states.find(x=>x.workflow===workflow),run=state?.completedRun,age=run?(Date.parse(now)-Date.parse(run.updated_at))/60000:Infinity;return{label,workflow,critical:true,status:state?.error||!run?'yellow':run.conclusion!=='success'?'red':age>maxAge?'yellow':'green',latestRun:state?.latestRun,completedRun:run,checkedAt:state?.checkedAt,runId:run?.id||null,url:run?.html_url||null,generatedAt:run?.updated_at||null,detail:(state?.error||run?.conclusion||'nessuna verifica')+' · '+(Number.isFinite(age)?Math.round(age)+' min fa':'data n/d')};});
 return{generatedAt:now,items,workflowStates:states,runs:recent.map(compact),runsError};
}
