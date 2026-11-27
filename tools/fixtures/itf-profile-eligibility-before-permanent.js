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
function playerTournamentEligible(t) {
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
function canonicalPlayerMatches(items) {
  const players = new Map();
  for (const match of (items || []).filter(match => circuit(match) === "tennis-europe")) {
    const rows = players.get(match.playerId) || [];
    rows.push(match);
    players.set(match.playerId, rows);
  }
  return [...players.values()].flatMap(rows =>
    dedupeAgendaMatches(mergeAgenda([], rows)));
}

function normalizeMatchProjection() {}
