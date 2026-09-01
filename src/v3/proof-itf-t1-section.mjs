import {drawsheet,writeJson} from './itf-common.mjs';

const combo=JSON.parse(Buffer.from(process.env.ITF_T1_COMBO_B64||'','base64').toString('utf8'));
const tournament=JSON.parse(Buffer.from(process.env.ITF_T1_TOURNAMENT_B64||'','base64').toString('utf8'));
const index=Number(process.env.ITF_T1_SECTION_INDEX),event=String(process.env.ITF_T1_SECTION_EVENT||'');
let status='error',error=null,players=0,groups=0,matches=0,json=null;
for(let attempt=1;attempt<=4;attempt++){
 try{
  json=await drawsheet({...combo,sourceUrl:tournament.sourceUrl||combo.sourceUrl||''});
  const allGroups=[...(json.koGroups||[]),...(json.rrGroups||[])];
  groups=allGroups.length;
  for(const group of allGroups)for(const round of group.rounds||group.matchesByRound||[])for(const match of round.matches||[]){matches++;for(const team of match.teams||[])players+=(team.players||[]).filter(p=>p&&(p.givenName||p.familyName||p.playerName||p.name)).length}
  status=groups>0&&matches>0&&players>0?'acquired':'incomplete_not_published';
  error=null;
  break;
 }catch(e){
  error=String(e.message||e);
  status=/incapsula/i.test(error)?'incapsula_retry':'error_retry';
  if(attempt<4)await new Promise(resolve=>setTimeout(resolve,attempt*3000));
 }
}
const result={version:1,generatedAt:new Date().toISOString(),mode:'read_only_one_runner_one_section',competitionId:tournament.competitionId,index,event,status,groups,matches,players,error};
await writeJson('ops/itf-t1-exhaustive/results/section-'+String(index).padStart(3,'0')+'.json',result);
console.log(JSON.stringify(result,null,2));
