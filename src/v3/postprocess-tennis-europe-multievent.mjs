import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const BASE = 'https://te.tournamentsoftware.com';
const FILE = 'dist/v3/source_tennis_europe_entries.json';
const AUDIT_FILE = 'dist/v3/source_tennis_europe_multievent_audit.json';
const SELECT_NAME = 'cphPage_cphPage_cphPage_vfHeader_fs0_selectevent';

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}
async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function clean(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#176;/g, '°')
    .replace(/&#224;/g, 'à')
    .replace(/&#232;/g, 'è')
    .replace(/&#233;/g, 'é')
    .replace(/&#236;/g, 'ì')
    .replace(/&#242;/g, 'ò')
    .replace(/&#249;/g, 'ù')
    .replace(/\s+/g, ' ')
    .trim();
}
function cookiePair(sc) {
  return (sc || '').split(/,(?=\s*[^;]+=)/).map(x => x.split(';')[0].trim()).filter(Boolean).join('; ');
}
function mergeCookie(...parts) {
  const m = new Map();
  for (const p of parts.filter(Boolean).join('; ').split(';').map(x => x.trim()).filter(Boolean)) {
    const i = p.indexOf('=');
    if (i > 0) m.set(p.slice(0, i), p.slice(i + 1));
  }
  return [...m].map(([k, v]) => `${k}=${v}`).join('; ');
}
async function req(method, url, { cookie = '', body = null } = {}) {
  const r = await fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      'user-agent': 'Mozilla/5.0 CourtWatch-v3-tennis-europe-multievent/1.0',
      accept: 'text/html,application/json,*/*',
      'accept-language': 'en-GB,en;q=0.9,it;q=0.8',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      cookie,
    },
    body,
  });
  const text = await r.text();
  return { status: r.status, location: r.headers.get('location') || '', setCookie: r.headers.get('set-cookie') || '', text };
}
async function acceptedCookie() {
  const first = await req('GET', BASE + '/tournaments');
  let cookie = cookiePair(first.setCookie);
  if (first.location && /cookiewall/i.test(first.location)) {
    const wall = await req('GET', BASE + first.location, { cookie });
    cookie = mergeCookie(cookie, cookiePair(wall.setCookie));
    const body = new URLSearchParams({ ReturnUrl: '/tournaments', SettingsOpen: 'false' });
    for (const v of ['1', '2', '3', '4']) body.append('CookiePurposes', v);
    const post = await req('POST', BASE + '/cookiewall/Save', { cookie, body: body.toString() });
    cookie = mergeCookie(cookie, cookiePair(post.setCookie));
  }
  return cookie;
}
function normName(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim();
}
function nameForms(name) {
  const p = normName(name).split(/\s+/).filter(Boolean);
  if (!p.length) return [];
  const first = p[0], last = p.at(-1), full = p.join(' ');
  return [...new Set([full, `${last} ${first}`, `${first} ${last}`].filter(v => v.trim().split(/\s+/).length >= 2))];
}
function listCode(section) {
  return section === 'Main' ? 'MD' : section === 'Qualifying' ? 'Q' : section === 'Alternates' ? 'A' : section === 'Withdrawn' ? 'W' : '';
}
function parseHidden(html) {
  const out = {};
  const re = /<input\b[^>]*type=["']hidden["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = (tag.match(/name=["']([^"']+)["']/i) || [])[1];
    const value = (tag.match(/value=["']([^"']*)["']/i) || [])[1] || '';
    if (name) out[name] = value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }
  return out;
}
function parseOptions(html) {
  const selectRe = new RegExp(`<select\\b[^>]*name=["']${SELECT_NAME}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i');
  const sel = html.match(selectRe)?.[1] || '';
  const out = [];
  const re = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  let m;
  while ((m = re.exec(sel))) {
    const value = (m[1].match(/value=["']([^"']+)["']/i) || [])[1] || '';
    const label = clean(m[2]);
    const selected = /selected/i.test(m[1]);
    if (value && label) out.push({ value, label, selected });
  }
  return out;
}
function sections(text) {
  const t = clean(text);
  const heads = [...t.matchAll(/\b(Main|Qualifying|Alternates|Withdrawn)\b/g)].map(m => ({ name: m[1], i: m.index }));
  return heads.map((h, idx) => ({ name: h.name, text: t.slice(h.i, heads[idx + 1]?.i || t.length) }));
}
function rowCandidates(sectionText) {
  // Split before a likely numbered country row. This keeps position, country and name inside one record.
  return sectionText.split(/(?=\s\d{1,3}\s+(?:\([^)]*\)\s+)?\[[A-Z]{2,3}\]\s+)/g).map(clean).filter(Boolean);
}
function parseAcceptanceHtml(html, playerMap, forcedEvent = '') {
  const t = clean(html);
  const event = forcedEvent || (t.match(/\b(BS\d\d|GS\d\d) Acceptance list\b/i) || [])[1] || '';
  const lastUpdated = (t.match(/Last updated:\s*([^\.]+)\./i) || [])[1] || '';
  const found = [];

  for (const sec of sections(html)) {
    for (const row of rowCandidates(sec.text)) {
      const rowNorm = normName(row);
      const pos = Number((row.match(/^\s*(\d{1,3})\s+/) || [])[1] || 0) || null;
      for (const player of playerMap.values()) {
        const matched = player.forms.some(f => rowNorm.includes(f));
        if (!matched) continue;
        const code = listCode(sec.name);
        found.push({
          playerId: player.id,
          playerName: player.name,
          acceptanceEvent: event,
          acceptanceList: sec.name,
          acceptanceCode: code,
          acceptancePosition: pos,
          calendarListLabel: code + (pos ? `-${pos}` : ''),
          acceptanceLastUpdated: lastUpdated,
          acceptanceRow: row.slice(0, 400),
        });
      }
    }
  }
  return found;
}
async function fetchEventHtml(url, cookie, baseHtml, option) {
  if (!option) return baseHtml;
  const hidden = parseHidden(baseHtml);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) body.set(k, v);
  body.set('__EVENTTARGET', SELECT_NAME);
  body.set('__EVENTARGUMENT', '');
  body.set(SELECT_NAME, option.value);
  const r = await req('POST', url, { cookie, body: body.toString() });
  return r.status === 200 && r.text ? r.text : baseHtml;
}
async function parseCompetitionAcceptance(competitionId, entries, cookie) {
  const url = `${BASE}/sport/acceptancelist.aspx?id=${competitionId}`;
  const r = await req('GET', url, { cookie });
  if (r.status !== 200) return { competitionId, url, published: false, events: [], matches: [], error: `status_${r.status}` };

  const playerMap = new Map();
  for (const e of entries) {
    playerMap.set(e.playerId, { id: e.playerId, name: e.playerName, forms: nameForms(e.playerName) });
  }

  const options = parseOptions(r.text);
  const events = options.length ? options : [{ value: '', label: '', selected: true }];
  const byKey = new Map();
  const eventAudit = [];

  for (const option of events) {
    const html = option.value ? await fetchEventHtml(url, cookie, r.text, option) : r.text;
    const matches = parseAcceptanceHtml(html, playerMap, option.label);
    eventAudit.push({ label: option.label || 'default', value: option.value || '', matches: matches.length });
    for (const m of matches) byKey.set(`${m.playerId}|${m.acceptanceEvent}|${m.acceptanceList}|${m.acceptancePosition || ''}`, m);
    await sleep(20);
  }

  return { competitionId, url, published: true, events: eventAudit, matches: [...byKey.values()] };
}
function chooseBest(matches) {
  if (!matches.length) return null;
  const order = { Main: 1, Qualifying: 2, Alternates: 3, Withdrawn: 4 };
  return [...matches].sort((a, b) => (order[a.acceptanceList] || 9) - (order[b.acceptanceList] || 9) || (a.acceptancePosition || 9999) - (b.acceptancePosition || 9999))[0];
}

const data = await readJson(FILE, { entries: [] });
const entries = Array.isArray(data.entries) ? data.entries : [];
const byCompetition = new Map();
for (const e of entries.filter(e => e.circuit === 'tennis-europe' && e.competitionId)) {
  if (!byCompetition.has(e.competitionId)) byCompetition.set(e.competitionId, []);
  byCompetition.get(e.competitionId).push(e);
}

const cookie = await acceptedCookie();
const acceptanceByCompetition = new Map();
for (const [competitionId, compEntries] of byCompetition) {
  acceptanceByCompetition.set(competitionId, await parseCompetitionAcceptance(competitionId, compEntries, cookie));
  await sleep(25);
}

const updated = [];
const removedWithdrawn = [];
for (const e of entries) {
  if (e.circuit !== 'tennis-europe') { updated.push(e); continue; }
  const parsed = acceptanceByCompetition.get(e.competitionId);
  const matches = (parsed?.matches || []).filter(m => m.playerId === e.playerId);
  const best = chooseBest(matches);
  if (best?.acceptanceList === 'Withdrawn') {
    removedWithdrawn.push({ playerId: e.playerId, playerName: e.playerName, competitionId: e.competitionId, tournamentName: e.tournamentName, acceptanceEvent: best.acceptanceEvent, calendarDecision: 'removed_withdrawn_multievent' });
    continue;
  }
  if (best) {
    updated.push({
      ...e,
      sourceUrl: parsed.url || e.sourceUrl,
      sourcePage: parsed.url || e.sourcePage,
      entryStatus: 'confirmed_on_acceptance_list',
      acceptanceListPublished: true,
      acceptanceListUrl: parsed.url || e.acceptanceListUrl || '',
      acceptanceEvent: best.acceptanceEvent,
      acceptanceList: best.acceptanceList,
      acceptanceCode: best.acceptanceCode,
      acceptancePosition: best.acceptancePosition,
      calendarListLabel: best.calendarListLabel,
      acceptanceLastUpdated: best.acceptanceLastUpdated,
      multiEventAcceptanceMatched: true,
    });
  } else {
    updated.push(e);
  }
}

const teEntries = updated.filter(e => e.circuit === 'tennis-europe');
const byPlayer = {};
const bySourceMode = {};
const byAcceptance = {};
for (const e of teEntries) {
  byPlayer[e.playerId] = (byPlayer[e.playerId] || 0) + 1;
  bySourceMode[e.entryStatus] = (bySourceMode[e.entryStatus] || 0) + 1;
  byAcceptance[e.calendarListLabel || e.entryStatus] = (byAcceptance[e.calendarListLabel || e.entryStatus] || 0) + 1;
}

const eventsParsed = [...acceptanceByCompetition.values()].reduce((a, x) => a + (x.events?.length || 0), 0);
const matchesFound = [...acceptanceByCompetition.values()].reduce((a, x) => a + (x.matches?.length || 0), 0);

const output = {
  ...data,
  status: String(data.status || 'tennis_europe_acceptance_list_engine_complete') + '_multievent_acceptance_applied',
  multiEventAcceptance: {
    appliedAt: NOW,
    competitionsChecked: acceptanceByCompetition.size,
    eventsParsed,
    matchesFound,
    removedWithdrawn: removedWithdrawn.length,
  },
  entriesFound: teEntries.length,
  byPlayer,
  bySourceMode,
  byAcceptance,
  entries: updated,
};

await writeJson(FILE, output);
await writeJson(AUDIT_FILE, {
  generatedAt: NOW,
  summary: output.multiEventAcceptance,
  competitions: [...acceptanceByCompetition.values()].map(x => ({ competitionId: x.competitionId, url: x.url, published: x.published, events: x.events, matches: x.matches })),
  removedWithdrawn,
});

console.log(JSON.stringify(output.multiEventAcceptance, null, 2));
