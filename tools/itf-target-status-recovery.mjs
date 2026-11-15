import {drawMatchNodes} from '../src/v3/itf-common.mjs';
export const eventKey=c=>[c.playerTypeCode,c.matchTypeCode,c.eventClassificationCode,c.drawsheetStructureCode].join('-');
export const sectionKey=(id,event)=>`${id}|${event}`;
export function validateDocument(row){
  if(!row||!/^J-/.test(row.competitionId||'')||!/^([BG])-([SD])-([MQ])-([A-Z]+)$/.test(row.event||''))throw Error('invalid_document_identity');
  const doc=row.document;
  if(!doc||typeof doc!=='object'||(!Array.isArray(doc.koGroups)&&!Array.isArray(doc.rrGroups)))throw Error('invalid_draw_document');
  if(!drawMatchNodes(doc).length)throw Error('empty_draw_pending');
  return row;
}
export function summarizePair(playerId,sections){
  const matches=[];
  for(const row of sections)for(const {match:m} of drawMatchNodes(row.document)){
    const playerIds=(m.teams||[]).filter(Boolean).flatMap(t=>(t.players||[]).filter(Boolean)).map(p=>String(p.playerId||p.id||'')).filter(Boolean);
    if(!playerIds.includes(playerId))continue;
    matches.push({event:row.event,matchId:String(m.matchId??''),playerIds,
      playStatus:m.playStatusDesc||m.playStatus||'',playStatusCode:m.playStatusCode??null,
      resultStatus:m.resultStatusDesc||m.resultStatus||'',resultStatusCode:m.resultStatusCode??null});
  }
  return {playerId,status:matches.length?'official_matches_found':'unresolved',matches};
}
export async function recoverTournament({tournament,events,saved=new Map(),inventory,draw,browser,onDocument=async()=>{}}){
  const sections=[],failures=[],wanted=[...new Set(events)];
  for(const event of wanted){const row=saved.get(sectionKey(tournament.competitionId,event));if(row)sections.push(validateDocument(row))}
  let pending=wanted.filter(e=>!sections.some(s=>s.event===e));
  if(!pending.length)return {sections,failures};
  let combos=[],inventoryError=null;
  try{combos=await inventory(tournament)}catch(error){inventoryError=error}
  for(const event of pending){
    if(inventoryError)break;
    const task=combos.find(c=>eventKey(c)===event);if(!task)continue;
    let row;
    try{row=validateDocument({competitionId:tournament.competitionId,event,acquiredAt:new Date().toISOString(),document:await draw(task)})}catch{continue}
    await onDocument(row);sections.push(row);
  }
  pending=wanted.filter(e=>!sections.some(s=>s.event===e));
  if(pending.length){
    let result;
    try{
      const tasks=pending.map(e=>combos.find(c=>eventKey(c)===e));
      result=await browser(tournament,tasks.every(Boolean)?{tasks,events:pending}:{events:pending});
    }catch(error){for(const event of pending)failures.push({event,error:error.message});return {sections,failures}}
    for(const event of pending){
      const found=result.outcomes.find(o=>eventKey(o.combo)===event);let row;
      try{
        if(!found?.json)throw Error(found?.error||'event_not_returned_by_inventory');
        row=validateDocument({competitionId:tournament.competitionId,event,acquiredAt:new Date().toISOString(),document:found.json});
      }catch(error){failures.push({event,error:error.message});continue}
      await onDocument(row);sections.push(row);
    }
  }
  return {sections,failures};
}
