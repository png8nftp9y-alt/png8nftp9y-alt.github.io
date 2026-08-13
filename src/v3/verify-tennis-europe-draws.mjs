import fs from 'node:fs/promises';

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const BASE = 'https://te.tournamentsoftware.com';
const FILE = 'dist/v3/source_tennis_europe_entries.json';

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
async function req(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 CourtWatch-v3-tennis-europe-draw-parser/2.0',
      accept: 'text/html,*/*',
      'accept-language': 'en-GB,en;q=0.9,it;q=0.8',
    },
  });
  return { status: r.status, text: await r.text() };
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
    return u.includes('/sport/draw') || u.includes('/sport/matches') || u.includes('/sport/event') || /draw|qualifying|main/i.test(l.text);
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
async function checkDraw(entry, wanted) {
  const basePages = [...new Set([
    entry.eventsUrl || `${BASE}/sport/events.aspx?id=${entry.competitionId}`,
    `${BASE}/sport/tournament.aspx?id=${entry.competitionId}`,
    `${BASE}/sport/draws.aspx?id=${entry.competitionId}`,
  ])];
  const tried = [];
  const drawLinks = [];
  let reliable = false;

  for (const url of basePages) {
    try {
      const r = await req(url);
      const found = r.status === 200 && hasPlayer(r.text, entry.playerName);
      const looks = r.status === 200 && pageLooksLikeDraw(r.text, wanted);
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

  for (const link of uniqueLinks.slice(0, 10)) {
    try {
      const r = await req(link.url);
      const found = r.status === 200 && hasPlayer(r.text, entry.playerName);
      const looks = r.status === 200 && pageLooksLikeDraw(r.text, wanted);
      if (looks) reliable = true;
      tried.push({ url: link.url, label: link.text, score: link.score, status: r.status, kind: 'draw_link', found, reliableEvidence: looks });
      if (found && looks) return { found: true, reliable: true, tried, drawLinks: uniqueLinks.slice(0, 20) };
    } catch (error) {
      tried.push({ url: link.url, label: link.text, score: link.score, kind: 'draw_link', error: error.message });
    }
    await sleep(20);
  }

  return { found: false, reliable, tried, drawLinks: uniqueLinks.slice(0, 20) };
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

  if (wanted === 'qualifying' && d >= -1) {
    const check = await checkDraw(entry, 'qualifying');
    if (check.found) {
      kept.push({
        ...entry,
        preDrawCalendarListLabel: entry.calendarListLabel,
        calendarListLabel: '',
        acceptanceCode: '',
        acceptancePosition: null,
        entryStatus: 'started_confirmed_in_qualifying_draw',
        calendarState: 'draw_confirmed',
        drawConfirmedAt: NOW,
        lastDrawCheck: NOW,
      });
      decision = 'kept_qualifying_draw_confirmed';
    } else if (check.reliable && d >= 0) {
      decision = 'removed_not_in_reliable_qualifying_draw';
    } else {
      kept.push({ ...entry, calendarState: d >= 0 ? 'qualifying_draw_check_inconclusive' : 'qualifying_draw_check_pending', lastDrawCheck: NOW, drawVerificationInconclusive: true });
      decision = check.reliable ? 'kept_qualifying_absent_before_start' : 'kept_qualifying_draw_inconclusive';
    }
    audit.push({ playerId: entry.playerId, playerName: entry.playerName, competitionId: entry.competitionId, tournamentName: entry.tournamentName, code: entry.acceptanceCode, event: entry.acceptanceEvent, daysFromStart: d, decision, check });
    continue;
  }

  if (wanted === 'main' && d >= 0) {
    const check = await checkDraw(entry, 'main');
    if (check.found) {
      kept.push({
        ...entry,
        preDrawCalendarListLabel: entry.calendarListLabel,
        calendarListLabel: '',
        acceptanceCode: '',
        acceptancePosition: null,
        entryStatus: 'started_confirmed_in_main_draw',
        calendarState: 'draw_confirmed',
        drawConfirmedAt: NOW,
        lastDrawCheck: NOW,
      });
      decision = 'kept_main_draw_confirmed';
    } else if (check.reliable && d >= 2) {
      decision = 'removed_not_in_reliable_main_draw_after_2_days';
    } else {
      kept.push({ ...entry, calendarState: d >= 2 ? 'main_draw_check_inconclusive_after_day_2' : 'main_draw_check_pending', lastDrawCheck: NOW, drawVerificationInconclusive: true });
      decision = check.reliable ? 'kept_main_absent_until_day_2' : 'kept_main_draw_inconclusive';
    }
    audit.push({ playerId: entry.playerId, playerName: entry.playerName, competitionId: entry.competitionId, tournamentName: entry.tournamentName, code: entry.acceptanceCode, event: entry.acceptanceEvent, daysFromStart: d, decision, check });
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
    rule: 'Draw parser v2: discover official TournamentSoftware draw links from tournament/events pages; Q/A checked from day -1 against qualifying draws; MD checked day 0..2 against main draws. Removal only when a draw page is parsed as reliable; inconclusive checks keep acceptance-list entries visible.',
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

await writeJson(FILE, output);
await writeJson('dist/v3/source_tennis_europe_draw_audit.json', {
  generatedAt: NOW,
  today: TODAY,
  summary: output.drawRules,
  audit,
});
console.log(JSON.stringify(output.drawRules, null, 2));
