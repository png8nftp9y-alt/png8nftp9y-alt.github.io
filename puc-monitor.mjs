import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOT = 'https://www.fitp.it';
const SEARCH = `${ROOT}/Tornei/Ricerca-tornei`;
const TARGET = /JUNIOR\s+NEXT\s+GEN|CENTRO\s+ESTIVO.*BRALLO|BRALLO/i;
const now = new Date().toISOString();
const data = JSON.parse(await fs.readFile('data.json', 'utf8'));
const old = new Map((data.matches || []).map(m => [m.key, `${m.date}|${m.time}|${m.court}|${m.opponent}`]));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'puc-'));
const competitions = new Set();
const pdfs = new Set();
const docs = [];
const diag = { startedAt: now, searchLoaded: false, cards: [], competitionUrls: [], pdfUrls: [], rejectedUrls: [], errors: [] };
const names = new Map((data.players || []).map(p => [p.id, [p.name, p.name.split(/\s+/).reverse().join(' ')].map(v => v.toUpperCase())]));

function addError(value) {
  if (diag.errors.length < 40) diag.errors.push(String(value).slice(0, 800));
}
function absolute(value, base = `${ROOT}/`) {
  try { return new URL(String(value).replace(/&amp;/g, '&'), base).href; } catch { return null; }
}
function isFitp(url) {
  try { const h = new URL(url).hostname; return h === 'fitp.it' || h.endsWith('.fitp.it'); } catch { return false; }
}
function addCompetition(value, base) {
  const url = absolute(value, base);
  if (url && isFitp(url) && /\/(?:Tornei\/Dettaglio-Competizione|Pagine-Puc\/Competizione)/i.test(new URL(url).pathname) && /competitionId=/i.test(url)) competitions.add(url);
}
function addPdf(value, base) {
  const url = absolute(value, base);
  if (!url || !isFitp(url) || !/\.pdf(?:$|\?)/i.test(url)) return;
  pdfs.add(url);
}
function inspect(value, base, { allowPdfs = false } = {}) {
  const text = String(value || '');
  for (const match of text.matchAll(/(?:https?:\/\/www\.fitp\.it)?\/(?:Tornei\/Dettaglio-Competizione|Pagine-Puc\/Competizione)\?[^\s"'<>]*competitionId=[A-Za-z0-9-]+[^\s"'<>]*/gi)) addCompetition(match[0], base);
  for (const match of text.matchAll(/(?:competitionId|competition_id|id_fonte)["'\s:=]+([A-Za-z0-9-]{3,})/gi)) addCompetition(`/Tornei/Dettaglio-Competizione?competitionId=${match[1]}`, base);
  if (allowPdfs) for (const match of text.matchAll(/(?:https?:\/\/[^\s"'<>]+|\/[^\s"'<>]+)\.pdf(?:\?[^\s"'<>]*)?/gi)) addPdf(match[0], base);
}
async function pdfText(file) {
  try {
    const output = `${file}.txt`;
    await exec('pdftotext', ['-layout', file, output]);
    return await fs.readFile(output, 'utf8');
  } catch (error) {
    addError(`PDF: ${error.message}`);
    return '';
  }
}
function watch(page, allowPdfs = false) {
  page.on('response', response => {
    const url = response.url();
    const type = response.headers()['content-type'] || '';
    if (!isFitp(url)) return;
    if (allowPdfs && /application\/pdf/i.test(type)) addPdf(url, url);
    if (!/json|text|html/i.test(type)) return;
    response.text().then(text => {
      if (text.length < 8e6) inspect(text, url, { allowPdfs });
    }).catch(() => {});
  });
}
async function acceptCookies(page) {
  for (const selector of ['#iubenda-cs-accept-btn', '#iubenda-cs-reject-btn', 'button:has-text("Accetta")', 'button:has-text("Rifiuta")']) {
    const button = page.locator(selector).first();
    if (await button.count() && await button.isVisible().catch(() => false)) await button.click({ timeout: 1500 }).catch(() => {});
  }
}
async function searchTournament(page, context) {
  await page.goto(SEARCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  diag.searchLoaded = true;
  await page.waitForTimeout(3000);
  await acceptCookies(page);

  const candidates = page.locator('input');
  let input = null;
  for (let i = 0; i < await candidates.count(); i++) {
    const item = candidates.nth(i);
    const placeholder = await item.getAttribute('placeholder').catch(() => '');
    const type = await item.getAttribute('type').catch(() => '');
    if (await item.isVisible().catch(() => false) && (/torneo|circolo|provincia|cerca/i.test(placeholder || '') || /search/i.test(type || ''))) { input = item; break; }
  }
  if (!input) throw new Error('Campo di ricerca P.U.C. non trovato');
  await input.fill('JUNIOR NEXT GEN BRALLO');

  const searchButtons = page.getByRole('button', { name: /^Cerca$/i });
  let submitted = false;
  for (let i = 0; i < await searchButtons.count(); i++) {
    const button = searchButtons.nth(i);
    if (await button.isVisible().catch(() => false)) { await button.click(); submitted = true; break; }
  }
  if (!submitted) await input.press('Enter');
  await page.waitForTimeout(6500);

  for (let pass = 0; pass < 25; pass++) {
    const texts = page.locator('body *').filter({ hasText: TARGET });
    let found = false;
    for (let i = 0; i < Math.min(await texts.count(), 30); i++) {
      const item = texts.nth(i);
      const text = (await item.innerText().catch(() => '')).trim();
      if (!text || !TARGET.test(text) || text.length > 1200) continue;
      found = true;
      if (!diag.cards.includes(text.slice(0, 300))) diag.cards.push(text.slice(0, 300));
      const html = await item.evaluate(element => {
        let current = element;
        for (let depth = 0; depth < 10 && current; depth++, current = current.parentElement) {
          if (/Dettagli|competitionId|id_fonte/i.test(current.outerHTML || '')) return current.outerHTML;
        }
        return element.outerHTML;
      }).catch(() => '');
      inspect(html, page.url());
    }
    inspect(await page.content(), page.url());
    if (competitions.size) break;

    if (found) {
      const details = page.getByText(/^Dettagli$/i);
      for (let i = 0; i < await details.count(); i++) {
        const button = details.nth(i);
        if (!await button.isVisible().catch(() => false)) continue;
        const containerText = await button.evaluate(element => {
          let current = element;
          for (let depth = 0; depth < 8 && current; depth++, current = current.parentElement) {
            const text = (current.innerText || '').trim();
            if (/JUNIOR\s+NEXT\s+GEN|CENTRO\s+ESTIVO.*BRALLO|BRALLO/i.test(text)) return text;
          }
          return '';
        }).catch(() => '');
        if (!TARGET.test(containerText)) continue;
        const before = page.url();
        const popupPromise = context.waitForEvent('page', { timeout: 4000 }).catch(() => null);
        await button.click({ timeout: 3000 }).catch(() => {});
        const popup = await popupPromise;
        const targetPage = popup || page;
        await targetPage.waitForTimeout(3500).catch(() => {});
        inspect(targetPage.url(), targetPage.url());
        inspect(await targetPage.content().catch(() => ''), targetPage.url());
        if (popup) await popup.close().catch(() => {});
        if (page.url() !== before && !competitions.size) await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        break;
      }
      if (competitions.size) break;
    }

    const more = page.locator('#btn-loadMore, button:has-text("Carica altri")').first();
    if (!await more.count() || !await more.isVisible().catch(() => false)) break;
    await more.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
  const page = await context.newPage();
  watch(page, false);
  await searchTournament(page, context);

  for (const url of [...competitions].slice(0, 12)) {
    const competitionPage = await context.newPage();
    watch(competitionPage, true);
    try {
      await competitionPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await competitionPage.waitForTimeout(6500);
      await acceptCookies(competitionPage);
      inspect(await competitionPage.content(), competitionPage.url(), { allowPdfs: true });
      for (const href of await competitionPage.locator('a[href]').evaluateAll(links => links.map(link => link.href)).catch(() => [])) {
        if (/\.pdf|ordine|orario|order|tabellone|programma/i.test(href)) addPdf(href, competitionPage.url());
      }
      const downloadLinks = competitionPage.getByText(/Scarica pdf|Ordine di gioco|Orario di gioco/i);
      for (let i = 0; i < await downloadLinks.count(); i++) {
        const link = downloadLinks.nth(i);
        if (!await link.isVisible().catch(() => false)) continue;
        const href = await link.getAttribute('href').catch(() => null);
        if (href) { addPdf(href, competitionPage.url()); continue; }
        const pending = competitionPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await link.click({ timeout: 3000 }).catch(() => {});
        const download = await pending;
        if (download) {
          const file = path.join(tmp, await download.suggestedFilename());
          await download.saveAs(file);
          docs.push({ url: competitionPage.url(), text: await pdfText(file) });
        }
      }
    } catch (error) { addError(`${url}: ${error.message}`); }
    await competitionPage.close();
  }

  for (const url of [...pdfs].slice(0, 50)) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) { diag.rejectedUrls.push(`${url} (HTTP ${response.status})`); continue; }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || '';
      if (!/application\/pdf/i.test(contentType) && buffer.subarray(0, 4).toString() !== '%PDF') {
        diag.rejectedUrls.push(`${url} (${contentType || 'not a PDF'})`);
        continue;
      }
      const file = path.join(tmp, `${Math.random().toString(36).slice(2)}.pdf`);
      await fs.writeFile(file, buffer);
      docs.push({ url, text: await pdfText(file) });
    } catch (error) { addError(`${url}: ${error.message}`); }
  }
} catch (error) {
  addError(`Scanner: ${error.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
}

const months = { gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06', luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12' };
function dateOf(text) {
  const named = text.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})/i);
  if (named) return `${named[3]}-${months[named[2].toLowerCase()]}-${named[1].padStart(2, '0')}`;
  const numeric = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
  return numeric ? `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}` : null;
}
function timeNear(lines, at) {
  for (let radius = 0; radius <= 12; radius++) for (const index of [at + radius, at - radius]) {
    const match = lines[index]?.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return null;
}
function courtNear(lines, at, position) {
  const header = lines.slice(Math.max(0, at - 120), at + 1).reverse().find(line => (line.match(/CAMPO\s+\d+/gi) || []).length >= 2);
  if (!header) return null;
  return [...header.matchAll(/CAMPO\s+(\d+)/gi)].map(match => ({ number: match[1], position: match.index || 0 })).sort((a, b) => Math.abs(a.position - position) - Math.abs(b.position - position))[0]?.number || null;
}

const updates = [];
for (const doc of docs) {
  if (!/ordine di gioco|orario di gioco|CAMPO\s+\d+/i.test(doc.text)) continue;
  const date = dateOf(doc.text);
  const lines = doc.text.split(/\r?\n/);
  const upper = lines.map(line => line.toUpperCase());
  if (!date) continue;
  for (const [id, aliases] of names) {
    let at = -1;
    let position = -1;
    for (let i = 0; i < upper.length && at < 0; i++) for (const alias of aliases) {
      const found = upper[i].indexOf(alias);
      if (found >= 0) { at = i; position = found; break; }
    }
    if (at < 0) continue;
    const time = timeNear(lines, at);
    if (!time) continue;
    let match = (data.matches || []).find(item => item.playerId === id && item.date === date);
    if (!match) {
      const tournament = (data.tournaments || []).find(item => item.playerId === id && /BRALLO|JUNIOR NEXT GEN/i.test(item.name || ''));
      if (!tournament) continue;
      match = { key: `puc|${date}|${id}`, playerId: id, playerName: tournament.playerName, tournamentName: tournament.name, location: tournament.location, date, time: null, court: null, opponent: null, url: tournament.url, sourceId: 'fitp-puc', status: 'scheduled' };
      (data.matches ||= []).push(match);
    }
    const player = (data.players || []).find(item => item.id === id);
    const surname = (player?.name || '').trim().split(/\s+/).at(-1)?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const opponent = surname ? doc.text.match(new RegExp(`${surname}\\s+incontra\\s+([^;\\n.]+)`, 'i'))?.[1]?.trim() : null;
    match.time = time;
    match.court = courtNear(lines, at, position) || match.court;
    match.opponent = opponent || match.opponent;
    match.url = doc.url;
    match.sourceName = 'P.U.C. FITP';
    match.verifiedAt = now;
    updates.push(match);
  }
}

diag.competitionUrls = [...competitions];
diag.pdfUrls = [...pdfs];
diag.documents = docs.length;
diag.finishedAt = new Date().toISOString();
data.generatedAt = now;
data.pucDiagnostics = diag;
await fs.writeFile('data.json', `${JSON.stringify(data, null, 2)}\n`);
const unique = [...new Map(updates.map(match => [match.key, match])).values()];
const notifications = unique.filter(match => old.get(match.key) !== `${match.date}|${match.time}|${match.court}|${match.opponent}`).map(match => ({ type: 'match', playerName: match.playerName, message: `${match.tournamentName}: ${match.date} alle ${match.time}${match.court ? ` · campo ${match.court}` : ''}${match.opponent ? ` · contro ${match.opponent}` : ''}`, url: match.url }));
await fs.writeFile('alerts.json', `${JSON.stringify({ generatedAt: now, notifications }, null, 2)}\n`);
console.log(JSON.stringify({ competitions: competitions.size, pdfs: pdfs.size, documents: docs.length, updates: unique.length, diagnostics: diag }, null, 2));
