const active = (t) =>
  !["eliminated", "excluded", "withdrawn"].includes(
    String(t.status || "").toLowerCase(),
  ) && String(t.acceptanceList || "").toLowerCase() !== "withdrawn";
const overlap = () => false;
function tournamentConcluded(t, today = iso(new Date())) {
  const end = String(t?.endDate || t?.officialEndDate || t?.startDate || "").slice(0,10);
  return (/^\d{4}-\d{2}-\d{2}$/.test(end) && end < today) || /^(finished|completed|concluso)$/i.test(String(t?.status || ""));
}
function tournamentCancelled(t) {
  return t?.cancelled === true || t?.canceled === true || t?.source?.cancelled === true ||
    /cancelled|canceled|annullat/i.test([t?.status,t?.tournamentStatus,t?.source?.status].filter(Boolean).join(" "));
}
// Keep already verified begun ITF history when a later projection repeats old acceptance data.
function verifiedItfTournament(t, today = iso(new Date())) {
  const start = String(t?.qualificationStartDate || t?.startDate || t?.officialStartDate || '').slice(0,10);
  return Boolean(t?.playerId && t?.competitionId && t.circuit === 'itf' && (t.drawConfirmed === true || /draw_confirmed|official_draw|confirmed_in_official_draw/i.test([t.calendarState,t.entryStatus].join(' '))));
}
function mergeVerifiedItfTournamentRows(rows, today = iso(new Date())) {
  const merged = new Map();
  for (const row of rows || []) {
    const key = [row.playerId, row.circuit || row.sourceId || '', String(row.competitionId || row.id || row.name).toUpperCase()].join('|');
    const old = merged.get(key);
    const proof = t => Boolean(t && (t.drawConfirmed === true || /draw_confirmed|official_draw|confirmed_in_official_draw/i.test([t.calendarState,t.entryStatus].join(' '))));
    const start = String(old?.qualificationStartDate || old?.startDate || old?.officialStartDate || '').slice(0,10);
    if (row.playerId && row.competitionId && row.circuit === 'itf' && old && proof(old)) {
      const next = {...old,...row,calendarState:'draw_confirmed',entryStatus:'official_draw',drawConfirmed:true,cancelled:false,canceled:false,acceptanceCode:'',acceptancePosition:null,acceptanceList:'',calendarListLabel:''};
      if (/withdrawn|removed|excluded|ritirat|cancelled|canceled/i.test(next.status || '')) next.status = 'detected';
      merged.set(key,next);
    } else merged.set(key,row);
  }
  return [...merged.values()];
}
function playerTournamentEligible(t) {
  if (t?.circuit === 'itf' && (t.drawConfirmed === true || /draw_confirmed|official_draw|confirmed_in_official_draw/i.test([t.calendarState,t.entryStatus].join(' ')))) return true;
  if (tournamentCancelled(t)) return false;
  if (/withdrawn|removed|excluded|ritirat/i.test([t?.entryStatus,t?.status,t?.acceptanceList].join(" ")) || /^W(?:-|$)/i.test(String(t?.acceptanceCode || ""))) return false;
  const confirmed = /draw_confirmed|official_draw/i.test([t?.calendarState,t?.entryStatus].join(" ")) || t?.drawConfirmed === true;
  if (tournamentConcluded(t) && confirmed) return true;
  const code = String(t?.acceptanceCode || t?.acceptanceList || t?.entryStatus || "").split("-")[0].toUpperCase();
  if (tournamentConcluded(t) && /^(A|ALTERNATE|ALTERNATES)$/.test(code) && !confirmed) return false;
  return active(t);
}

function effectiveAcceptanceLabel(entry) {
  if (tournamentConcluded(entry)) return "";
  return /(?:draw_confirmed|official_draw)/i.test(`${entry?.calendarState || ""} ${entry?.entryStatus || ""}`) ? "" : entry?.calendarListLabel || "";
}

function groups() {}
