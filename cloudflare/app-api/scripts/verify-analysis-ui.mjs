import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('../../../v3.js', import.meta.url)), 'utf8');
const apiSource = await readFile(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8');
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
assert.ok(hasSource('function renderOpponent(') && hasSource('opponentTeRankingDates'), 'opponent page must expose ranking date');
assert.ok(hasSource('opponentTeRankingCategories') && hasSource('Segui giocatore'), 'opponent header must expose age category and follow action');
assert.ok(hasSource('(ranking del ${esc(displayDate(rankingDate))})'), 'opponent ranking date must be parenthesized');
assert.ok(hasSource('function partnerHtml(') && hasSource('data-opponent-role'), 'partners must use opponent-profile navigation');
assert.ok(hasSource('doublesPartnerLink'), 'doubles partners must remain bold');
assert.ok(hasSource('function loadOpponentHistory(') && hasSource('/opponent-profile?name='), 'opponent page must load frozen history');
assert.ok(hasSource('function opponentTournamentEventLinks(') && hasSource('opponentTournamentDraw'), 'opponent tournaments must link event badges to draws');
assert.ok(hasSource('gender: agendaGenderClass(match)') && hasSource('drawCode ${esc(event.gender)}'), 'opponent event badges must reuse agenda gender colors');
assert.ok(hasSource('matchup = `${partners ? `con ${partners} ` : ""}vs ${opponents') && hasSource('<span class="opponentHistoryOpponent">${matchup}</span>'), 'opponent history rows must render partner plus vs opponent');
assert.ok(hasApiSource("apiPath==='/opponent-profile'"), 'API must expose opponent history');
assert.ok(hasApiSource('excludeMatchId') && hasSource('&excludeMatchId='), 'opponent study page must exclude the CourtWatch match');
assert.ok(hasApiSource('tennisEuropePerspectiveScore') && hasSource('opponentHistoryRoundLabel'), 'opponent study rows must orient scores and show full rounds');
assert.ok(hasApiSource('winnerTeam=people.find') && hasSource('opponentFormCircle'), 'winner score orientation and form circles must be present');
assert.ok(hasSource('Per vedere tutti i tornei segui giocatore') && hasSource('opponentTournamentDateLabel'), 'opponent history must show follow prompt and tournament dates');
assert.ok(hasApiSource('tennis_europe_match_ranking_snapshots WHERE match_id IN') && hasApiSource('snapshotFor(player,row.match_id)'), 'opponent-of-opponent rankings must use frozen match snapshots');
assert.ok(hasApiSource('participantTokens') && hasApiSource("nameKey(row.normalized_name)===playerNameKey") && hasApiSource('lookupClauses'), 'all opponent participants must resolve reordered Tennis Europe names with bounded D1 lookup');
assert.ok(hasApiSource('tournament.drawFormat') && hasApiSource('retirementReason') && hasSource('Rit.') && hasApiSource("?' Rit.':''") && hasApiSource('self?.is_winner!=null') && hasApiSource("match.score||match.result") && hasSource('completeSet = high >= 6') && hasApiSource('completeSet=high>=6'), 'RR payload evidence, valid tennis sets and API-visible retirement labels must be preserved');
assert.ok(hasSource('KAZ: "KZ"') && hasSource('flags/${flagFile}.svg'), 'Kazakhstan nationality must render its flat flag asset');
assert.ok(hasSource('<h3>Tornei</h3>') && hasSource('m.roundName, m.stage, m.phase, m.group'), 'player page heading and extended RR recognition must be present');
assert.ok(hasSource('matchResultText') && hasSource('data-follow-opponent') && hasSource('incompleteCompletedScore'), 'retirement formatting and opponent follow control must be present');
assert.ok(hasSource('nextCalendarMonth') && hasSource('retirementStatus') && hasSource('completedBy'), 'independent next month and extended retirement evidence must be present');
assert.ok(hasSource('if (!matchResultText(m)) return ""') && hasSource('matchResultText(m) ? `<p class="result'), 'all public match views must render score fallback and retirement labels');
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
assert.doesNotMatch(apiSource, /player\.ranking=labels\.join/, 'Tennis Europe ranking must not overwrite FITP ranking');
console.log(JSON.stringify({ analysisUi: 'green', nativePrompt: false, nativeConfirm: false, actions: ['read', 'save', 'update', 'delete'] }));
