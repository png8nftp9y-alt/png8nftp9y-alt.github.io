import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { URL } from 'node:url';

const config = JSON.parse(await fs.readFile(new URL('./players.json', import.meta.url), 'utf8'));
let old = {};
try { old = JSON.parse(await fs.readFile(new URL('./data.json', import.meta.url), 'utf8')); } catch {}

const SOURCES = [
  { id: 'fitp', name: 'FITP pubblico', seeds: ['https://www.fitp.it/Tornei/Ricerca-tornei'], max: 12 },
  { id: 'tennis-europe', name: 'Tennis Europe', seeds: ['https://www.tenniseurope.org/tournaments', 'https://te.tournamentsoftware.com/find'], max: 18 },
  { id: 'itf', name: 'ITF pubblico', seeds: ['https://www.itftennis.com/en/tournament-calendar/world-tennis-tour-juniors-calendar/'], max: 18 },
  { id: 'tennistalker', name: 'TennisTalker pubblico', seeds: config.players.map(p => p.tennisTalkerUrl).filter(Boolean), max: 20 }
];

const norm = v => (v || '').replace(/\s+/g, ' ').trim();
const upper = v => norm(v).toUpperCase();
const abs = (href, base) => { try { return new URL(href, base).href.split('#')[0]; } catch { return null; } };
const allowed = (u, s) => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return s.id === 'fitp' ? h.endsWith('fitp.it') : s.id === 'tennis-europe' ? h.endsWith('tenniseurope.org') || h.endsWith('tournamentsoftware.com') : s.id === 'itf' ? h.endsWith('itftennis.com') : h.endsWith('tennistalker.it'); } catch { return false; } };
const nav = /tournament|torneo|tabellon|draw|entry|acceptance|order.of.play|ordine.di.gioco|schedule|programma|calendar|calendario|player|giocatore/i;
const registration = /iscritt[oaie]|entry list|acceptance list|accepted|main draw|qualifying|alternate|programmata|tornei programmati/i;
const orderOfPlay = /order of play|ordine di gioco|programma incontri|schedule/i;
const draw = /tabellone|draw|round of|quarti|semifinale|finale/i;
const matchSignal = /campo|court|\bvs\.?\b|contro|ore\s+\d{1,2}[:.]\d{2}/i;
const loss = /eliminat[oa]|ha perso|sconfitt[oa]|lost to|defeated by|ritirat[oa]|walkover against/i;
const kind = t => orderOfPlay.test(t) ? 'order_of_play' : registration.test(t) ? 'registration' : draw.test(t) ? 'draw' : matchSignal.test(t) ? 'match' : 'mention';
const clip = (text, aliases, before = 260, after = 900) => { const u = text.toUpperCase(); for (const a of aliases) { const i = u.indexOf(a.toUpperCase()); if (i >= 0) return norm(text.slice(Math.max(0, i - before), i + after)); } return ''; };
const score = l => { const v = `${l.url} ${l.text}`; return (nav.test(v) ? 5 : 0) + (/2026|2027/.test(v) ? 2 : 0) + (/ital|ita|milano|roma|lecco|lombard/i.test(v) ? 3 : 0) - (/login|privacy|cookie|news|facebook|instagram|youtube/i.test(v) ? 8 : 0); };

