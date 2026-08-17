import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const FROM = '2025-12-18';
const HORIZON_DAYS = 730;
const BASE = 'https://www.itftennis.com';
const CALENDAR = '/en/tournament-calendar/world-tennis-tour-juniors-calendar/';
const MAX_WORKERS = 12;

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}
async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pad = n => String(n).padStart(2, '0');
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const normName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim();
const clean = value => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#176;/gi, '°')
  .replace(/\s+/g, ' ')
  .trim();
const absUrl = (href, base = BASE) => { try { return new URL(String(href).replace(/&amp;/g, '&'), base).toString(); } catch { return ''; } };

function playerMatch(text, player) {
  const hay = normName(text);
  if (!hay) return false;
  const names = [player.name, ...(player.aliases || [])]
    .map(normName)
    .filter(n => n && n.split(/\s+/).length > 1);
  for (const name of new Set(names)) {
    const parts = name.split(/\s+/);
    const reverse = [...parts].reverse().join(' ');
    if (hay.includes(name) || hay.includes(reverse)) return true;
  }
  return false;
}

function linkList(html, base) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ url: absUrl(m[1], base), text: clean(m[2]), index: m.index });
  return out;
}

function tournamentParts(url) {
  const m = String(url || '').match(/\/en\/tournament\/([^/?#]+)\/([^/?#]+)\/(\d{4})\/([^/?#]+)(?:\/|$)/i);
  if (!m) return null;
  return { slug: m[1], country: m[2].toUpperCase(), year: m[3], key: m[4].toUpperCase() };
}
function tournamentBase(url) {
  const p = tournamentParts(url);
  return p ? `${BASE}/en/tournament/${p.slug}/${p.country.toLowerCase()}/${p.year}/${p.key.toLowerCase()}/` : '';
}
function acceptanceUrl(url) {
  const base = tournamentBase(url);
  return base ? base + 'acceptance-list/' : '';
}
function competitionId(url) { return tournamentParts(url)?.key || ''; }

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function dateFromParts(day, mon, year) {
  const month = MONTHS[String(mon).slice(0,3).toLowerCase()];
  return month ? `${year}-${pad(month)}-${pad(day)}` : '';
}
function parseDateRange(text) {
  const s = clean(text);
  let m = s.match(/Dates?:\s*(\d{1,2})\s+([A-Za-z]{3,9})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})/i);
  if (m) {
    const y2 = Number(m[5]);
    const mo1 = MONTHS[m[2].slice(0,3).toLowerCase()];
    const mo2 = MONTHS[m[4].slice(0,3).toLowerCase()];
    const y1 = mo1 && mo2 && mo1 > mo2 ? y2 - 1 : y2;
    return { startDate: dateFromParts(m[1], m[2], y1), endDate: dateFromParts(m[3], m[4], y2) };
  }
  m = s.match(/Date:\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+to\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})/i);
  if (m) {
    const y2 = Number(m[5]);
    const mo1 = MONTHS[m[2].slice(0,3).toLowerCase()];
    const mo2 = MONTHS[m[4].slice(0,3).toLowerCase()];
    const y1 = mo1 && mo2 && mo1 > mo2 ? y2 - 1 : y2;
    return { startDate: dateFromParts(m[1], m[2], y1), endDate: dateFromParts(m[3], m[4], y2) };
  }
  m = s.match(/Date:\s*(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(20\d{2})/i);
  if (m) {
    const d = dateFromParts(m[1], m[2], Number(m[3]));
    return { startDate: d, endDate: d };
  }
  return { startDate: '', endDate: '' };
}

async function request(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(22000),
      headers: {
        'user-agent': 'Mozilla/5.0 CourtWatch-v3-itf/10.0-official-discovery',
        'accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9,it;q=0.8'
      }
    });
    const text = await response.text();
    if ((!response.ok || response.status >= 500) && attempt < 2) {
      await sleep(600 * (attempt + 1));
      return request(url, attempt + 1);
    }
    return { ok: response.ok, status: response.status, url: response.url || url, text };
  } catch (error) {
    if (attempt < 2) {
      await sleep(700 * (attempt + 1));
      return request(url, attempt + 1);
    }
    throw error;
  }
}

