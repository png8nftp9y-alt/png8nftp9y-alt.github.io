import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

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

const unreadable = [];
const byTask = new Map();
for (const file of files) {
  try {
    const doc = JSON.parse(gunzipSync(await fs.readFile(file)));
    if (doc?.taskId) byTask.set(doc.taskId, doc);
  } catch (error) {
    unreadable.push({ file, error: error.message });
  }
}
const docs = [...byTask.values()];
const retryDocs = docs.filter(doc => doc.status !== 'complete');
const completeDocs = docs.filter(doc => doc.status === 'complete');
const players = [...new Map(completeDocs.flatMap(doc => doc.players || []).map(player => [player.id || player.name, player])).values()];
const matches = [...new Map(completeDocs.flatMap(doc => doc.matches || []).map(match => [match.matchId || [match.competitionId, match.event, match.roundNumber, match.round].join('|'), match])).values()];
const missing = Math.max(0, expected - byTask.size);
const audit = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: missing || retryDocs.length || unreadable.length ? 'itf_history_draw_merge_incomplete' : 'itf_history_draw_merge_complete',
  expected,
  artifacts: files.length,
  uniqueTasks: byTask.size,
  complete: completeDocs.length,
  retry: retryDocs.length,
  missing,
  unreadable: unreadable.length,
  players: players.length,
  matches: matches.length,
  retryTasks: retryDocs.map(doc => ({ taskId: doc.taskId, competitionId: doc.competitionId, event: doc.event, error: doc.error || '' })),
  unreadableFiles: unreadable
};
await fs.mkdir('dist/v3/shards/itf', { recursive: true });
await fs.mkdir('dist/v3/audits', { recursive: true });
await fs.writeFile('dist/v3/shards/itf/results-0.json.gz', gzipSync(JSON.stringify({
  version: 7,
  generatedAt: audit.generatedAt,
  historicalTMinusOne: true,
  drawTasksChecked: docs.length,
  players,
  matches,
  retryQueue: audit.retryTasks
})));
await fs.writeFile('dist/v3/audits/itf-history-draw-merge.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ ...audit, retryTasks: undefined, unreadableFiles: undefined }, null, 2));
if (missing || retryDocs.length || unreadable.length) process.exitCode = 2;
