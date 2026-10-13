import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../v3.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(`function ${start}(`), source.indexOf(`function ${end}(`));
const context = vm.createContext({
  readableText: value => String(value || ''),
  esc: value => String(value || ''),
  matchMeta: () => ({ op: 'Opponent' }),
  courtWatchPlayerByName: () => null,
  matchAnalysisButton: () => '',
  displayDate: value => value,
  opponentHtml: () => 'Opponent',
});
vm.runInContext(section('incompleteCompletedScore', 'opponentHistoryRanking') +
  section('fullMatchRoundLabel', 'opponentTournamentDateLabel') +
  section('opponentHistoryResultText', 'opponentHistoryMatchRowHtml') +
  section('agendaResultHtml', 'plainOpponentHtml') +
  section('matchHistoryRowHtml', 'matchHistorySectionsHtml'), context);

test('winner perspective reverses every set only for a known loss', () => {
  const cases = [
    [{ result: '1-6 1-6', advances: false }, '6-1 6-1'],
    [{ result: '6-1 6-1', advances: true }, '6-1 6-1'],
    [{ score: '6-4 3-6 2-6', advances: false }, '4-6 6-3 6-2'],
    [{ score: '6(4)-7 7-6(5) [8-10]', advances: false }, '7-6(4) 6(5)-7 [10-8]'],
    [{ score: '1–6 1–6', advances: false }, '6–1 6–1'],
    [{ result: '1-6 2-3', advances: false, retired: true }, '6-1 3-2 Rit.'],
    [{ result: 'W.O.', advances: false }, 'W.O.'],
    [{ result: '', advances: false }, ''],
    [{ result: '1-6 1-6' }, '1-6 1-6'],
  ];
  for (const [match, expected] of cases) {
    const original = JSON.stringify(match);
    assert.equal(context.matchResultText(match), expected);
    assert.equal(JSON.stringify(match), original);
  }
});

test('opponent scores use the same formatter exactly once', () => {
  assert.equal(context.opponentHistoryResultText({ score: '1-6 1-6', won: false }), '6-1 6-1');
  assert.equal(context.opponentHistoryResultText({ score: '6-1 6-1', won: true }), '6-1 6-1');
});

test('agenda and player/tournament rows retain win/loss colors with winner-first scores', () => {
  for (const advances of [true, false]) {
    const match = { result: advances ? '6-1 6-1' : '1-6 1-6', advances, round: 'Final' };
    for (const html of [context.agendaResultHtml(match, { op: 'Opponent' }), context.matchHistoryRowHtml(match)]) {
      assert.match(html, /6-1 6-1/);
      assert.match(html, new RegExp(`class="result ${advances ? 'win' : 'loss'}"`));
    }
  }
});
