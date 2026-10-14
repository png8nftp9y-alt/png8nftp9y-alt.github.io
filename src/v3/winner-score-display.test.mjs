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

test('TE acquired app scores already oriented by the real generator are not reversed again', () => {
  const generator = readFileSync(new URL('../../cloudflare/app-api/scripts/generate-tennis-europe-app-candidates.mjs', import.meta.url), 'utf8');
  const formatter = generator.split('\n').find(line => line.startsWith('const winnerFirstScore='));
  assert.ok(formatter, 'production TE score formatter found');
  const normalize = vm.runInNewContext(formatter + '\nwinnerFirstScore');
  for (const winnerTeamIndex of [0, 1]) {
    const rawScore = winnerTeamIndex === 0 ? '6-1 6-1' : '1-6 1-6';
    const score = normalize(rawScore, winnerTeamIndex);
    for (const teamIndex of [0, 1]) {
      const match = { id: 'te-app:virginia-cereghini|acquired', playerId: 'virginia-cereghini',
        winnerTeamIndex, teamIndex, advances: teamIndex === winnerTeamIndex, score, result: score, round: 'Final' };
      assert.equal(context.matchResultText(match), '6-1 6-1');
      const row = context.matchHistoryRowHtml(match);
      assert.match(row, /6-1 6-1/);
      assert.match(row, new RegExp(`class="result ${match.advances ? 'win' : 'loss'}"`));
    }
  }
});

test('personal history with winner team metadata retains player-perspective reversal', () => {
  const match = { id: 'te-match:acquired', score: '1-6 1-6', advances: false, winnerTeamIndex: 0, teamIndex: 1 };
  assert.equal(context.matchResultText(match), '6-1 6-1');
  assert.equal(context.matchResultText({ ...match, id: 'te-app:legacy', scorePerspective: 'player' }), '6-1 6-1');
  assert.equal(context.matchResultText({ ...match, score: '6-1 6-1', scorePerspective: 'winner' }), '6-1 6-1');
});

test('already normalized app retirement scores remain winner-first even when loser was leading', () => {
  const match = { id: 'te-app:virginia-cereghini|retirement', result: '1-4', advances: false, winnerTeamIndex: 0, retired: true };
  assert.equal(context.matchResultText(match), '1-4 Rit.');
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
