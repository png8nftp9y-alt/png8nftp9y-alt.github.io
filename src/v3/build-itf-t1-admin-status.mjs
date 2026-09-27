import {TODAY,readJson,writeJson} from './itf-common.mjs';
import {t1Candidates} from './itf-t1-candidates.mjs';

const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const extraordinary=await readJson('dist/v3/itf_t1_extraordinary_batch.json',{extraordinaryTotal:0,queue:[]});
const windowEnd=new Date(Date.parse(TODAY+'T00:00:00Z')+3*864e5).toISOString().slice(0,10);
const details=t=>{const id=String(t.competitionId||'').toUpperCase(),row=state.tournaments?.[id]||{},inventory=row.eventInventory||[],cache=row.eventCache||{},missing=inventory.filter(item=>{const saved=cache[item.event]||{};return !saved.populated&&! saved.terminalAlternative&&saved.resolution!=='declared_but_unused'}).length;return{competitionId:id,tournamentName:t.tournamentName||row.tournamentName||'',startDate:t.startDate||row.startDate||'',endDate:t.endDate||row.endDate||'',status:row.decision||'unprocessed',knownDraws:inventory.length,acquiredDraws:Object.values(cache).filter(item=>item?.populated).length,missingDraws:inventory.length?missing:null,checkedAt:row.checkedAt||null}};
const ordinary=t1Candidates(catalog.tournaments||[],state.tournaments||{},TODAY,windowEnd,[]).filter(t=>!(state.tournaments?.[t.competitionId]?.decision==='pending'&&t.endDate<TODAY)).map(details);
const doc={version:1,generatedAt:new Date().toISOString(),today:TODAY,windowEnd,ordinary:{tournaments:ordinary,total:ordinary.length,missingDraws:ordinary.reduce((sum,row)=>sum+Number(row.missingDraws||0),0),byStatus:Object.fromEntries(Object.entries(Map.groupBy(ordinary,row=>row.status)).map(([key,rows])=>[key,rows.length]))},extraordinary:{tournaments:extraordinary.queue||[],total:Number(extraordinary.extraordinaryTotal||0),missingDraws:Number(extraordinary.extraordinaryMissingDraws||0),activeBacklog:Number(extraordinary.activeBacklog||0),pendingConcluded:Number(extraordinary.pendingConcluded||0)}};
await writeJson('dist/v3/itf_t1_queue_status.json',doc);
console.log('ITF_T1_QUEUE_STATUS='+JSON.stringify(doc));
