import fs from 'node:fs/promises';

const audit = JSON.parse(await fs.readFile('dist/v3/source_itf_draw_entry_discovery_audit.json', 'utf8'));
const entries = audit.entries || [];
const tournaments = new Map();
for (const entry of entries) {
  const key = String(entry.competitionId || '');
  if (!key) continue;
  const current = tournaments.get(key) || {
    competitionId: key,
    tournamentName: entry.tournamentName || '',
    location: entry.location || '',
    startDate: entry.startDate || '',
    endDate: entry.endDate || '',
    sourceUrl: entry.sourceUrl || '',
    players: []
  };
  if (!current.players.some(player => player.playerId === entry.playerId)) {
    current.players.push({ playerId: entry.playerId, playerName: entry.playerName });
  }
  tournaments.set(key, current);
}
const list = [...tournaments.values()]
  .map(tournament => ({ ...tournament, players: tournament.players.sort((a, b) => a.playerName.localeCompare(b.playerName)) }))
  .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.tournamentName.localeCompare(b.tournamentName));
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  trackedPlayersFound: new Set(entries.map(entry => entry.playerId)).size,
  playerTournamentOccurrences: entries.length,
  tournamentsWithTrackedPlayers: list.length,
  tournaments: list
};
await fs.mkdir('dist/v3/audits', { recursive: true });
await fs.writeFile('dist/v3/audits/itf-history-player-tournaments.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  trackedPlayersFound: report.trackedPlayersFound,
  playerTournamentOccurrences: report.playerTournamentOccurrences,
  tournamentsWithTrackedPlayers: report.tournamentsWithTrackedPlayers
}, null, 2));
