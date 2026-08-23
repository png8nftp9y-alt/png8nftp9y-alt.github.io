import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const BASE = 'https://te.tournamentsoftware.com';
const FILE = 'dist/v3/source_tennis_europe_entries.json';
const BACKFILL = process.env.TE_DRAW_BACKFILL === '1';
const AUDIT_ONLY = process.env.TE_DRAW_AUDIT_ONLY === '1';
const AUDIT_FILE = BACKFILL ? 'dist/v3/source_tennis_europe_draw_backfill_audit.json' : 'dist/v3/source_tennis_europe_draw_audit.json';
const REQUEST_CACHE = new Map();

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
function norm(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function absUrl(href, base = BASE) {
  try { return new URL(String(href || '').replace(/&amp;/g, '&'), base).toString(); } catch { return ''; }
}
function daysFromStart(entry) {
  if (!entry.startDate) return 999;
  return Math.floor((Date.parse(TODAY) - Date.parse(entry.startDate)) / 864e5);
}
async function req(url, extraHeaders = {}) {
  const cacheKey = `${url}|${extraHeaders['x-requested-with'] || ''}`;
  if (REQUEST_CACHE.has(cacheKey)) return REQUEST_CACHE.get(cacheKey);
  const request = (async () => { const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 CourtWatch-v3-tennis-europe-draw-parser/2.0',
      accept: 'text/html,*/*',
      'accept-language': 'en-GB,en;q=0.9,it;q=0.8', cookie: DRAW_COOKIE, ...extraHeaders,
    },
  });
  return { status: r.status, finalUrl: r.url, text: await r.text() }; })();
  REQUEST_CACHE.set(cacheKey, request);
  return request;
}
async function drawDocument(url) {
  const page = await req(url);
  if (page.status !== 200) return { ...page, shellText: page.text, drawContentUrl: '' };
  const action = ([...page.text.matchAll(/<form\b[^>]*action=["']([^"']*\/GetDrawContent[^"']*)/gi)][0] || [])[1] || '';
  if (!action) return { ...page, shellText: page.text, drawContentUrl: '' };
  const contentUrl = absUrl(action, page.finalUrl || url);
  const content = await req(contentUrl, {
    'x-requested-with': 'XMLHttpRequest',
    referer: page.finalUrl || url,
    accept: 'text/html, */*; q=0.01',
  });
  if (content.status !== 200 || /404\s*-\s*Page not found/i.test(clean(content.text))) return { ...page, shellText: page.text, drawContentUrl: contentUrl };
  return { ...content, shellText: page.text, drawContentUrl: contentUrl, finalUrl: page.finalUrl || url };
}
function cookiePair(value) { return String(value || '').split(/,(?=\s*[^;]+=)/).map(x => x.split(';')[0].trim()).filter(Boolean); }
const COOKIE_SESSION_DIAGNOSTIC = {};
async function acceptedCookie() {
  const jar = new Map();
  const collect = headers => {
    const values = headers.getSetCookie?.() || [headers.get('set-cookie') || ''];
    for (const pair of cookiePair(values.join(','))) {
      const split = pair.indexOf('=');
      if (split > 0) jar.set(pair.slice(0, split), pair.slice(split + 1));
    }
  };
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const browserHeaders = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en-GB,en;q=0.9,it;q=0.8' };
  const visit = async (startUrl, options = {}) => {
    let url = startUrl;
    let method = options.method || 'GET';
    let body = options.body;
    const chain = [];
    for (let hop = 0; hop < 6; hop++) {
      const response = await fetch(url, {
        method,
        body,
        redirect: 'manual',
        headers: { ...browserHeaders, ...(options.headers || {}), cookie: cookie() },
      });
      collect(response.headers);
      const text = await response.text();
      const location = response.headers.get('location') || '';
      chain.push({ status: response.status, url, location });
      if (response.status < 300 || response.status >= 400 || !location) return { response, text, url, chain };
      url = absUrl(location, url);
      if (!url) return { response, text, url, chain };
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
    }
    throw new Error('Tennis Europe cookie session exceeded redirect limit.');
  };
  const inputTags = html => [...String(html || '').matchAll(/<input\b[^>]*>/gi)].map(match => match[0]);
  const attr = (tag, name) => (new RegExp(`${name}=["']([^"']*)`, 'i').exec(tag) || [])[1] || '';

  const consentTarget = '/tournament/5173C79B-B05D-4157-AD04-CD4D4F68C4E7/draw/1';
  const first = await visit(BASE + consentTarget);
  const onWall = /\/cookiewall(?:\/|\?|$)/i.test(first.url) || /name=["']CookiePurposes|SettingsOpen/i.test(first.text);
  COOKIE_SESSION_DIAGNOSTIC.first = { chain: first.chain, finalUrl: first.url, onWall, bodyLength: first.text.length, cookieNames: [...jar.keys()] };
  if (onWall) {
    const tags = inputTags(first.text);
    const returnInput = tags.find(tag => /^ReturnUrl$/i.test(attr(tag, 'name')));
    const settingsInput = tags.find(tag => /^SettingsOpen$/i.test(attr(tag, 'name')));
    const purposeInputs = tags.filter(tag => /^CookiePurposes$/i.test(attr(tag, 'name')));
    const availablePurposes = purposeInputs.map(tag => attr(tag, 'value')).filter(Boolean);
    COOKIE_SESSION_DIAGNOSTIC.wall = { status: first.response.status, finalUrl: first.url, bodyLength: first.text.length, hasConsentForm: purposeInputs.length > 0, availablePurposes, cookieNames: [...jar.keys()] };
    console.log(JSON.stringify({ tennisEuropeCookieSession: COOKIE_SESSION_DIAGNOSTIC }, null, 2));
    if (!availablePurposes.includes('1')) throw new Error('Tennis Europe cookie wall returned no basic consent purpose.');
    const returnUrl = attr(returnInput, 'value') || consentTarget;
    const settingsOpen = attr(settingsInput, 'value') || 'false';
    const body = new URLSearchParams({ ReturnUrl: returnUrl.replace(/&amp;/g, '&'), SettingsOpen: settingsOpen });
    body.append('CookiePurposes', '1');
    const saved = await visit(BASE + '/cookiewall/Save', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: BASE,
        referer: first.url,
      },
      body,
    });
    COOKIE_SESSION_DIAGNOSTIC.saved = { chain: saved.chain, finalUrl: saved.url, purpose: '1', cookieNames: [...jar.keys()] };
    if (saved.response.status >= 400) throw new Error(`Tennis Europe cookie consent failed with HTTP ${saved.response.status}.`);
  }
  return cookie();
}
const DRAW_COOKIE = await acceptedCookie();
const COOKIE_SMOKE_URL = BASE + '/tournament/5173C79B-B05D-4157-AD04-CD4D4F68C4E7/draw/1';
const cookieSmoke = await drawDocument(COOKIE_SMOKE_URL);
const cookieSmokeText = cookieSmoke.text;
const cookieSmokeEvidence = drawEvidence(cookieSmokeText, 'main', { acceptanceEvent: 'BS14' }, `${drawHeading(cookieSmoke.shellText)} known BS14 main draw`);
const syntheticEmptyEvidence = drawEvidence(`<h1>BS14 - Boys Singles 14 Main Draw</h1>${'<div>Bye</div>'.repeat(64)}`, 'main', { acceptanceEvent: 'BS14' }, 'synthetic bye-only BS14 main draw');
COOKIE_SESSION_DIAGNOSTIC.smoke = { status: cookieSmoke.status, finalUrl: cookieSmoke.finalUrl, drawContentUrl: cookieSmoke.drawContentUrl, evidence: cookieSmokeEvidence, syntheticEmptyEvidence, cookieNames: DRAW_COOKIE.split(';').map(x => x.split('=')[0].trim()).filter(Boolean) };
console.log(JSON.stringify({ tennisEuropeCookieSession: COOKIE_SESSION_DIAGNOSTIC }, null, 2));
if (/\/cookiewall\//i.test(cookieSmoke.finalUrl) || /name=["']CookiePurposes|SettingsOpen/i.test(cookieSmokeText)) {
  throw new Error('Tennis Europe cookie smoke test failed: draw request returned the cookie wall.');
}
if (!/BS14|Boys Singles 14|Main Draw/i.test(cookieSmoke.shellText + ' ' + cookieSmokeText)) {
  throw new Error('Tennis Europe cookie smoke test failed: known draw page was not readable.');
}
if (!cookieSmoke.drawContentUrl || !cookieSmokeEvidence.relevant || !cookieSmokeEvidence.populated) {
  throw new Error('Tennis Europe cookie smoke test failed: populated asynchronous draw content was not classified correctly.');
}
if (!syntheticEmptyEvidence.relevant || syntheticEmptyEvidence.populated || !syntheticEmptyEvidence.publishedEmpty || syntheticEmptyEvidence.byes !== 64) {
  throw new Error('Tennis Europe cookie smoke test failed: bye-only draw fixture was not classified as published empty.');
}
function linkList(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ url: absUrl(m[1], baseUrl), text: clean(m[2]) });
  return out;
}
function playerForms(name) {
  const p = norm(name).split(/\s+/).filter(Boolean);
  if (p.length < 2) return [];
  const first = p[0], last = p.at(-1), full = p.join(' ');
  return [...new Set([full, `${last} ${first}`, `${first} ${last}`])];
}
function hasPlayer(html, name) {
  const text = norm(clean(html));
  return playerForms(name).some(f => text.includes(f));
}
function eventParts(entry) {
  const ev = String(entry.acceptanceEvent || '').toUpperCase();
  return { gender: ev.slice(0, 2), age: (ev.match(/\d{2}/) || [])[0] || '' };
}
function drawTypeWanted(entry) {
  if (entry.acceptanceCode === 'MD') return 'main';
  if (entry.acceptanceCode === 'Q' || entry.acceptanceCode === 'A') return 'qualifying';
  return '';
}
function drawLinkScore(link, entry, wanted) {
  const label = norm([link.text, link.url].join(' '));
  const { gender, age } = eventParts(entry);
  let score = 0;
  if (/DRAW|DRAWS|ELIMINATION|KNOCK OUT|ROUND ROBIN|QUALIFYING|QUALIFICATION|MAIN/.test(label)) score += 2;
  if (/SPORT DRAW/.test(label) || /DRAWS? ASPX/.test(label) || /SPORT\/DRAW/.test(label)) score += 4;
  if (gender && label.includes(gender)) score += 4;
  if (age && label.includes(age)) score += 3;
  if (wanted === 'qualifying') {
    if (/QUALIFYING|QUALIFICATION|\bQ\b/.test(label)) score += 5;
    if (/MAIN/.test(label)) score -= 3;
  } else if (wanted === 'main') {
    if (/MAIN/.test(label)) score += 4;
    if (/QUALIFYING|QUALIFICATION/.test(label)) score -= 4;
  }
  return score;
}
function candidateDrawLinks(html, pageUrl, entry, wanted) {
  const links = linkList(html, pageUrl).filter(l => {
    const u = l.url.toLowerCase();
    return !/double|doubles|doppio/i.test(l.text) && (u.includes('/sport/draw') || /\/tournament\/[^/]+\/draw\/\d+/i.test(u) || u.includes('/sport/matches') || u.includes('/sport/event') || /draw|qualifying|main/i.test(l.text));
  });
  const ranked = links
    .map(l => ({ ...l, score: drawLinkScore(l, entry, wanted) }))
    .filter(l => l.score > 0)
    .sort((a, b) => b.score - a.score);
  const out = [];
  const seen = new Set();
  for (const l of ranked) {
    if (seen.has(l.url)) continue;
    seen.add(l.url);
    out.push(l);
  }
  return out.slice(0, 12);
}
function pageLooksLikeDraw(html, wanted) {
  const text = norm(clean(html));
  if (!text) return false;
  if (/PLAYER|ROUND|MATCH|SEED|DRAW|COURT|SCORE/.test(text) && /\b(ITA|FRA|GER|ESP|SUI|AUT|CRO|SLO|BEL|NED|GBR)\b/.test(text)) return true;
  if (wanted === 'qualifying' && /QUALIFYING|QUALIFICATION/.test(text) && /PLAYER|MATCH|ROUND/.test(text)) return true;
  if (wanted === 'main' && /MAIN DRAW|ROUND|MATCH/.test(text)) return true;
  return false;
}
function drawHeading(html) {
  return clean([...String(html || '').matchAll(/<(?:title|h1|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/(?:title|h1|h2|h3|h4)>/gi)].map(m => m[1]).join(' '));
}
function drawEvidence(html, wanted, entry, label = '') {
  const text = norm(clean(html));
  const actualHeading = drawHeading(html);
  const usefulLabel = /^direct draw\s+\d+$/i.test(String(label || '').trim()) ? '' : label;
  const heading = norm(actualHeading + ' ' + usefulLabel);
  const { gender, age } = eventParts(entry);
  const doubles = /DOUBLES|DOPPIO|DOUBLE GARCONS|DOUBLE FILLES/.test(heading);
  const genderMismatch = (/GIRLS|WOMEN|FEMALE|FILLES|RAGAZZE/.test(heading) && gender === 'BS') || (/BOYS|MEN|MALE|GARCONS|RAGAZZI/.test(heading) && gender === 'GS');
  const ages = [...heading.matchAll(/(?:U|UNDER)\s*(12|14|16)/g)].map(m => m[1]);
  const ageMismatch = ages.length > 0 && age && !ages.includes(age);
  const qualifying = /QUALIFYING|QUALIFICATION|QUALIFICAZIONE/.test(heading);
  const kindMatches = wanted === 'qualifying' ? qualifying : !qualifying;
  const looks = pageLooksLikeDraw(html, wanted) || /DRAW|TABELLONE|KNOCK OUT|ELIMINATION/.test(norm(actualHeading));
  const relevant = looks && !doubles && !genderMismatch && !ageMismatch && kindMatches;
  const profileLinks = (html.match(/player-profile|\/player\/|\/sport\/player\.aspx|data-player-id=/gi) || []).length;
  const countryPlayers = (text.match(/\b(ITA|FRA|GER|ESP|SUI|AUT|CRO|SLO|BEL|NED|GBR|CZE|SRB|POL|ROU|BUL|HUN|SVK|UKR|TUR|GRE)\b/g) || []).length;
  const byes = (text.match(/\bBYE\b/g) || []).length;
  const populated = relevant && (profileLinks >= 2 || countryPlayers >= 2 || (profileLinks + countryPlayers > byes && profileLinks + countryPlayers >= 2));
  return { relevant, populated, publishedEmpty: relevant && !populated, heading: drawHeading(html).slice(0, 300), profileLinks, countryPlayers, byes, doubles, genderMismatch, ageMismatch, qualifying };
}
async function checkDraw(entry, wanted) {
  const basePages = [...new Set([
    entry.eventsUrl || `${BASE}/sport/events.aspx?id=${entry.competitionId}`,
    `${BASE}/tournament/${entry.competitionId}`,
    `${BASE}/sport/tournament.aspx?id=${entry.competitionId}`,
    `${BASE}/sport/draws.aspx?id=${entry.competitionId}`,
  ])];
  const tried = [];
  const drawLinks = [];
  let reliable = false;

  for (const url of basePages) {
    try {
      const r = await req(url);
      const found = false;
      const looks = false;
      if (looks) reliable = true;
      tried.push({ url, status: r.status, kind: 'base', found, reliableEvidence: looks });
      if (found && looks) return { found: true, reliable: true, tried, drawLinks };
      if (r.status === 200) drawLinks.push(...candidateDrawLinks(r.text, url, entry, wanted));
    } catch (error) {
      tried.push({ url, kind: 'base', error: error.message });
    }
    await sleep(15);
  }

  const uniqueLinks = [];
  const seen = new Set();
  for (const link of drawLinks.sort((a, b) => b.score - a.score)) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    uniqueLinks.push(link);
  }
  for (let draw = 1; draw <= 24; draw++) {
    const url = `${BASE}/tournament/${entry.competitionId}/draw/${draw}`;
    if (!seen.has(url)) { seen.add(url); uniqueLinks.push({ url, text: `direct draw ${draw}`, score: 1, directProbe: true }); }
  }

  for (const link of uniqueLinks.slice(0, 40)) {
    try {
      const r = await drawDocument(link.url);
      const evidence = r.status === 200 ? drawEvidence(r.text, wanted, entry, `${drawHeading(r.shellText)} ${link.text} ${link.url}`) : { relevant:false, populated:false, publishedEmpty:false };
      const found = evidence.populated && hasPlayer(r.text, entry.playerName);
      if (evidence.populated) reliable = true;
      tried.push({ url: link.url, finalUrl:r.finalUrl, drawContentUrl:r.drawContentUrl, label: link.text, score: link.score, status: r.status, kind: link.directProbe?'numbered_draw_probe':'draw_link', found, reliableEvidence: evidence.populated, publishedEmpty: evidence.publishedEmpty, evidence });
      if (found) return { found: true, reliable: true, tried, drawLinks: uniqueLinks.slice(0, 40) };
    } catch (error) {
      tried.push({ url: link.url, label: link.text, score: link.score, kind: 'draw_link', error: error.message });
    }
    await sleep(20);
  }

  return { found: false, reliable, tried, drawLinks: uniqueLinks.slice(0, 40) };
}

