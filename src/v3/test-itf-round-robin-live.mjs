import {readJson,tournamentEvents,drawsheet,drawMatchNodes,playersFromDrawsheet} from './itf-common.mjs';
import {readTournamentDrawsInBrowser} from './read-itf-draws-browser.mjs';

const ids=['J-J30-ALG-2026-003','J-J30-BEL-2026-007','J-J30-LAT-2026-004','J-J30-NCA-2026-002'];
const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]}),byId=new Map((catalog.tournaments||[]).map(row=>[row.competitionId,row]));
const results=[];
for(const competitionId of ids){
 const tournament=byId.get(competitionId);if(!tournament)throw new Error(`missing_tournament:${competitionId}`);
 const combos=(await tournamentEvents(tournament)).filter(combo=>combo.drawsheetStructureCode==='RR');
 let browser=null;
 for(const combo of combos){let json;try{json=await drawsheet(combo)}catch(error){if(!/incapsula/i.test(error.message))throw error;browser??=await readTournamentDrawsInBrowser(tournament);const event=[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-'),recovered=browser.outcomes.find(outcome=>[outcome.combo.playerTypeCode,outcome.combo.matchTypeCode,outcome.combo.eventClassificationCode,outcome.combo.drawsheetStructureCode].join('-')===event);if(!recovered?.json)throw new Error(`${competitionId}:${event}:browser_recovery_failed:${recovered?.error||error.message}`);json=recovered.json}const nodes=drawMatchNodes(json),players=playersFromDrawsheet(json),groups=[...new Set(nodes.map(row=>String(row.group??'')).filter(Boolean))];results.push({competitionId,event:[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-'),groups:groups.length,matches:nodes.length,players:new Set(players.map(player=>player.id||player.name)).size,topLevelKeys:Object.keys(json||{})})}
}
console.log(JSON.stringify(results,null,2));
if(!results.length||results.some(result=>result.matches===0||result.players===0))process.exitCode=2;
