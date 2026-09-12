import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('../../../v3.js', import.meta.url)), 'utf8');
const apiSource = await readFile(fileURLToPath(new URL('../src/index.js', import.meta.url)), 'utf8');

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
  assert.ok(source.includes(marker), `missing analysis UI marker: ${marker}`);
}
assert.ok(source.includes('playerRankingSummary(p)'), 'player profile must render both FITP and Tennis Europe rankings');
assert.ok(source.includes("profileTitle.append(profileRankings)"), 'player profile must place all rankings beside nationality');
assert.ok(source.includes("source==='tennis-europe'?tournamentTeRanking:source==='fitp'?playerRecord?.ranking:''"), 'tournament page must use the ranking appropriate to that tournament');
assert.ok(source.includes('${nationalityHtml(playerNationality)}${playerRanking?'), 'tournament page must place ranking after nationality');
assert.ok(source.includes('${nationalityHtml(knownNationality(name,nationalities[index]))}${teRankHtml(rankings[index])}'), 'participant rankings must follow nationality');
assert.ok(source.includes('tennisEuropeRanking:projected.tennisEuropeRanking||projected.ranking'), 'JSON merge must preserve the FITP ranking');
assert.ok(apiSource.includes('player.tennisEuropeRanking=labels.join'), 'API must expose Tennis Europe ranking separately');
assert.doesNotMatch(apiSource, /player\.ranking=labels\.join/, 'Tennis Europe ranking must not overwrite FITP ranking');
console.log(JSON.stringify({ analysisUi: 'green', nativePrompt: false, nativeConfirm: false, actions: ['read', 'save', 'update', 'delete'] }));
