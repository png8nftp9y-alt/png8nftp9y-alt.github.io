import fs from 'node:fs/promises';

const BASE = 'https://dp-myfit-test-function-v2.azurewebsites.net';
const PLAYER_ID = 'virginia-cereghini';
const COVERAGE_FROM = '2025-12-18';
const DAYS_AHEAD = 420;
const CONCURRENCY = 10;

const now = new Date();
const coverageStart = new Date(`${COVERAGE_FROM}T00:00:00Z`);
const coverageUntilDate = new Date(now.getTime() + DAYS_AHEAD * 864e5);
const coverageUntil = coverageUntilDate.toISOString().slice(0, 10);

const norm = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();

const iso = value => {
  const s = String(value || '');
  let m = s.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\D(\d{1,2})\D(20\d{2})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};
const it = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const overlaps = (start, end) => (!end || end >= COVERAGE_FROM) && (!start || start <= coverageUntil);

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 CourtWatch-Virginia-FITP/1.0',
      origin: 'https://www.fitp.it',
      referer: 'https://www.fitp.it/Tornei/Ricerca-tornei'
    },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function listPayload({ term, start, end }, skip) {
  return {
    guid: '', profilazione: '', freetext: term,
    id_regione: '', id_provincia: '', id_stato: '', id_disciplina: '', sesso: '',
    data_inizio: it(start), data_fine: it(end), tipo_competizione: '', categoria_eta: '',
    id_classifica: '', classifica: '', massimale_montepremi: '', id_area_regionale: '', ambito: '',
    rowstoskip: skip, fetchrows: 100, sortcolumn: '', sortorder: ''
  };
}

const playersDoc = JSON.parse(await fs.readFile('players.json', 'utf8'));
const data = JSON.parse(await fs.readFile('data.json', 'utf8'));
const player = (playersDoc.players || []).find(p => p.id === PLAYER_ID);
if (!player) throw new Error(`Missing player ${PLAYER_ID}`);

const nameParts = player.name.split(/\s+/).filter(Boolean);
const surname = nameParts[nameParts.length - 1] || 'Cereghini';
const first = nameParts[0] || 'Virginia';
const aliases = new Set([player.name, `${surname} ${first}`, first, surname, ...(player.aliases || [])].map(norm));
const terms = [
  '', player.name, `${surname} ${first}`, surname, first,
  'CEREGHINI', 'VIRGINIA', 'UNDER 13', 'UNDER 14', 'U13', 'U14',
  'FEMMINILE', 'JUNIOR', 'NEXT GEN', 'CAMPIONATI ITALIANI', 'QUALIFICAZIONE',
  'KINDER', 'RODEO', 'TENNIS TROPHY', 'TE', 'TENNIS EUROPE'
];

const specs = [];
for (let start = new Date(Date.UTC(coverageStart.getUTCFullYear(), coverageStart.getUTCMonth(), coverageStart.getUTCDate())); start <= coverageUntilDate; start = new Date(start.getTime() + 7 * 864e5)) {
  const end = new Date(Math.min(coverageUntilDate.getTime(), start.getTime() + 6 * 864e5));
  for (const term of terms) specs.push({ term, start, end });
}