const data = await readJson(FILE, { entries: [] });
const original = Array.isArray(data.entries) ? data.entries : [];
const kept = [];
const audit = [];

for (const entry of original) {
  if (entry.circuit !== 'tennis-europe') { kept.push(entry); continue; }
  const wanted = drawTypeWanted(entry);
  const d = daysFromStart(entry);
  let decision = 'kept_pre_tournament_acceptance';

  const tournamentStillActive = !entry.endDate || TODAY <= entry.endDate;
  const historicalBackfillTarget = BACKFILL && entry.endDate && entry.endDate < TODAY;
  if ((d >= -1 && tournamentStillActive) || historicalBackfillTarget) {
    const qualifying = await checkDraw(entry, 'qualifying');
    const main = await checkDraw(entry, 'main');
    if (qualifying.found || main.found) {
      const drawType = qualifying.found ? 'qualifying' : 'main';
      kept.push({
        ...entry,
        preDrawCalendarListLabel: entry.calendarListLabel,
        calendarListLabel: '',
        acceptanceCode: '',
        acceptancePosition: null,
        entryStatus: `draw_confirmed_${drawType}`,
        calendarState: 'draw_confirmed',
        drawConfirmedAt: NOW,
        lastDrawCheck: NOW,
      });
      decision = `kept_${drawType}_draw_confirmed`;
    } else {
      const remove = qualifying.reliable && main.reliable;
      if (remove) {
        decision = 'removed_absent_from_reliable_relevant_singles_draws';
      } else {
        kept.push({ ...entry, calendarState: 'draw_check_pending_or_empty', lastDrawCheck: NOW, drawVerificationInconclusive: true });
        decision = 'kept_draw_unpublished_empty_or_inconclusive';
      }
    }
    audit.push({ playerId: entry.playerId, playerName: entry.playerName, competitionId: entry.competitionId, tournamentName: entry.tournamentName, code: entry.acceptanceCode, label: entry.calendarListLabel, event: entry.acceptanceEvent, daysFromStart: d, decision, qualifying, main });
    continue;
  }

  kept.push(entry);
  audit.push({ playerId: entry.playerId, playerName: entry.playerName, competitionId: entry.competitionId, tournamentName: entry.tournamentName, code: entry.acceptanceCode, event: entry.acceptanceEvent, daysFromStart: d, decision });
}

