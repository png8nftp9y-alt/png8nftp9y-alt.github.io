import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../../v3.js', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('async function load()'), source.indexOf('document.addEventListener("click", (event) => {', source.indexOf('async function load()')));
const label = source.slice(source.indexOf('function syncLabel('), source.indexOf('function unavailableLabel('));
function setup(group, projection, {cached = null, staticData = {}, staticOffline = false} = {}) {
  let saved, requests = 0, unavailable = 0;
  const nodes = {syncStatus: {hidden: false, textContent: 'Old warning'}, dataAlert: {hidden: false, textContent: 'Old alert'}};
  const ctx = {
    PLAYER_GROUP: group, state: {data: null, selected: new Set(), playerSelectionEpoch: 0},
    loadRunning: false, uiSelectionRestored: false,
    removedCourtWatchPlayers: new Set(), confirmedCourtWatchPlayers: new Map(), FORMER_PLAYERS: new Set(),
    console: {warn() {}, error() {}}, Date, Map, Set, Promise,
    apiProjection: async () => {requests++; if (projection instanceof Error) throw projection; return projection;},
    v3json: async name => {if (staticOffline) throw Error('JSON offline'); return staticData[name] || {};},
    cachedData: () => cached, saveCachedData: data => {saved = data;},
    cachedPersonalTournaments: (previous, players) => previous.tournaments?.filter(t => players.some(p => p.id === t.playerId && p.userAdded)) || [],
    agendaKey: m => `${m.playerId}|${m.id}`, mergeAgenda: (agenda, matches) => [...agenda, ...matches],
    iso: date => date.toISOString().slice(0, 10), add: (date, days) => new Date(+date + days * 86400000),
    renderIfDataChanged() {}, restoreUiScroll() {}, unavailableLabel: () => unavailable++,
    $: id => nodes[id] || {},
  };
  vm.createContext(ctx); vm.runInContext(label + loader, ctx);
  return {ctx, nodes, saved: () => saved, requests: () => requests, unavailable: () => unavailable};
}
const player = {id: 'a', name: 'Europe Player', userAdded: true};
const matches = ['tennis-europe', 'fitp', 'itf'].map((circuit, i) => ({id: `m${i}`, playerId: 'a', circuit, date: '2026-10-01'}));
for (const group of ['main', 'others']) {
  test(`${group}: identical loader keeps every circuit and works without static files`, async () => {
    const c = setup(group, {group, players: [player], tournaments: [{playerId: 'a'}], matches}, {staticOffline: true});
    await c.ctx.load();
    assert.deepEqual(Array.from(c.ctx.state.data.matches, m => m.circuit), ['tennis-europe', 'fitp', 'itf']);
    assert.equal(c.ctx.state.data.agenda.length, 3);
    assert.equal(c.ctx.state.data.tournaments.length, 1);
    assert.equal(c.saved().group, group);
    assert.equal(c.ctx.loadRunning, false);
    assert.equal(c.requests(), 1);
    assert.equal(c.nodes.syncStatus.hidden, true);
  });
  test(`${group}: failed update preserves cached Europe matches without a warning`, async () => {
    const cached = {group, players: [player], tournaments: [{playerId: 'a'}], matches, agenda: matches, personalProjectionComplete: true};
    const c = setup(group, Error('API unavailable'), {cached, staticOffline: true});
    await c.ctx.load();
    assert.equal(c.ctx.state.data.matches.length, 3);
    assert.equal(c.ctx.state.data.tournaments.length, 1);
    assert.equal(c.ctx.state.data.personalProjectionComplete, true);
    assert.equal(c.nodes.syncStatus.hidden, true);
    assert.equal(c.nodes.syncStatus.textContent, '');
    assert.equal(c.nodes.dataAlert.hidden, true);
    assert.equal(c.unavailable(), 0);
  });
}
test('Others never adopts TCL membership or foreign data from static files', async () => {
  const c = setup('others', {group: 'others', players: [player], tournaments: [{playerId: 'a'}, {playerId: 'foreign'}], matches: [...matches, {id: 'foreign', playerId: 'foreign'}]}, {
    staticData: {'players.json': {players: [{id: 'tcl', name: 'TCL'}]}, 'tournaments.json': {tournaments: [{playerId: 'tcl'}]}, 'matches.json': {matches: [{playerId: 'tcl'}]}}
  });
  await c.ctx.load();
  assert.deepEqual(Array.from(c.ctx.state.data.players, p => p.id), ['a']);
  assert.equal(c.ctx.state.data.tournaments.length, 1);
  assert.equal(c.ctx.state.data.matches.length, 3);
});
test('Others can recover Europe matches from static files for its known members', async () => {
  const cached = {group: 'others', personalProjectionComplete: true, players: [player], tournaments: [], matches: []};
  const c = setup('others', Error('API unavailable'), {cached, staticData: {
    'players.json': {players: [{id: 'tcl'}]}, 'tournaments.json': {tournaments: [{playerId: 'a'}, {playerId: 'tcl'}]},
    'matches.json': {matches: [matches[0], {id: 'foreign', playerId: 'tcl'}]}
  }});
  await c.ctx.load();
  assert.deepEqual(Array.from(c.ctx.state.data.players, p => p.id), ['a']);
  assert.equal(c.ctx.state.data.matches[0].id, 'm0');
  assert.equal(c.ctx.state.data.matches.length, 1);
});
test('empty Others membership is valid and never imports the main list', async () => {
  const c = setup('others', {group: 'others', players: [], tournaments: [], matches: []}, {staticData: {'players.json': {players: [{id: 'tcl'}]}}});
  await c.ctx.load();
  assert.equal(c.ctx.state.data.players.length, 0);
});
test('wrong-group response cannot replace Others cache or expose TCL players', async () => {
  const cached = {group: 'others', personalProjectionComplete: true, players: [player], tournaments: [], matches};
  const c = setup('others', {group: 'main', players: [{id: 'tcl'}], tournaments: [], matches: []}, {cached});
  await c.ctx.load();
  assert.deepEqual(Array.from(c.ctx.state.data.players, p => p.id), ['a']);
  assert.equal(c.ctx.state.data.matches.length, 3);
  assert.equal(c.saved(), undefined);
  assert.equal(c.nodes.syncStatus.hidden, true);
});
test('removed members and their matches are excluded in both groups', async () => {
  for (const group of ['main', 'others']) {
    const c = setup(group, {group, players: [player, {id: 'gone'}], tournaments: [{playerId: 'gone'}, {playerId: 'a'}], matches: [...matches, {id: 'gone', playerId: 'gone'}]});
    c.ctx.removedCourtWatchPlayers.add('gone'); await c.ctx.load();
    assert.equal(c.ctx.state.data.players.length, 1);
    assert.equal(c.ctx.state.data.tournaments.length, 1);
    assert.equal(c.ctx.state.data.matches.length, 3);
  }
});
test('old or missing generation does not show misleading delay warnings', () => {
  const c = setup('others', null);
  c.ctx.syncLabel({generatedAt: '2000-01-01T00:00:00Z'});
  assert.equal(c.nodes.syncStatus.hidden, true);
  assert.equal(c.nodes.syncStatus.textContent, '');
  assert.equal(c.nodes.dataAlert.hidden, true);
});
