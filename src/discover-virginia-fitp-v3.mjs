import fs from 'node:fs/promises';

const PLAYER_ID = 'virginia-cereghini';
const COVERAGE_FROM = '2025-12-18';
const BASE = 'https://dp-myfit-test-function-v2.azurewebsites.net';
const now = new Date().toISOString();

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

const itDate = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth()+1).padStart(2, '0')}/${d.getUTCFullYear()}`;

async function post(path, body) {
  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 CourtWatch-Virginia-FITP-v3/1.0',
      origin: 'https://www.fitp.it',
      referer: 'https://www.fitp.it/Tornei/Ricerca-tornei'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function listPayload({ term, start, end }, skip) {
  return {
    guid: '', profilazione: '', freetext: term,
    id_regione: '', id_provincia: '', id_stato: '', id_disciplina: '', sesso: '',
    data_inizio: itDate(start), data_fine: itDate(end), tipo_competizione: '', categoria_eta: '',
    id_classifica: '', classifica: '', massimale_montepremi: '', id_area_regionale: '', ambito: '',
    rowstoskip: skip, fetchrows: 100, sortcolumn: '', sortorder: ''
  };
}

const players = JSON.parse(await fs.readFile('players.json', 'utf8')).players || [];
const data = JSON.parse(await fs.readFile('data.json', 'utf8'));
const player = players.find(p => p.id === PLAYER_ID);
if (!player) throw new Error(`Missing ${PLAYER_ID}`);

const playerAliases = new Set([
  player.name,
  'CEREGHINI VIRGINIA',
  'VIRGINIA CEREGHINI',
  ...(player.aliases || [])
].map(norm));
const weakTerms = ['CEREGHINI', 'VIRGINIA'];
const expectedCard = String(player.membershipCard || '').replace(/\D/g, '');

function isVirginiaParticipant(p) {
  const full = norm(`${p.Name || ''} ${p.Surname || ''}`);
  const fullAlt = norm(`${p.Surname || ''} ${p.Name || ''}`);
  const card = String(p.MembershipCard || p.NumeroTessera || '').replace(/\D/g, '');
  return (expectedCard && card === expectedCard) || playerAliases.has(full) || playerAliases.has(fullAlt);
}

function seedKey(seed) {
  return String(seed.competitionId || seed.guid || norm(`${seed.name}|${seed.startDate || ''}|${seed.endDate || ''}`)).toUpperCase();
}

const candidates = new Map();
function addCandidate(seed) {
  const key = seedKey(seed);
  if (!key) return null;
  const existing = candidates.get(key) || {
    key,
    competitionId: seed.competitionId || seed.guid || '',
    name: seed.name || seed.competition || seed.nome_torneo || '',
    startDate: seed.startDate || iso(seed.data_inizio) || '',
    endDate: seed.endDate || iso(seed.data_fine) || '',
    location: seed.location || seed.citta || '',
    sources: [],
    evidence: [],
    status: 'seeded'
  };
  existing.name ||= seed.name || seed.competition || seed.nome_torneo || '';
  existing.competitionId ||= seed.competitionId || seed.guid || '';
  existing.startDate ||= seed.startDate || iso(seed.data_inizio) || '';
  existing.endDate ||= seed.endDate || iso(seed.data_fine) || '';
  existing.location ||= seed.location || seed.citta || '';
  if (seed.source && !existing.sources.includes(seed.source)) existing.sources.push(seed.source);
  if (seed.evidence) existing.evidence.push(seed.evidence);
  candidates.set(key, existing);
  return existing;
}

// Source A: broad P.U.C. list, no expected count.
const start = new Date(`${COVERAGE_FROM}T00:00:00Z`);
const until = new Date(Date.now() + 420 * 864e5);
const terms = ['', player.name, 'CEREGHINI VIRGINIA', 'VIRGINIA CEREGHINI', ...weakTerms, 'JUNIOR NEXT GEN', 'SUPER NEXT GEN', 'CAMPIONATI ITALIANI', 'QUALIFICAZIONE', 'KINDER', 'TENNIS TROPHY', 'RODEO', 'UNDER 13', 'UNDER 14', 'U13', 'U14', 'FEMMINILE'];
const listErrors = [];
let listQueries = 0;
for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); d <= until; d = new Date(d.getTime() + 7 * 864e5)) {
  const end = new Date(Math.min(until.getTime(), d.getTime() + 6 * 864e5));
  for (const term of terms) {
    for (let skip = 0; skip < 2000; skip += 100) {
      listQueries++;
      try {
        const result = await post('/api/v3/tornei/puc/list', listPayload({ term, start: d, end }, skip));
        const rows = result?.competizioni || [];
        for (const row of rows) {
          if (Number(row.cod_fonte) !== 1 || !row.guid || row.guid === '11111111-1111-1111-1111-111111111111') continue;
          addCandidate({
            source: 'puc-list',
            guid: row.guid,
            name: row.nome_torneo,
            data_inizio: row.data_inizio,
            data_fine: row.data_fine,
            citta: row.citta,
            evidence: { term: term || 'ALL', window: `${itDate(d)}-${itDate(end)}` }
          });
        }
        if (rows.length < 100) break;
      } catch (error) {
        listErrors.push({ term: term || 'ALL', window: `${itDate(d)}-${itDate(end)}`, skip, error: error.message });
        break;
      }
    }
  }
}

// Source B: existing dataset matches and tournaments as seeds, not as final truth.
for (const t of data.tournaments || []) {
  if (t.sourceId === 'fitp-puc' && (t.playerId === PLAYER_ID || t.name || t.competitionId)) {
    addCandidate({ source: t.playerId === PLAYER_ID ? 'existing-virginia-tournament' : 'existing-fitp-tournament', competitionId: t.competitionId, name: t.name, startDate: t.startDate, endDate: t.endDate, location: t.location, evidence: { playerId: t.playerId } });
  }
}
for (const m of data.matches || []) {
  if (m.playerId !== PLAYER_ID || m.sourceId !== 'fitp-puc') continue;
  const date = iso(m.date);
  if (date && date < COVERAGE_FROM) continue;
  addCandidate({ source: 'existing-virginia-match', competitionId: m.competitionId, name: m.tournamentName, startDate: date, endDate: date, location: m.location, evidence: { matchKey: m.key, opponent: m.opponent, result: m.result } });
}

// Validate all candidates through competition detail and, when possible, sections/matches.
const final = [];
const rejected = [];
const openCandidates = [];
const validationErrors = [];
for (const candidate of candidates.values()) {
  if (!candidate.competitionId) {
    candidate.status = 'open_no_competition_id';
    openCandidates.push(candidate);
    continue;
  }
  try {
    const detail = await post('/api/v3/puc/competizione/dettaglio', { competitionUid: candidate.competitionId });
    let entryHit = false;
    const draws = new Set();
    for (const draw of detail?.Tournaments || []) {
      for (const participant of draw.Participants || []) {
        if (!isVirginiaParticipant(participant)) continue;
        entryHit = true;
        draws.add(draw.TournamentDescription || draw.Description || 'Tabellone');
      }
    }
    if (entryHit) {
      candidate.status = 'validated_entry';
      candidate.name = detail.Description || candidate.name;
      candidate.startDate = iso(detail.From) || candidate.startDate;
      candidate.endDate = iso(detail.To) || candidate.endDate;
      candidate.location = [detail.Municipality, detail.Province].filter(Boolean).join(' ') || candidate.location;
      candidate.draws = [...draws];
      final.push(candidate);
      continue;
    }
    if (candidate.sources.includes('existing-virginia-match')) {
      candidate.status = 'validated_match_seed_needs_section_recheck';
      final.push(candidate);
      continue;
    }
    candidate.status = 'rejected_detail_no_virginia';
    rejected.push(candidate);
  } catch (error) {
    validationErrors.push({ competitionId: candidate.competitionId, error: error.message });
    if (candidate.sources.includes('existing-virginia-match')) {
      candidate.status = 'validated_match_seed_detail_error';
      final.push(candidate);
    } else {
      candidate.status = 'open_detail_error';
      openCandidates.push(candidate);
    }
  }
}

const dedupedFinal = [...new Map(final.map(t => [seedKey(t), t])).values()]
  .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')) || String(a.name || '').localeCompare(String(b.name || '')));

const report = {
  generatedAt: now,
  player: player.name,
  playerId: PLAYER_ID,
  membershipCard: player.membershipCard,
  coverageFrom: COVERAGE_FROM,
  expectedCountUsed: false,
  status: openCandidates.length || validationErrors.length ? 'needs_review' : 'complete',
  finalCount: dedupedFinal.length,
  tournaments: dedupedFinal,
  openCandidates,
  rejectedCount: rejected.length,
  rejected: rejected.slice(0, 200),
  diagnostics: {
    listQueries,
    candidateCount: candidates.size,
    listErrors: listErrors.slice(0, 50),
    validationErrors: validationErrors.slice(0, 50)
  }
};

await fs.writeFile('virginia-fitp-final.json', JSON.stringify(report, null, 2) + '\n');
await fs.writeFile('virginia-fitp-candidates.json', JSON.stringify([...candidates.values()], null, 2) + '\n');
await fs.writeFile('virginia-fitp-discovery-log.json', JSON.stringify(report.diagnostics, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, expectedCountUsed: false, finalCount: report.finalCount, openCandidates: report.openCandidates.length, rejected: report.rejectedCount, listQueries }, null, 2));