const months = { gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12,january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
function dates(text) {
  const out = [];
  for (const m of text.matchAll(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/g)) out.push(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`);
  for (const m of text.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g)) out.push(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  for (const m of text.toLowerCase().matchAll(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/g)) out.push(`${m[3]}-${String(months[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  return [...new Set(out)].sort();
}
const time = t => t.match(/\b(?:ore\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/i)?.slice(1).join(':') || null;
const court = t => t.match(/(?:campo|court)\s*([A-Za-z0-9-]+)/i)?.[1] || null;
const cleanTournamentName = value => norm(value).replace(/^(tornei programmati|tornei in programma|attività|tornei)\s*/i, '').replace(/^(programmat[oa])\s*/i, '').replace(/[·|:-]+$/,'').trim();

function programmedTournaments(text) {
  const lines = text.split(/\r?\n/).map(norm).filter(Boolean);
  const out = [];
  const range = /(\d{1,2}[\/.]\d{1,2}[\/.]20\d{2})\s*-\s*(\d{1,2}[\/.]\d{1,2}[\/.]20\d{2})/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(range);
    if (!m) continue;
    const status = `${lines[i]} ${lines[i + 1] || ''}`;
    if (!/PROGRAMMAT[AO]/i.test(status)) continue;
    let name = cleanTournamentName(lines[i].replace(range, '').replace(/PROGRAMMAT[AO]/ig, ''));
    if (!name || /^\d|^(data|dal|al)$/i.test(name)) name = cleanTournamentName(lines[i - 1] || '');
    if (!name || /^(panoramica|partite|statistiche|attività|social)$/i.test(name)) continue;
    const ds = dates(`${m[1]} ${m[2]}`);
    out.push({ name, startDate: ds[0], endDate: ds[1] || ds[0] });
  }
  const flat = norm(text);
  const section = flat.split(/tornei programmati/i).pop();
  for (const chunk of section.split(/PROGRAMMAT[AO]/i).slice(0, -1)) {
    const m = chunk.match(/(\d{1,2}[\/.]\d{1,2}[\/.]20\d{2})\s*-\s*(\d{1,2}[\/.]\d{1,2}[\/.]20\d{2})\s*$/);
    if (!m) continue;
    const before = chunk.slice(0, m.index);
    let name = cleanTournamentName(before.slice(-220).split(/PROGRAMMAT[AO]|tornei programmati/i).pop());
    const ds = dates(`${m[1]} ${m[2]}`);
    if (name && ds.length) out.push({ name, startDate: ds[0], endDate: ds[1] || ds[0] });
  }
  const unique = new Map();
  for (const t of out) unique.set(`${upper(t.name)}|${t.startDate}|${t.endDate}`, t);
  return [...unique.values()];
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', userAgent: 'Mozilla/5.0 (compatible; CourtWatchPublicMonitor/3.0)' });
const findings = [], liveTournaments = [], liveMatches = [], tracked = new Set(old.trackedUrls || []), sourceStates = [];

for (const source of SOURCES) {
  const queue = [...new Set([...source.seeds, ...(old.trackedUrls || []).filter(u => allowed(u, source))])].map(url => ({ url, depth: 0 }));
  const seen = new Set(), errors = [];
  while (queue.length && seen.size < source.max) {
    const item = queue.shift();
    if (!item?.url || seen.has(item.url) || !allowed(item.url, source)) continue;
    seen.add(item.url);
    const page = await ctx.newPage();
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const title = norm(await page.title());
      const text = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      const pageUrl = page.url();
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })));
      const expanded = links.map(l => ({ url: abs(l.href, pageUrl), text: norm(l.text) })).filter(l => l.url);

      if (source.id === 'tennistalker') {
        for (const player of config.players) {
          const aliases = player.aliases || [player.name];
          const playerLink = expanded.find(l => /\/giocatore\/\d+/.test(l.url) && aliases.some(a => upper(l.text).includes(upper(a))));
          if (playerLink) {
            tracked.add(playerLink.url);
            if (!player.tennisTalkerUrl) player.tennisTalkerUrl = playerLink.url;
            if (!seen.has(playerLink.url)) queue.unshift({ url: playerLink.url, depth: 1 });
          }
        }
      }

      for (const player of config.players) {
        const aliases = player.aliases || [player.name];
        const snippet = clip(text, aliases);
        if (!snippet) continue;
        const directProfile = source.id === 'tennistalker' && (/\/giocatore\/\d+/.test(pageUrl)) && (aliases.some(a => upper(title).includes(upper(a))) || (player.tennisTalkerUrl && pageUrl.includes(player.tennisTalkerUrl)));
        const observedAt = new Date().toISOString();
        if (directProfile) {
          const scheduled = programmedTournaments(text);
          for (const t of scheduled) {
            const key = `${player.id}|${pageUrl}|${upper(t.name)}|${t.startDate}`;
            if (!findings.some(f => f.key === key)) findings.push({ key, playerId: player.id, playerName: player.name, sourceId: source.id, sourceName: source.name, type: 'registration', title: t.name, url: pageUrl, snippet: `${t.name} ${t.startDate} ${t.endDate} PROGRAMMATA`, observedAt, dates: [t.startDate, t.endDate], time: null, court: null, eliminated: false });
            liveTournaments.push({ key, playerId: player.id, playerName: player.name, name: t.name, circuit: 'FITP / TennisTalker', url: pageUrl, startDate: t.startDate, endDate: t.endDate, status: t.startDate > new Date().toISOString().slice(0,10) ? 'upcoming' : 'active', lastSeen: observedAt, evidence: 'Iscrizione programmata visibile sul profilo pubblico TennisTalker' });
          }
        }
        const type = kind(snippet), key = `${player.id}|${pageUrl}|${type}`;
        if (!findings.some(f => f.key === key)) findings.push({ key, playerId: player.id, playerName: player.name, sourceId: source.id, sourceName: source.name, type, title: title || pageUrl, url: pageUrl, snippet, observedAt, dates: dates(snippet), time: time(snippet), court: court(snippet), eliminated: loss.test(snippet) });
        tracked.add(pageUrl);
      }

      if (item.depth < 1) {
        const candidates = expanded.filter(l => allowed(l.url, source) && score(l) > 0).sort((a,b) => score(b) - score(a));
        for (const l of candidates.slice(0, source.max)) if (!seen.has(l.url)) queue.push({ url: l.url, depth: item.depth + 1 });
      }
    } catch (e) { errors.push({ url: item.url, error: String(e.message || e).slice(0,180) }); }
    finally { await page.close(); }
  }
  sourceStates.push({ id: source.id, name: source.name, status: seen.size ? (errors.length < seen.size ? 'ok' : 'partial') : 'error', pagesChecked: seen.size, errorCount: errors.length });
}
await browser.close();

const today = new Date().toISOString().slice(0,10);
const tournamentMap = new Map();
for (const t of old.tournaments || []) {
  if (t.endDate && t.endDate < today && !['eliminated','finished'].includes(t.status)) t.status = 'finished';
  tournamentMap.set(t.key, t);
}
for (const t of liveTournaments) tournamentMap.set(t.key, t);
for (const f of findings.filter(f => ['registration','draw','order_of_play','match'].includes(f.type) && f.type !== 'registration')) {
  const key = `${f.playerId}|${f.url}`;
  const ds = f.dates || [], existing = tournamentMap.get(key) || {};
  tournamentMap.set(key, { ...existing, key, playerId: f.playerId, playerName: f.playerName, name: f.title, circuit: f.sourceName, url: f.url, startDate: ds[0] || existing.startDate || null, endDate: ds.at(-1) || existing.endDate || null, status: f.eliminated ? 'eliminated' : ((ds[0] || '') > today ? 'upcoming' : 'active'), lastSeen: f.observedAt });
}
const tournaments = [...tournamentMap.values()].filter(t => !(t.status === 'active' && !t.endDate && t.lastSeen && Date.now() - new Date(t.lastSeen).getTime() > 21 * 86400000));
const matchMap = new Map((old.matches || []).map(m => [m.key, m]));
for (const f of findings.filter(f => ['order_of_play','match'].includes(f.type) && f.dates?.length)) {
  const date = f.dates[0], key = `${f.playerId}|${f.url}|${date}|${f.time || ''}`;
  matchMap.set(key, { key, playerId: f.playerId, playerName: f.playerName, tournamentName: f.title, date, time: f.time, court: f.court, opponent: null, url: f.url, status: f.eliminated ? 'completed' : 'scheduled', lastSeen: f.observedAt });
}
for (const m of liveMatches) matchMap.set(m.key, m);
const matches = [...matchMap.values()].filter(m => m.date >= new Date(Date.now() - 14 * 86400000).toISOString().slice(0,10));
const players = config.players.map(p => ({ ...p, findingCount: findings.filter(f => f.playerId === p.id).length }));
await fs.writeFile(new URL('./data.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), mode: 'public-web', players, findings, matches, tournaments, trackedUrls: [...tracked].slice(0,300), sources: sourceStates }, null, 2) + '\n');
console.log(`CourtWatch v3: ${findings.length} riscontri, ${tournaments.length} tornei, ${matches.length} partite.`);
