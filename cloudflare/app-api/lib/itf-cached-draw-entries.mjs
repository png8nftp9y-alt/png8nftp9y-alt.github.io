// Official cached draw presence, joined by native ITF ID; no name matching or match scores.
export function cachedItfDrawEntries(database,{from='2025-12-18'}={}){
 const out=[];
 for(const t of Object.values(database.tournaments||{})){
  const competitionId=String(t.competitionId||'').toUpperCase(),startDate=String(t.startDate||'').slice(0,10),endDate=String(t.endDate||startDate).slice(0,10);
  if(!competitionId||endDate&&endDate<from)continue;
  const seen=new Set();
  for(const [event,draw] of Object.entries(t.eventCache||{})){
   if(draw.populated!==true||draw.error||draw.failureType)continue;
   for(const player of draw.players||[]){
    const id=String(player.id||player.playerId||'');if(!id||seen.has(id))continue;seen.add(id);
    const name=String(player.name||[player.givenName,player.familyName].filter(Boolean).join(' ')).trim();if(!name)continue;
    out.push({id,name,tournament:{competitionId,name:t.tournamentName||competitionId,startDate,endDate,sourceUrl:t.eventInventory?.find(e=>e.event===event)?.combo?.sourceUrl||'',calendarState:'draw_confirmed',entryStatus:'official_draw',drawConfirmed:true,calendarListLabel:'',event}});
   }
  }
 }
 return out;
}
export function mergeItfDrawTournament(previous={},draw){
 const withdrawn=/withdrawn|removed|excluded/i.test(String(previous.entryStatus||''))||/^W(?:-|$)/i.test(String(previous.acceptanceCode||''));
 return {...previous,...draw,location:previous.location||draw.location||'',entryStatus:withdrawn?'withdrawn':'official_draw',acceptanceCode:withdrawn?previous.acceptanceCode:'',acceptancePosition:null,calendarListLabel:''};
}
