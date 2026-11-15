import fs from 'node:fs/promises';
import {tournamentEvents,drawsheet,drawMatchNodes,hash} from '../src/v3/itf-common.mjs';

const target=JSON.parse(await fs.readFile('tools/itf-status-targets.json','utf8'));
const catalog=JSON.parse(await fs.readFile('dist/v3/source_itf_tournaments.json','utf8'));
const shard=Number(process.env.STATUS_SHARD);
const ids=[...new Set(target.pairs.map(r=>r.competitionId))]
  .filter(id=>hash(id)%8===shard).sort();
const output={shard,tournaments:[],failures:[]};
const dir=`artifacts/itf-status-${shard}`;
await fs.mkdir(dir,{recursive:true});
const save=()=>fs.writeFile(`${dir}/report.json`,JSON.stringify(output,null,2));
for(const id of ids){
  const record={competitionId:id,sections:[],pairs:[]};
  output.tournaments.push(record);
  try{
    const tournament=catalog.tournaments.find(t=>t.competitionId===id);
    if(!tournament)throw Error('catalog_missing');
    const inventory=await tournamentEvents(tournament);
    const wanted=target.sections.filter(s=>s.competitionId===id);
    for(const section of wanted){
      try{
        const task=inventory.find(c=>[
          c.playerTypeCode,c.matchTypeCode,
          c.eventClassificationCode,c.drawsheetStructureCode
        ].join('-')===section.event);
        if(!task)throw Error('event_not_returned_by_inventory');
        const document=await drawsheet(task);
        await fs.writeFile(`${dir}/${id}_${section.event}.json`,
          JSON.stringify({competitionId:id,event:section.event,
            acquiredAt:new Date().toISOString(),document}));
        const matches=drawMatchNodes(document).map(({match:m})=>({
          matchId:String(m.matchId??''),
          playerIds:(m.teams||[]).filter(Boolean)
            .flatMap(t=>(t.players||[]).filter(Boolean))
            .map(p=>String(p.playerId||p.id||'')).filter(Boolean),
          playStatus:m.playStatusDesc||m.playStatus||'',
          playStatusCode:m.playStatusCode??null,
          resultStatus:m.resultStatusDesc||m.resultStatus||'',
          resultStatusCode:m.resultStatusCode??null
        }));
        record.sections.push({event:section.event,matches});
      }catch(error){
        output.failures.push({competitionId:id,event:section.event,error:error.message});
      }
      await save();
    }
    for(const pair of target.pairs.filter(p=>p.competitionId===id)){
      const matches=record.sections.flatMap(s=>s.matches
        .filter(m=>m.playerIds.includes(pair.playerId))
        .map(m=>({event:s.event,...m})));
      record.pairs.push({
        playerId:pair.playerId,
        status:matches.length?'official_matches_found':'unresolved',
        matches
      });
    }
  }catch(error){
    output.failures.push({competitionId:id,error:error.message});
  }
  await save();
  console.log(`${output.tournaments.length}/${ids.length} tornei letti`);
}
console.log(JSON.stringify({
  shard,tournaments:ids.length,failures:output.failures.length,
  unresolved:output.tournaments.flatMap(t=>t.pairs)
    .filter(p=>p.status==='unresolved').length
}));
if(output.failures.length)process.exitCode=1;