function calendarMonths() {
  const first = new Date(FROM.slice(0, 7) + '-01T00:00:00Z');
  const limit = addDays(new Date(TODAY + 'T00:00:00Z'), HORIZON_DAYS);
  const out = [];
  for (let d = new Date(first); d <= limit; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

function tournamentCandidatesFromCalendar(html, pageUrl, month) {
  const rawText = clean(html);
  const links = linkList(html, pageUrl);
  const out = [];
  for (const link of links) {
    const base = tournamentBase(link.url);
    if (!base) continue;
    const p = tournamentParts(base);
    if (!p || !/^J(?:30|60|100|200|300|500|GS)/i.test(p.key.replace(/^J-/, ''))) continue;
    const name = clean(link.text) || p.slug.replace(/-/g, ' ');
    const idx = rawText.toUpperCase().indexOf(name.toUpperCase());
    const around = idx >= 0 ? rawText.slice(Math.max(0, idx - 160), idx + 850) : '';
    const dr = parseDateRange(around);
    const host = (around.match(/Host Nation:\s*([^|]{2,60}?)(?=\s+City\/Town:|\s+Category:|\s+Surface:|$)/i) || [])[1] || '';
    const city = (around.match(/City\/Town:\s*([^|]{2,60}?)(?=\s+Category:|\s+Surface:|\s+Status:|$)/i) || [])[1] || '';
    const category = (around.match(/Category:\s*(J(?:30|60|100|200|300|500|GS))/i) || [])[1] || (name.match(/\bJ(?:30|60|100|200|300|500|GS)\b/i) || [])[0] || '';
    out.push({
      competitionId: p.key,
      tournamentName: name.replace(/\s+/g, ' ').trim(),
      location: [city, host].filter(Boolean).join(', '),
      hostNation: clean(host),
      category: String(category).toUpperCase(),
      startDate: dr.startDate,
      endDate: dr.endDate,
      sourceUrl: base,
      sourcePage: pageUrl,
      searchSpec: `calendar_${month}`
    });
  }
  return out;
}

function sectionCode(name) {
  const s = String(name || '').toUpperCase();
  if (s.includes('MAIN DRAW')) return 'MD';
  if (s.includes('QUAL')) return 'Q';
  if (s.includes('ALTERNATE')) return 'A';
  if (s.includes('WITHDRAW')) return 'W';
  return '';
}
function parseAcceptance(html, players) {
  const text = clean(html);
  if (!/Acceptance List/i.test(text) || /There were no results for your selection/i.test(text)) return [];
  const headingRe = /\b(MAIN DRAW(?:\s+[A-Z][A-Z ]{0,80})?|QUALIFYING(?:\s+[A-Z][A-Z ]{0,80})?|ALTERNATES?|WITHDRAWN)\b/gi;
  const heads = [];
  let hm;
  while ((hm = headingRe.exec(text))) heads.push({ name: hm[1].trim(), index: hm.index });
  if (!heads.length) heads.push({ name: 'Acceptance List', index: text.indexOf('Acceptance List') });
  const found = [];
  for (let i = 0; i < heads.length; i++) {
    const section = text.slice(heads[i].index, heads[i + 1]?.index ?? text.length);
    const code = sectionCode(heads[i].name);
    for (const player of players) {
      if (!playerMatch(section, player)) continue;
      const aliases = [player.name, ...(player.aliases || [])].map(normName).filter(x => x.split(/\s+/).length > 1);
      const sectionNorm = normName(section);
      let pos = null;
      let row = '';
      for (const alias of new Set(aliases)) {
        const variants = [alias, alias.split(/\s+/).reverse().join(' ')];
        for (const variant of variants) {
          const at = sectionNorm.indexOf(variant);
          if (at < 0) continue;
          row = sectionNorm.slice(Math.max(0, at - 90), at + variant.length + 140);
          const before = sectionNorm.slice(Math.max(0, at - 90), at);
          const nums = [...before.matchAll(/\b(\d{1,3})\b/g)];
          if (nums.length) pos = Number(nums.at(-1)[1]);
          break;
        }
        if (row) break;
      }
      found.push({
        playerId: player.id,
        playerName: player.name,
        acceptanceList: heads[i].name,
        acceptanceCode: code,
        acceptancePosition: pos,
        calendarListLabel: code + (pos ? `-${pos}` : ''),
        row: row.slice(0, 320)
      });
    }
  }
  const priority = value => ({ MD: 0, Q: 1, A: 2, W: 3 }[value] ?? 4);
  const best = new Map();
  for (const hit of found) {
    const old = best.get(hit.playerId);
    if (!old || priority(hit.acceptanceCode) < priority(old.acceptanceCode) ||
      (priority(hit.acceptanceCode) === priority(old.acceptanceCode) && (hit.acceptancePosition ?? 9999) < (old.acceptancePosition ?? 9999))) {
      best.set(hit.playerId, hit);
    }
  }
  return [...best.values()];
}

function tournamentMeta(html, fallback = {}) {
  const text = clean(html);
  const h1 = (text.match(/(?:^|\s)(J(?:30|60|100|200|300|500|GS)\s+[^|]{2,80}?)(?=\s+Dates?:)/i) || [])[1] || '';
  const dr = parseDateRange(text);
  const hostNation = clean((text.match(/Host nation:\s*([^|]{2,60}?)(?=\s+Hospitality:|\s+Surface:|\s+Prize money:|\s+Date:|$)/i) || [])[1] || fallback.hostNation || '');
  const venue = clean((text.match(/Venue Name:\s*([^|]{2,80}?)(?=\s+Venue Address:|$)/i) || [])[1] || '');
  return {
    tournamentName: clean(h1) || fallback.tournamentName || '',
    startDate: dr.startDate || fallback.startDate || '',
    endDate: dr.endDate || fallback.endDate || '',
    location: fallback.location || venue || hostNation,
    hostNation,
    category: fallback.category || (clean(h1).match(/\bJ(?:30|60|100|200|300|500|GS)\b/i) || [])[0] || ''
  };
}

const playersDoc = await readJson('players.json', { players: [] });
const players = playersDoc.players || [];
const itfPlayers = players.filter(p => (p.circuits || []).some(c => String(c).toUpperCase() === 'ITF'));
const errors = [];
const notes = [];
const queries = [];
const profileSeeds = [];
const candidateMap = new Map();
const entries = [];
let pagesChecked = 0;
let acceptanceListsChecked = 0;
let acceptanceListsPublished = 0;

function addCandidate(candidate) {
  const base = tournamentBase(candidate.sourceUrl);
  const id = candidate.competitionId || competitionId(base);
  if (!base || !id) return;
  const old = candidateMap.get(id) || {};
  candidateMap.set(id, {
    ...old,
    ...candidate,
    competitionId: id,
    sourceUrl: base,
    tournamentName: candidate.tournamentName || old.tournamentName || '',
    startDate: candidate.startDate || old.startDate || '',
    endDate: candidate.endDate || old.endDate || '',
    location: candidate.location || old.location || ''
  });
}

for (const player of itfPlayers) {
  const confirmed = (player.confirmedOfficialTournaments || []).filter(c => /itftennis\.com/i.test(c.url || ''));
  for (const c of confirmed) {
    const base = tournamentBase(c.url);
    if (!base) continue;
    addCandidate({
      competitionId: competitionId(base), tournamentName: c.name || '', location: c.location || '',
      startDate: c.startDate || '', endDate: c.endDate || '', sourceUrl: base, sourcePage: 'players.json', searchSpec: 'confirmed_seed'
    });
    entries.push({
      playerId: player.id, playerName: player.name, circuit: 'itf', competitionId: competitionId(base),
      tournamentName: c.name || 'Torneo ITF', location: c.location || '', startDate: c.startDate || '', endDate: c.endDate || '',
      sourceUrl: base, source: 'ITF confirmed official tournament seed', status: 'detected',
      entryStatus: c.entryStatus || 'confirmed_on_official_seed', acceptanceList: c.entryStatus || '', acceptanceCode: '',
      acceptancePosition: c.entryPosition ?? null, calendarListLabel: '', acceptanceListUrl: acceptanceUrl(base), lastSeen: NOW
    });
  }
  const urls = [...(player.officialUrls?.itf || [])].filter(u => /itftennis\.com/i.test(u));
  for (const url of new Set(urls)) {
    profileSeeds.push({ playerId: player.id, playerName: player.name, sourceUrl: url });
    const base = tournamentBase(url);
    if (base) {
      addCandidate({ competitionId: competitionId(base), tournamentName: '', startDate: '', endDate: '', sourceUrl: base, sourcePage: 'players.json', searchSpec: 'official_url_seed' });
    } else {
      try {
        const r = await request(url);
        pagesChecked++;
        if (!r.ok) {
          errors.push(`profile ${player.name} ${url}: HTTP ${r.status}`);
          continue;
        }
        for (const link of linkList(r.text, r.url)) {
          const tb = tournamentBase(link.url);
          if (tb) addCandidate({ competitionId: competitionId(tb), tournamentName: link.text, startDate: '', endDate: '', sourceUrl: tb, sourcePage: url, searchSpec: 'profile_link' });
        }
      } catch (error) {
        errors.push(`profile ${player.name} ${url}: ${error.message}`);
      }
    }
  }
}

for (const month of calendarMonths()) {
  const url = `${BASE}${CALENDAR}?categories=All&startdate=${month}`;
  try {
    const r = await request(url);
    pagesChecked++;
    queries.push({ type: 'calendar', month, url, status: r.status });
    if (!r.ok) {
      errors.push(`calendar ${month}: HTTP ${r.status}`);
      continue;
    }
    for (const candidate of tournamentCandidatesFromCalendar(r.text, r.url, month)) addCandidate(candidate);
  } catch (error) {
    errors.push(`calendar ${month}: ${error.message}`);
    queries.push({ type: 'calendar', month, url, error: error.message });
  }
}

const candidates = [...candidateMap.values()].filter(c => !c.endDate || c.endDate >= FROM);
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= candidates.length) return;
    const candidate = candidates[index];
    const listUrl = acceptanceUrl(candidate.sourceUrl);
    if (!listUrl) continue;
    try {
      const r = await request(listUrl);
      pagesChecked++;
      acceptanceListsChecked++;
      if (!r.ok) {
        if (r.status !== 404) errors.push(`acceptance ${candidate.competitionId}: HTTP ${r.status}`);
        continue;
      }
      const text = clean(r.text);
      const published = /Acceptance List/i.test(text) && !/There were no results for your selection/i.test(text);
      if (published) acceptanceListsPublished++;
      const matches = parseAcceptance(r.text, itfPlayers);
      if (!matches.length) continue;
      const meta = tournamentMeta(r.text, candidate);
      for (const match of matches) {
        entries.push({
          playerId: match.playerId,
          playerName: match.playerName,
          circuit: 'itf',
          competitionId: candidate.competitionId,
          tournamentName: meta.tournamentName || candidate.tournamentName || 'Torneo ITF',
          location: meta.location || candidate.location || '',
          startDate: meta.startDate || candidate.startDate || '',
          endDate: meta.endDate || candidate.endDate || '',
          category: meta.category || candidate.category || '',
          sourceUrl: candidate.sourceUrl,
          sourcePage: candidate.sourcePage || '',
          source: 'ITF official calendar + acceptance list',
          status: 'detected',
          entryStatus: 'confirmed_on_acceptance_list',
          acceptanceList: match.acceptanceList,
          acceptanceCode: match.acceptanceCode,
          acceptancePosition: match.acceptancePosition,
          calendarListLabel: match.calendarListLabel,
          acceptanceListUrl: listUrl,
          acceptanceListPublished: published,
          lastSeen: NOW
        });
      }
    } catch (error) {
      errors.push(`acceptance ${candidate.competitionId}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(MAX_WORKERS, Math.max(1, candidates.length)) }, () => worker()));

const codePriority = code => ({ MD: 0, Q: 1, A: 2, W: 3 }[code] ?? 9);
const statusPriority = status => status === 'confirmed_on_acceptance_list' ? 0 : status === 'confirmed_on_official_seed' ? 1 : 2;
const best = new Map();
for (const e of entries) {
  if (!e.playerId || !e.competitionId) continue;
  const k = `${e.playerId}|${e.competitionId}`;
  const old = best.get(k);
  const better = !old || statusPriority(e.entryStatus) < statusPriority(old.entryStatus) ||
    (statusPriority(e.entryStatus) === statusPriority(old.entryStatus) && codePriority(e.acceptanceCode) < codePriority(old.acceptanceCode)) ||
    (statusPriority(e.entryStatus) === statusPriority(old.entryStatus) && codePriority(e.acceptanceCode) === codePriority(old.acceptanceCode) && (e.acceptancePosition ?? 9999) < (old.acceptancePosition ?? 9999));
  if (better) best.set(k, e);
}
const finalEntries = [...best.values()]
  .filter(e => !e.endDate || e.endDate >= FROM)
  .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || a.playerName.localeCompare(b.playerName) || a.competitionId.localeCompare(b.competitionId));
const byPlayer = Object.fromEntries(itfPlayers.map(p => [p.id, finalEntries.filter(e => e.playerId === p.id).length]));
const byAcceptance = finalEntries.reduce((acc, e) => {
  const k = e.acceptanceCode || 'seed';
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
const confirmed = finalEntries.filter(e => e.entryStatus === 'confirmed_on_acceptance_list').length;
const calendarFailures = queries.filter(q => q.error || (q.status && q.status >= 400)).length;
const status = !queries.length || calendarFailures === queries.length ? 'failed' : errors.length ? 'partial' : 'complete';

const out = {
  version: 'cw-v3-agenda-first',
  generatedAt: NOW,
  status,
  source: 'ITF official World Tennis Tour Juniors calendar + official acceptance lists + player/confirmed seeds; no v1/v2/data.json',
  coverageFrom: FROM,
  coverageTo: isoDate(addDays(new Date(TODAY + 'T00:00:00Z'), HORIZON_DAYS)),
  profiles: itfPlayers.length,
  profileSeeds: profileSeeds.length,
  pagesChecked,
  entriesFound: finalEntries.length,
  entriesConfirmedOnAcceptanceList: confirmed,
  byPlayer,
  byAcceptance,
  globalSearch: {
    calendarMonthsChecked: queries.length,
    calendarFailures,
    tournamentsFound: candidates.length,
    acceptanceListsChecked,
    acceptanceListsPublished
  },
  entries: finalEntries,
  notes: notes.slice(0, 200),
  errors: errors.slice(0, 200)
};
await writeJson('dist/v3/source_itf_entries.json', out);
console.log(JSON.stringify({ ...out, entries: undefined, errors: out.errors.slice(0, 20) }, null, 2));
