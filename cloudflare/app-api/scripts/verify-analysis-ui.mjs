import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('../../../v3.js', import.meta.url)), 'utf8');
const apiSource = await readFile(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8');
const html = await readFile(fileURLToPath(new URL('../../../v3.html', import.meta.url)), 'utf8');
const canonical = value => String(value).replace(/\s+/g, '').replace(/"/g, "'");
const hasSource = marker => canonical(source).includes(canonical(marker));
const hasApiSource = marker => canonical(apiSource).includes(canonical(marker));

assert.doesNotMatch(source, /\bprompt\s*\(/, 'v3.js must not use native prompt dialogs');
assert.doesNotMatch(source, /\bconfirm\s*\(/, 'v3.js must not use native confirm dialogs');
for (const marker of [
  'function analysisEditor()',
  'function editMatchAnalysis(',
  'Analisi della partita',
  "loadingText.value='Caricamento…'",
  'aria-label="Testo analisi"',
  '>Salva<',
  '>Elimina<',
  "method:'PUT'",
  "method:'DELETE'",
  "location.origin+'/app/api'"
]) {
  assert.ok(hasSource(marker), `missing analysis UI marker: ${marker}`);
}
assert.ok(hasSource('playerRankingSummary(p)'), 'player profile must render both FITP and Tennis Europe rankings');
assert.doesNotMatch(source, /profileTitle\.append\(profileRankings\)/, 'player rankings must remain in the muted detail row');
assert.ok(hasSource("source==='tennis-europe'?tournamentTeRanking:source==='fitp'?playerRecord?.ranking:''"), 'tournament page must use the ranking appropriate to that tournament');
assert.ok(hasSource('${participantDesignationHtml(participantDesignation(rows.find(row=>participantDesignation(row,"player")),"player"))}${nationalityHtml(playerNationality)}${playerRanking?'), 'tournament page must place designation before nationality and ranking after nationality');
assert.ok(hasSource('${esc(person.name)}${participantDesignationHtml(designation||person.designation)}${nationalityHtml(nationality)}${teRankHtml(ranking)}'), 'participant labels must place designation before nationality and ranking after nationality');
assert.ok(hasSource('function tournamentSurfaceLabel(') && hasSource('[place,courtConditions].filter(Boolean).join'), 'agenda and player tournament headers must expose court conditions');
assert.ok(hasSource('m.opponentDesignations||m.opponentEntryTypes||m.opponentSeeds') && hasSource('participantDesignation(m,"player")'), 'all match views must normalize seed, WC and Q aliases');
assert.ok(hasSource('const projection=await projectionPromise'), 'the UI must wait for the authoritative projection instead of flickering to a partial fallback');
assert.ok(hasSource('retained=projected?.tennisEuropeRankings||projected?.tennisEuropeRanking?projected:previousPlayers.get(player.id)'), 'last known Tennis Europe rankings must survive a temporary projection gap');
assert.ok(hasSource('retainedCurrentMatches=previousMatches.filter'), 'current matches must survive a temporary projection gap');
assert.ok(hasSource('tennisEuropeRanking:retained.tennisEuropeRanking||retained.ranking'), 'JSON merge must preserve the FITP ranking');
assert.ok(hasApiSource('player.tennisEuropeRanking=labels.join'), 'API must expose Tennis Europe ranking separately');
assert.ok(hasApiSource("apiPath==='/player-ranking'") && hasApiSource('currentTennisEuropePlayerRanking') && hasSource('loadCurrentPlayerRanking(p)'), 'player page must read the current Tennis Europe ranking directly from D1');
assert.ok(hasSource('PLAYER_RANKING_CACHE') && hasSource('playerRankingCache.set(key,data)') && !hasSource('(ranking del ${displayDate(row.ranking_date)})'), 'player ranking must render immediately from its last live value without a parenthesized date');
assert.ok(hasApiSource("apiPath==='/player-search'") && hasApiSource('searchPlayers(env,query)') && hasSource('renderPlayerSearchPage(') && hasSource('playerSearchSuggestions'), 'players environment must provide global D1 search with suggestions and a results page');
assert.ok(hasApiSource('player.tennisEuropeRankingDates') && hasApiSource("if(player.tennisEuropeRankingDates[key]&&player.tennisEuropeRankingDates[key]>date)return"), 'API must retain the newest Tennis Europe ranking by date');
assert.ok(hasApiSource('tennisEuropeNameKey') && hasApiSource('h.normalized_name LIKE ?') && hasApiSource('playersByName.get(tennisEuropeNameKey(row.normalized_name))'), 'current player rankings must resolve reversed Tennis Europe names');
assert.ok(hasSource('function renderOpponentProfile(') && hasSource('profile.ranking_date'), 'opponent page must expose the current ranking date');
assert.ok(hasSource('profile.category') && hasSource('Segui giocatore'), 'opponent header must expose current age category and follow action');
assert.ok(hasSource('(ranking del ${displayDate(profile.ranking_date)})'), 'opponent ranking date must be parenthesized');
assert.ok(hasSource('function partnerHtml(') && hasSource('data-open-current-opponent'), 'partners must use current opponent-profile navigation');
assert.ok(hasSource('doublesPartnerLink'), 'doubles partners must remain bold');
assert.ok(hasSource('function loadOpponentHistory(') && hasSource('/opponent-profile?name='), 'opponent page must load current history with frozen match rankings');
assert.ok(hasSource('function opponentTournamentEventLinks(') && hasSource('opponentTournamentDraw'), 'opponent tournaments must link event badges to draws');
assert.ok(hasSource('gender: agendaGenderClass(match)') && hasSource('drawCode ${esc(event.gender)}'), 'opponent event badges must reuse agenda gender colors');
assert.ok(hasSource('matchup = `${partners ? `con ${partners} ` : ""}vs ${opponents') && hasSource('<span class="opponentHistoryOpponent unifiedMatchOpponent">${matchup}</span>'), 'opponent history rows must render partner plus vs opponent');
assert.ok(hasApiSource("apiPath==='/opponent-profile'"), 'API must expose opponent history');
assert.ok(hasSource('const asOf = iso(new Date())') && !hasSource('&excludeMatchId='), 'opponent profile must always load through today without excluding the clicked match');
assert.ok(hasApiSource('tennisEuropePerspectiveScore') && hasSource('opponentHistoryRoundLabel'), 'opponent study rows must orient scores and show full rounds');
assert.ok(hasApiSource('winnerTeam=people.find') && !source.includes('Aggiornato al'), 'winner score orientation must remain and opponent profile must not show an updated-at label');
assert.ok(hasSource('Per vedere tutti i tornei segui giocatore') && hasSource('opponentTournamentDateLabel'), 'opponent history must show follow prompt and tournament dates');
assert.ok(hasApiSource('tennis_europe_match_ranking_snapshots WHERE match_id IN') && hasApiSource('snapshotFor(player,row.match_id)'), 'opponent-of-opponent rankings must use frozen match snapshots');
assert.ok(hasSource('opponentHistoryPersonLink') && hasSource('openCurrentOpponent(') && hasSource('#opponent-profile'), 'every non-CourtWatch participant must support recursive profile navigation');
assert.ok(hasSource('preloadOpponentHistory(') && hasSource('opponentHistoryRequests = new Map()') && hasSource('pointerenter') && !hasSource('requestIdleCallback'), 'clickable opponent profiles must use targeted prefetch and share in-flight requests without a request storm');
assert.ok(hasSource('opponentPrefetchActive<2') && hasSource('OPPONENT_HISTORY_CACHE') && hasSource('queueOpponentPreload('), 'opponent pages must be warmed through a bounded queue and session cache');
assert.ok(hasSource('else if(currentOpponent)') && hasSource('data-retry-opponent') && hasSource('controller.abort(),15000') && hasSource('wire();wireAccount();route();load();'), 'opponent routes must survive manual refresh and failed history loads must be bounded and retryable');
assert.ok(hasSource("if (!/^#opponent(?:-profile)?\\//.test(location.hash)) load()") && hasSource("if (/^#opponent(?:-profile)?\\//.test(location.hash))"), 'opponent profiles must not rerender during the periodic refresh');
assert.ok(hasApiSource('participantTokens') && hasApiSource("nameKey(row.normalized_name)===playerNameKey") && hasApiSource('lookupClauses'), 'all opponent participants must resolve reordered Tennis Europe names with bounded D1 lookup');
assert.ok(hasApiSource('tournament.drawFormat') && hasApiSource('retirementReason') && hasSource('Rit.') && hasApiSource("?' Rit.':''") && hasApiSource('self?.is_winner!=null') && hasApiSource("match.score||match.result") && hasSource('completeSet = high >= 6') && hasApiSource('completeSet=high>=6'), 'RR payload evidence, valid tennis sets and API-visible retirement labels must be preserved');
assert.ok(hasSource('KAZ: "KZ"') && hasSource('flags/${flagFile}.svg'), 'Kazakhstan nationality must render its flat flag asset');
assert.ok(hasSource('<h3>Tornei</h3>') && hasSource('m.roundName, m.stage, m.phase, m.group'), 'player page heading and extended RR recognition must be present');
assert.ok(hasSource('matchResultText') && hasSource('data-follow-opponent') && hasSource('incompleteCompletedScore'), 'retirement formatting and opponent follow control must be present');
assert.ok(hasSource('nextCalendarMonth') && hasSource('retirementStatus') && hasSource('completedBy'), 'independent next month and extended retirement evidence must be present');
assert.ok(hasSource('if (!matchResultText(m)) return ""') && (hasSource('matchResultText(m) ? `<p class="result') || hasSource('result = matchResultText(m)')), 'all public match views must render score fallback and retirement labels');
assert.ok(hasSource('/^round\\s*\\d+$/i.test(round)'), 'numbered round-robin rounds must render as RR in opponent history');
assert.ok(hasApiSource('partners=people.filter') && hasSource('partners ? `con ${partners} `'), 'doubles partner must appear before vs');
assert.ok(hasApiSource("const targets=[...new Set(matches.flatMap"), 'match snapshot must backfill participant rankings by date');
assert.ok(hasSource('https://te.tournamentsoftware.com/tournament/'), 'opponent tournament name must link to its official homepage');
assert.ok(hasSource('bindParticipantNavigation($("profileContent"))'), 'profile and tournament pages must bind participant links');
assert.ok(hasSource('opponentHistoryCourtWatch') && hasSource('bindParticipantNavigation(body)'), 'CourtWatch players in opponent history must open their full profile');
assert.ok(hasSource('function dedupeAgendaMatches(') && hasSource('sameAgendaMatch(existing, match)'), 'agenda must deduplicate shared CourtWatch matches');
assert.ok(hasSource('function agendaResultHtml(') && hasSource('Vincitore:'), 'shared CourtWatch match must name the winner');
assert.ok(hasSource('courtWatchOpponent') && hasSource('opponentPlayerLink'), 'opponent styling must distinguish CourtWatch players');
assert.ok(hasApiSource("profileKey=prefix+'ProfileIds'") && hasApiSource("dateKey=prefix+'RankingDates'"), 'API must expose opponent ranking identity and date');
assert.ok(hasApiSource('profileRows=await optionalRows') && hasApiSource('profile,tournaments:') && hasSource('profileRanking.textContent'), 'opponent header must fall back to dated ranking history');
assert.ok(hasApiSource('surface:tournament.surface') && hasApiSource('environment:tournament.environment') && hasSource('tournamentSurfaceLabel(tournament)'), 'opponent tournaments must expose their own surface and environment');
assert.ok(hasApiSource('tennisEuropeTournamentMetadata()') && hasApiSource('officialTournament.surface') && hasApiSource('officialTournament.indoorOutdoor'), 'opponent tournaments must recover official conditions outside the CourtWatch projection');
assert.ok(hasSource('[data-home-route]') && hasSource('primaryView = location.hash.match') && hasSource('${primaryView}View'), 'home must route to dedicated players, calendar and agenda pages');
assert.ok(hasSource('quickSectionNav') && hasSource('renderWeeklyAgenda()') && hasSource('agendaGoToday'), 'internal views must expose quick navigation, weekly tournaments and today return');
assert.ok(hasSource('function matchHistoryRowHtml(') && hasSource('opponentHistoryMatch unifiedMatchRow matchWithAnalysis') && hasSource('matchHistorySectionsHtml(matches)'), 'player and tournament matches must share the opponent-history row structure');
assert.ok(hasSource('function groupedMatchSections(') && hasSource('matchTypeHeading') && hasSource('opponentHistoryMatchSectionsHtml'), 'player, tournament and opponent pages must group singles and doubles');
assert.ok(hasSource('function fullMatchRoundLabel(') && hasSource('Qualification round ${Math.max') && hasSource('matchRoundFull'), 'all match pages must use full round labels and ordinal qualification rounds');
assert.ok(hasSource('/bonus\\s*draw/i.test(source)') && hasSource('Bonus ${value}'), 'bonus draws must prefix the complete round label');
assert.ok(!hasSource('<span class="matchType">${matchType}</span>'), 'grouped match rows must not repeat the match type');
assert.ok(html.includes('id="homeOthers" class="playersHeaderAction"') && (html.match(/class="playersHeaderAction"[^>]*>Altri<\/button>/g) || []).length >= 2, 'inactive Altri labels must match the players environment');
assert.ok(hasSource('Acceptance list: '), 'scheduled Tennis Europe tournaments must label the acceptance list');
assert.ok(hasSource('querySelectorAll(".unifiedMatchRow")') && hasSource('class="result ${outcome}"') && hasSource('$("brandHome").onclick'), 'tournament counters must read unified rows and the brand must return home');
assert.ok(!hasSource('$("resetHome")') && hasSource('String(a.startDate || "").localeCompare'), 'home label must be absent and weekly tournaments must be ordered');
assert.doesNotMatch(apiSource, /player\.ranking=labels\.join/, 'Tennis Europe ranking must not overwrite FITP ranking');
console.log(JSON.stringify({ analysisUi: 'green', nativePrompt: false, nativeConfirm: false, actions: ['read', 'save', 'update', 'delete'] }));
