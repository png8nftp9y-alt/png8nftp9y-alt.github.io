import fs from 'node:fs/promises';
import {TODAY,readJson,writeJson} from './itf-common.mjs';

// Individual concluded tournaments found without certified archive coverage.
// Team competitions are intentionally excluded. Cancelled tournaments remain:
// inventory must decide whether official draws exist before they can be closed.
const BACKLOG=`
J-J100-CYP-2026-002 J-J100-TUR-2026-002 J-J60-TUR-2026-003 J-J30-ETH-2026-001
J-J30-ETH-2026-002 J-J100-TUR-2026-003 J-J60-ISR-2026-003 J-J100-TUR-2026-004
J-J60-ISR-2026-006 J-J30-TUR-2026-002 J-J60-QAT-2026-001 J-J60-QAT-2026-002
J-J30-NMI-2026-001 J-J100-LAT-2026-002 J-J60-TJK-2026-001 J-J100-ESP-2026-007
J-J200-CHN-2026-001 J-J30-COL-2026-004 J-J30-GEO-2026-004 J-J30-GHA-2026-006
J-J30-HON-2026-006 J-J30-IND-2026-005 J-J30-POL-2026-005 J-J30-SRB-2026-004
J-J30-SUI-2026-005 J-J30-TPE-2026-003 J-J300-KAZ-2026-001 J-J60-AUS-2026-004
J-J60-CHI-2026-002 J-J60-ECU-2026-003 J-J60-MEX-2026-010 J-J60-SRI-2026-001
J-J60-USA-2026-005 J-J60-USA-2026-008 J-JGS-USA-2026-001 J-J100-ITA-2026-001
J-J100-JPN-2026-001 J-J30-AZE-2026-002 J-J30-DEN-2026-003 J-J30-FRA-2026-006
J-J60-BUL-2026-003 J-J60-EGY-2026-006 J-J60-GER-2026-008 J-J100-USA-2026-005
J-J200-CAN-2026-001 J-J100-BIH-2026-001 J-J30-BEL-2026-007 J-J30-COL-2026-005
J-J30-CRO-2026-001 J-J30-DEN-2026-002 J-J30-ECU-2026-003 J-J30-GEO-2026-005
J-J30-MRI-2026-002 J-J30-TPE-2026-004 J-J60-AZE-2026-002 J-J60-ESP-2026-008
J-J60-GHA-2026-001 J-J200-JPN-2026-001 J-J200-RSA-2026-001 J-J30-CZE-2026-005
J-J30-NCA-2026-003 J-J30-NED-2026-003 J-J300-AUT-2026-001 J-J300-CHN-2026-001
J-J60-EGY-2026-005 J-J60-SRI-2026-002 J-J100-CAN-2026-002 J-J100-HKG-2026-001
J-J200-URU-2026-001 J-J30-ALG-2026-003 J-J30-CZE-2026-006 J-J30-DOM-2026-001
J-J30-KAZ-2026-004 J-J30-MEX-2026-008 J-J30-TPE-2026-001 J-J30-UKR-2026-002
J-J60-ALB-2026-002 J-J60-ARM-2026-009 J-J60-GHA-2026-002 J-J60-MRI-2026-001
`.trim().split(/\s+/);

const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const catalogById=new Map((catalog.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const activeBacklog=BACKLOG
 .filter(id=>!['complete','cancelled_no_draws'].includes(state.tournaments?.[id]?.decision))
 .map(id=>catalogById.get(id)||state.tournaments?.[id])
 .filter(Boolean);

const concludedPending=Object.values(state.tournaments||{})
 .filter(t=>t?.decision==='pending'&&t.competitionId&&t.endDate&&t.endDate<TODAY)
 .sort((a,b)=>String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))||String(a.competitionId).localeCompare(String(b.competitionId)));

const queueMap=new Map();
for(const tournament of [...activeBacklog,...concludedPending]){
 const id=String(tournament.competitionId||'').toUpperCase();
 if(id&&!queueMap.has(id))queueMap.set(id,tournament);
}
const queue=[...queueMap.values()];
const unseenIds=new Set(BACKLOG.filter(id=>!state.tournaments?.[id]));
queue.sort((a,b)=>
 Number(unseenIds.has(String(b.competitionId).toUpperCase()))-Number(unseenIds.has(String(a.competitionId).toUpperCase()))||
 String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))||
 String(a.competitionId).localeCompare(String(b.competitionId))
);
const selected=queue.slice(0,2);
const competitionIds=selected.map(t=>String(t.competitionId).toUpperCase());
await writeJson('dist/v3/itf_t1_extraordinary_batch.json',{version:4,generatedAt:new Date().toISOString(),today:TODAY,extraordinaryTotal:queue.length,activeBacklog:activeBacklog.length,pendingConcluded:concludedPending.length,selected:selected.map(t=>({competitionId:t.competitionId,tournamentName:t.tournamentName||'',endDate:t.endDate||'',checkedAt:t.checkedAt||null}))});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`competition_ids=${competitionIds.join(',')}\nselected=${competitionIds.length}\n`);
console.log(JSON.stringify({today:TODAY,extraordinaryTotal:queue.length,activeBacklog:activeBacklog.length,pendingConcluded:concludedPending.length,selected:competitionIds},null,2));
