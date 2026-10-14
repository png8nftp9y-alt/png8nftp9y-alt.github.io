export function opponentTournamentWindow(tournaments,today){
 const key=t=>(t.circuit||'tennis-europe')+'|'+String(t.competitionId||t.id||'').toUpperCase(),unique=new Map();
 for(const t of tournaments){
  const k=key(t),old=unique.get(k),fields=Object.fromEntries(Object.entries(t).filter(([,v])=>v!==''&&v!==null&&v!==undefined)),matches=new Map();
  for(const m of [...(old?.matches||[]),...(t.matches||[])])matches.set(m.matchId||m.id||JSON.stringify(m),m);
  unique.set(k,{...old,...fields,circuit:t.circuit||old?.circuit||'tennis-europe',matches:[...matches.values()]});
 }
 const all=[...unique.values()],valid=t=>/^\d{4}-\d{2}-\d{2}$/.test(String(t.startDate||'')),end=t=>String(t.endDate||t.startDate).slice(0,10);
 const past=all.filter(t=>valid(t)&&end(t)<today).sort((a,b)=>end(b).localeCompare(end(a))||key(a).localeCompare(key(b))).slice(0,3).map(t=>({...t,historyKind:'past'}));
 const eligible=all.filter(t=>valid(t)&&!['W','WITHDRAWN','CANCELLED','CANCELED'].includes(String(t.acceptanceCode||'').toUpperCase())&&!/withdraw|ritirat|cancel/i.test(String(t.entryStatus||'')));
 const current=eligible.filter(t=>t.startDate<=today&&end(t)>=today).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate))||key(a).localeCompare(key(b)));
 const future=eligible.filter(t=>t.startDate>today).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||key(a).localeCompare(key(b)));
 const selected=current[0]||future[0];
 return[...(selected?[{...selected,historyKind:current.length?'current':'upcoming'}]:[]),...past];
}
