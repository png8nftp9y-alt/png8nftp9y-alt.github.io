import {drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const native=m=>(m.players||[]).map(p=>String(p.id)).sort().join('|');
const key=m=>drawMatchKey(m)+'~'+native(m);
const iso=v=>String(v||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
function replacement(old,matches){
 if(!old.opponentPending||old.status!=='scheduled'||old.score||old.winnerPlayerIds?.length||!/^([BG])S\d{2}\b/i.test(old.event)||old.players?.length!==1||!old.players[0].id)return null;
 const candidates=matches.filter(m=>m.opponentPending!==true&&m.players?.length===2&&new Set(m.players.map(p=>String(p.id))).size===2&&iso(m.date)===iso(old.date)&&drawMatchKey({...m,players:[]})===drawMatchKey({...old,players:[]})&&m.players.some(p=>String(p.id)===String(old.players[0].id))&&m.sourceUrl===old.sourceUrl&&m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&m.courtMatchNumberSource==='official_schedule_subheader');
 return candidates.length===1?candidates[0]:null;
}
export function resolvedPendingReplacements(previous,current){
 const matches=current.matches||[],known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>!known.has(key(m))).flatMap(m=>{const next=replacement(m,matches);return next?[{reason:'pending_opponent_resolved_and_schedule_updated',previousMatchId:m.id,currentMatchId:next.id,competitionId:m.competitionId,date:next.date,event:next.event,round:next.round,knownPlayerIds:m.players.map(p=>String(p.id)),previousCourt:m.court,currentCourt:next.court,previousCourtMatchNumber:m.courtMatchNumber,currentCourtMatchNumber:next.courtMatchNumber}]:[]});
}
export function unexplainedOopRemovals(previous,current){
 const matches=current.matches||[],active=new Set((current.tournaments||[]).map(t=>String(t.competitionId).toUpperCase())),known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>active.has(String(m.competitionId).toUpperCase())&&!known.has(key(m))&&!replacement(m,matches)).map(m=>({reason:'previous_acquired_match_absent_without_verified_exclusion',matchId:m.id,competitionId:m.competitionId,event:m.event,round:m.round,date:m.date,players:m.players}));
}
