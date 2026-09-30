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
const strictAudit=process.env.ITF_AUDIT_STATE_FILE?await readJson(process.env.ITF_AUDIT_STATE_FILE,{tournaments:[]}):{tournaments:[]};
const catalogById=new Map((catalog.tournaments||[]).map(t=>[String(t.competitionId||'').toUpperCase(),t]));
const DYNAMIC_SAFETY_FROM='2026-09-27';
const isTeamCompetition=t=>String(t?.category||'').toUpperCase()==='GC'||/\b(?:team finals|davis cup junior|billie jean king cup)\b/i.test(String(t?.tournamentName||''));
const historicalBacklog=BACKLOG
 .filter(id=>!['complete','cancelled_no_draws'].includes(state.tournaments?.[id]?.decision))
 .map(id=>({...catalogById.get(id),...state.tournaments?.[id],competitionId:id}))
 .filter(Boolean);
const futureSafetyBacklog=(catalog.tournaments||[])
 .filter(t=>t?.competitionId&&t.endDate&&t.endDate>=DYNAMIC_SAFETY_FROM&&t.endDate<TODAY&&!isTeamCompetition(t))
 .filter(t=>!['complete','cancelled_no_draws'].includes(state.tournaments?.[String(t.competitionId).toUpperCase()]?.decision));
const activeBacklog=[...new Map([...historicalBacklog,...futureSafetyBacklog].map(t=>[String(t.competitionId).toUpperCase(),t])).values()];

const concludedPending=Object.values(state.tournaments||{})
 .filter(t=>t?.decision==='pending'&&t.competitionId&&(!t.endDate||t.endDate<TODAY))
 .sort((a,b)=>String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))||String(a.competitionId).localeCompare(String(b.competitionId)));
const strictConcludedMissing=(strictAudit.tournaments||[]).filter(t=>t.classification==='missing_draws'&&t.competitionId&&t.endDate<TODAY).map(t=>{const id=String(t.competitionId).toUpperCase(),cache=state.tournaments?.[id]?.eventCache||{},missingEvents=(t.missingEvents||[]).filter(item=>!cache[item.event]?.populated&&!cache[item.event]?.terminalAlternative);return{...t,competitionId:id,auditMissingEvents:missingEvents,auditMissingDraws:missingEvents.length}}).filter(t=>t.auditMissingDraws>0);

const queueMap=new Map();
for(const tournament of [...strictConcludedMissing,...activeBacklog,...concludedPending]){
 const id=String(tournament.competitionId||'').toUpperCase();
 if(id&&!queueMap.has(id))queueMap.set(id,tournament);
}
const queue=[...queueMap.values()];
const lane=String(process.env.ITF_EXTRAORDINARY_LANE||'a').toLowerCase()==='b'?'b':'a';
const laneOf=id=>[...String(id)].reduce((sum,char)=>sum+char.charCodeAt(0),0)%2===0?'a':'b';
const laneQueue=queue.filter(t=>laneOf(t.competitionId)===lane);
const excludedIds=new Set(String(process.env.ITF_EXCLUDE_IDS||'').split(',').map(id=>id.trim().toUpperCase()).filter(Boolean));
const strictIds=new Set(strictConcludedMissing.map(t=>String(t.competitionId).toUpperCase())),unseenIds=new Set(activeBacklog.map(t=>String(t.competitionId).toUpperCase()).filter(id=>!state.tournaments?.[id]));
queue.sort((a,b)=>
 Number(strictIds.has(String(b.competitionId).toUpperCase()))-Number(strictIds.has(String(a.competitionId).toUpperCase()))||
 Number(unseenIds.has(String(b.competitionId).toUpperCase()))-Number(unseenIds.has(String(a.competitionId).toUpperCase()))||
 String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))||
 String(a.competitionId).localeCompare(String(b.competitionId))
);
const available=laneQueue.filter(t=>!excludedIds.has(String(t.competitionId||'').toUpperCase()));
const cycleReset=laneQueue.length>0&&available.length===0;
const selected=(cycleReset?laneQueue:available).slice(0,2);
const competitionIds=selected.map(t=>String(t.competitionId).toUpperCase());
const nextPreviousIds=[...(cycleReset?new Set():excludedIds),...competitionIds].join(',');
const queueStatus=queue.map(t=>{const id=String(t.competitionId||'').toUpperCase(),row=state.tournaments?.[id]||t,inventory=row.eventInventory||[],cache=row.eventCache||{},missingDraws=t.auditMissingDraws??inventory.filter(item=>{const saved=cache[item.event]||{};return !saved.populated&&!saved.terminalAlternative&&saved.resolution!=='declared_but_unused'}).length;return{competitionId:id,tournamentName:t.tournamentName||row.tournamentName||'',startDate:t.startDate||row.startDate||'',endDate:t.endDate||row.endDate||'',status:t.auditMissingDraws!=null?'strict_missing_draws':row.decision||'unprocessed',knownDraws:t.events?.length||inventory.length,missingDraws:(t.auditMissingDraws!=null||inventory.length)?missingDraws:null,checkedAt:row.checkedAt||null}});
await writeJson('dist/v3/itf_t1_extraordinary_batch.json',{version:7,generatedAt:new Date().toISOString(),today:TODAY,lane,laneTotal:laneQueue.length,extraordinaryTotal:queue.length,extraordinaryMissingDraws:queueStatus.reduce((sum,row)=>sum+Number(row.missingDraws||0),0),strictConcludedMissing:strictConcludedMissing.length,activeBacklog:activeBacklog.length,pendingConcluded:concludedPending.length,selectionCycleReset:cycleReset,attemptedInCycle:nextPreviousIds?nextPreviousIds.split(',').length:0,selected:selected.map(t=>({competitionId:t.competitionId,tournamentName:t.tournamentName||'',endDate:t.endDate||'',checkedAt:t.checkedAt||null})),queue:queueStatus});
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`competition_ids=${competitionIds.join(',')}\nselected=${competitionIds.length}\nnext_previous_ids=${nextPreviousIds}\n`);
console.log(JSON.stringify({today:TODAY,lane,laneTotal:laneQueue.length,extraordinaryTotal:queue.length,activeBacklog:activeBacklog.length,pendingConcluded:concludedPending.length,cycleReset,selected:competitionIds},null,2));
