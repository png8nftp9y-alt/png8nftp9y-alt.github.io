import fs from 'node:fs/promises';
import {readJson,tournamentEvents} from './itf-common.mjs';

const ids=String(process.env.ITF_COMPETITION_IDS||'').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean);
const catalog=await readJson('dist/v3/source_itf_tournaments.json',{tournaments:[]});
const baseline=await readJson('src/v3/itf-audit-baseline-20261001.json',{tournaments:[]});
const byId=new Map([...baseline.tournaments,...(catalog.tournaments||[])].map(row=>[String(row.competitionId||'').toUpperCase(),row]));
const tournaments=[];
for(const competitionId of ids){
 const tournament=byId.get(competitionId);
 if(!tournament){tournaments.push({competitionId,status:'catalog_missing',events:[],error:'catalog_missing'});continue}
 try{
  const events=(await tournamentEvents(tournament)).map(combo=>({event:[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode,combo.drawsheetStructureCode].join('-'),family:[combo.playerTypeCode,combo.matchTypeCode,combo.eventClassificationCode].join('-'),structure:combo.drawsheetStructureCode,tournamentId:combo.tournamentId,tourType:combo.tourType||'N',weekNumber:combo.weekNumber||0}));
  tournaments.push({competitionId,tournamentName:tournament.tournamentName||'',startDate:tournament.startDate||null,endDate:tournament.endDate||null,status:events.length?'inventoried':'empty_inventory',events,error:null});
 }catch(error){tournaments.push({competitionId,tournamentName:tournament.tournamentName||'',startDate:tournament.startDate||null,endDate:tournament.endDate||null,status:'unverifiable',events:[],error:String(error?.message||error)})}
}
await fs.mkdir('dist/v3/audits/itf-official-inventory-shards',{recursive:true});
const shard=String(process.env.ITF_INVENTORY_SHARD||'0').padStart(4,'0');
await fs.writeFile(`dist/v3/audits/itf-official-inventory-shards/${shard}.json`,JSON.stringify({generatedAt:new Date().toISOString(),tournaments},null,2)+'\n');
console.log(JSON.stringify({shard,tournaments:tournaments.length,inventoried:tournaments.filter(row=>row.status==='inventoried').length,unverifiable:tournaments.filter(row=>row.status==='unverifiable').length}));
