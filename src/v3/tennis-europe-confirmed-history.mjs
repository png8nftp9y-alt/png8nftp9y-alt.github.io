// Only positive draw evidence is permanent; acceptance, names and draw URLs are not proof.
export const europeKey = e => `${e.playerId}|${e.circuit}|${String(e.competitionId || '').toUpperCase()}`;
export function confirmedEurope(e) {
 return Boolean(e?.playerId && e?.competitionId && e.circuit === 'tennis-europe' &&
  (e.drawConfirmed === true || /draw_confirmed|official_draw|confirmed_in_official_draw/i.test(`${e.calendarState || ''} ${e.entryStatus || ''}`)));
}
export function permanentEurope(e) {
 return {...e,circuit:'tennis-europe',drawConfirmed:true,calendarState:'draw_confirmed',entryStatus:'official_draw',
  status:'detected',cancelled:false,canceled:false,acceptanceCode:'',acceptancePosition:null,acceptanceList:'',calendarListLabel:''};
}
export function europeRelationEvidence(document) {
 return Object.values(document?.relations || {}).filter(r => r.permanenceStatus === 'draw_confirmed_permanent' || r.calendarState === 'draw_confirmed')
  .map(r => permanentEurope({...r,tournamentName:r.tournamentName || r.name || '',acceptanceEvent:r.acceptanceEvent || r.event || 'singles'}));
}
export function mergeConfirmedEurope(current,evidence) {
 const rows = new Map();
 for (const row of current || []) {
  const key=europeKey(row),prior=rows.get(key);
  rows.set(key,confirmedEurope(prior)?permanentEurope({...row,...prior}):confirmedEurope(row)?permanentEurope(row):row);
 }
 for (const proof of evidence || []) {
  if (!confirmedEurope(proof)) continue;
  const key=europeKey(proof),prior=rows.get(key);
  // Preserve the precise positive proof and its metadata rather than stale acceptance fields.
  rows.set(key,permanentEurope({...prior,...proof}));
 }
 return [...rows.values()];
}
