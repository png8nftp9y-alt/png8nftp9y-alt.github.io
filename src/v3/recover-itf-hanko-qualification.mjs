import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {documentRecord} from './itf-draw-document-d1.mjs';

export const COMPETITION='J-J30-FIN-2026-004',EVENT='G-S-Q-KO';
export function recoveryTask(baseline){
 const tournament=baseline.tournaments?.find(x=>x.competitionId===COMPETITION);
 const event=tournament?.events?.find(x=>x.event===EVENT);
 if(!event||!Number.isInteger(event.tournamentId)||event.tournamentId<=0)throw new Error('Official saved Hanko qualification parameters missing');
 const url=new URL(tournament.sourceUrl);
 if(url.hostname!=='www.itftennis.com'||!url.pathname.endsWith('/'+COMPETITION.toLowerCase()+'/'))throw new Error('Unexpected Hanko source URL');
 return {...event,competitionId:COMPETITION,sourceUrl:url.href,taskId:COMPETITION+'__'+EVENT,playerTypeCode:'G',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO'};
}
export function requireRecoveredDraw(doc){
 const record=documentRecord(doc);
 if(doc.competitionId!==COMPETITION||doc.event!==EVENT||!record||record.acquisitionState!=='complete')throw new Error('Hanko qualification NOT recovered: '+JSON.stringify({status:doc.status,players:doc.players?.length||0,matches:doc.matches?.length||0,error:doc.error||''}));
 return record;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='verify'){
  const doc=JSON.parse(gunzipSync(await fs.readFile(`dist/v3/shards/itf/draw-tasks/${COMPETITION}__${EVENT}.json.gz`)));
  const row=requireRecoveredDraw(doc);console.log('HANKO_QUALIFICATION_RECOVERED='+JSON.stringify({drawKey:row.drawKey,sha256:row.sha256,players:row.playerCount,matches:row.matchCount}));
 }else{
  const task=recoveryTask(JSON.parse(await fs.readFile('src/v3/itf-audit-baseline-20261001.json','utf8')));
  const result=spawnSync(process.execPath,['src/v3/acquire-itf-history-tournament-tasks.mjs'],{stdio:'inherit',env:{...process.env,ITF_REQUIRE_POPULATED_DRAW:'1',ITF_TOURNAMENT_TASKS_JSON:JSON.stringify([task])}});
  if(result.error)throw result.error;process.exitCode=result.status??1;
 }
}
