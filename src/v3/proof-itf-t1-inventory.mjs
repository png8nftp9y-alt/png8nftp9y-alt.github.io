import fs from 'node:fs/promises';
import {TODAY,readJson,writeJson,tournamentEvents} from './itf-common.mjs';

const map=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const state=await readJson('history/itf_draw_target_db.json',{tournaments:{}});
const tomorrow=new Date(Date.parse(TODAY+'T00:00:00Z')+864e5).toISOString().slice(0,10);
const requested=String(process.env.ITF_T1_PROOF_COMPETITION_ID||'').trim().toUpperCase();
const due=(map.tournaments||[]).filter(t=>t.startDate<=tomorrow&&t.endDate>=TODAY&&state.tournaments?.[t.competitionId]?.decision!=='complete');
const candidates=due.sort((a,b)=>{
 const at=state.tournaments?.[a.competitionId]||{},bt=state.tournaments?.[b.competitionId]||{};
 const ap=at.eventFailure?0:1,bp=bt.eventFailure?0:1;
 return ap-bp||String(at.checkedAt||'').localeCompare(String(bt.checkedAt||''))||String(a.competitionId).localeCompare(String(b.competitionId));
});
const tournament=requested?(map.tournaments||[]).find(t=>String(t.competitionId).toUpperCase()===requested):candidates[0];
if(!tournament)throw new Error('No ITF T-1 tournament available for exhaustive proof.');
const combos=await tournamentEvents(tournament);
if(!combos.length)throw new Error('ITF returned no draw combinations for '+tournament.competitionId);
const eventKey=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
const matrix={include:combos.map((combo,index)=>({index,event:eventKey(combo),combo:Buffer.from(JSON.stringify(combo)).toString('base64'),tournament:Buffer.from(JSON.stringify(tournament)).toString('base64')}))};
const inventory={version:1,generatedAt:new Date().toISOString(),mode:'read_only_exhaustive_t1_inventory',competitionId:tournament.competitionId,tournamentName:tournament.tournamentName,expectedSections:combos.length,sections:combos.map((combo,index)=>({index,event:eventKey(combo),combo}))};
await writeJson('ops/itf-t1-exhaustive/inventory.json',inventory);
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\nexpected='+combos.length+'\ncompetition_id='+tournament.competitionId+'\n');
console.log(JSON.stringify({competitionId:tournament.competitionId,expectedSections:combos.length,events:inventory.sections.map(x=>x.event)},null,2));
