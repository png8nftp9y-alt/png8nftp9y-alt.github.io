import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempRoot = path.join(process.cwd(), '.tmp');
await fs.mkdir(tempRoot, { recursive: true });
const dir = await fs.mkdtemp(path.join(tempRoot, 'courtwatch-fitp-history-'));
const input = path.join(dir, 'current.json');
const history = path.join(dir, 'history.json');
const script = new URL('./update-fitp-player-history.mjs', import.meta.url);

async function run(entries) {
  await fs.writeFile(input, JSON.stringify({ entries }));
  const result = spawnSync(process.execPath, [script.pathname], {
    env: { ...process.env, FITP_HISTORY_INPUT: input, FITP_HISTORY_FILE: history },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(await fs.readFile(history, 'utf8'));
}

const tournament = {
  circuit: 'fitp', playerId: 'player-a', playerName: 'Player A',
  competitionId: 'ABC-123', tournamentName: 'Torneo Gennaio',
  startDate: '2026-01-16', endDate: '2026-01-28'
};

const first = await run([tournament]);
assert.equal(first.tournamentsInHistory, 1);
assert.equal(first.tournaments[0].presentInLatestSearch, true);

const second = await run([]);
assert.equal(second.tournamentsInHistory, 1);
assert.equal(second.missingFromLatestSearch, 1);
assert.equal(second.tournaments[0].competitionId, 'ABC-123');
assert.equal(second.tournaments[0].presentInLatestSearch, false);
assert.equal(second.tournaments[0].archivedPermanently, true);

await fs.rm(dir, { recursive: true, force: true });
console.log(JSON.stringify({ status: 'fitp_player_history_test_passed', retained: 'ABC-123' }));
