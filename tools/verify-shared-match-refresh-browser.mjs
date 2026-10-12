import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const assets = Object.fromEntries(await Promise.all(['v3.html', 'v3.js', 'v3.css'].map(async name => [name, await readFile(new URL('../' + name, import.meta.url), 'utf8')])));
const player = {id: 'virginia-cereghini', name: 'Virginia Cereghini', userAdded: true};
const tournament = {playerId: player.id, competitionId: 'fixture-event', name: 'Fixture Europe', circuit: 'tennis-europe', startDate: '2026-01-01', endDate: '2026-10-14'};
const full = {id: 'full-double', playerId: player.id, playerName: player.name, competitionId: tournament.competitionId, tournamentName: tournament.name, circuit: 'tennis-europe', date: '2026-10-13', event: 'GD14 - Girls Doubles 14 Main Draw', round: 'Round of 16', matchType: 'doubles', partner: 'Ivona Dirnbek', opponent: 'Nadia Luczak / Amaliya Pismennyi', court: 'Court 1', courtMatchNumber: 2};
const wrong = {...full, id: 'wrong-double', partner: '', opponent: full.partner};
const old = {...full, id: 'old-single', date: '2026-01-03', event: 'GS14', matchType: 'singles', partner: '', opponent: 'Previous Opponent', score: '6-4 6-3', result: '6-4 6-3'};
const recent = {...old, id: 'recent-single', date: '2026-10-12', opponent: 'Recent Opponent'};
const browser = await chromium.launch({headless: true});
try {
  for (const group of ['main', 'others']) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    let offline = false, partial = false, requests = 0;
    await page.addInitScript(() => {window.setInterval = () => 0;});
    await page.route('**/*', async route => {
      const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
      if (url.pathname.endsWith('/app-snapshot')) {
        requests++;
        if (offline) return route.fulfill({status: 503, json: {error: 'offline'}});
        return route.fulfill({json: {group, generatedAt: '2026-10-13T00:00:00Z', players: [player], tournaments: partial ? [{...tournament, entryStatus: 'withdrawn'}] : [tournament], matches: partial ? [{...recent, score: '', result: ''}] : [old, recent, wrong, full]}});
      }
      if (url.pathname.endsWith('/session')) return route.fulfill({json: {user: {displayName: 'Fixture', role: 'admin'}}});
      if (assets[name]) return route.fulfill({body: assets[name], contentType: name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/javascript'});
      return route.fulfill({json: {players: [], tournaments: [], matches: [], rankings: [], results: [], agenda: []}});
    });
    const target = `http://courtwatch.test/v3.html?group=${group}#player/${player.id}`;
    await page.goto(target);
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'full-double'));
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: profile must have two singles and only the correct double`);
    const before = await page.evaluate(() => state.data.matches.map(m => m.id));
    assert.equal(before.includes('wrong-double'), false);
    partial = true;
    await page.evaluate(() => load());
    assert.deepEqual(await page.evaluate(() => state.data.matches.map(m => m.id).sort()), [...before].sort(), `${group}: partial refresh must preserve known history`);
    assert.equal(await page.evaluate(() => state.data.matches.find(m => m.id === 'recent-single').score), '6-4 6-3');
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {if (key.includes('last-good')) throw Error('QuotaExceededError'); return original.call(this, key, value);};
      localStorage.removeItem(LAST_GOOD_CACHE);
      saveCachedData(state.data);
    });
    offline = true;
    await page.reload();
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'old-single'));
    await page.evaluate(() => load());
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: cache reload must retain the old single`);
    assert.equal(await page.locator('#syncStatus').isVisible(), false);
    assert.equal(await page.locator('#dataAlert').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({group, knownMatches: before.length, partialRefresh: 'passed', profileDouble: 'passed', cacheReload: 'passed', requests}));
    await page.close();
  }
} finally {await browser.close();}
