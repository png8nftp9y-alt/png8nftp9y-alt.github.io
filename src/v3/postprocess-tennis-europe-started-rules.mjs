import fs from 'node:fs/promises';

const TODAY = new Date().toISOString().slice(0, 10);
const FILE = 'dist/v3/source_tennis_europe_entries.json';
const AUDIT_FILE = 'dist/v3/source_tennis_europe_started_rules_audit.json';

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}
async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
function started(entry) {
  return Boolean(entry.startDate && entry.startDate <= TODAY);
}
function hasDraw(entry) {
  return Array.isArray(entry.draws) && entry.draws.some(v => String(v || '').trim());
}
function isFemaleEntry(entry) {
  const haystack = [
    entry.playerName,
    entry.acceptanceEvent,
    entry.acceptanceList,
    entry.calendarListLabel,
    ...(Array.isArray(entry.draws) ? entry.draws : []),
  ].map(v => String(v || '')).join(' ');
  return /\b(GS|GD)\d{2}\b/i.test(haystack)
    || /\bGirls\b/i.test(haystack)
    || /\bFemminile\b/i.test(haystack)
    || /\bvirginia\b|\bgiulia\b|\baila\b|\bnoemi\b|\bmartina\b|\banna\b|\bcamilla\b|\bmatilde\b/i.test(String(entry.playerName || ''));
}
function clearAcceptanceLabel(entry) {
  return {
    ...entry,
    preTournamentAcceptanceList: entry.acceptanceList || '',
    preTournamentAcceptanceCode: entry.acceptanceCode || '',
    preTournamentAcceptancePosition: entry.acceptancePosition ?? null,
    preTournamentCalendarListLabel: entry.calendarListLabel || '',
    acceptanceList: '',
    acceptanceCode: '',
    acceptancePosition: null,
    calendarListLabel: '',
    calendarDecision: 'kept_started_in_draw_without_label',
    entryStatus: 'started_confirmed_in_draw',
  };
}
function keepFemaleDrawGap(entry) {
  return {
    ...entry,
    calendarDecision: 'kept_started_female_draw_gap_pending_engine_strengthening',
    entryStatus: entry.entryStatus || 'profile_seen_not_on_acceptance_list_yet',
    drawConfirmationPending: true,
    drawConfirmationPendingReason: 'female_te_draw_gap_do_not_remove_while_engine_is_being_strengthened',
  };
}

const data = await readJson(FILE, { entries: [] });
const originalEntries = Array.isArray(data.entries) ? data.entries : [];
const kept = [];
const audit = [];

for (const entry of originalEntries) {
  if (entry.circuit !== 'tennis-europe') {
    kept.push(entry);
    continue;
  }

  const isStarted = started(entry);
  const inDraw = hasDraw(entry);
  const femaleEntry = isFemaleEntry(entry);

  if (!isStarted) {
    kept.push({ ...entry, calendarDecision: entry.acceptanceList === 'Withdrawn' ? 'removed_withdrawn' : 'kept_not_started_acceptance_list_rule' });
    audit.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      competitionId: entry.competitionId,
      tournamentName: entry.tournamentName,
      startDate: entry.startDate,
      tournamentStarted: false,
      foundInDraw: inDraw,
      femaleEntry,
      preTournamentListLabel: entry.calendarListLabel || '',
      calendarDecision: 'kept_not_started_acceptance_list_rule',
    });
    continue;
  }

  if (inDraw) {
    const next = clearAcceptanceLabel(entry);
    kept.push(next);
    audit.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      competitionId: entry.competitionId,
      tournamentName: entry.tournamentName,
      startDate: entry.startDate,
      tournamentStarted: true,
      foundInDraw: true,
      femaleEntry,
      draws: entry.draws,
      preTournamentListLabel: entry.calendarListLabel || '',
      calendarDecision: 'kept_started_in_draw_without_label',
    });
  } else if (femaleEntry) {
    const next = keepFemaleDrawGap(entry);
    kept.push(next);
    audit.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      competitionId: entry.competitionId,
      tournamentName: entry.tournamentName,
      startDate: entry.startDate,
      tournamentStarted: true,
      foundInDraw: false,
      femaleEntry: true,
      preTournamentListLabel: entry.calendarListLabel || '',
      acceptanceList: entry.acceptanceList || '',
      calendarDecision: 'kept_started_female_draw_gap_pending_engine_strengthening',
    });
  } else {
    audit.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      competitionId: entry.competitionId,
      tournamentName: entry.tournamentName,
      startDate: entry.startDate,
      tournamentStarted: true,
      foundInDraw: false,
      femaleEntry: false,
      preTournamentListLabel: entry.calendarListLabel || '',
      acceptanceList: entry.acceptanceList || '',
      calendarDecision: 'removed_started_not_in_draw',
    });
  }
}

const byPlayer = {};
const bySourceMode = {};
const byAcceptance = {};
for (const entry of kept.filter(e => e.circuit === 'tennis-europe')) {
  byPlayer[entry.playerId] = (byPlayer[entry.playerId] || 0) + 1;
  bySourceMode[entry.entryStatus] = (bySourceMode[entry.entryStatus] || 0) + 1;
  byAcceptance[entry.calendarListLabel || entry.entryStatus] = (byAcceptance[entry.calendarListLabel || entry.entryStatus] || 0) + 1;
}

const removed = audit.filter(a => a.calendarDecision === 'removed_started_not_in_draw');
const keptStarted = audit.filter(a => a.calendarDecision === 'kept_started_in_draw_without_label');
const keptFuture = audit.filter(a => a.calendarDecision === 'kept_not_started_acceptance_list_rule');
const keptFemaleDrawGaps = audit.filter(a => a.calendarDecision === 'kept_started_female_draw_gap_pending_engine_strengthening');

const output = {
  ...data,
  status: String(data.status || 'tennis_europe_acceptance_list_engine_complete') + '_started_draw_rules_applied_female_draw_gaps_kept',
  startedTournamentRule: {
    appliedAt: new Date().toISOString(),
    today: TODAY,
    rule: 'Before tournament start use acceptance labels MD/Q/A. From tournament start keep players found in official draw data and remove MD/Q/A labels. Male entries only present in acceptance list but absent from draws are removed. Female entries with draw gaps are kept while the TE draw/event engine is strengthened.',
    originalEntries: originalEntries.length,
    entriesFound: kept.filter(e => e.circuit === 'tennis-europe').length,
    removedStartedNotInDraw: removed.length,
    keptStartedInDrawWithoutLabel: keptStarted.length,
    keptStartedFemaleDrawGapsPending: keptFemaleDrawGaps.length,
    keptNotStartedWithAcceptanceRule: keptFuture.length,
  },
  entriesFound: kept.filter(e => e.circuit === 'tennis-europe').length,
  byPlayer,
  bySourceMode,
  byAcceptance,
  entries: kept,
};

await writeJson(FILE, output);
await writeJson(AUDIT_FILE, {
  generatedAt: new Date().toISOString(),
  today: TODAY,
  summary: output.startedTournamentRule,
  audit,
});

console.log(JSON.stringify(output.startedTournamentRule, null, 2));
