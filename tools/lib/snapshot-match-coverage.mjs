const key = m => `${m.playerId}|${m.matchId || m.id}`;
const describe = m => ({playerId:m.playerId,playerName:m.playerName||m.sourcePlayerName||'',matchId:m.matchId||m.id,competitionId:m.competitionId,date:m.date,event:m.event,round:m.round,agendaOnly:m.agendaOnly===true});
export function snapshotMatchCoverage({expectedMatches,expectedAdvances,actualMatches,actualAgenda,actualResults}) {
 const history = new Set(actualMatches.map(key)), agenda = new Set(actualAgenda.map(key));
 const missingMatches = expectedMatches.filter(m=>!history.has(key(m)));
 const missingAdvances = expectedAdvances.filter(m=>!agenda.has(key(m)));
 const advanceKeys = new Set(expectedAdvances.map(key));
 const leakedAdvances = [...actualMatches,...actualResults].filter(m=>m.agendaOnly===true||advanceKeys.has(key(m)));
 return {missingSnapshotMatches:missingMatches.length,missingAgendaAdvances:missingAdvances.length,
  leakedAgendaAdvances:leakedAdvances.length,expectedAgendaAdvances:expectedAdvances.length,
  missingMatchDetails:missingMatches.slice(0,10).map(describe),
  missingAdvanceDetails:missingAdvances.slice(0,10).map(describe),
  leakedAdvanceDetails:leakedAdvances.slice(0,10).map(describe)};
}
