import {AUDIT_CRITERION,requiredAuditEvents} from '../../src/v3/itf-audit-acquisition-policy.mjs';
export const competitionKey=x=>String(x?.competitionId||x?.sourceTournamentId||x||'').toUpperCase();
export function presenceIndex(state){
 const out=new Map(),unidentified=[];
 for(const t of Object.values(state.tournaments||{}))for(const [event,draw]of Object.entries(t.eventCache||{})){
  if(draw.populated!==true||draw.error||draw.failureType)continue;
  for(const p of draw.players||[]){const id=String(p.id||p.playerId||'');if(!id){unidentified.push({competitionId:competitionKey(t),event,name:p.name||''});continue;}
   const found=out.get(id)||new Map();found.set(competitionKey(t),{competitionId:competitionKey(t),name:t.tournamentName||'',startDate:t.startDate||'',endDate:t.endDate||'',events:[...new Set([...(found.get(competitionKey(t))?.events||[]),event])]});out.set(id,found);
  }
 }
 return {players:out,unidentified};
}
export function comparePresence(expected,actual){
 const wanted=new Set(expected.map(competitionKey)),got=new Set(actual.map(competitionKey));
 return {expected:wanted.size,present:[...wanted].filter(id=>got.has(id)).length,missing:[...wanted].filter(id=>!got.has(id))};
}
export function alternateExpectation(p,state){
 const gender=String(p.gender||p.playerTypeCode||'').toUpperCase(),sex=/^(G|GIRLS?|FEMALE)$/.test(gender)?'G':/^(B|BOYS?|MALE)$/.test(gender)?'B':'';
 if(!sex)return {state:'unverifiable',reason:'missing_gender'};
 if(!state)return {state:'unverifiable',reason:'missing_tournament_inventory'};
 if(state.inventoryError)return {state:'unverifiable',reason:'inventory_read_error'};
 const inventory=(state.eventInventory||[]).filter(e=>e.event?.startsWith(sex+'-')).map(e=>({...e,family:e.event.split('-').slice(0,3).join('-'),structure:e.event.split('-').at(-1)}));
 if(!inventory.some(e=>e.family===sex+'-S-M')||!inventory.some(e=>e.family===sex+'-S-Q'))return {state:'unverifiable',reason:'main_or_qualifying_not_inventoried'};
 const events=requiredAuditEvents(inventory),proof=p=>p?.complete===true&&p.criterion===AUDIT_CRITERION;
 let found=false;
 for(const e of events){const d=state.eventCache?.[e.event];
  if(d?.error||d?.failureType)return {state:'unverifiable',reason:'failed_draw',event:e.event};
  if(d?.resolution==='empty_singles_qualification'&&proof(d.resolutionProof)&&d.resolutionProof.mainEvents?.length&&d.resolutionProof.mainEvents.every(x=>events.some(e=>e.event===x)))continue;
  if(!proof(d?.acquisitionProof)||d?.populated!==true||!d.players?.length||d.players.some(x=>!String(x.id||x.playerId||'')))return {state:'unverifiable',reason:'draw_not_fully_certified',event:e.event};
  if(d.players.some(x=>String(x.id||x.playerId)===String(p.worldTennisId||p.id||p.playerId)))found=true;
 }
 return {state:found?'present':'absent',events:events.map(e=>e.event)};
}
export function forbiddenPast(t){return t.circuit==='itf'&&t.historyKind==='past'&&!t.matches?.length&&!Number(t.historyMatchCount);}
