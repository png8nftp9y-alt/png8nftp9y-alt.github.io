import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const config = JSON.parse(await fs.readFile('players.json', 'utf8'));
const previous = JSON.parse(await fs.readFile('data.json', 'utf8'));
const players = config.players || [];
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'courtwatch-'));

const sources = [
  { id: 'fitp-puc', name: 'P.U.C. FITP', hosts: ['fitp.it'], seeds: ['https://www.fitp.it/Tornei/Ricerca-tornei?tournament=Junior%20Next%20Gen%20Brallo', 'https://www.fitp.it/Tornei/Ricerca-tornei'] },
  { id: 'tennis-europe', name: 'Tennis Europe', hosts: ['te.tournamentsoftware.com'], seeds: ['https://te.tournamentsoftware.com/'] },
  { id: 'itf', name: 'ITF', hosts: ['itftennis.com'], seeds: ['https://www.itftennis.com/en/tournament/j30-cuneo/ita/2026/j-j30-ita-2026-002/acceptance-list/'] }
];

for (const p of players) {
  for (const [kind, urls] of Object.entries(p.officialUrls || {})) {
    const id = kind === 'fitp' ? 'fitp-puc' : kind === 'tennisEurope' ? 'tennis-europe' : 'itf';
    const source = sources.find(s => s.id === id);
    for (const url of urls || []) if (url && !source.seeds.includes(url)) source.seeds.push(url);
  }
  sources.find(s => s.id === 'tennis-europe').seeds.push('https://te.tournamentsoftware.com/find/player?q=' + encodeURIComponent(p.name));
  sources.find(s => s.id === 'itf').seeds.push('https://www.itftennis.com/en/search/?q=' + encodeURIComponent(p.name));
}
for (const t of previous.tournaments || []) {
  const source = sources.find(s => s.id === t.sourceId);
  if (source && t.url && !source.seeds.includes(t.url)) source.seeds.push(t.url);
}

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const upper = value => normalize(value).toUpperCase();
const absolute = (href, base) => { try { return new URL(href, base).href.split('#')[0]; } catch { return null; } };
const allowed = (url, source) => { try { const host = new URL(url).hostname.replace(/^www\./, ''); return source.hosts.some(h => host.endsWith(h)); } catch { return false; } };
const monthNumbers = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12, january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

