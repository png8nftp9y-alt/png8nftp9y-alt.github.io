import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {TODAY,HISTORY_FROM,hash,readJson} from './itf-common.mjs';

const worker=Number(process.env.ITF_HISTORY_WORKER||0),workers=Math.max(1,Number(process.env.ITF_HISTORY_WORKERS||32));
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const queue=(map.tournaments||[]).filter(t=>t.endDate>=HISTORY_FROM&&t.endDate<TODAY&&hash(t.competitionId)%workers===worker).sort((a,b)=>a.endDate.localeCompare(b.endDate));
let complete=0,incomplete=0,timedOut=0;
for(const t of queue){const run=spawnSync(process.execPath,['src/v3/scan-itf-history-tournament.mjs'],{stdio:'inherit',timeout:Number(process.env.ITF_TOURNAMENT_TIMEOUT_MS||240000),env:{...process.env,ITF_COMPETITION_ID:t.competitionId}});if(run.error?.code==='ETIMEDOUT')timedOut++;else if(run.status===0)complete++;else incomplete++}
const summary={worker,workers,assigned:queue.length,complete,incomplete,timedOut,generatedAt:new Date().toISOString()};
await fs.mkdir('dist/v3/shards/itf/history-workers',{recursive:true});await fs.writeFile(`dist/v3/shards/itf/history-workers/worker-${worker}.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
if(incomplete||timedOut)process.exitCode=2;
