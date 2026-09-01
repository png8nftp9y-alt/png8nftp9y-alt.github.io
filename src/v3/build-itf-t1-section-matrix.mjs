import fs from 'node:fs/promises';
import {TODAY,readJson,writeJson,tournamentEvents} from './itf-common.mjs';

const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const tomorrow=new Date(Date.parse(TODAY+'T00:00:00Z')+864e5).toISOString().slice(0,10);
// A pending tournament never ages out of the queue.  T-1 starts the search,
// but only a certified complete inventory removes it from subsequent cycles.
const due=(map.tournaments||[]).filter(t=>t.startDate<=tomorrow&&state.tournaments?.[t.competitionId]?.decision!=='complete').sort((a,b)=>String(state.tournaments?.[a.competitionId]?.checkedAt||'').localeCompare(String(state.tournaments?.[b.competitionId]?.checkedAt||''))||String(a.startDate).localeCompare(String(b.startDate))||String(a.competitionId).localeCompare(String(b.competitionId)));
const tournament=due[0];
if(!tournament){
 const matrix={include:[{skip:true,index:0,event:'none',competitionId:'none',inventory:''}]};
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\ncompetition_id=\ndeclared=0\nrequested=0\n');
 console.log(JSON.stringify({status:'no_pending_itf_t1_tournaments'}));
 process.exit(0);
}
const combos=await tournamentEvents(tournament);
if(!combos.length)throw new Error('ITF returned no draw combinations for '+tournament.competitionId);
const eventKey=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
const cache=state.tournaments?.[tournament.competitionId]?.eventCache||{};
const missing=combos.filter(combo=>!cache[eventKey(combo)]?.populated);
const work=missing.length?missing:[combos[0]];
const tasks=work.map((combo,index)=>({...combo,index,competitionId:tournament.competitionId,event:eventKey(combo),taskId:tournament.competitionId+'__'+eventKey(combo),sourceUrl:tournament.sourceUrl||tournament.drawsResultsUrl||''}));
const matrix={include:tasks.map(task=>({index:task.index,event:task.event,competitionId:task.competitionId,task:Buffer.from(JSON.stringify(task)).toString('base64')}))};
const inventory={version:2,generatedAt:new Date().toISOString(),mode:'live_t_minus_one_historical_acquisition',competitionId:tournament.competitionId,tournamentName:tournament.tournamentName,tournament,declaredSections:combos.length,alreadyAcquiredSections:combos.length-missing.length,requestedSections:work.length,sections:combos.map((combo,index)=>({index,event:eventKey(combo),acquired:Boolean(cache[eventKey(combo)]?.populated),combo}))};
await writeJson('dist/v3/itf_t1_section_inventory.json',inventory);
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\ncompetition_id='+tournament.competitionId+'\ndeclared='+combos.length+'\nrequested='+work.length+'\n');
console.log(JSON.stringify({competitionId:tournament.competitionId,declaredSections:combos.length,alreadyAcquiredSections:combos.length-missing.length,requestedSections:work.length,events:work.map(eventKey)},null,2));
