import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const INPUT = process.env.FITP_HISTORY_INPUT || 'dist/v3/source_fitp_entries.json';
const HISTORY = process.env.FITP_HISTORY_FILE || 'dist/v3/history/fitp_tournaments.json';

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}

async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

const rowsOf = doc => doc.entries || doc.tournamentEntries || doc.tournaments || [];
const idOf = row => String(row.competitionId || row.guid || '').toUpperCase();
const keyOf = row => `${row.playerId || ''}|${idOf(row)}`;
const isFitpPlayerTournament = row =>
  row.playerId && idOf(row) && String(row.circuit || 'fitp').toLowerCase() === 'fitp';

const currentDoc = await readJson(INPUT, { entries: [] });
const previousDoc = await readJson(HISTORY, { tournaments: [] });
const current = rowsOf(currentDoc).filter(isFitpPlayerTournament);
const previous = rowsOf(previousDoc).filter(isFitpPlayerTournament);
const history = new Map(previous.map(row => [keyOf(row), row]));
const seenNow = new Set();

for (const row of current) {
  const key = keyOf(row);
  const old = history.get(key);
  seenNow.add(key);
  history.set(key, {
    ...old,
    ...row,
    circuit: 'fitp',
    competitionId: idOf(row),
    firstDetectedAt: old?.firstDetectedAt || row.firstDetectedAt || NOW,
    lastSeenAt: row.lastSeenAt || row.lastSeen || NOW,
    presentInLatestSearch: true,
    missingSince: null,
    archivedPermanently: true
  });
}

for (const [key, row] of history) {
  if (seenNow.has(key)) continue;
  history.set(key, {
    ...row,
    presentInLatestSearch: false,
    missingSince: row.missingSince || NOW,
    archivedPermanently: true
  });
}

const tournaments = [...history.values()].sort((a, b) =>
  String(a.startDate || '').localeCompare(String(b.startDate || '')) ||
  String(a.playerName || '').localeCompare(String(b.playerName || ''))
);

const output = {
  version: 'cw-v3-fitp-player-history-v1',
  generatedAt: NOW,
  source: INPUT,
  policy: 'A FITP tournament linked to a tracked player is retained permanently and updated by playerId + competitionId.',
  tournamentsFoundNow: current.length,
  tournamentsInHistory: tournaments.length,
  missingFromLatestSearch: tournaments.filter(row => !row.presentInLatestSearch).length,
  tournaments
};

await writeJson(HISTORY, output);
console.log(JSON.stringify({
  status: 'fitp_player_history_updated',
  file: HISTORY,
  tournamentsFoundNow: output.tournamentsFoundNow,
  tournamentsInHistory: output.tournamentsInHistory,
  missingFromLatestSearch: output.missingFromLatestSearch
}, null, 2));