function extractDates(text) {
  const out = [];
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) out.push(m[0]);
  for (const m of text.matchAll(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/g)) out.push(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  for (const m of text.toLowerCase().matchAll(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?\b/g)) out.push(`${m[3] || year}-${String(monthNumbers[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  return [...new Set(out)].sort();
}
function extractTimes(text) {
  return [...new Set([...text.matchAll(/\b(?:ore|at|not before|starting at|nb)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/ig)].map(m => `${m[1].padStart(2, '0')}:${m[2]}`))];
}
function extractEntry(text) {
  let status = null;
  if (/main draw|tabellone principale|\bmd\b/i.test(text)) status = 'Main draw';
  else if (/qualifying|qualification|qualificazioni|\bquali\b|\bq\b/i.test(text)) status = 'Qualifying';
  else if (/alternates?|alternate list|riserve|\balt\b/i.test(text)) status = 'Alternates';
  const position = text.match(/(?:position|posizione|alternate|alt\.?|number|numero)[^0-9]{0,18}(\d{1,3})/i)?.[1] || null;
  return { status, position };
}
function cleanTitle(title) {
  return normalize(title).replace(/\s*[|–-]\s*(FITP|Tennis Europe|ITF).*$/i, '').slice(0, 180) || 'Torneo';
}

const tournaments = new Map((previous.tournaments || []).filter(t => ['fitp-puc', 'tennis-europe', 'itf'].includes(t.sourceId)).map(t => [t.key, t]));
const matches = new Map((previous.matches || []).filter(m => ['fitp-puc', 'tennis-europe', 'itf'].includes(m.sourceId)).map(m => [m.key, m]));
const entries = new Map((previous.entryStatuses || []).map(e => [`${e.playerId}|${e.tournamentKey}`, e]));
const findings = [];
const states = [];

function processDocument(source, url, title, rawText) {
  const text = normalize(rawText);
  if (!text) return;
  const documentDates = extractDates(text);
  const looksLikeSchedule = /ordine di gioco|order of play|programma incontri|schedule|not before|starting at|\bcampo\b|\bcourt\b/i.test(`${title} ${url} ${text.slice(0, 2500)}`);
  const textUpper = upper(text);
  for (const player of players) {
    let index = -1;
    for (const alias of player.aliases || [player.name]) { index = textUpper.indexOf(upper(alias)); if (index >= 0) break; }
    if (index < 0) continue;
    const context = normalize(text.slice(Math.max(0, index - 800), index + 1800));
    const contextDates = extractDates(context);
    const contextTimes = extractTimes(context);
    const observedAt = new Date().toISOString();
    const baseTournament = [...tournaments.values()].find(t => t.playerId === player.id && t.sourceId === source.id && t.url && url.includes(new URL(t.url).pathname)) || [...tournaments.values()].find(t => t.playerId === player.id && t.sourceId === source.id);
    const tournamentName = baseTournament?.name || cleanTitle(title);
    const tournamentKey = baseTournament?.key || `${source.id}|${player.id}|${tournamentName.toLowerCase().replace(/\W+/g, '-')}`;
    const location = baseTournament?.location || 'Luogo da pubblicare';
    const entry = extractEntry(context);
    findings.push({ key: `${source.id}|${player.id}|${url}`, playerId: player.id, playerName: player.name, sourceId: source.id, sourceName: source.name, title: cleanTitle(title), url, snippet: context.slice(0, 1000), observedAt, entryStatus: entry.status, entryPosition: entry.position });
    if (entry.status) {
      entries.set(`${player.id}|${tournamentKey}`, { playerId: player.id, playerName: player.name, tournamentKey, tournamentName, sourceId: source.id, status: entry.status, position: entry.position, url, observedAt });
      if (baseTournament) { baseTournament.entryStatus = entry.status; baseTournament.entryPosition = entry.position; baseTournament.lastSeen = observedAt; }
    }
    const foundDates = contextDates.length ? contextDates : documentDates;
    if (!baseTournament && foundDates.length >= 2 && !/ricerca|search/i.test(title)) tournaments.set(tournamentKey, { key: tournamentKey, playerId: player.id, playerName: player.name, name: tournamentName, location, sourceId: source.id, sourceName: source.name, url, startDate: foundDates[0], endDate: foundDates.at(-1), status: foundDates.at(-1) < today ? 'finished' : foundDates[0] > today ? 'upcoming' : 'active', lastSeen: observedAt });
    if (looksLikeSchedule && contextTimes.length) {
      const matchDate = foundDates.find(d => d >= today) || foundDates[0] || baseTournament?.startDate || today;
      const matchTime = contextTimes[0];
      const court = context.match(/(?:campo|court)\s*(?:n\.?\s*)?([A-Za-z0-9-]+)/i)?.[1] || null;
      const opponent = context.match(/(?:vs\.?|contro)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{3,50})/i)?.[1]?.trim() || null;
      for (const [key, oldMatch] of matches) if (oldMatch.playerId === player.id && oldMatch.date === matchDate && oldMatch.sourceId === source.id && !oldMatch.time) matches.delete(key);
      const key = `${source.id}|${player.id}|${matchDate}|${matchTime}|${tournamentName}`;
      matches.set(key, { key, playerId: player.id, playerName: player.name, tournamentName, location, date: matchDate, time: matchTime, court, opponent, url, sourceId: source.id, sourceName: source.name, status: 'scheduled', lastSeen: observedAt });
    }
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', userAgent: 'Mozilla/5.0 (compatible; CourtWatchOfficialMonitor/5.1)' });
for (const source of sources) {
  const queue = [...new Set(source.seeds)].map(url => ({ url, depth: 0 }));
  const seen = new Set();
  const errors = [];
  while (queue.length && seen.size < 45) {
    const item = queue.shift();
    if (!item || seen.has(item.url) || !allowed(item.url, source)) continue;
    seen.add(item.url);
    if (/\.pdf(?:\?|$)/i.test(item.url)) {
      try {
        const pdf = path.join(tmp, `${source.id}-${seen.size}.pdf`);
        const txt = pdf + '.txt';
        const response = await fetch(item.url);
        await fs.writeFile(pdf, Buffer.from(await response.arrayBuffer()));
        await exec('pdftotext', ['-layout', pdf, txt]);
        processDocument(source, item.url, path.basename(new URL(item.url).pathname), await fs.readFile(txt, 'utf8'));
      } catch (error) { errors.push(String(error.message || error).slice(0, 160)); }
      continue;
    }
    const page = await context.newPage();
    const responseTasks = [];
    page.on('response', response => {
      const contentType = response.headers()['content-type'] || '';
      if (/json|text\//i.test(contentType) && /api|search|tournament|draw|schedule|accept|order|competition/i.test(response.url())) responseTasks.push((async () => { try { const body = await response.text(); if (body.length < 4000000) processDocument(source, response.url(), await page.title().catch(() => response.url()), body); } catch {} })());
    });
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(5000);
      const title = normalize(await page.title());
      const body = await page.locator('body').innerText({ timeout: 12000 }).catch(() => '');
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })));
      processDocument(source, item.url, title, body);
      await Promise.allSettled(responseTasks);
      if (item.depth < 2) for (const link of links) {
        const url = absolute(link.href, item.url);
        if (!url || !allowed(url, source) || seen.has(url)) continue;
        if (/\.pdf|torne|tournament|competition|draw|tabell|order|ordine|schedule|programma|accept|entry|player|profile|match|risultat/i.test(`${url} ${link.text}`)) queue.push({ url, depth: item.depth + 1 });
      }
    } catch (error) { errors.push(String(error.message || error).slice(0, 160)); }
    finally { await page.close(); }
  }
  states.push({ id: source.id, name: source.name, status: seen.size && errors.length < seen.size ? 'active' : 'partial', pagesChecked: seen.size, errorCount: errors.length, lastRun: new Date().toISOString() });
}
await browser.close();

const nextMatches = [...matches.values()].sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
const nextEntries = [...entries.values()];
const oldMatchSignatures = new Map((previous.matches || []).map(m => [m.key, `${m.date}|${m.time || ''}|${m.court || ''}|${m.opponent || ''}`]));
const oldEntrySignatures = new Map((previous.entryStatuses || []).map(e => [`${e.playerId}|${e.tournamentKey}`, `${e.status}|${e.position || ''}`]));
const notifications = [];
for (const match of nextMatches) {
  const signature = `${match.date}|${match.time || ''}|${match.court || ''}|${match.opponent || ''}`;
  const before = oldMatchSignatures.get(match.key);
  if (before !== signature && match.lastSeen) notifications.push({ type: 'match', playerName: match.playerName, message: `${match.tournamentName}: ${match.date} alle ${match.time || 'orario da pubblicare'}${match.court ? ' · campo ' + match.court : ''}${match.opponent ? ' · contro ' + match.opponent : ''}`, url: match.url });
}
for (const entry of nextEntries) {
  const key = `${entry.playerId}|${entry.tournamentKey}`;
  const signature = `${entry.status}|${entry.position || ''}`;
  if (oldEntrySignatures.get(key) !== signature) notifications.push({ type: 'entry', playerName: entry.playerName, message: `${entry.tournamentName}: ${entry.status}${entry.position ? ' · posizione ' + entry.position : ''}`, url: entry.url });
}
const data = { ...previous, generatedAt: new Date().toISOString(), mode: 'official-portals-vercel', players: players.map(p => ({ id: p.id, name: p.name, club: p.club || null, circuits: p.circuits || [] })), tournaments: [...tournaments.values()], matches: nextMatches, entryStatuses: nextEntries, findings, sources: states };
await fs.writeFile('data.json', JSON.stringify(data, null, 2) + '\n');
await fs.writeFile('alerts.json', JSON.stringify({ generatedAt: data.generatedAt, notifications }, null, 2) + '\n');
console.log(`Court Watch v5.1: ${states.map(s => `${s.name} ${s.pagesChecked}`).join(', ')}; ${findings.length} riscontri; ${notifications.length} avvisi.`);
