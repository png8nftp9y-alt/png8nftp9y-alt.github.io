import fs from 'node:fs/promises';
import {readJson} from './itf-common.mjs';

const previous=process.env.ITF_AUDIT_STATE_FILE?await readJson(process.env.ITF_AUDIT_STATE_FILE,{tournaments:[]}):{tournaments:[]};
const baseline=await readJson('src/v3/itf-audit-baseline-20261001.json',{tournaments:[]});
if(baseline.tournaments.length!==1031)throw new Error('ITF_baseline_missing_or_invalid');
const previousById=new Map((previous.tournaments||[]).map(row=>[String(row.competitionId||'').toUpperCase(),row]));
const rows=baseline.tournaments;
const targets=rows.filter(row=>{const prior=previousById.get(row.competitionId)||row;return prior.classification==='unverifiable'||!['inventoried','empty_inventory'].includes(prior.status)});
const batchSize=Math.max(1,Math.min(12,Number(process.env.ITF_INVENTORY_BATCH_SIZE||5)));
const include=[];
for(let offset=0;offset<targets.length;offset+=batchSize)include.push({shard:include.length,competitionIds:targets.slice(offset,offset+batchSize).map(row=>row.competitionId).join(',')});
if(!include.length)include.push({shard:0,competitionIds:''});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify({include})}\n`);
console.log(JSON.stringify({catalog:rows.length,targets:targets.length,excludedFutureUnverifiable:0,batchSize,shards:include.length},null,2));