const byPlayer = {};
const byAcceptance = {};
for (const entry of kept.filter(e => e.circuit === 'tennis-europe')) {
  byPlayer[entry.playerId] = (byPlayer[entry.playerId] || 0) + 1;
  byAcceptance[entry.calendarListLabel || entry.entryStatus || 'unlabeled'] = (byAcceptance[entry.calendarListLabel || entry.entryStatus || 'unlabeled'] || 0) + 1;
}
const removed = audit.filter(a => String(a.decision || '').startsWith('removed_'));
const confirmed = audit.filter(a => String(a.decision || '').includes('confirmed'));
const inconclusive = audit.filter(a => String(a.decision || '').includes('inconclusive'));

const output = {
  ...data,
  status: String(data.status || 'tennis_europe_acceptance_complete') + '_draw_parser_v2_applied',
  drawRules: {
    appliedAt: NOW,
    today: TODAY,
    mode: BACKFILL ? 'one_time_historical_backfill' : 'live_t_minus_1',
    auditOnly: AUDIT_ONLY,
    rule: 'From day -1 through tournament end inspect official singles qualifying and main draws. A player found in either draw stays permanently without an acceptance label. Absence removes the player only when both singles draws are populated and reliable. Missing, error, empty or bye-only draws are inconclusive and preserve the last valid acceptance state.',
    originalEntries: original.filter(e => e.circuit === 'tennis-europe').length,
    entriesFound: kept.filter(e => e.circuit === 'tennis-europe').length,
    confirmedInDraw: confirmed.length,
    removedByReliableDrawAbsence: removed.length,
    inconclusiveKept: inconclusive.length,
  },
  entriesFound: kept.filter(e => e.circuit === 'tennis-europe').length,
  byPlayer,
  byAcceptance,
  entries: kept,
};

if (!AUDIT_ONLY) await writeJson(FILE, output);
await writeJson(AUDIT_FILE, {
  generatedAt: NOW,
  today: TODAY,
  summary: output.drawRules,
  audit,
});
console.log(JSON.stringify(output.drawRules, null, 2));
