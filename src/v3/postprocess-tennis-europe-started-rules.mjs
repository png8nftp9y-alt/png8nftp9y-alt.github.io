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
function eventGender(entry) {
  const eventText = [
    entry.acceptanceEvent,
    entry.preTournamentAcceptanceEvent,
    ...(Array.isArray(entry.draws) ? entry.draws : []),
  ].map(v => String(v || '')).join(' ');
  if (/\b(GS|GD)\d{2}\b/i.test(eventText) || /\bGirls\b/i.test(eventText) || /\bFemminile\b/i.test(eventText)) return 'female';
  if (/\b(BS|BD)\d{2}\b/i.test(eventText) || /\bBoys\b/i.test(eventText) || /\bMaschile\b/i.test(eventText)) return 'male';
  if (entry.eventGender === 'female' || entry.gender === 'female' || entry.sex === 'F') return 'female';
  if (entry.eventGender === 'male' || entry.gender === 'male' || entry.sex === 'M') return 'male';
  return 'unknown';
}
function clearAcceptanceLabel(entry) {
  return {
    ...entry,
    eventGender: eventGender(entry),
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
  const gender = eventGender(entry);

  if (!isStarted) {
    kept.push({ ...entry, eventGender: gender, calendarDecision: entry.acceptanceList === 'Withdrawn' ? 'removed_withdrawn' : 'kept_not_started_acceptance_list_rule' });
    audit.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      competitionId: entry.competitionId,
      tournamentName: entry.tournamentName,
      startDate: entry.startDate,
      tournamentStarted: false,
      foundInDraw: inDraw,
      eventGender: gender,
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
      eventGender: gender,
      draws: entry.draws,
      preTournamentListLabel: entry.calendarListLabel || '',
      calendarDecision: 'kept_started_in_draw_without_label',
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
      eventGender: gender,
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

const output = {
  ...data,
  status: String(data.status || 'tennis_europe_acceptance_list_engine_complete') + '_started_draw_rules_applied_same_rule_all_events',
  startedTournamentRule: {
    appliedAt: new Date().toISOString(),
    today: TODAY,
    rule: 'Same rule for boys and girls: before tournament start use acceptance labels MD/Q/A; from tournament start keep only players found in official draw data and remove MD/Q/A labels; remove players only present in acceptance list but absent from draws.',
    originalEntries: originalEntries.length,
    entriesFound: kept.filter(e => e.circuit === 'tennis-europe').length,
    removedStartedNotInDraw: removed.length,
    keptStartedInDrawWithoutLabel: keptStarted.length,
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
