import fs from 'node:fs/promises';
import {NOW,readJson,tournamentEvents} from './itf-common.mjs';
const id=String(process.env.ITF_COMPETITION_ID||'').trim();if(!id)throw new Error('ITF_COMPETITION_ID_required');
const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]}),t=(map.tournaments||[]).find(x=>x.competitionId===id);if(!t)throw new Error('tournament_not_found');
const key=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
let events=[],error='';try{events=(await tournamentEvents(t)).map(c=>({competitionId:id,event:key(c),tournamentId:c.tournamentId,tourType:c.tourType||'N',weekNumber:c.weekNumber||0,playerTypeCode:c.playerTypeCode,matchTypeCode:c.matchTypeCode,eventClassificationCode:c.eventClassificationCode,drawsheetStructureCode:c.drawsheetStructureCode,sourceUrl:t.sourceUrl||t.drawsResultsUrl||''}))}catch(e){error=e.message}
const status=error?'retry':'complete',out={version:1,generatedAt:NOW,status,competitionId:id,tournament:t,eventCount:events.length,events,error};await fs.mkdir('dist/v3/shards/itf/inventory',{recursive:true});await fs.writeFile(`dist/v3/shards/itf/inventory/${id}.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({competitionId:id,status,eventCount:events.length,error}));if(error)process.exitCode=2;