const listErrors = [];
const queries = [];
const byGuid = new Map();
let specIndex = 0;
async function listWorker() {
  while (specIndex < specs.length) {
    const spec = specs[specIndex++];
    for (let skip = 0, total = Infinity; skip < total && skip < 2000; skip += 100) {
      try {
        const r = await post('/api/v3/tornei/puc/list', listPayload(spec, skip));
        const rows = r?.competizioni || [];
        total = Number(r?.record || rows.length || 0);
        const official = rows.filter(x => Number(x.cod_fonte) === 1 && x.guid && x.guid !== '11111111-1111-1111-1111-111111111111');
        for (const c of official) byGuid.set(String(c.guid).toUpperCase(), c);
        queries.push({ term: spec.term || 'ALL', start: it(spec.start), end: it(spec.end), skip, record: total, rows: rows.length, official: official.length });
        if (rows.length < 100) break;
      } catch (e) {
        listErrors.push({ term: spec.term || 'ALL', start: it(spec.start), end: it(spec.end), skip, error: e.message });
        break;
      }
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, listWorker));

// Add already-known FITP competitions as safety net, then re-validate detail for Virginia only.
for (const t of data.tournaments || []) {
  if (t.sourceId === 'fitp-puc' && t.competitionId) {
    byGuid.set(String(t.competitionId).toUpperCase(), { guid: t.competitionId, nome_torneo: t.name, data_inizio: t.startDate, data_fine: t.endDate, citta: t.location });
  }
}

const competitions = [...byGuid.values()].filter(c => overlaps(iso(c.data_inizio || c.startDate), iso(c.data_fine || c.endDate)));
const found = [];
const details = [];
const detailErrors = [];
let detailIndex = 0;
function participantMatches(q) {
  const full = norm(`${q.Name || ''} ${q.Surname || ''}`);
  const fullAlt = norm(`${q.Surname || ''} ${q.Name || ''}`);
  const card = String(q.MembershipCard || '').replace(/\D/g, '');
  const expectedCard = String(player.membershipCard || '').replace(/\D/g, '');
  return (expectedCard && card && card === expectedCard) || aliases.has(full) || aliases.has(fullAlt);
}
async function detailWorker() {
  while (detailIndex < competitions.length) {
    const c = competitions[detailIndex++];
    try {
      const d = await post('/api/v3/puc/competizione/dettaglio', { competitionUid: c.guid });
      if (!d) continue;
      const draws = [];
      let membershipCard = '';
      let ranking = '';
      for (const draw of d.Tournaments || []) {
        for (const q of draw.Participants || []) {
          if (!participantMatches(q)) continue;
          draws.push(draw.TournamentDescription || draw.Description || 'Tabellone');
          membershipCard ||= q.MembershipCard || '';
          ranking ||= q.Ranking || '';
        }
      }
      if (!draws.length) continue;
      const startDate = iso(d.From || c.data_inizio || c.startDate);
      const endDate = iso(d.To || c.data_fine || c.endDate);
      if (!overlaps(startDate, endDate)) continue;
      const name = d.Description || c.nome_torneo || c.name || 'Torneo FITP';
      const location = [d.Municipality || c.citta, d.Province || c.provincia].filter(Boolean).join(' ');
      const entry = {
        player: player.name,
        playerId: player.id,
        competition: name,
        competitionId: c.guid,
        draws: [...new Set(draws)],
        startDate,
        endDate,
        location,
        membershipCard,
        ranking,
        url: 'https://www.fitp.it/Tornei/Dettaglio-Competizione?competitionId=' + encodeURIComponent(c.guid)
      };
      found.push(entry);
      details.push({ guid: c.guid, name, players: [player.name] });
    } catch (e) {
      detailErrors.push({ guid: c.guid, error: e.message });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, detailWorker));

found.sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')) || a.competition.localeCompare(b.competition));
const uniqueFound = [...new Map(found.map(f => [String(f.competitionId).toUpperCase(), f])).values()];

// Replace only Virginia FITP/P.U.C. tournaments; leave TE official and all other players untouched.
const oldCount = (data.tournaments || []).filter(t => t.playerId === PLAYER_ID && t.sourceId === 'fitp-puc').length;
data.tournaments = (data.tournaments || []).filter(t => !(t.playerId === PLAYER_ID && t.sourceId === 'fitp-puc'));
for (const f of uniqueFound) {
  data.tournaments.push({
    key: `fitp-${String(f.competitionId).toLowerCase()}|${PLAYER_ID}`,
    playerId: PLAYER_ID,
    playerName: player.name,
    name: f.competition,
    location: f.location || '',
    sourceId: 'fitp-puc',
    sourceName: 'P.U.C. FITP',
    url: f.url,
    startDate: f.startDate,
    endDate: f.endDate,
    status: f.endDate && f.endDate < now.toISOString().slice(0, 10) ? 'finished' : f.startDate && f.startDate > now.toISOString().slice(0, 10) ? 'upcoming' : 'active',
    competitionId: f.competitionId,
    draws: f.draws,
    playerRanking: f.ranking,
    membershipCard: f.membershipCard || player.membershipCard || '',
    lastSeen: now.toISOString(),
    searchScope: 'virginia-fitp-only'
  });
}

data.generatedAt = now.toISOString();
data.virginiaFitpDiscovery = {
  lastRun: now.toISOString(),
  status: detailErrors.length ? 'complete_with_detail_errors' : 'complete',
  player: player.name,
  playerId: PLAYER_ID,
  membershipCard: player.membershipCard || '',
  coverageFrom: COVERAGE_FROM,
  coverageUntil,
  method: 'Ricerca riscritta solo per Virginia Cereghini: finestre settimanali dal 18/12/2025, termini dedicati, paginazione completa, conferma sul dettaglio competizione per tessera/alias.',
  queryWindows: Math.ceil((coverageUntilDate - coverageStart) / 864e5 / 7),
  queries: queries.length,
  successfulQueries: queries.filter(q => !q.error).length,
  competitionsChecked: competitions.length,
  previousVirginiaFitpTournaments: oldCount,
  found: uniqueFound,
  details,
  listErrors: listErrors.slice(0, 100),
  detailErrors: detailErrors.slice(0, 100)
};

await fs.writeFile('data.json', JSON.stringify(data, null, 2) + '\n');
await fs.writeFile('virginia-fitp-discovery.json', JSON.stringify(data.virginiaFitpDiscovery, null, 2) + '\n');
console.log(JSON.stringify({ status: data.virginiaFitpDiscovery.status, coverageFrom: COVERAGE_FROM, coverageUntil, queries: queries.length, competitionsChecked: competitions.length, previousVirginiaFitpTournaments: oldCount, found: uniqueFound.length, errors: listErrors.length + detailErrors.length, tournaments: uniqueFound.map(x => ({ name: x.competition, startDate: x.startDate, endDate: x.endDate, draws: x.draws })) }, null, 2));
