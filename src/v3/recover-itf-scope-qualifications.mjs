import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {documentRecord} from './itf-draw-document-d1.mjs';

export const TARGETS=Object.freeze([
 {competitionId:'J-J100-BOL-2026-002',tournamentId:1100203824},
 {competitionId:'J-J100-ARG-2026-001',tournamentId:1100202687}
]);
export const EVENT='B-S-Q-KO';
export function recoveryTasks(baseline){
 return TARGETS.map(target=>{
  const tournament=baseline.tournaments?.find(row=>row.competitionId===target.competitionId);
  const event=tournament?.events?.find(row=>row.event===EVENT);
  if(!event||event.tournamentId!==target.tournamentId||event.tourType!=='N')throw Error('Saved official qualification parameters missing or changed: '+target.competitionId);
  const url=new URL(tournament.sourceUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.itftennis.com'||!url.pathname.endsWith('/'+target.competitionId.toLowerCase()+'/'))throw Error('Unexpected official source: '+target.competitionId);
  return {...event,competitionId:target.competitionId,sourceUrl:url.href,taskId:target.competitionId+'__'+EVENT,playerTypeCode:'B',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO'};
 });
}
export function requireRecoveredQualification(doc){
 if(!TARGETS.some(row=>row.competitionId===doc.competitionId)||doc.event!==EVENT)throw Error('Unexpected qualification recovery document');
 const record=documentRecord(doc);
 if(!record||record.acquisitionState!=='complete')throw Error('Qualification NOT recovered: '+doc.competitionId+' '+JSON.stringify({status:doc.status,players:doc.players?.length||0,matches:doc.matches?.length||0,error:doc.error||''}));
 return record;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='verify'){
  for(const target of TARGETS){
   const doc=JSON.parse(gunzipSync(await fs.readFile(`dist/v3/shards/itf/draw-tasks/${target.competitionId}__${EVENT}.json.gz`)));
   const row=requireRecoveredQualification(doc);console.log('SCOPE_QUALIFICATION_RECOVERED='+JSON.stringify({drawKey:row.drawKey,sha256:row.sha256,players:row.playerCount,matches:row.matchCount}));
  }
 }else{
  const tasks=recoveryTasks(JSON.parse(await fs.readFile('src/v3/itf-audit-baseline-20261001.json','utf8')));
  const result=spawnSync(process.execPath,['src/v3/acquire-itf-history-tournament-tasks.mjs'],{stdio:'inherit',env:{...process.env,ITF_REQUIRE_POPULATED_DRAW:'1',ITF_TOURNAMENT_TASKS_JSON:JSON.stringify(tasks)}});
  if(result.error)throw result.error;process.exitCode=result.status??1;
 }
}
