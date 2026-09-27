import fs from 'node:fs/promises';
import {TODAY,readJson,writeJson} from './itf-common.mjs';

const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const pending=Object.values(state.tournaments||{})
  .filter(t=>t?.decision==='pending'&&t.competitionId&&t.endDate&&t.endDate<TODAY)
  .sort((a,b)=>String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))||String(a.competitionId).localeCompare(String(b.competitionId)));
const selected=pending.slice(0,2);
const competitionIds=selected.map(t=>String(t.competitionId).toUpperCase());
await writeJson('dist/v3/itf_t1_extraordinary_batch.json',{
  version:1,
  generatedAt:new Date().toISOString(),
  today:TODAY,
  pendingConcluded:pending.length,
  selected:selected.map(t=>({competitionId:t.competitionId,tournamentName:t.tournamentName||'',endDate:t.endDate,checkedAt:t.checkedAt||null}))
});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`competition_ids=${competitionIds.join(',')}\nselected=${competitionIds.length}\n`);
console.log(JSON.stringify({today:TODAY,pendingConcluded:pending.length,selected:competitionIds},null,2));
