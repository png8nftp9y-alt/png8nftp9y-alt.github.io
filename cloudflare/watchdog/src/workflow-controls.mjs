const BASE='https://api.github.com/repos/png8nftp9y-alt/png8nftp9y-alt.github.io';
function headers(env){if(!env.COURTWATCH_GITHUB_TOKEN)throw Error('workflow_control_unconfigured');return {Accept:'application/vnd.github+json',Authorization:'Bearer '+env.COURTWATCH_GITHUB_TOKEN,'User-Agent':'courtwatch-workflow-controls','X-GitHub-Api-Version':'2022-11-28'};}
export async function listWorkflowControls(env,fetcher=fetch){
 const workflows=[];
 for(let page=1;page<=10;page++){
  const response=await fetcher(`${BASE}/actions/workflows?per_page=100&page=${page}`,{headers:headers(env),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('workflow_controls_read:'+response.status);
  const data=await response.json();
  if(!Array.isArray(data.workflows)||!Number.isInteger(data.total_count))throw Error('workflow_controls_invalid');
  for(const item of data.workflows){
   if(!Number.isSafeInteger(item.id)||item.id<=0||typeof item.name!=='string'||typeof item.state!=='string')throw Error('workflow_controls_invalid');
   workflows.push({id:item.id,name:item.name,path:item.path||'',state:item.state,url:`https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/workflows/${item.id}`});
  }
  if(workflows.length===data.total_count){
   if(new Set(workflows.map(w=>w.id)).size!==workflows.length)throw Error('workflow_controls_changed');
   return workflows.sort((a,b)=>a.name.localeCompare(b.name));
  }
  if(!data.workflows.length||workflows.length>data.total_count)throw Error('workflow_controls_changed');
 }
 throw Error('workflow_controls_incomplete');
}
export async function setWorkflowEnabled(env,{id,enabled,expectedState},fetcher=fetch){
 if(!Number.isSafeInteger(id)||id<=0||typeof enabled!=='boolean'||!['active','disabled_manually','disabled_inactivity'].includes(expectedState))throw Error('workflow_control_invalid');
 const get=()=>fetcher(`${BASE}/actions/workflows/${id}`,{headers:headers(env),redirect:'manual',signal:AbortSignal.timeout(15000)});
 const before=await get();if(!before.ok)throw Error('workflow_controls_read:'+before.status);
 const current=await before.json();
 if(current.id!==id||!String(current.path||'').startsWith('.github/workflows/'))throw Error('workflow_control_invalid');
 if(current.state!==expectedState)throw Error('workflow_control_conflict');
 const desired=enabled?'active':'disabled_manually';
 if(current.state===desired)return {id,state:desired,changed:false};
 const response=await fetcher(`${BASE}/actions/workflows/${id}/${enabled?'enable':'disable'}`,{method:'PUT',headers:headers(env),redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response.status!==204)throw Error('workflow_control_write:'+response.status);
 const after=await get();if(!after.ok)throw Error('workflow_control_verify:'+after.status);
 const result=await after.json();if(result.id!==id||result.state!==desired)throw Error('workflow_control_unverified');
 return {id,state:desired,changed:true};
}
