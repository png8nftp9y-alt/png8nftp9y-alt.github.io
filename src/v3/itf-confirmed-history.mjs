// Draw evidence is stronger than a later acceptance snapshot for a begun event.
export const itfEntryKey = e => `${e.playerId}|${String(e.competitionId || '').toUpperCase()}`;
export function confirmedItfEntry(e) {
 return Boolean(e?.playerId && /^J-/.test(String(e.competitionId || '')) &&
  (!e.circuit || e.circuit === 'itf') &&
  (/draw_confirmed|confirmed_in_official_draw|official_draw/.test(`${e.calendarState || ''} ${e.entryStatus || ''}`) || e.drawConfirmed === true));
}
export function begunItfEntry(e, today) {
 const start = e?.qualificationStartDate || e?.startDate || e?.officialStartDate;
 return /^\d{4}-\d{2}-\d{2}$/.test(start || '') && start <= today;
}
const entryFields = e => Object.fromEntries(Object.entries(e || {}).filter(([k]) => !['drawEntry','acceptanceEntry','drawDecision','removalReason','removedAt','withdrawnAt','lastDrawCheckedAt','firstSeenInAcceptanceAt','lastSeenInAcceptanceAt'].includes(k)));
export function mergeConfirmedItfHistory(entries, evidence, today) {
 const rows = new Map(entries.map(e => [itfEntryKey(e), e]));
 for (const e of evidence) {
  if (!confirmedItfEntry(e)) continue;
  const key = itfEntryKey(e), current = rows.get(key);
  if (current?.worldTennisId && e.worldTennisId && String(current.worldTennisId) !== String(e.worldTennisId)) throw Error(`Conflicting ITF identity: ${key}`);
  const merged = {...entryFields(current), ...entryFields(e)};
  if (/withdrawn|removed|excluded|cancelled|canceled/.test(merged.status || '')) merged.status = 'detected';
  rows.set(key, {...merged, cancelled:false, canceled:false, acceptanceCode:'', acceptancePosition:null, calendarListLabel:'', acceptanceList:'',
   entryStatus:'draw_confirmed', calendarState:'draw_confirmed', drawConfirmed:true});
 }
 return [...rows.values()];
}
export function preserveConfirmedItfTargets(targets, evidence, today) {
 const next = {...targets};
 const rows = mergeConfirmedItfHistory([], evidence, today);
 for (const e of rows) {
  const key = itfEntryKey(e), old = next[key] || {};
  if (old.worldTennisId && e.worldTennisId && String(old.worldTennisId) !== String(e.worldTennisId)) throw Error(`Conflicting ITF target identity: ${key}`);
  next[key] = {...old, ...e, acceptanceEntry:old.acceptanceEntry ? entryFields(old.acceptanceEntry) : null, drawDecision:'confirmed', drawEntry:e};
  delete next[key].removalReason; delete next[key].removedAt; delete next[key].withdrawnAt;
 }
 return next;
}
export function itfTargetEvidence(doc) {
 return Object.values(doc?.targets || {}).flatMap(t => [t.drawEntry, t]).filter(Boolean);
}
