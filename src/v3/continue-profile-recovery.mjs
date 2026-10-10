import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function continuationDecision(report){
 if(report.recoverySeries!=='europe-profile-20261010')return 'different_series';
 if(!Number.isInteger(report.recoveryRunNumber)||report.recoveryRunNumber<2||report.recoveryRunNumber>=9)return 'bounded_series_finished';
 if(report.status!=='unresolved_official_evidence')return 'not_residual_audit';
 if(report.mapping?.status!=='ready'||report.mapping.pending!==0)return 'mapping_not_verified';
 if(!Number.isInteger(report.before)||!Number.isInteger(report.after?.unresolved)||report.after.unresolved<=0)return 'no_verified_residual';
 if(!(report.repaired>0&&report.after.unresolved<report.before))return 'no_verified_progress';
 return 'continue';
}
async function main(){
 const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8')),run=event.workflow_run,repo=process.env.GITHUB_REPOSITORY;
 if(!run||run.name!=='Court Watch targeted official player profile recovery'||run.conclusion!=='failure'||run.head_branch!=='main'||run.head_repository.full_name!==repo)throw Error('unexpected_recovery_event');
 const base='https://api.github.com/repos/'+repo,headers={Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function api(path,options={}){const r=await fetch(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('recovery_continuation_github_'+r.status);return r;}
 const artifacts=await(await api('/actions/runs/'+run.id+'/artifacts?per_page=100')).json();
 const artifact=artifacts.artifacts.find(a=>a.name==='targeted-player-profile-recovery'&&!a.expired);if(!artifact)throw Error('recovery_audit_artifact_missing');
 const bytes=Buffer.from(await(await api('/actions/artifacts/'+artifact.id+'/zip')).arrayBuffer());if(bytes.length>20000000)throw Error('recovery_audit_artifact_oversize');
 const file='tmp-recovery-'+run.id+'.zip';await fs.writeFile(file,bytes);
 const report=JSON.parse(execFileSync('unzip',['-p',file,'report.json'],{maxBuffer:20000000,encoding:'utf8'}));
 const decision=continuationDecision(report);console.log(JSON.stringify({sourceRun:run.id,decision,repaired:report.repaired,residual:report.after?.unresolved,runNumber:report.recoveryRunNumber}));
 if(decision!=='continue')return;
 const runs=await(await api('/actions/workflows/courtwatch-player-profile-live-repair.yml/runs?branch=main&per_page=100')).json();
 // An already queued recovery will read current residuals; do not add another copy.
 if(runs.workflow_runs.some(r=>['queued','pending','in_progress','waiting','requested'].includes(r.status))){console.log('recovery_already_scheduled');return;}
 await api('/actions/workflows/courtwatch-player-profile-live-repair.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});
 console.log('next_residual_recovery_dispatched');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
