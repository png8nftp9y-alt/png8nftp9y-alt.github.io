import fs from 'node:fs/promises';
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
export async function continueRecovery({report,sourceRun,repo,token,request=fetch,log=console.log}){
 const decision=continuationDecision(report);log(JSON.stringify({sourceRun,decision,repaired:report.repaired,residual:report.after?.unresolved,runNumber:report.recoveryRunNumber}));
 if(decision!=='continue')return decision;
 const base='https://api.github.com/repos/'+repo,headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function api(path,options={}){const r=await request(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('recovery_continuation_github_'+r.status);return r;}
 const runs=await(await api('/actions/workflows/courtwatch-player-profile-live-repair.yml/runs?branch=main&per_page=100')).json();
 // An already queued recovery will read current residuals; do not add another copy.
 if(runs.workflow_runs.some(r=>String(r.id)!==String(sourceRun)&&['queued','pending','in_progress','waiting','requested'].includes(r.status))){log('recovery_already_scheduled');return 'already_scheduled';}
 await api('/actions/workflows/courtwatch-player-profile-live-repair.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});
 log('next_residual_recovery_dispatched');return 'dispatched';
}
async function main(){
 if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_WORKFLOW!=='Court Watch targeted official player profile recovery')throw Error('unexpected_recovery_context');
 let report;try{report=JSON.parse(await fs.readFile('tmp/live-profile-recovery/report.json','utf8'));}catch(error){if(error.code==='ENOENT'){console.log('recovery_audit_missing');return;}throw error;}
 await continueRecovery({report,sourceRun:process.env.GITHUB_RUN_ID,repo:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
