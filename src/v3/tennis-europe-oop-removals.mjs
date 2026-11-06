import {drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const native=m=>(m.players||[]).map(p=>String(p.id)).sort().join('|');
const key=m=>drawMatchKey(m)+'~'+native(m);
const iso=v=>String(v||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
// An official provisional singles slot may change its sole named player.
function provisionalSlot(m){
 const id=String(m.id||''),date=String(m.date||'').replaceAll('-','');
 return m.opponentPending===true&&m.status==='scheduled'&&!m.score&&!m.winnerPlayerIds?.length&&
  /^([BG])S\d{2}\b/i.test(m.event)&&m.players?.length===1&&m.players[0].id&&
  m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&
  m.courtMatchNumberSource==='official_schedule_subheader'&&
  id===['te-slot',m.competitionId,date,m.court,m.courtMatchNumber].join('|')&&
  m.sourceUrl==='https://te.tournamentsoftware.com/tournament/'+m.competitionId+'/matches/'+date;
}
function provisionalReplacement(old,matches){
 if(!provisionalSlot(old))return null;
 const same=matches.filter(m=>m.id===old.id);
 if(same.length!==1)return null;
 const next=same[0];
 return provisionalSlot(next)&&next.sourceUrl===old.sourceUrl&&next.event===old.event&&next.round===old.round&&native(next)!==native(old)?next:null;
}
function replacement(old,matches){
 if(!old.opponentPending||old.status!=='scheduled'||old.score||old.winnerPlayerIds?.length||!/^([BG])S\d{2}\b/i.test(old.event)||old.players?.length!==1||!old.players[0].id)return null;
 const pending=provisionalReplacement(old,matches);if(pending)return pending;
 const candidates=matches.filter(m=>m.opponentPending!==true&&m.players?.length===2&&new Set(m.players.map(p=>String(p.id))).size===2&&iso(m.date)===iso(old.date)&&drawMatchKey({...m,players:[]})===drawMatchKey({...old,players:[]})&&m.players.some(p=>String(p.id)===String(old.players[0].id))&&m.sourceUrl===old.sourceUrl&&m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&m.courtMatchNumberSource==='official_schedule_subheader');
 return candidates.length===1?candidates[0]:null;
}
export function resolvedPendingReplacements(previous,current){
 const matches=current.matches||[],known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>!known.has(key(m))).flatMap(m=>{const next=replacement(m,matches);return next?[{reason:next.opponentPending?'official_provisional_slot_player_replaced':'pending_opponent_resolved_and_schedule_updated',previousMatchId:m.id,currentMatchId:next.id,competitionId:m.competitionId,date:next.date,event:next.event,round:next.round,knownPlayerIds:m.players.map(p=>String(p.id)),previousCourt:m.court,currentCourt:next.court,previousCourtMatchNumber:m.courtMatchNumber,currentCourtMatchNumber:next.courtMatchNumber}]:[]});
}
export function unexplainedOopRemovals(previous,current){
 const matches=current.matches||[],active=new Set((current.tournaments||[]).map(t=>String(t.competitionId).toUpperCase())),known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>active.has(String(m.competitionId).toUpperCase())&&!known.has(key(m))&&!replacement(m,matches)).map(m=>({reason:'previous_acquired_match_absent_without_verified_exclusion',matchId:m.id,competitionId:m.competitionId,event:m.event,round:m.round,date:m.date,players:m.players}));
}
