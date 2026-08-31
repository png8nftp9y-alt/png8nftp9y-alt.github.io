import fs from 'node:fs/promises';
import {tournamentEvents,drawsheet,playerFromApi,readJson,TODAY} from './itf-common.mjs';

const sectionSlot=Math.max(0,Number(process.env.ITF_V2_SECTION_SLOT||0));
const startedAt=new Date().toISOString();
const targetDb=await readJson('history/itf_draw_target_db.json',{targets:{},tournaments:{}});
const candidates=[];
for(const target of Object.values(targetDb.targets||{})){
  const acceptance=target.acceptanceEntry||target;
  if(!acceptance?.competitionId||!acceptance?.sourceUrl)continue;
  if(String(target.drawDecision||'')==='removed'||String(target.entryStatus||'')==='withdrawn')continue;
  const start=String(target.officialStartDate||acceptance.officialStartDate||acceptance.startDate||'').slice(0,10);
  const end=String(target.officialEndDate||acceptance.officialEndDate||acceptance.endDate||'').slice(0,10);
  if(!start||!end)continue;
  if(!(start<=TODAY&&TODAY<=end))continue;
  candidates.push({competitionId:acceptance.competitionId,tournamentName:acceptance.tournamentName||target.tournamentName||acceptance.competitionId,sourceUrl:acceptance.sourceUrl,officialStartDate:start,officialEndDate:end});
}
const unique=[...new Map(candidates.map(x=>[x.competitionId,x])).values()].sort((a,b)=>a.competitionId.localeCompare(b.competitionId));
if(!unique.length){
  console.error(JSON.stringify({status:'no_itf_tournament_in_progress',today:TODAY},null,2));
  process.exit(3);
}
const tournament=unique[0];
const classify=message=>{
  const m=String(message||'');
  if(/incapsula/i.test(m))return'blocked_incapsula';
  if(/timeout|network|fetch failed|ECONN|ENOTFOUND/i.test(m))return'network_error';
  if(/empty|not.?published|404/i.test(m))return'not_published';
  return'invalid_response';
};
function participantCount(json){let count=0;const walk=v=>{if(Array.isArray(v)){for(const x of v)walk(x);return}if(!v||typeof v!=='object')return;if(Array.isArray(v.players))for(const p of v.players){const pp=playerFromApi(p);if(pp.name)count++}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x)};walk(json);return count}
let result={version:3,mode:'read_only_in_progress_single_section',startedAt,today:TODAY,tournament,eligibleInProgressTargets:unique.length,sectionSlot,status:'invalid_response'};
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
