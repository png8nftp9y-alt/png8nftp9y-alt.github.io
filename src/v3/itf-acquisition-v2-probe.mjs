import fs from 'node:fs/promises';
import {tournamentEvents,drawsheet,playerFromApi,readJson,TODAY} from './itf-common.mjs';

const sectionSlot=Math.max(0,Number(process.env.ITF_V2_SECTION_SLOT||0));
const startedAt=new Date().toISOString();
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const targetDb=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const tournamentStates=targetDb.tournaments||{};
const tomorrow=new Date(Date.parse(TODAY+'T00:00:00Z')+864e5).toISOString().slice(0,10);
const due=(map.tournaments||[])
  .filter(t=>t?.competitionId&&t?.sourceUrl&&t.startDate<=tomorrow&&t.endDate>=TODAY&&tournamentStates[t.competitionId]?.decision!=='complete')
  .sort((a,b)=>String(tournamentStates[a.competitionId]?.checkedAt||'').localeCompare(String(tournamentStates[b.competitionId]?.checkedAt||''))||String(a.startDate).localeCompare(String(b.startDate)));
if(!due.length){
  console.error(JSON.stringify({status:'no_production_due_itf_tournament',today:TODAY,tomorrow},null,2));
  process.exit(3);
}
const tournament=due[0];
const classify=message=>{
  const m=String(message||'');
  if(/incapsula/i.test(m))return'blocked_incapsula';
  if(/timeout|network|fetch failed|ECONN|ENOTFOUND/i.test(m))return'network_error';
  if(/empty|not.?published|404/i.test(m))return'not_published';
  return'invalid_response';
};
function participantCount(json){let count=0;const walk=v=>{if(Array.isArray(v)){for(const x of v)walk(x);return}if(!v||typeof v!=='object')return;if(Array.isArray(v.players))for(const p of v.players){const pp=playerFromApi(p);if(pp.name)count++}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x)};walk(json);return count}
let result={version:4,mode:'read_only_production_due_single_section',startedAt,today:TODAY,tomorrow,tournament,eligibleProductionDueTournaments:due.length,sectionSlot,status:'invalid_response'};
try{
  const combos=await tournamentEvents(tournament);
  if(!combos.length)throw new Error('event_filters_empty');
  const combo=combos[sectionSlot%combos.length];
  const event=[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-');
  try{
    const json=await drawsheet(combo);
    const participants=participantCount(json);
    result={...result,status:participants>0?'complete':'not_published',event,participants,eventCount:combos.length,finishedAt:new Date().toISOString()};
  }catch(error){result={...result,status:classify(error.message),event,error:error.message,eventCount:combos.length,finishedAt:new Date().toISOString()}}
}catch(error){result={...result,status:classify(error.message),error:error.message,finishedAt:new Date().toISOString()}}
await fs.mkdir('ops/itf-v2/out',{recursive:true});
await fs.writeFile('ops/itf-v2/out/section-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
