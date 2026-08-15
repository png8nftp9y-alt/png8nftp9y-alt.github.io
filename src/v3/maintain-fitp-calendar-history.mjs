import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const FROM = '2025-12-18';
const FORMER_PLAYERS = new Set(['martina-busa','manuel-natale','pietro-sala','niccolo-zanaga']);
const readJson = async (path, fallback) => { try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; } };
const writeJson = async (path, value) => { await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true }); await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n'); };
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const idOf = entry => `fitp:${String(entry.competitionId || '').toUpperCase()}:${entry.playerId}`;
const excluded = entry => {
  const name = norm(entry.tournamentName || entry.name);
  return String(entry.circuit || '').toLowerCase() !== 'fitp' ||
    FORMER_PLAYERS.has(entry.playerId) ||
    String(entry.startDate || '') < FROM ||
    /(^| )ITF( |$)|TENNIS EUROPE|CAMPIONATO A SQUADRE|GARE A SQUADRE/.test(name);
};

const source = await readJson('dist/v3/tournament_entries.json', null);
if (!source || !Array.isArray(source.tournamentEntries) || !source.generatedAt) throw new Error('A complete tournament_entries.json is required');
const ageHours = (Date.now() - Date.parse(source.generatedAt)) / 36e5;
if (!Number.isFinite(ageHours) || ageHours > 36) throw new Error(`tournament_entries.json is stale (${ageHours.toFixed(1)}h)`);

const previous = await readJson('history/player_tournaments.json', { entries: [] });
const confirmed = source.tournamentEntries.filter(entry => !excluded(entry) && entry.competitionId && entry.playerId);
const unique = new Map(confirmed.map(entry => [idOf(entry), {
  ...entry,
  calendarStatus: 'confirmed',
  firstConfirmedAt: previous.entries?.find(old => idOf(old) === idOf(entry))?.firstConfirmedAt || entry.lastSeen || source.generatedAt,
  lastConfirmedAt: entry.lastSeen || source.generatedAt
}]));
const entries = [...unique.values()].sort((a,b) => String(a.startDate).localeCompare(String(b.startDate)) || String(a.playerName).localeCompare(String(b.playerName)));
const currentIds = new Set(entries.map(idOf));
const removed = (previous.entries || []).filter(entry => !currentIds.has(idOf(entry))).map(entry => ({ id: idOf(entry), playerId: entry.playerId, competitionId: entry.competitionId, removedAt: NOW, reason: 'not_in_latest_complete_official_list' }));

await writeJson('history/player_tournaments.json', { version: 'cw-v3-calendar-history-v1', generatedAt: NOW, rule: 'Contains only confirmed FITP registrations that must remain on the calendar. Cancelled or absent registrations are removed after a successful source build.', entries });
await writeJson('history/audit.json', { version: 'cw-v3-calendar-history-audit-v1', generatedAt: NOW, sourceGeneratedAt: source.generatedAt, entries: entries.length, removedThisRun: removed.length, removed });

const calendar = await readJson('dist/v3/tournaments.json', { tournaments: [] });
const nonFitp = (calendar.tournaments || []).filter(item => String(item.circuit || item.source || '').toLowerCase() !== 'fitp');
const fitpCalendar = entries.map(entry => ({ ...entry, name: entry.tournamentName, source: 'fitp', circuit: 'fitp', historyManaged: true }));
await writeJson('dist/v3/tournaments.json', { ...calendar, generatedAt: NOW, tournaments: [...nonFitp, ...fitpCalendar] });
console.log(JSON.stringify({ generatedAt: NOW, confirmed: entries.length, removed: removed.length, nonFitpPreserved: nonFitp.length }, null, 2));
