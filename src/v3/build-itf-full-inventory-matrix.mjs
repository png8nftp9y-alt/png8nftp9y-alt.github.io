import fs from 'node:fs/promises';
import {readJson} from './itf-common.mjs';

const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const previous=process.env.ITF_AUDIT_STATE_FILE?await readJson(process.env.ITF_AUDIT_STATE_FILE,{tournaments:[]}):{tournaments:[]};
const previousIds=new Set((previous.tournaments||[]).map(row=>String(row.competitionId||'').toUpperCase()));
const retryIds=new Set((previous.tournaments||[]).filter(row=>row.classification==='unverifiable').map(row=>String(row.competitionId||'').toUpperCase()));
const batchSize=Math.max(1,Math.min(12,Number(process.env.ITF_INVENTORY_BATCH_SIZE||5)));
const rows=(catalog.tournaments||[]).filter(row=>row?.competitionId&&!/^GC$/i.test(String(row.category||''))).sort((a,b)=>String(a.competitionId).localeCompare(String(b.competitionId)));
const targets=previousIds.size?rows.filter(row=>{const id=String(row.competitionId).toUpperCase();return retryIds.has(id)||!previousIds.has(id)}):rows;
const include=[];
for(let offset=0;offset<targets.length;offset+=batchSize)include.push({shard:include.length,competitionIds:targets.slice(offset,offset+batchSize).map(row=>row.competitionId).join(',')});
if(!include.length)include.push({shard:0,competitionIds:''});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify({include})}\n`);
console.log(JSON.stringify({catalog:rows.length,previouslyUnverifiable:retryIds.size,targets:targets.length,batchSize,shards:include.length},null,2));
