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
const browser = await chromium.launch({headless: true, executablePath: process.env.COURTWATCH_TEST_CHROMIUM || undefined});
try {
  for (const group of ['main', 'others']) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(String(error)));
    let offline = false, partial = false, empty = false, requests = 0, holdSnapshot = false, releaseSnapshot;
    let holdOpponent = false, releaseOpponent, opponentOffline = false, opponentPartial = false;
    const opponentRequests = new Map();
    await page.addInitScript(() => {
      window.setInterval = () => 0;
      window.observedProfileCounts = [];
      window.observedEmptyOpponent = false;
      new MutationObserver(() => {
        const stat = document.querySelector('#profileContent [data-stat="all"]');
        if (stat) window.observedProfileCounts.push(Number(stat.textContent));
        if (document.querySelector('.opponentProfileHero') && !document.querySelector('#opponentTournamentHistory .unifiedMatchRow')) window.observedEmptyOpponent = true;
      }).observe(document, {childList: true, subtree: true, characterData: true});
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url()), name = url.pathname.split('/').pop();
      if (url.pathname.endsWith('/opponent-profile')) {
        const id = url.searchParams.get('profileId'), person = url.searchParams.get('name');
        opponentRequests.set(id, (opponentRequests.get(id) || 0) + 1);
        if (holdOpponent && id === 'fixture-opponent-a') await new Promise(resolve => {releaseOpponent = resolve;});
        if (opponentOffline) return route.fulfill({status: 503, json: {error: 'offline'}});
        return route.fulfill({json: {profile: {name: person, ranking: 12, category: 'GS14'}, tournaments: opponentPartial ? [] : [{...tournament, competitionId: 'opponent-event', historyKind: 'past', matches: [{id: id + '-match', date: '2026-01-03', event: 'GS14', round: 'Final', score: '6-4 6-3', won: true, status: 'completed', opponents: [{name: id === 'fixture-opponent-a' ? 'Opponent B' : 'Opponent C', profileId: id === 'fixture-opponent-a' ? 'fixture-opponent-b' : 'fixture-opponent-c'}]}]}]}});
      }
      if (url.pathname.endsWith('/app-snapshot')) {
        requests++;
        if (holdSnapshot) await new Promise(resolve => {releaseSnapshot = resolve;});
        if (offline) return route.fulfill({status: 503, json: {error: 'offline'}});
        return route.fulfill({json: {group, generatedAt: '2026-10-13T00:00:00Z', players: empty ? [] : [player], tournaments: empty ? [] : partial ? [{...tournament, entryStatus: 'withdrawn'}] : [tournament], matches: empty ? [] : partial ? [{...recent, score: '', result: ''}] : [old, recent, wrong, full, {...recent, id:"disabled-fitp", circuit:"fitp"}, {...recent, id:"disabled-itf", circuit:"itf"}]}});
      }
      if (url.pathname.endsWith('/session')) return route.fulfill({json: {user: {displayName: 'Fixture', role: 'admin'}}});
      if (assets[name]) return route.fulfill({body: assets[name], contentType: name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/javascript'});
      return route.fulfill({json: {players: [], tournaments: [], matches: [], rankings: [], results: [], agenda: []}});
    });
    const target = `http://courtwatch.test/v3.html?group=${group}#player/${player.id}`;
    await page.goto(target);
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'full-double'));
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: profile must have two singles and only the correct double`);
    assert.equal(await page.evaluate(() => observedProfileCounts.includes(0)), false, `${group}: cold profile must never render a provisional zero`);
    const before = await page.evaluate(() => state.data.matches.map(m => m.id));
    assert.equal(before.includes('wrong-double'), false);
    partial = true;
    await page.evaluate(() => load());
    assert.deepEqual(await page.evaluate(() => state.data.matches.map(m => m.id).sort()), [...before].sort(), `${group}: partial refresh must preserve known history`);
    assert.equal(await page.evaluate(() => state.data.matches.find(m => m.id === 'recent-single').score), '6-4 6-3');
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    empty = true;
    await page.evaluate(() => load());
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: an empty snapshot must not erase the player profile`);
    assert.equal(await page.evaluate(() => state.data.players.length), 1);
    await page.evaluate(async () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {if (key.includes('last-good') || key.includes('calendar-v1')) throw Error('QuotaExceededError'); return original.call(this, key, value);};
      for (const storage of [localStorage, sessionStorage]) { storage.removeItem(LAST_GOOD_CACHE); storage.removeItem(CALENDAR_CACHE); }
      await saveCachedData(state.data);
    });
    offline = true;
    await page.reload();
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'old-single'));
    await page.evaluate(() => load());
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: cache reload must retain the old single`);
    assert.equal(await page.locator('#syncStatus').isVisible(), false);
    assert.equal(await page.locator('#dataAlert').isVisible(), false);
    assert.equal(await page.evaluate(() => observedProfileCounts.includes(0)), false, `${group}: durable restore must precede profile rendering`);

    // A newer empty Web Storage copy must not defeat an older complete IndexedDB copy.
    await page.evaluate(() => {
      const partial = {...calendarCacheSnapshot(state.data, Date.now() + 1000), matches: [], agenda: []};
      localStorage.setItem(CALENDAR_CACHE, JSON.stringify(partial));
      sessionStorage.setItem(CALENDAR_CACHE, JSON.stringify(partial));
    });
    await page.reload();
    await page.locator('#profileContent [data-stat="all"]').waitFor();
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3, `${group}: first profile must recover history despite a newer partial cache`);
    assert.equal(await page.evaluate(() => observedProfileCounts.includes(0)), false);

    // Visible links prefetch. A click during that request keeps the complete current page.
    holdOpponent = true;
    await page.evaluate(() => {
      const root = document.querySelector('#profileContent');
      root.insertAdjacentHTML('afterbegin', '<button data-test-opponent data-open-current-opponent="fixture-opponent-a" data-opponent-name="Opponent A" data-opponent-event="GS14">Opponent A</button>');
      bindParticipantNavigation(root);
    });
    await page.waitForFunction(() => opponentHistoryRequests.has(opponentHistoryKey('Opponent A', 'GS14', 'fixture-opponent-a').requestKey));
    await page.locator('[data-test-opponent]').click();
    assert.equal(await page.evaluate(() => location.hash), '#player/' + player.id);
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    assert.equal(opponentRequests.get('fixture-opponent-a'), 1, `${group}: click must share the pending prefetch`);
    assert.equal(typeof releaseOpponent, 'function');
    holdOpponent = false; releaseOpponent();
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent A');
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1);
    assert.equal(opponentRequests.get('fixture-opponent-a'), 1, `${group}: ready opponent must not be fetched again on opening`);

    // The opponent's own visible opponent is prepared by the same path.
    await page.waitForFunction(() => opponentHistoryCache.has(opponentHistoryKey('Opponent B', 'GS14', 'fixture-opponent-b').requestKey));
    await page.locator('[data-open-current-opponent="fixture-opponent-b"]').click();
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent B');
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1);
    assert.equal(opponentRequests.get('fixture-opponent-b'), 1);
    assert.equal(await page.evaluate(() => observedEmptyOpponent), false, `${group}: neither opponent page may be rendered empty`);

    opponentPartial = true;
    await page.evaluate(() => fetchOpponentHistory('Opponent B', 'GS14', 'fixture-opponent-b', true));
    assert.equal(await page.evaluate(() => preparedOpponentHistory('Opponent B', 'GS14', 'fixture-opponent-b').tournaments[0].matches.length), 1);
    opponentPartial = false;
    await page.evaluate(async () => {
      for (const [key, data] of opponentHistoryCache) {
        const parts = key.split('|');
        parts[2] = '2000-01-01';
        await saveDurableOpponent(parts[1], parts[3], parts[0], parts.join('|'), data);
      }
      localStorage.removeItem(OPPONENT_HISTORY_CACHE);
      localStorage.removeItem(ACTIVE_OPPONENT_CACHE);
      opponentHistoryCache.clear();
    });
    offline = true; opponentOffline = true;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent B');
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1, `${group}: durable opponent must survive reload, a changed day, and failed API`);
    assert.equal(await page.evaluate(() => observedEmptyOpponent), false);
    await page.evaluate(() => openCurrentOpponent('fixture-opponent-a', 'Opponent A', 'GS14'));
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent A');
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1);

    // With no local match history, wait for the real snapshot instead of claiming zero.
    await page.evaluate(async () => {
      const empty = {...calendarCacheSnapshot(state.data, Date.now() + 2000), matches: [], agenda: []};
      localStorage.setItem(CALENDAR_CACHE, JSON.stringify(empty));
      sessionStorage.setItem(CALENDAR_CACHE, JSON.stringify(empty));
      await writeDurableProjection(empty);
    });
    offline = false; partial = false; empty = false; holdSnapshot = true;
    await page.goto(target);
    await page.reload();
    await page.waitForFunction(() => loadRunning);
    assert.equal(await page.locator('[data-profile-loading]').count(), 0);
    assert.equal(await page.locator('#profileContent [data-stat="all"]').count(), 0, `${group}: no provisional match counter while the snapshot is pending`);
    assert.equal(typeof releaseSnapshot, 'function');
    holdSnapshot = false; releaseSnapshot();
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'full-double'));
    await page.locator('#profileContent [data-stat="all"]').waitFor();
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    assert.equal(await page.evaluate(() => observedProfileCounts.includes(0)), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({group, knownMatches: before.length, firstProfile: 'passed', delayedSnapshot: 'passed', newerPartialCache: 'passed', readyOpponentClick: 'passed', recursiveOpponent: 'passed', durableOpponentReload: 'passed', partialRefresh: 'passed', profileDouble: 'passed', cacheReload: 'passed', emptySnapshot: 'passed', europeOnly: 'passed', requests}));
    await page.close();
  }
} finally {await browser.close();}
