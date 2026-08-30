import fs from 'node:fs/promises';

const CATALOG_PATH = process.env.TE_CATALOG_PATH || 'history/tennis_europe_tournament_catalog.json';
const OUTPUT_PATH = process.env.TE_OOP_INVENTORY_OUTPUT || 'dist/v3/tennis_europe_oop_inventory.json';
const CUTOFF = process.env.TE_OOP_CUTOFF || '2025-12-18';
const TODAY = process.env.TE_OOP_TODAY || new Date().toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function minusOneDay(value) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const source = Object.values(catalog.tournaments || {});
const invalid = [];
const selected = [];

for (const tournament of source) {
  const id = String(tournament.competitionId || '').trim();
  const startDate = String(tournament.startDate || '').slice(0, 10);
  const endDate = String(tournament.endDate || '').slice(0, 10);
  if (!UUID.test(id) || !/^20\d{2}-\d{2}-\d{2}$/.test(startDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    invalid.push({ competitionId: id, tournamentName: tournament.tournamentName || '', startDate, endDate });
    continue;
  }
  if (endDate < CUTOFF) continue;
  const tMinusOneDate = minusOneDay(startDate);
  const phase = endDate < TODAY ? 'concluded' : startDate <= TODAY ? 'active' : 'future';
  const acquisition = phase === 'concluded' ? 'historical_backfill' : phase === 'active' || TODAY >= tMinusOneDate ? 'live' : 'waiting_t_minus_one';
  selected.push({
    circuit: 'tennis-europe',
    competitionId: id,
    tournamentName: tournament.tournamentName || '',
    location: tournament.location || '',
    startDate,
    endDate,
    tMinusOneDate,
    phase,
    acquisition,
    matchesUrl: 'https://te.tournamentsoftware.com/tournament/' + id + '/matches',
    sourceUrl: tournament.sourceUrl || ''
  });
}

selected.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.competitionId.localeCompare(b.competitionId));
const count = key => selected.filter(t => t.phase === key).length;
const acquisitionCount = key => selected.filter(t => t.acquisition === key).length;
const earliest = selected[0]?.startDate || null;
const latest = selected.at(-1)?.endDate || null;
const result = {
  version: 'te-oop-inventory-v1',
  generatedAt: new Date().toISOString(),
  status: selected.length > 0 && invalid.length === 0 ? 'green' : 'red',
  requestedCutoff: CUTOFF,
  evaluatedOn: TODAY,
  sourceCatalogGeneratedAt: catalog.generatedAt || null,
  coverage: { earliestStartDate: earliest, latestEndDate: latest },
  counts: {
    catalog: source.length,
    eligible: selected.length,
    concluded: count('concluded'),
    active: count('active'),
    future: count('future'),
    historicalBackfill: acquisitionCount('historical_backfill'),
    live: acquisitionCount('live'),
    waitingTMinusOne: acquisitionCount('waiting_t_minus_one'),
    invalid: invalid.length
  },
  invalid,
  tournaments: selected
};

await fs.mkdir(OUTPUT_PATH.split('/').slice(0, -1).join('/'), { recursive: true });
await fs.writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, coverage: result.coverage, counts: result.counts }, null, 2));
if (result.status !== 'green') throw new Error('Tennis Europe OOP inventory is incomplete');
