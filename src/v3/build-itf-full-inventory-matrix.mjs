import fs from 'node:fs/promises';
import {readJson} from './itf-common.mjs';

const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const batchSize=Math.max(1,Math.min(12,Number(process.env.ITF_INVENTORY_BATCH_SIZE||8)));
const rows=(catalog.tournaments||[]).filter(row=>row?.competitionId&&!/^GC$/i.test(String(row.category||''))).sort((a,b)=>String(a.competitionId).localeCompare(String(b.competitionId)));
const include=[];
for(let offset=0;offset<rows.length;offset+=batchSize)include.push({shard:include.length,competitionIds:rows.slice(offset,offset+batchSize).map(row=>row.competitionId).join(',')});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify({include})}\n`);
console.log(JSON.stringify({tournaments:rows.length,batchSize,shards:include.length},null,2));
