// D1_READ_ONLY: replay existing GET snapshots through readOnlyReplayDb; no writes or workflow dispatch.
import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {inspectObservedItfHistory} from './lib/observed-itf-history-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('audit_phase_required');
const directory=path.join(root,'cloudflare/app-api/tmp');await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'observed-itf-history-'+phase+'.json');
try{
 const snapshots={};
 for(const group of ['main','others']){
  const snapshot=path.join(directory,'itf-audit-snapshot-'+group+'.json');
  const run=spawnSync(process.execPath,['tools/replay-others-real-snapshot.mjs'],{cwd:root,env:{...process.env,COURTWATCH_REPLAY_GROUP:group,COURTWATCH_OTHERS_SNAPSHOT_PATH:snapshot},encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
  const summary=run.stdout?.split('\n').find(x=>x.startsWith('OTHERS_READ_ONLY_RESULT='));if(summary)console.log(group+': '+summary);
  if(run.status!==0)throw Error('live_snapshot_read_failed:'+group);
  snapshots[group]=JSON.parse(await fs.readFile(snapshot));await fs.rm(snapshot,{force:true});
 }
 const registry=JSON.parse(gunzipSync(await fs.readFile(path.join(root,'history/itf-confirmed-draw-presences.json.gz'))));
 const source=await fs.readFile(path.join(root,phase==='before'?'tools/fixtures/itf-profile-eligibility-before-permanent.js':'v3.js'),'utf8');const result={phase,checkedAt:new Date().toISOString(),...inspectObservedItfHistory(snapshots,registry.entries,source)};
 if(phase==='after'){
  let before;try{before=JSON.parse(await fs.readFile(path.join(directory,'observed-itf-history-before.json')));}catch{}
  const key=e=>[e.group,e.nativeId,e.competitionId].join('|'),remaining=new Set(result.missing.map(key));
  result.recoveredCases=(before?.missing||[]).filter(e=>!remaining.has(key(e)));
 }
 await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');console.log('OBSERVED_ITF_HISTORY='+JSON.stringify(result));
 if(phase==='after'&&result.status!=='complete')process.exitCode=1;
}catch(error){const result={phase,status:'not_verified',error:error.message};await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');console.log('OBSERVED_ITF_HISTORY='+JSON.stringify(result));if(phase==='after')process.exitCode=1;}
