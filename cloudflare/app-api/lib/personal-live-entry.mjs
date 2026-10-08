export function hasPersonalDrawPresence(entry){
 return /(?:draw_confirmed|official_draw)/i.test(`${entry?.calendarState||''} ${entry?.entryStatus||''}`);
}
export function personalLiveEntry(entry){
 const result={...entry};
 if(!['itf','tennis-europe'].includes(entry.circuit))return result;
 const raw=String(entry.acceptanceCode||'').trim().toUpperCase();
 const code=({MAIN:'MD',QUALIFYING:'Q',ALTERNATES:'A',WITHDRAWN:'W'})[raw]||raw;
 const supported=['MD','Q','A','W','WC','LL'].includes(code);
 const position=entry.acceptancePosition;
 const validPosition=position!==null&&position!==undefined&&String(position).trim()!==''&&Number.isInteger(Number(position))&&Number(position)>0;
 result.acceptanceCode=code;
 result.acceptancePosition=validPosition?Number(position):null;
 result.calendarListLabel=supported?code+(validPosition?'-'+Number(position):''):'';
 result.acceptanceList=({MD:'Main',Q:'Qualifying',A:'Alternates',W:'Withdrawn'})[code]||'';
 if(hasPersonalDrawPresence(entry)){result.calendarListLabel='';return result;}
 result.calendarState='pre_tournament_acceptance';
 if(code==='W'){result.status='withdrawn';result.entryStatus='withdrawn';}
 return result;
}

export function mergePersonalLiveTournaments(current,incoming,playerId){
 const merged=new Map(current.map(t=>[`${t.playerId}|${t.circuit}|${t.competitionId}`,t]));
 for(const entry of incoming){
  const key=`${playerId}|${entry.circuit}|${entry.competitionId}`,prior=merged.get(key),confirmed=hasPersonalDrawPresence(prior);
  const t=personalLiveEntry({...prior,...entry,playerId,...(confirmed?{calendarState:'draw_confirmed',entryStatus:'official_draw'}:{})});
  merged.set(key,t);
 }
 return [...merged.values()];
}
