import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const PROVINCES = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','108','109','110','111'];
const OWNER = 'png8nftp9y-alt';
const REPO = 'png8nftp9y-alt.github.io';
const BASELINE_COMMIT = '59f59a8d801baa0f9df5eb2679fbad926f2d75d2';
const BASELINE_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BASELINE_COMMIT}/dist/v3/source_fitp_tournaments.json`;

async function readJson(path, fallback) { try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; } }
async function fetchJson(url) { try { const r = await fetch(url, { headers: { 'user-agent': 'CourtWatch-v3-fitp-province-merger/2.0' } }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); } catch (error) { return { error: error.message, tournaments: [] }; } }
async function writeJson(path, value) { await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true }); await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
const key = t => String(t?.competitionId || t?.guid || '').toUpperCase();
const provinceOf = t => { const match = String(t.location || '').match(/\b([A-Z]{2})$/); return match ? match[1] : ''; };
const monthOf = t => String(t.startDate || '').slice(0, 7) || 'unknown';
function group(values, fn) { const out = {}; for (const value of values) { const k = fn(value) || 'unknown'; out[k] = (out[k] || 0) + 1; } return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))); }

const baseline = await fetchJson(BASELINE_URL);
const baselineMap = new Map((baseline.tournaments || []).map(t => [key(t), t]).filter(([id]) => id));
const provinceMap = new Map();
const provinceStats = [];
const errors = [];

for (const province of PROVINCES) {
  const path = `dist/v3/shards/source_fitp_tournaments_province_${province}.json`;
  const shard = await readJson(path, null);
  if (!shard) { errors.push({ province, error: 'missing province output' }); continue; }
  const shardErrors = (shard.errors || []).length;
  const unresolved = shard.unresolvedSaturations || 0;
  provinceStats.push({ province, generatedAt: shard.generatedAt, status: shard.status, branches: shard.branches, queries: shard.queries, tournamentsFound: shard.tournamentsFound, unresolvedSaturations: unresolved, errors: shardErrors, coverageFrom: shard.coverageFrom, coverageUntil: shard.coverageUntil });
  if (shard.status !== 'fitp_province_shard_complete' || unresolved || shardErrors) errors.push({ province, error: 'incomplete province shard', status: shard.status, unresolvedSaturations: unresolved, errors: shardErrors });
  for (const tournament of shard.tournaments || []) {
    const id = key(tournament);
    if (!id) continue;
    if (!provinceMap.has(id)) provinceMap.set(id, { ...tournament, discoveryShards: [], coverageModes: [] });
    const current = provinceMap.get(id);
    current.discoveryShards = [...new Set([...(current.discoveryShards || []), `province_${province}`])].sort();
    current.coverageModes = [...new Set([...(current.coverageModes || []), ...(tournament.coverageModes || [])])].sort();
  }
}

const tournaments = [...provinceMap.values()].sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || String(a.tournamentName || '').localeCompare(String(b.tournamentName || '')));
const baselineOnly = [...baselineMap.values()].filter(t => !provinceMap.has(key(t)));
const provinceOnly = tournaments.filter(t => !baselineMap.has(key(t)));
const allShardsPresent = provinceStats.length === PROVINCES.length;
const allShardsComplete = allShardsPresent && errors.length === 0;
const coverageFrom = provinceStats.map(x => x.coverageFrom).filter(Boolean).sort()[0] || '';
const coverageUntil = provinceStats.map(x => x.coverageUntil).filter(Boolean).sort().at(-1) || '';
const byStatus = group(tournaments, t => t.status);

const audit = {
  version: 'cw-v3-fitp-province-sharded-v2', generatedAt: NOW,
  status: allShardsComplete ? 'fitp_province_sharded_complete' : 'fitp_province_sharded_incomplete',
  source: 'Province shards are the only catalog source. Historical baseline is comparison-only and is never merged into the official output.',
  coverageFrom, coverageUntil,
  provinceWindow: { expectedProvinceShards: PROVINCES.length, completedProvinceShards: provinceStats.length, completeProvinceShards: provinceStats.filter(x => x.status === 'fitp_province_shard_complete' && !x.unresolvedSaturations && !x.errors).length, queries: provinceStats.reduce((sum, x) => sum + (x.queries || 0), 0), tournamentsFound: tournaments.length },
  baselineAudit: { commit: BASELINE_COMMIT, count: baselineMap.size, url: BASELINE_URL, baselineOnly: baselineOnly.length, provinceOnly: provinceOnly.length, baselineOnlyByProvince: group(baselineOnly, provinceOf), baselineOnlyByMonth: group(baselineOnly, monthOf), provinceOnlyByProvince: group(provinceOnly, provinceOf), provinceOnlyByMonth: group(provinceOnly, monthOf) },
  quality: { provinceSharded: true, baselineMerged: false, allShardsPresent, allShardsComplete, provinceShards: provinceStats, individualOnly: true, tennisEuropeExcluded: true },
  tournamentsFound: tournaments.length, bySource: { 'TORNEI FITP': tournaments.length }, byStatus,
  errors
};

await writeJson('dist/v3/source_fitp_tournaments_audit.json', { ...audit, sample: tournaments.slice(0, 300), baselineOnlySample: baselineOnly.slice(0, 300), provinceOnlySample: provinceOnly.slice(0, 200) });

if (!allShardsComplete) {
  console.error(JSON.stringify(audit, null, 2));
  process.exitCode = 1;
} else {
  const output = { ...audit, tournaments };
  await writeJson('dist/v3/source_fitp_tournaments.json', output);
  console.log(JSON.stringify(audit, null, 2));
}
