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
assert.ok(hasSource('${nationalityHtml(playerNationality)}${playerRanking?'), 'tournament page must place ranking after nationality');
assert.ok(hasSource('${nationalityHtml(knownNationality(name,nationalities[index]))}${teRankHtml(rankings[index])}'), 'participant rankings must follow nationality');
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
assert.ok(hasSource('<span class="opponentHistoryOpponent">vs ${opponents'), 'opponent history rows must prefix the opponent with vs');
assert.ok(hasApiSource("apiPath==='/opponent-profile'"), 'API must expose opponent history');
assert.ok(hasApiSource('excludeMatchId') && hasSource('&excludeMatchId='), 'opponent study page must exclude the CourtWatch match');
assert.ok(hasSource('https://te.tournamentsoftware.com/tournament/'), 'opponent tournament name must link to its official homepage');
assert.ok(hasSource('bindParticipantNavigation($("profileContent"))'), 'profile and tournament pages must bind participant links');
assert.ok(hasSource('function dedupeAgendaMatches(') && hasSource('sameAgendaMatch(existing, match)'), 'agenda must deduplicate shared CourtWatch matches');
assert.ok(hasSource('function agendaResultHtml(') && hasSource('Vincitore:'), 'shared CourtWatch match must name the winner');
assert.ok(hasSource('courtWatchOpponent') && hasSource('opponentPlayerLink'), 'opponent styling must distinguish CourtWatch players');
assert.ok(hasApiSource("profileKey=prefix+'ProfileIds'") && hasApiSource("dateKey=prefix+'RankingDates'"), 'API must expose opponent ranking identity and date');
assert.doesNotMatch(apiSource, /player\.ranking=labels\.join/, 'Tennis Europe ranking must not overwrite FITP ranking');
console.log(JSON.stringify({ analysisUi: 'green', nativePrompt: false, nativeConfirm: false, actions: ['read', 'save', 'update', 'delete'] }));
