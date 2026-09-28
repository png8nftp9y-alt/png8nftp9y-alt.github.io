import {readJson,writeJson,tournamentEvents,drawsheet,drawMatchNodes} from './itf-common.mjs';

const groupIndex=Math.max(0,Number(process.env.ITF_RR_GROUP_INDEX||1)-1);
const ids=['J-J30-ALG-2026-003','J-J30-BEL-2026-007','J-J30-LAT-2026-004','J-J30-NCA-2026-002'];
const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const byId=new Map((catalog.tournaments||[]).map(row=>[row.competitionId,row]));
const outcomes=[];
for(const competitionId of ids){
 const tournament=byId.get(competitionId);
 if(!tournament){outcomes.push({competitionId,group:groupIndex+1,error:'missing_tournament'});continue}
 try{
  const combos=(await tournamentEvents(tournament)).filter(combo=>combo.drawsheetStructureCode==='RR');
  for(const combo of combos){
   const event=[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-');
   try{
    const json=await drawsheet(combo),declaredGroups=(json.rrGroups||[]).length,group=(json.rrGroups||[])[groupIndex]||null;
    const matches=group?drawMatchNodes({rrGroups:[group]}):[];
    outcomes.push({competitionId,event,group:groupIndex+1,declaredGroups,present:Boolean(group),matches:matches.length,data:group});
   }catch(error){outcomes.push({competitionId,event,group:groupIndex+1,error:error.message})}
  }
 }catch(error){outcomes.push({competitionId,group:groupIndex+1,error:error.message})}
}
await writeJson(`dist/v3/audits/itf-rr-groups/group-${groupIndex+1}.json`,{group:groupIndex+1,outcomes});
console.log(JSON.stringify({group:groupIndex+1,outcomes:outcomes.map(({data,...row})=>row)},null,2));
