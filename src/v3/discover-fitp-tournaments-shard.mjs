import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const FROM = '2025-12-18';
const BASE = 'https://dp-myfit-test-function-v2.azurewebsites.net';
const TENNIS = '4332';
const FETCH = 100;
const MAX_PAGES = 80;
const ROOT_WINDOW_DAYS = 7;
const ROOT_OVERLAP_DAYS = 31;
const MIN_SPLIT_DAYS = 1;
const MAX_SPLIT_DEPTH = 0;
const HORIZON_DAYS = 730;
const PROVINCE_ID = String(process.env.FITP_PROVINCE_ID || '');
if (!PROVINCE_ID) throw new Error('FITP_PROVINCE_ID is required for province-sharded discovery');

const REGRESSION_IDS = {
  feniceBresciaLomb370: '676A77A5-3B55-479E-81E2-45F109C25F98',
  rossonikinderImperia: '25C6CC33-AE3A-447E-A55B-FBE66FBAFC80',
  navaKinderMilano3: 'B3110C9E-C6E4-4DE6-A9A3-BAB9B1341D47'
};

const dd = n => String(n).padStart(2, '0');
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const it = d => `${dd(d.getUTCDate())}/${dd(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const isoDate = d => d.toISOString().slice(0, 10);
const iso = v => {
  const s = String(v || '');
  let m = s.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = s.match(/^(\d{1,2})\D(\d{1,2})\D(20\d{2})/);
  return m ? `${m[3]}-${dd(m[2])}-${dd(m[1])}` : '';
};
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const key = r => String(r?.guid || r?.competitionId || '').toUpperCase();
const rawKey = r => `${key(r)}:${String(r?.id_torneo_digital || '')}`;

async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

async function post(body, attempt = 0) {
  const response = await fetch(BASE + '/api/v3/tornei/puc/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 CourtWatch-v3-fitp-province-shard/2.0',
      origin: 'https://www.fitp.it',
      referer: 'https://www.fitp.it/Tornei/Ricerca-tornei'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    if (attempt < 4 && (response.status >= 500 || response.status === 429)) {
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      return post(body, attempt + 1);
    }
    throw new Error(response.status + ' ' + text.slice(0, 180));
  }
  return text ? JSON.parse(text) : null;
}

function basePayload() {
  return { guid: '', profilazione: '', freetext: '', id_regione: '', id_provincia: '', id_stato: '', id_disciplina: TENNIS, sesso: '', data_inizio: '', data_fine: '', tipo_competizione: '', categoria_eta: '', id_classifica: '', classifica: '', massimale_montepremi: '', id_area_regionale: '', ambito: '', cod_fonte: '1', id_fonte: 'TORNEI FITP', rowstoskip: 0, fetchrows: FETCH, sortcolumn: '', sortorder: '' };
}

function reject(row) {
  const id = key(row);
  if (!id || id === '11111111-1111-1111-1111-111111111111') return true;
  if (String(row.id_disciplina || '') !== TENNIS) return true;
  if (String(row.cod_fonte || '') !== '1') return true;
  const name = norm([row.nome_torneo, row.name, row.descrizione, row.id_fonte].join(' '));
  return /TENNIS EUROPE|TE U\s?\d{2}|TENNIS EUROPE JUNIOR TOUR/.test(name);
}

function statusOf(start, end) {
  if (end && end < TODAY) return 'finished';
  if (start && start > TODAY) return 'upcoming';
  return 'active_or_open';
}

function payload(window, skip) {
  const value = basePayload();
  value.id_provincia = PROVINCE_ID;
  value.data_inizio = it(window.start);
  value.data_fine = it(window.end);
  value.rowstoskip = skip;
  return value;
}

function logicalWindows() {
  const start = new Date(FROM + 'T00:00:00Z');
  const limit = addDays(new Date(TODAY + 'T00:00:00Z'), HORIZON_DAYS);
  const windows = [];
  for (let cursor = new Date(start), index = 1; cursor <= limit; cursor = addDays(cursor, ROOT_WINDOW_DAYS), index++) {
    const coreEnd = new Date(Math.min(limit.getTime(), addDays(cursor, ROOT_WINDOW_DAYS - 1).getTime()));
    const end = new Date(Math.min(limit.getTime(), addDays(coreEnd, ROOT_OVERLAP_DAYS).getTime()));
    windows.push({ label: `window_${index}_${isoDate(cursor)}_${isoDate(coreEnd)}_plus_${ROOT_OVERLAP_DAYS}d`, start: new Date(cursor), end, coreEnd, depth: 0 });
  }
  return windows;
}

function splitWindow(window) {
  const span = daysBetween(window.start, window.end) + 1;
  if (span <= MIN_SPLIT_DAYS) return [];
  const leftDays = Math.ceil(span / 2);
  const midpoint = addDays(window.start, leftDays - 1);
  const overlap = Math.min(ROOT_OVERLAP_DAYS, Math.max(0, span - 2));
  const extendLeft = Math.floor(overlap / 2);
  const extendRight = overlap - extendLeft;
  const leftEnd = new Date(Math.min(window.end.getTime(), addDays(midpoint, extendLeft).getTime()));
  const rightStart = new Date(Math.max(window.start.getTime(), addDays(midpoint, 1 - extendRight).getTime()));
  return [
    { label: window.label + 'A', start: new Date(window.start), end: leftEnd, depth: window.depth + 1 },
    { label: window.label + 'B', start: rightStart, end: new Date(window.end), depth: window.depth + 1 }
  ];
}

const byId = new Map();
const coverage = {};
const queries = [];
const errors = [];
const branches = [];
let unresolvedSaturations = 0;
let boundedIncompleteBranches = 0;

async function runBranch(window) {
  const branch = {
    provinceId: PROVINCE_ID,
    windowLabel: window.label,
    start: isoDate(window.start),
    end: isoDate(window.end),
    depth: window.depth,
    pagesRead: 0,
    rowsRead: 0,
    uniqueRows: 0,
    totalDeclared: 0,
    termination: '',
    saturated: false,
    split: false,
    errors: []
  };
  const branchIds = new Set();
  const rawBranchIds = new Set();
  let previousSignature = '';

  for (let page = 0, skip = 0; page < MAX_PAGES; page++, skip += FETCH) {
    let json;
    try {
      json = await post(payload(window, skip));
    } catch (error) {
      const item = { provinceId: PROVINCE_ID, windowLabel: window.label, skip, error: error.message };
      errors.push(item);
      branch.errors.push(item);
      branch.termination = 'request_error';
      break;
    }

    const rows = json?.competizioni || [];
    const total = Number(json?.record || 0);
    const signature = rows.map(rawKey).join('|');
    branch.pagesRead++;
    branch.rowsRead += rows.length;
    branch.totalDeclared = Math.max(branch.totalDeclared, total || 0);

    if (!rows.length) {
      const incomplete = branch.totalDeclared > 0 && rawBranchIds.size < branch.totalDeclared;
      const canSplit = window.depth < MAX_SPLIT_DEPTH && daysBetween(window.start, window.end) > 0;
      branch.termination = incomplete && canSplit ? 'incomplete_empty_page' : incomplete ? 'bounded_incomplete_empty_page' : 'empty_page';
      if (incomplete && !canSplit) boundedIncompleteBranches++;
      queries.push({ provinceId: PROVINCE_ID, windowLabel: window.label, start: branch.start, end: branch.end, skip, rows: 0, total, uniqueRawRows: rawBranchIds.size, termination: branch.termination });
      break;
    }

    const repeated = signature && signature === previousSignature;
    for (const row of rows) rawBranchIds.add(rawKey(row));
    if (repeated) {
      const incomplete = total > 0 && rawBranchIds.size < total;
      const canSplit = window.depth < MAX_SPLIT_DEPTH && daysBetween(window.start, window.end) > 0;
      branch.termination = incomplete && canSplit ? 'repeated_page' : incomplete ? 'bounded_incomplete_repeated_page' : 'declared_total_exhausted';
      if (incomplete && !canSplit) boundedIncompleteBranches++;
      queries.push({ provinceId: PROVINCE_ID, windowLabel: window.label, start: branch.start, end: branch.end, skip, rows: rows.length, total, uniqueRawRows: rawBranchIds.size, termination: branch.termination });
      break;
    }
    previousSignature = signature;

    for (const row of rows) {
      if (reject(row)) continue;
      const id = key(row);
      branchIds.add(id);
      if (!byId.has(id)) byId.set(id, row);
      (coverage[id] ??= new Set()).add(`${PROVINCE_ID}:${window.label}`);
    }

    queries.push({ provinceId: PROVINCE_ID, windowLabel: window.label, start: branch.start, end: branch.end, skip, rows: rows.length, total });

    // FITP can return fewer than FETCH rows before all declared records have
    // been exposed (notably in dense metropolitan searches). Keep paging until
    // an empty page or a repeated page after the declared total is exhausted.
    if (total <= 0 && rows.length < FETCH) {
      branch.termination = 'short_page_without_total';
      break;
    }
    if (page === MAX_PAGES - 1) branch.termination = 'page_cap';
  }

  branch.uniqueRows = branchIds.size;
  branch.saturated = branch.termination === 'page_cap' || branch.termination === 'repeated_page' || branch.termination === 'incomplete_empty_page';

  if (branch.saturated) {
    const parts = splitWindow(window);
    if (parts.length) {
      branch.split = true;
      branches.push(branch);
      for (const part of parts) await runBranch(part);
      return;
    }
    unresolvedSaturations++;
  }
  branches.push(branch);
}

for (const window of logicalWindows()) await runBranch(window);

const tournaments = [...byId.values()].map(row => {
  const startDate = iso(row.data_inizio);
  const rawEnd = iso(row.data_fine);
  const endDate = rawEnd === '1900-01-01' ? '' : rawEnd;
  const id = key(row);
  return {
    circuit: 'fitp', competitionId: id, tournamentName: row.nome_torneo || '',
    location: [row.citta, row.sigla_provincia || row.provincia].filter(Boolean).join(' '),
    startDate, endDate, status: statusOf(startDate, endDate), disciplineId: String(row.id_disciplina || ''),
    sourceCode: String(row.cod_fonte || ''), sourceName: row.id_fonte || '', categoryAge: row.cat_eta || '',
    categoryClass: row.cat_class || '', tournamentType: row.tipo_torneo || '', club: row.tennisclub || '',
    sourceUrl: 'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId=' + encodeURIComponent(id),
    discoveryShard: `province_${PROVINCE_ID}`, coverageModes: [...(coverage[id] || new Set())].sort(), lastSeen: NOW
  };
}).filter(t => !t.endDate || t.endDate >= FROM).sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || String(a.tournamentName || '').localeCompare(String(b.tournamentName || '')));

const ids = new Set(tournaments.map(t => String(t.competitionId).toUpperCase()));
const regression = Object.fromEntries(Object.entries(REGRESSION_IDS).map(([name, id]) => [name, ids.has(id)]));
const status = errors.length ? 'fitp_province_shard_with_errors' : unresolvedSaturations ? 'fitp_province_shard_with_unresolved_saturations' : 'fitp_province_shard_complete';
const out = {
  version: 'cw-v3-fitp-province-shard-v2', generatedAt: NOW, status, provinceId: PROVINCE_ID,
  source: `One FITP province per shard using the official FITP id_provincia value. ${ROOT_WINDOW_DAYS}-day root windows have a ${ROOT_OVERLAP_DAYS}-day forward overlap; recursive splits never add overlap. Pagination continues past premature short pages; fixed overlapping roots provide redundant coverage; incomplete terminal pages are audited without recursive expansion.`,
  coverageFrom: FROM, coverageUntil: isoDate(addDays(new Date(TODAY + 'T00:00:00Z'), HORIZON_DAYS)),
  branches: branches.length, queries: queries.length, tournamentsFound: tournaments.length,
  unresolvedSaturations, boundedIncompleteBranches, regression, tournaments, errors
};

await writeJson(`dist/v3/shards/source_fitp_tournaments_province_${PROVINCE_ID}.json`, out);
await writeJson(`dist/v3/shards/source_fitp_tournaments_province_${PROVINCE_ID}_audit.json`, { ...out, tournaments: undefined, queries, branches, sample: tournaments.slice(0, 200) });
console.log(JSON.stringify({ ...out, tournaments: undefined }, null, 2));
if (errors.length || unresolvedSaturations) process.exitCode = 1;
