// Historical registrations are preserved evidence, not proof a match was played.
const id=e=>[e.playerId,String(e.competitionId||'').toUpperCase()].join('|');
const terminal=e=>e.cancelled===true||e.canceled===true||/withdrawn|cancelled|canceled|removed|excluded|ritirat|annullat/i.test([e.status,e.entryStatus,e.acceptanceList].filter(Boolean).join(' '));
const valid=e=>String(e.circuit||'fitp').toLowerCase()==='fitp'&&e.playerId&&e.competitionId&&!/\bITF\b|TENNIS EUROPE|CAMPIONATO A SQUADRE|GARE A SQUADRE/i.test(e.tournamentName||e.name||'');
export function mergeFitpRegistrationHistory({current=[],previous=[],recovered=[],players=[],today}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('fitp_history_invalid_date');
 const allowed=new Set(players.map(p=>p.id)),cards=new Map(players.map(p=>[p.id,String(p.membershipCard||'')])),out=new Map(),currentById=new Map(current.map(e=>[id(e),e]));
 for(const e of [...recovered,...previous]){
  if(recovered.includes(e)&&e.membershipCard&&cards.get(e.playerId)&&String(e.membershipCard)!==cards.get(e.playerId))continue;
  const end=String(e.endDate||'').slice(0,10),start=String(e.startDate||'').slice(0,10);
  if(!valid(e)||!allowed.has(e.playerId)||terminal(e)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||start>today||end<'2025-12-18')continue;
  out.set(id(e),{...e,tournamentName:e.tournamentName||e.name});
 }
 for(const e of current)if(valid(e)&&allowed.has(e.playerId)&&!out.has(id(e)))out.set(id(e),e);
 return [...out.values()];
}
export function reuseStartedFitpSnapshot(tournament,snapshot,today){
 return Boolean(snapshot&&/^\d{4}-\d{2}-\d{2}$/.test(tournament.startDate||'')&&tournament.startDate<=today);
}

export function validateFitpParticipantResponse(detail,competitionId){
 if(!detail||typeof detail!=='object'||String(detail.CompetitionUid||'').toUpperCase()!==String(competitionId).toUpperCase()||!Array.isArray(detail.Tournaments)||detail.Tournaments.some(t=>!t||typeof t!=='object'||t.Participants!=null&&!Array.isArray(t.Participants)))throw Error('fitp_participant_response_invalid');
 return detail;
}
