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
    let holdAppScript = false, releaseAppScript;
    let holdGroupSnapshot = false, releaseGroupSnapshot, failGroupSnapshot = false;
    const targetGroup = group === 'main' ? 'others' : 'main';
    const targetPlayer = {id: 'fixture-' + targetGroup, name: 'Destination ' + targetGroup, userAdded: true};
    await page.addInitScript(() => {
      window.setInterval = () => 0;
      window.observedProfileCounts = [];
      window.observedEmptyOpponent = false;
      window.observedHomeDuringRefresh = false;
      window.observedBlankGroupFrame = false;
      window.documentIdentity = Math.random();
      const observeFrames = () => {
        const home = document.querySelector('#homeView');
        if (location.hash && home?.classList.contains('active') && getComputedStyle(home).display !== 'none') window.observedHomeDuringRefresh = true;
        if (typeof state !== 'undefined' && state.data && ![...document.querySelectorAll('main.view.active')].some(view => view.getClientRects().length)) window.observedBlankGroupFrame = true;
        requestAnimationFrame(observeFrames);
      };
      requestAnimationFrame(observeFrames);
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
        return route.fulfill({json: {profile: {name: person, ranking: opponentRequests.get(id) > 1 ? 7 : 12, category: 'GS14'}, tournaments: opponentPartial ? [] : [{...tournament, competitionId: 'opponent-event', historyKind: 'past', matches: [{id: id + '-match', date: '2026-01-03', event: 'GS14', round: 'Final', score: '6-4 6-3', won: true, status: 'completed', opponents: [{name: id === 'fixture-opponent-a' ? 'Opponent B' : 'Opponent C', profileId: id === 'fixture-opponent-a' ? 'fixture-opponent-b' : 'fixture-opponent-c'}]}]}]}});
      }
      if (url.pathname.endsWith('/app-snapshot')) {
        requests++;
        const requestedGroup = route.request().headers()['x-courtwatch-group'] || 'main';
        if (requestedGroup !== group) {
          if (holdGroupSnapshot) await new Promise(resolve => {releaseGroupSnapshot = resolve;});
          if (failGroupSnapshot) return route.fulfill({status: 503, json: {error: 'offline'}});
          return route.fulfill({json: {group: requestedGroup, players: [targetPlayer], tournaments: [{...tournament, playerId: targetPlayer.id}], matches: [{...old, playerId: targetPlayer.id, id: 'destination-match'}]}});
        }
        if (holdSnapshot) await new Promise(resolve => {releaseSnapshot = resolve;});
        if (offline) return route.fulfill({status: 503, json: {error: 'offline'}});
        return route.fulfill({json: {group, generatedAt: '2026-10-13T00:00:00Z', players: empty ? [] : [player], tournaments: empty ? [] : partial ? [{...tournament, entryStatus: 'withdrawn'}] : [tournament], matches: empty ? [] : partial ? [{...recent, score: '', result: ''}] : [old, recent, wrong, full, {...recent, id:"disabled-fitp", circuit:"fitp"}, {...recent, id:"disabled-itf", circuit:"itf"}]}});
      }
      if (url.pathname.endsWith('/session')) return route.fulfill({json: {user: {displayName: 'Fixture', role: 'admin'}}});
      if (assets[name]) {
        if (name === 'v3.js' && holdAppScript) await new Promise(resolve => {releaseAppScript = resolve;});
        return route.fulfill({body: assets[name], contentType: name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'application/javascript'});
      }
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
    await page.waitForFunction(() => document.querySelector('#opponentProfileRanking')?.textContent.includes('7 TE'));
    assert.equal(opponentRequests.get('fixture-opponent-a'), 2, `${group}: opening checks the latest ranking once after prefetch`);

    // The opponent's own visible opponent is prepared by the same path.
    await page.waitForFunction(() => opponentHistoryCache.has(opponentHistoryKey('Opponent B', 'GS14', 'fixture-opponent-b').requestKey));
    await page.locator('[data-open-current-opponent="fixture-opponent-b"]').click();
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent B');
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1);
    await page.waitForFunction(() => document.querySelector('#opponentProfileRanking')?.textContent.includes('7 TE'));
    assert.equal(opponentRequests.get('fixture-opponent-b'), 2, `${group}: recursive opening also refreshes the current ranking once`);
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
    const pendingStat = page.locator('#profileContent [data-stat="all"]');
    if (await pendingStat.count()) assert.equal(await pendingStat.textContent(), '3', `${group}: a refresh preview must retain the last known count`);
    assert.equal(typeof releaseSnapshot, 'function');
    holdSnapshot = false; releaseSnapshot();
    await page.waitForFunction(() => state.data?.matches?.some(m => m.id === 'full-double'));
    await page.locator('#profileContent [data-stat="all"]').waitFor();
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    assert.equal(await page.evaluate(() => observedProfileCounts.includes(0)), false);
    assert.deepEqual(errors, []);

    // Preserve the actual visible profile and scroll before the app script even starts.
    await page.locator('#profileMatchTypeFilter').selectOption('singles');
    await page.evaluate(() => {
      const body = document.querySelector('.profileTournamentMatches');
      body.hidden = false;
      openProfileTournamentKeys.add(body.closest('.profileTournament').dataset.profileTournament);
      const style = document.createElement('style');
      style.id = 'refresh-scroll-fixture'; style.textContent = '.profileTournamentMatches{min-height:1400px}';
      document.head.append(style);
    });
    await page.mouse.wheel(0, 420);
    await page.waitForFunction(() => scrollY >= 400);
    const refreshY = await page.evaluate(() => scrollY);
    assert.ok(refreshY >= 400);
    holdAppScript = true;
    await page.reload({waitUntil: 'commit'});
    await page.waitForFunction(() => Boolean(window.courtWatchRefreshPreview));
    assert.equal(await page.locator('#homeView').isVisible(), false);
    assert.equal(await page.locator('#profileContent .unifiedMatchRow').count(), 3);
    assert.equal(await page.locator('#profileMatchTypeFilter').inputValue(), 'singles');
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - refreshY) <= 2, `${group}: saved scroll must exist before v3.js starts`);
    assert.equal(typeof releaseAppScript, 'function');
    holdAppScript = false; releaseAppScript();
    await page.waitForFunction(() => typeof state !== 'undefined' && Boolean(state.data) && !window.courtWatchRefreshPreview);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - refreshY) <= 2, `${group}: app startup must keep the same scroll`);
    assert.equal(await page.evaluate(() => observedHomeDuringRefresh), false);
    assert.equal(await page.locator('#profileMatchTypeFilter').inputValue(), 'singles');
    assert.deepEqual(errors, []);
    await page.evaluate(() => openCurrentOpponent('fixture-opponent-a', 'Opponent A', 'GS14'));
    await page.waitForFunction(() => document.querySelector('.opponentProfileHero h2')?.textContent === 'Opponent A');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'refresh-opponent-scroll-fixture'; style.textContent = '.opponentHistoryMatches{min-height:1400px}';
      document.head.append(style);
    });
    await page.mouse.wheel(0, 420);
    await page.waitForFunction(() => scrollY >= 400);
    const opponentRefreshY = await page.evaluate(() => scrollY);
    holdAppScript = true;
    await page.reload({waitUntil: 'commit'});
    await page.waitForFunction(() => Boolean(window.courtWatchRefreshPreview));
    assert.equal(await page.locator('#opponentTournamentHistory .unifiedMatchRow').count(), 1);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - opponentRefreshY) <= 2);
    holdAppScript = false; releaseAppScript();
    await page.waitForFunction(() => typeof state !== 'undefined' && Boolean(state.data) && !window.courtWatchRefreshPreview);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - opponentRefreshY) <= 2);
    assert.equal(await page.evaluate(() => observedHomeDuringRefresh), false);
    assert.deepEqual(errors, []);
    // Cross both groups in the same document, including a failed first request.
    offline = false; opponentOffline = false;
    await page.evaluate(() => {location.hash = '#players';});
    await page.locator('#playersView.active').waitFor();
    const documentIdentity = await page.evaluate(() => documentIdentity);
    await page.evaluate(() => {state.selected.clear(); saveUiState();});
    failGroupSnapshot = true;
    await page.evaluate(() => switchPlayerGroup());
    assert.equal(await page.evaluate(() => PLAYER_GROUP), group);
    assert.equal(await page.locator('#playersList .playerRow').count(), 1);
    assert.equal(await page.evaluate(() => documentIdentity), documentIdentity);
    failGroupSnapshot = false; holdGroupSnapshot = true;
    const destinationRequest = page.waitForRequest(request => request.url().includes('/app-snapshot') && request.headers()['x-courtwatch-group'] === targetGroup);
    await page.locator('#playersView [data-switch-player-group]').click();
    await destinationRequest;
    assert.equal(await page.evaluate(() => PLAYER_GROUP), group);
    assert.equal(await page.locator('#playersList .playerRow').count(), 1);
    assert.equal(typeof releaseGroupSnapshot, 'function');
    holdGroupSnapshot = false; releaseGroupSnapshot();
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, targetGroup);
    assert.deepEqual(await page.evaluate(() => state.data.players.map(player => player.id)), [targetPlayer.id]);
    assert.deepEqual(await page.evaluate(() => [...state.selected]), [targetPlayer.id]);
    assert.equal(await page.evaluate(() => documentIdentity), documentIdentity);
    await page.locator('#playersView [data-switch-player-group]').click();
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, group);
    assert.deepEqual(await page.evaluate(() => state.data.players.map(player => player.id)), [player.id]);
    assert.equal(await page.evaluate(() => state.selected.size), 0, `${group}: deselect-all must remain scoped to the original list`);
    await page.evaluate(() => history.back());
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, targetGroup);
    assert.deepEqual(await page.evaluate(() => state.data.players.map(player => player.id)), [targetPlayer.id]);
    await page.evaluate(() => history.forward());
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, group);
    assert.equal(await page.evaluate(() => state.selected.size), 0);
    assert.equal(await page.evaluate(() => documentIdentity), documentIdentity);
    assert.equal(await page.evaluate(() => observedBlankGroupFrame), false);
    assert.deepEqual(errors, []);
    await page.evaluate(id => openProfile(id), player.id);
    await page.locator('#profileContent [data-stat="all"]').waitFor();
    await page.evaluate(({targetGroup, targetId}) => {
      const target = new URL(location.href);
      if (targetGroup === 'others') target.searchParams.set('group', 'others'); else target.searchParams.delete('group');
      target.hash = '#player/' + targetId;
      history.pushState(null, '', target);
      dispatchEvent(new PopStateEvent('popstate'));
      dispatchEvent(new HashChangeEvent('hashchange'));
    }, {targetGroup, targetId: targetPlayer.id});
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, targetGroup);
    assert.equal(await page.evaluate(() => location.hash), '#player/' + targetPlayer.id);
    assert.equal(await page.locator('#profileContent .profileHero h2').textContent(), targetPlayer.name);
    await page.evaluate(() => history.back());
    await page.waitForFunction(expected => PLAYER_GROUP === expected && !groupSwitchRunning, group);
    await page.waitForFunction(id => location.hash === '#player/' + id, player.id);
    assert.equal(await page.locator('#profileContent .profileHero h2').textContent(), player.name);
    assert.equal(await page.evaluate(() => observedBlankGroupFrame), false);
    // A new member is clickable from Home even before any match is available.
    await page.evaluate(() => {
      state.data.players.push({id: 'new-home-member', name: 'New Home Member', userAdded: true});
      state.initialMatchProjectionPending = true;
      confirmedCourtWatchPlayers.clear();
      initialProjectionRequest = new Promise(() => {});
      location.hash = '#players';
    });
    await page.locator('#playersView.active [data-profile="new-home-member"]').click();
    await page.waitForFunction(() => location.hash === '#player/new-home-member' && document.querySelector('#profileContent .profileHero h2')?.textContent === 'New Home Member');
    assert.equal(await page.locator('#profileContent .profileHero h2').textContent(), 'New Home Member');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({group, knownMatches: before.length, seamlessGroupSwitch: 'passed', scopedSelections: 'passed', groupHistory: 'passed', refreshPosition: 'passed', noHomeFlash: 'passed', firstProfile: 'passed', delayedSnapshot: 'passed', newerPartialCache: 'passed', readyOpponentClick: 'passed', recursiveOpponent: 'passed', durableOpponentReload: 'passed', partialRefresh: 'passed', profileDouble: 'passed', cacheReload: 'passed', emptySnapshot: 'passed', europeOnly: 'passed', requests}));
    await page.close();
  }
} finally {await browser.close();}
