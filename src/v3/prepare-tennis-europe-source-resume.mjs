import fs from 'node:fs/promises';
import { auditDate, validateCoverageShards } from './tennis-europe-coverage-audit.mjs';
import { resumeBackfill } from './tennis-europe-backfill-resume.mjs';

const read = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const catalog = await read('history/tennis_europe_tournament_catalog.json');
const mode = process.argv[2];
let env;
if (mode === 'audit') {
  const docs = [];
  for (let shard = 0; shard < 16; shard++) {
    if (shard === 9) continue;
    docs.push(await read(`coverage-shards/europe-coverage-${shard}/coverage-${shard}.json`));
  }
  const first = docs[0];
  const archive = await read('baseline/tennis_europe_oop_historical.json');
  const today = auditDate(first.today, '');
  const rows = Object.values(catalog.tournaments).filter(t => t.endDate >= first.cutoff && t.endDate < today)
    .sort((a,b) => a.competitionId.localeCompare(b.competitionId));
  for (const doc of docs) {
    const expected = rows.filter((_,i) => i % 16 === doc.shard).map(t => t.competitionId).sort();
    const actual = doc.results.map(t => t.competitionId).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error('Audit checkpoint tournament mismatch');
  }
  const placeholder = {...first, shard:9, queued:0, results:[]};
  if (validateCoverageShards([...docs, placeholder]).length ||
      first.catalogGeneratedAt !== catalog.generatedAt ||
      archive.status !== 'green' || String(archive.sourceRunId) !== String(first.baselineSourceRunId) ||
      first.cutoff !== '2025-12-18') throw Error('Audit checkpoint snapshot mismatch');
  env = {TE_AUDIT_TODAY:today, TE_AUDIT_SHARD:9};
} else if (mode === 'backfill') {
  const file = 'checkpoint/backfill-07.json';
  const doc = await read(file);
  const today = auditDate(doc.evaluatedOn, '');
  const cutoff = '2025-12-18';
  const rows = Object.values(catalog.tournaments).filter(t => String(t.endDate||'').slice(0,10) >= cutoff && String(t.endDate||'').slice(0,10) < today)
    .sort((a,b) => String(a.startDate).localeCompare(String(b.startDate)) || a.competitionId.localeCompare(b.competitionId));
  const {completed, pending} = resumeBackfill(doc, rows.filter((_,i) => i % 16 === 7), {shard:7,total:16,cutoff,today});
  const ids = pending.map(t => t.competitionId.toUpperCase()).sort();
  if (ids.join(',') !== '1CD251AA-303D-4B65-A905-EB593D4A946F,2C0482E0-9B40-4E03-8BDC-3A807C0D829C' ||
      completed.some(t => t.oopCompleteness?.version !== 1 || !['complete','deferred_team','cancelled','postponed'].includes(t.oopCompleteness.status)))
    throw Error('Backfill checkpoint differs from the two diagnosed failures');
  env = {TE_OOP_RESUME_FILE:file, TE_OOP_SHARD:7, TE_OOP_TOTAL:16, TE_OOP_TODAY:today, TE_OOP_CUTOFF:cutoff};
} else {
  throw Error('Expected audit or backfill mode');
}
console.log(JSON.stringify(env));
if (process.env.GITHUB_ENV) await fs.appendFile(process.env.GITHUB_ENV, Object.entries(env).map(([k,v]) => k+'='+v+'\n').join(''));
