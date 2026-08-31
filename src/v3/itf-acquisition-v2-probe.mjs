import fs from 'node:fs/promises';
import {tournamentEvents,drawsheet,playerFromApi} from './itf-common.mjs';

const tournament={
  competitionId:process.env.ITF_V2_COMPETITION_ID||'J-J30-ITA-2026-002',
  tournamentName:process.env.ITF_V2_TOURNAMENT_NAME||'J30 Cuneo',
  sourceUrl:process.env.ITF_V2_SOURCE_URL||'https://www.itftennis.com/en/tournament/j30-cuneo/ita/2026/j-j30-ita-2026-002/'
};
const sectionSlot=Math.max(0,Number(process.env.ITF_V2_SECTION_SLOT||0));
const startedAt=new Date().toISOString();
const classify=message=>{
  const m=String(message||'');
  if(/incapsula/i.test(m))return'blocked_incapsula';
  if(/timeout|network|fetch failed|ECONN|ENOTFOUND/i.test(m))return'network_error';
  if(/empty|not.?published|404/i.test(m))return'not_published';
  return'invalid_response';
};
function participantCount(json){let count=0;const walk=v=>{if(Array.isArray(v)){for(const x of v)walk(x);return}if(!v||typeof v!=='object')return;if(Array.isArray(v.players))for(const p of v.players){const pp=playerFromApi(p);if(pp.name)count++}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x)};walk(json);return count}
let result={version:1,mode:'read_only_single_tournament_single_section',startedAt,tournament,sectionSlot,status:'invalid_response'};
try{
  const combos=await tournamentEvents(tournament);
  if(!combos.length)throw new Error('event_filters_empty');
  const combo=combos[sectionSlot%combos.length];
  const event=[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-');
  try{
    const json=await drawsheet(combo);
    const participants=participantCount(json);
    result={...result,status:participants>0?'complete':'not_published',event,participants,eventCount:combos.length,finishedAt:new Date().toISOString()};
  }catch(error){
    result={...result,status:classify(error.message),event,error:error.message,eventCount:combos.length,finishedAt:new Date().toISOString()};
  }
}catch(error){
  result={...result,status:classify(error.message),error:error.message,finishedAt:new Date().toISOString()};
}
await fs.mkdir('ops/itf-v2/out',{recursive:true});
await fs.writeFile('ops/itf-v2/out/section-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!['complete','not_published','blocked_incapsula','network_error','invalid_response'].includes(result.status))process.exitCode=2;
