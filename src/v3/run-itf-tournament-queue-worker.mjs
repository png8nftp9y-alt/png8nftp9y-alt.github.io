import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {hash} from './itf-common.mjs';

const dir='dist/v3/shards/itf',worker=Number(process.env.ITF_QUEUE_WORKER||0),workers=Math.max(1,Number(process.env.ITF_QUEUE_WORKERS||2)),delay=Math.max(1000,Number(process.env.ITF_QUEUE_DELAY_MS||3000)),ids=new Set();
for(const file of await fs.readdir(dir))if(/^results-\d+\.json\.gz$/.test(file)){const data=JSON.parse(gunzipSync(await fs.readFile(`${dir}/${file}`)));for(const item of data.retryQueue||[])if(item.competitionId&&hash(item.competitionId)%workers===worker)ids.add(item.competitionId)}
const queue=[...ids].sort();let completed=0,failed=0;
for(const competitionId of queue){const run=spawnSync(process.execPath,['src/v3/retry-itf-result-queue-shard.mjs'],{stdio:'inherit',env:{...process.env,ITF_RETRY_COMPETITION_ID:competitionId}});if(run.status===0)completed++;else failed++;await new Promise(resolve=>setTimeout(resolve,delay))}
const summary={worker,workers,tournaments:queue.length,completed,failed,generatedAt:new Date().toISOString()};
await fs.writeFile(`dist/v3/itf-queue-worker-${worker}.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if(failed)process.exitCode=2;
