import {AUDIT_CRITERION,requiredAuditEvents} from '../../../src/v3/itf-audit-acquisition-policy.mjs';

// Negative evidence requires the complete, certified inventory for this sex.
// A populated flag, a date, or a single available draw never proves absence.
export function itfAlternateDrawDecision(player,state){
 const code=String(player.acceptanceCode||'').toUpperCase();
 if(!/^(A(?:-\d+)?|ALTERNATES?)$/.test(code))return null;
 const id=String(player.worldTennisId||player.id||player.playerId||'');
 const gender=String(player.playerTypeCode||player.gender||'').toUpperCase();
 const sex=/^(B|BOYS?|MALE)$/.test(gender)?'B':/^(G|GIRLS?|FEMALE)$/.test(gender)?'G':'';
 if(!id||!sex||!state||state.inventoryError)return null;
 const inventory=(state.eventInventory||[]).filter(e=>String(e.event||'').startsWith(sex+'-')).map(e=>({...e,family:e.event.split('-').slice(0,3).join('-'),structure:e.event.split('-').at(-1)}));
 if(!inventory.some(e=>e.family===sex+'-S-M')||!inventory.some(e=>e.family===sex+'-S-Q'))return null;
 const required=requiredAuditEvents(inventory);
 const certified=proof=>proof?.criterion===AUDIT_CRITERION&&proof.complete===true;
 let present=false;
 for(const section of required){
  const draw=state.eventCache?.[section.event];
  if(draw?.error||draw?.failureType)return null;
  if(draw?.resolution==='empty_singles_qualification'&&certified(draw.resolutionProof)){
   if(!draw.resolutionProof.mainEvents?.length||!draw.resolutionProof.mainEvents.every(event=>required.some(e=>e.event===event)))return null;
   continue;
  }
  if(draw?.populated!==true||!certified(draw.acquisitionProof)||!Array.isArray(draw.players)||!draw.players.length)return null;
  // An unidentified participant could be the alternate: do not infer absence.
  if(draw.players.some(p=>!String(p.id||p.playerId||'')))return null;
  if(draw.players.some(p=>String(p.id||p.playerId)===id))present=true;
 }
 return {entryStatus:present?'official_draw':'excluded',calendarState:present?'draw_confirmed':'excluded',drawConfirmed:present,
  alternateDrawDecision:present?'present_in_complete_draws':'absent_from_complete_draws',drawDecisionEvents:required.map(e=>e.event),
  ...(present?{acceptanceCode:'',acceptancePosition:null,calendarListLabel:''}:{})};
}
