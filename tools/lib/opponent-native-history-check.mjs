export function checkOpponentNativeHistory(rows,tournaments,asOf){
 const parse=x=>typeof x==='string'?JSON.parse(x||'{}'):x||{};
 const key=t=>String(t.competitionId||t.source_tournament_id||'').toUpperCase();
 const groups=new Map(),unverifiable=[];
 for(const row of rows){
  const t=parse(row.tournament_payload),m=parse(row.payload),id=key({...row,...t,competitionId:t.competitionId||m.competitionId||row.source_tournament_id});
  const end=String(t.endDate||t.startDate||'').slice(0,10);
  if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(end)){unverifiable.push({matchId:row.id,reason:'native_tournament_dates_missing'});continue;}
  if(end>=asOf||row.played_date>asOf)continue;
  const g=groups.get(id)||{id,end,matches:[]};g.matches.push(row.id);groups.set(id,g);
 }
 const past=tournaments.filter(t=>t.historyKind==='past'),cutoff=past.length>=3?past.map(t=>String(t.endDate||t.startDate||'').slice(0,10)).sort().at(0):null;
 const missingTournaments=[],missingMatches=[];
 for(const g of groups.values()){
  const selected=past.find(t=>t.circuit==='itf'&&key(t)===g.id);
  if(!selected){if(!cutoff||g.end>cutoff)missingTournaments.push(g.id);else if(g.end===cutoff){const boundary=past.filter(t=>String(t.endDate||t.startDate||'').slice(0,10)===cutoff).map(t=>(t.circuit||'tennis-europe')+'|'+key(t)).sort((a,b)=>a.localeCompare(b)).at(-1);if(('itf|'+g.id).localeCompare(boundary)<0)missingTournaments.push(g.id);}continue;}
  const got=new Set((selected.matches||[]).map(m=>m.matchId));
  for(const id of g.matches)if(!got.has(id))missingMatches.push({competitionId:g.id,matchId:id});
 }
 return{missingTournaments,missingMatches,unverifiable};
}
