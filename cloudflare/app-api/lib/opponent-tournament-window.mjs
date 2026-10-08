export function opponentTournamentWindow(tournaments,today){
 const key=t=>(t.circuit||'tennis-europe')+'|'+String(t.competitionId||t.id||'').toUpperCase(),unique=new Map();
 for(const t of tournaments){const k=key(t),old=unique.get(k);unique.set(k,old?{...t,...old,matches:[...(old.matches||[]),...(t.matches||[])]}:t)}
 const all=[...unique.values()],valid=t=>/^\d{4}-\d{2}-\d{2}$/.test(String(t.startDate||''));
 const past=all.filter(t=>valid(t)&&String(t.endDate||t.startDate).slice(0,10)<today).sort((a,b)=>String(b.endDate||b.startDate).localeCompare(String(a.endDate||a.startDate))).slice(0,3).map(t=>({...t,historyKind:'past'}));
 const next=all.filter(t=>valid(t)&&String(t.startDate).slice(0,10)>=today&&!['W','WITHDRAWN','CANCELLED','CANCELED'].includes(String(t.acceptanceCode||'').toUpperCase())&&!/withdraw|ritirat|cancel/i.test(String(t.entryStatus||''))).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))).slice(0,1).map(t=>({...t,historyKind:'upcoming'}));
 return[...next,...past];
}
