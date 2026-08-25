import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { aliases, norm, readJson } from './itf-common.mjs';

const root = process.env.ITF_DRAW_TASK_DIR || 'dist/v3/shards/itf/draw-tasks';
const expected = Number(process.env.ITF_EXPECTED_TASKS || 4291);
const files = [];
async function walk(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.json.gz')) files.push(full);
  }
}
await walk(root);

const former = new Set(((await readJson('former-players.json', { players: [] })).players || []).map(p => p.id));
const tracked = ((await readJson('players.json', { players: [] })).players || []).filter(p => !former.has(p.id));
const aliasesByPlayer = tracked.map(player => ({ player, names: aliases(player) }));
const tournamentMap = await readJson('dist/v3/source_itf_tournaments.json', { tournaments: [] });
const tournamentsById = new Map((tournamentMap.tournaments || []).map(t => [String(t.competitionId), t]));

const byTask = new Map();
const unreadable = [];
for (const file of files) {
  try {
    const doc = JSON.parse(gunzipSync(await fs.readFile(file)));
    if (doc?.taskId) byTask.set(doc.taskId, doc);
  } catch (error) {
    unreadable.push({ file, error: error.message });
  }
}
const docs = [...byTask.values()];
const retry = docs.filter(doc => doc.status !== 'complete');
const hits = new Map();
for (const doc of docs.filter(doc => doc.status === 'complete')) {
  for (const raw of doc.players || []) {
    const name = String(raw.name || [raw.givenName, raw.familyName].filter(Boolean).join(' ')).trim();
    if (!name) continue;
    const normalized = norm(name);
    const found = aliasesByPlayer.find(item => item.names.includes(normalized));
    if (!found) continue;
    const competitionId = String(doc.competitionId || '');
    const key = `${found.player.id}|${competitionId}`;
    const tournament = tournamentsById.get(competitionId) || {};
    const existing = hits.get(key) || {
      playerId: found.player.id,
      playerName: found.player.name,
      competitionId,
      tournamentName: tournament.tournamentName || '',
      location: tournament.location || '',
      startDate: tournament.startDate || '',
      endDate: tournament.endDate || '',
      sourceUrl: tournament.sourceUrl || '',
      events: []
    };
    if (doc.event && !existing.events.includes(doc.event)) existing.events.push(doc.event);
    hits.set(key, existing);
  }
}
const occurrences = [...hits.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.playerName.localeCompare(b.playerName));
const tournaments = new Map();
for (const hit of occurrences) {
  const current = tournaments.get(hit.competitionId) || {
    competitionId: hit.competitionId,
    tournamentName: hit.tournamentName,
    location: hit.location,
    startDate: hit.startDate,
    endDate: hit.endDate,
    sourceUrl: hit.sourceUrl,
    players: []
  };
  if (!current.players.some(player => player.playerId === hit.playerId)) current.players.push({ playerId: hit.playerId, playerName: hit.playerName });
  tournaments.set(hit.competitionId, current);
}
const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  expectedDrawTasks: expected,
  uniqueDrawTasks: byTask.size,
  completeDrawTasks: docs.length - retry.length,
  retry: retry.length,
  missing: Math.max(0, expected - byTask.size),
  unreadable: unreadable.length,
  trackedPlayersFound: new Set(occurrences.map(hit => hit.playerId)).size,
  playerTournamentOccurrences: occurrences.length,
  tournamentsWithTrackedPlayers: tournaments.size,
  occurrences,
  tournaments: [...tournaments.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.competitionId.localeCompare(b.competitionId))
};
await fs.mkdir('dist/v3/audits', { recursive: true });
await fs.writeFile('dist/v3/audits/itf-history-player-tournaments.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  expectedDrawTasks: report.expectedDrawTasks,
  uniqueDrawTasks: report.uniqueDrawTasks,
  completeDrawTasks: report.completeDrawTasks,
  retry: report.retry,
  missing: report.missing,
  unreadable: report.unreadable,
  trackedPlayersFound: report.trackedPlayersFound,
  playerTournamentOccurrences: report.playerTournamentOccurrences,
  tournamentsWithTrackedPlayers: report.tournamentsWithTrackedPlayers
}, null, 2));
if (report.retry || report.missing || report.unreadable) process.exitCode = 2;
