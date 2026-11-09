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
// Confirmed against the official ROKAH 67 qualifying draw, draw 7.
function verifiedRokahReplacement(old,matches){
 const tournament='903480F6-55DB-4501-B014-F13DD75DCC96';
 const event='BS14 - Boys Singles 14 Qualifying';
 const round='Qualification round of 64';
 const draw='https://te.tournamentsoftware.com/sport/draw.aspx?id='+tournament.toLowerCase()+'&draw=7';
 const previousId=['te',tournament,'20261107',event,round,'96-50'].join('|');
 const currentId=['te',tournament,'20261108',event,round,'96-60'].join('|');
 if(old.id!==previousId||old.status!=='scheduled'||old.score||old.winnerPlayerId||
    old.winnerPlayerIds?.length||old.retired||old.drawUrl!==draw||native(old)!=='50|96')return null;
 const candidates=matches.filter(m=>m.id===currentId&&m.drawUrl===draw&&
  m.competitionId===tournament&&m.event===event&&m.round===round&&
  iso(m.date)==='2026-11-08'&&native(m)==='60|96'&&
  m.sourceUrl==='https://te.tournamentsoftware.com/tournament/'+tournament+'/matches/20261108');
 return candidates.length===1?candidates[0]:null;
}
function verifiedLuckyLoserReplacement(old,matches){
 const players=m=>m.players||[];
 const scheduled=m=>m.status==='scheduled'&&!m.score&&!m.retired&&!m.winnerPlayerId&&!m.winnerPlayerIds?.length&&
  m.opponentPending!==true&&players(m).length===2&&players(m).every(p=>p.id)&&
  new Set(players(m).map(p=>String(p.id))).size===2&&
  m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&
  m.courtMatchNumberSource==='official_schedule_subheader';
 if(!scheduled(old)||!/^([BG])S\d{2}\b/i.test(old.event)||!old.round||!old.drawUrl)return null;
 const date=iso(old.date).replaceAll('-','');
 const source='https://te.tournamentsoftware.com/tournament/'+old.competitionId+'/matches/'+date;
 if(old.sourceUrl!==source)return null;
 const candidates=matches.filter(m=>m.competitionId===old.competitionId&&iso(m.date)===iso(old.date)&&
  m.event===old.event&&m.round===old.round&&m.drawUrl===old.drawUrl&&m.sourceUrl===source&&
  m.court===old.court&&m.courtMatchNumber===old.courtMatchNumber);
 if(candidates.length!==1||!scheduled(candidates[0]))return null;
 const next=candidates[0],oldIds=new Set(players(old).map(p=>String(p.id)));
 const newcomers=players(next).filter(p=>!oldIds.has(String(p.id)));
 return newcomers.length===1&&[newcomers[0].entryType,newcomers[0].designation].includes('LL')?next:null;
}
function replacement(old,matches){
 const confirmed=verifiedRokahReplacement(old,matches);if(confirmed)return confirmed;
 const luckyLoser=verifiedLuckyLoserReplacement(old,matches);if(luckyLoser)return luckyLoser;
 if(!old.opponentPending||old.status!=='scheduled'||old.score||old.winnerPlayerIds?.length||!/^([BG])S\d{2}\b/i.test(old.event)||old.players?.length!==1||!old.players[0].id)return null;
 const pending=provisionalReplacement(old,matches);if(pending)return pending;
 const candidates=matches.filter(m=>m.opponentPending!==true&&m.players?.length===2&&new Set(m.players.map(p=>String(p.id))).size===2&&iso(m.date)===iso(old.date)&&drawMatchKey({...m,players:[]})===drawMatchKey({...old,players:[]})&&m.players.some(p=>String(p.id)===String(old.players[0].id))&&m.sourceUrl===old.sourceUrl&&m.court&&Number.isInteger(m.courtMatchNumber)&&m.courtMatchNumber>0&&m.courtMatchNumberSource==='official_schedule_subheader');
 return candidates.length===1?candidates[0]:null;
}
export function resolvedPendingReplacements(previous,current){
 const matches=current.matches||[],known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>!known.has(key(m))).flatMap(m=>{const next=replacement(m,matches);return next?[{reason:verifiedRokahReplacement(m,[next])?'official_draw_schedule_replacement':verifiedLuckyLoserReplacement(m,[next])?'official_lucky_loser_same_slot':next.opponentPending?'official_provisional_slot_player_replaced':'pending_opponent_resolved_and_schedule_updated',previousMatchId:m.id,currentMatchId:next.id,competitionId:m.competitionId,date:next.date,event:next.event,round:next.round,knownPlayerIds:m.players.map(p=>String(p.id)),previousCourt:m.court,currentCourt:next.court,previousCourtMatchNumber:m.courtMatchNumber,currentCourtMatchNumber:next.courtMatchNumber}]:[]});
}
export function unexplainedOopRemovals(previous,current){
 const matches=current.matches||[],active=new Set((current.tournaments||[]).map(t=>String(t.competitionId).toUpperCase())),known=new Set(matches.map(key));
 return (previous?.matches||[]).filter(m=>active.has(String(m.competitionId).toUpperCase())&&!known.has(key(m))&&!replacement(m,matches)).map(m=>({reason:'previous_acquired_match_absent_without_verified_exclusion',matchId:m.id,competitionId:m.competitionId,event:m.event,round:m.round,date:m.date,players:m.players}));
}
