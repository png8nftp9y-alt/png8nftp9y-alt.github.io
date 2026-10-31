import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../../v3.js', import.meta.url), 'utf8');
const mergeSource = source.slice(source.indexOf('function mergeKnownMatches('), source.indexOf('function clearDemographicFilters('));
const agendaSource = source.slice(source.indexOf('function mergeAgenda('), source.indexOf('function mergeKnownMatches('));
const loader = source.slice(source.indexOf('async function load('), source.indexOf('document.addEventListener("click", (event) => {', source.indexOf('async function load(')));
const label = source.slice(source.indexOf('function syncLabel('), source.indexOf('function unavailableLabel('));
function setup(group, projection, {cached = null, staticData = {}, staticOffline = false} = {}) {
  let saved, requests = 0, unavailable = 0;
  const nodes = {syncStatus: {hidden: false, textContent: 'Old warning'}, dataAlert: {hidden: false, textContent: 'Old alert'}};
  const ctx = {
    PLAYER_GROUP: group, state: {data: null, selected: new Set(), playerSelectionEpoch: 0},
    loadRunning: false, uiSelectionRestored: false,
    removedCourtWatchPlayers: new Set(), confirmedCourtWatchPlayers: new Map(), FORMER_PLAYERS: new Set(),
    console: {warn() {}, error() {}}, Date, Map, Set, Promise, circuit: m => m.circuit || "fitp", normalizeMatchProjection: data => ({...data, matches: data.matches.filter(m => m.circuit === "tennis-europe"), results: (data.results || []).filter(m => m.circuit === "tennis-europe")}),
    apiProjection: async () => {requests++; if (projection instanceof Error) throw projection; return projection;},
    v3json: async name => {if (staticOffline) throw Error('JSON offline'); return staticData[name] || {};},
    cachedData: () => cached, saveCachedData: data => {saved = data;},
    cachedPersonalTournaments: (previous, players) => previous.tournaments?.filter(t => players.some(p => p.id === t.playerId && p.userAdded)) || [],
    agendaKey: m => `${m.playerId}|${m.id}`, mergeAgenda: (agenda, matches) => [...agenda, ...matches],
    iso: date => date.toISOString().slice(0, 10), add: (date, days) => new Date(+date + days * 86400000),
    renderIfDataChanged() {}, restoreUiScroll() {}, unavailableLabel: () => unavailable++,
    $: id => nodes[id] || {},
  };
  ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx); vm.runInContext(agendaSource + mergeSource + label + loader, ctx);
  return {ctx, nodes, saved: () => saved, requests: () => requests, unavailable: () => unavailable};
}
const player = {id: 'a', name: 'Europe Player', userAdded: true};
const matches = ['tennis-europe', 'tennis-europe', 'tennis-europe'].map((circuit, i) => ({id: `m${i}`, playerId: 'a', circuit, date: '2026-10-01'}));
for (const group of ['main','others']) test(`${group}: actual load paints lightweight results while full API is still pending`,async()=>{
  const id='te|event|date|single', scheduled={...matches[0],id,matchId:id,playerName:'Europe Player',teamIndex:0,status:'scheduled',date:new Date().toISOString().slice(0,10)};
  const cached={group,personalProjectionComplete:true,players:[player],tournaments:[],matches:[scheduled],agenda:[scheduled]};
  const projection={group,membershipIds:[player.id],players:[player],tournaments:[],matches:[scheduled]};
  const c=setup(group,projection,{cached});
  let releaseSnapshot,releaseResults;
  c.ctx.state.data=cached;c.ctx.location={hash:'#agenda'};
  Object.assign(c.ctx,{AbortController,setTimeout,clearTimeout,PRIVATE_API:'/app/api',privateApiOptions:x=>x,
    fetch:()=>new Promise(resolve=>releaseResults=resolve),
    apiProjection:()=>new Promise(resolve=>releaseSnapshot=resolve)});
  vm.runInContext(source.slice(source.indexOf('const knownResultUpdates ='),source.indexOf('async function load(')),c.ctx);
  const paints=[];c.ctx.renderIfDataChanged=()=>paints.push(c.ctx.state.data.agenda[0]?.score);
  const loading=c.ctx.load();
  releaseResults({ok:true,json:async()=>({group,matches:[{matchId:id,status:'completed',score:'6-0 6-3',winnerTeamIndex:0,participants:[]}]})});
  await c.ctx.refreshKnownMatchResults();
  assert.ok(paints.includes('6-0 6-3'));assert.equal(c.ctx.loadRunning,true);
  releaseSnapshot(projection);await loading;
  assert.equal(c.ctx.state.data.matches[0].score,'6-0 6-3');assert.equal(c.ctx.state.data.agenda[0].advances,true);
});
for (const group of ['main', 'others']) {
  test(`${group}: a fresh win renders before secondary JSON and durable cache complete`, async () => {
    const scheduled = {...matches[0], status: 'scheduled', date: '2026-10-14'};
    const completed = {...scheduled, status: 'completed', score: '6-0 6-3', result: '6-0 6-3', advances: true};
    const cached = {group, personalProjectionComplete: true, players: [player], tournaments: [{playerId: player.id}], matches: [scheduled], agenda: [scheduled]};
    const c = setup(group, {group, membershipIds: [player.id], players: [player], tournaments: [{playerId: player.id}], matches: [completed]}, {cached});
    let releaseFiles, releaseCache;
    const files = new Promise(resolve => {releaseFiles = resolve;});
    const cache = new Promise(resolve => {releaseCache = resolve;});
    let filesReady = false, cacheReady = false;
    const renders = [];
    c.ctx.v3json = async () => {await files; return {};};
    c.ctx.saveCachedData = () => cache;
    c.ctx.location = {hash: '#agenda'};
    c.ctx.state.data = cached; // Startup has already restored the visible copy.
    c.ctx.scrollY = 840;
    c.ctx.scrollTo = ({top}) => {c.ctx.scrollY = top;};
    c.ctx.renderIfDataChanged = () => {
      renders.push({score: c.ctx.state.data.agenda[0]?.score, filesReady, cacheReady});
      c.ctx.scrollY = 0; // Simulate layout clamping during a DOM replacement.
    };
    c.ctx.state.selected = new Set([player.id]);
    c.ctx.state.sexFilter = 'F';
    c.ctx.state.agendaDate = new Date('2026-10-14T12:00:00Z');
    const loading = c.ctx.load();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(renders.some(r => r.score === '6-0 6-3' && !r.filesReady && !r.cacheReady));
    assert.equal(c.ctx.state.data.matches.length, 1);
    assert.equal(c.requests(), 1);
    assert.deepEqual(Array.from(c.ctx.state.selected), [player.id]);
    assert.equal(c.ctx.state.sexFilter, 'F');
    assert.equal(c.ctx.state.agendaDate.toISOString(), '2026-10-14T12:00:00.000Z');
    assert.equal(c.ctx.scrollY, 840);
    assert.equal(c.ctx.location.hash, '#agenda');
    filesReady = true; releaseFiles();
    await loading; // A still-pending durable write must not keep the loader busy.
    assert.equal(c.ctx.loadRunning, false);
    assert.equal(cacheReady, false);
    assert.equal(c.ctx.state.data.agenda[0].score, '6-0 6-3');
    assert.equal(c.ctx.state.data.agenda.length, 1);
    assert.equal(c.ctx.scrollY, 840);
    cacheReady = true; releaseCache();
  });
}

test('a cancelled group request cannot publish its early API result', async () => {
  const cached = {group: 'main', personalProjectionComplete: true, players: [player], tournaments: [], matches};
  const c = setup('main', null, {cached});
  let release;
  c.ctx.apiProjection = () => new Promise(resolve => {release = resolve;});
  const loading = c.ctx.load();
  c.ctx.state.playerSelectionEpoch = 1;
  release({group: 'main', players: [{id: 'foreign'}], tournaments: [], matches: []});
  await loading;
  assert.deepEqual(Array.from(c.ctx.state.data.players, p => p.id), [player.id]);
  assert.equal(c.ctx.state.data.matches.length, matches.length);
});

for (const group of ['main', 'others']) {
  test(`${group}: identical loader keeps acquired Europe matches and works without static files`, async () => {
    const c = setup(group, {group, players: [player], tournaments: [{playerId: 'a'}], matches}, {staticOffline: true});
    await c.ctx.load();
    assert.deepEqual(Array.from(c.ctx.state.data.matches, m => m.circuit), ['tennis-europe', 'tennis-europe', 'tennis-europe']);
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

for (const group of ['main', 'others']) {
  test(`${group}: partial refresh keeps all acquired historical matches and scores`, async () => {
    const snapshot = {group, players: [player], tournaments: [{playerId: 'a'}], matches};
    const c = setup(group, snapshot);
    await c.ctx.load();
    c.ctx.state.data.matches[0].score = '6-4 6-3';
    snapshot.matches = [{...matches[0], score: '', opponent: 'New opponent'}];
    await c.ctx.load();
    assert.equal(c.ctx.state.data.matches.length, 3);
    assert.equal(c.ctx.state.data.matches[0].score, '6-4 6-3');
    assert.equal(c.ctx.state.data.matches[0].opponent, 'New opponent');
  });
}
test('one slow snapshot request is allowed to complete without an abort-and-restart cycle', async () => {
  const calls = [], ctx = {APP_API: '/snapshot', fetchProjection: async (url, timeout) => {calls.push({url, timeout}); return {matches: []};}};
  ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('async function apiProjection()'), source.indexOf('function cachedData()')), ctx);
  await ctx.apiProjection();
  assert.deepEqual(calls, [{url: '/snapshot', timeout: 45000}]);
});

for (const group of ['main', 'others']) {
  test(`${group}: an empty refresh cannot erase known players, tournaments or Europe matches`, async () => {
    const snapshot = {group, players: [player], tournaments: [{playerId:'a', competitionId:'known'}], matches};
    const c = setup(group, snapshot);
    await c.ctx.load();
    snapshot.players=[];snapshot.tournaments=[];snapshot.matches=[];
    await c.ctx.load();
    assert.equal(c.ctx.state.data.players.length,1);
    assert.equal(c.ctx.state.data.tournaments.length,1);
    assert.equal(c.ctx.state.data.matches.length,3);
    assert.equal(c.ctx.state.selected.has('a'),true);
  });
  test(`${group}: unenabled FITP and ITF rows are ignored from API, static files and cache`, async () => {
    const mixed=['tennis-europe','fitp','itf'].map((circuit,i)=>({id:`mixed-${i}`,playerId:'a',circuit,date:'2026-01-01'}));
    const c=setup(group,{group,players:[player],tournaments:[],matches:mixed},{cached:{players:[player],tournaments:[],matches:mixed,personalProjectionComplete:true},staticData:{'matches.json':{matches:mixed},'results.json':{results:mixed}}});
    await c.ctx.load();
    assert.deepEqual(Array.from(c.ctx.state.data.matches,m=>m.circuit),['tennis-europe']);
    assert.deepEqual(Array.from(c.ctx.state.data.agenda,m=>m.circuit),['tennis-europe']);
    assert.deepEqual(Array.from(c.ctx.state.data.results,m=>m.circuit),['tennis-europe']);
  });
}

for (const group of ['main','others']) {
  test(`${group}: complete membership restores missing player records but applies confirmed removals`,async()=>{
    const snapshot={group,membershipIds:['a'],players:[player],tournaments:[{playerId:'a',competitionId:'known'}],matches};
    const c=setup(group,snapshot);await c.ctx.load();
    snapshot.players=[];snapshot.matches=[];snapshot.tournaments=[];
    await c.ctx.load();assert.equal(c.ctx.state.data.players.length,1);assert.equal(c.ctx.state.data.matches.length,3);
    snapshot.membershipIds=[];
    await c.ctx.load();assert.equal(c.ctx.state.data.players.length,0);assert.equal(c.ctx.state.data.matches.length,0);
  });
}

for (const group of ['main', 'others']) {
  test(`${group}: fresh authoritative list removes future and ongoing withdrawals but preserves concluded history`, async () => {
    const future = {playerId: 'a', circuit: 'fitp', competitionId: 'A62D829E-687A-4DC8-A2F8-FBEFEB690167', startDate: '2099-10-17'};
    const past = {...future, competitionId: 'past', startDate: '2020-10-01'};
    const current = {...future, competitionId: 'current', startDate: new Date().toISOString().slice(0,10)};
    const started = {...future, competitionId: '24654291-5A49-4D39-BCA8-6F4608CAB3A1', startDate: '2026-10-30', endDate: '2099-11-01'};
    const cached = {group, personalProjectionComplete: true, generatedAt: '2026-10-15T20:00:00Z', players: [player], tournaments: [future, past, current, started], matches: []};
    const confirmed = {...future, competitionId: 'confirmed', name: 'Updated tournament'};
    const c = setup(group, {group, generatedAt: '2026-10-16T00:00:00Z', players: [player], tournaments: [confirmed], matches: []}, {cached});
    await c.ctx.load();
    assert.deepEqual(Array.from(c.saved().tournaments, t => t.competitionId), ['past', 'confirmed']);
  });
  for (const [label, response] of [
    ['failed', new Error('offline')],
    ['older', {generatedAt: '2026-10-14T00:00:00Z', tournaments: []}],
    ['undated', {tournaments: []}],
    ['partial', {generatedAt: '2026-10-16T00:00:00Z', partial: true, tournaments: []}],
    ['missing tournament list', {generatedAt: '2026-10-16T00:00:00Z'}],
  ]) test(`${group}: ${label} response retains cached registration`, async () => {
    const future = {playerId: 'a', circuit: 'fitp', competitionId: 'brescia', startDate: '2026-10-30', endDate: '2099-11-01'};
    const cached = {group, personalProjectionComplete: true, generatedAt: '2026-10-15T20:00:00Z', players: [player], tournaments: [future], matches: []};
    const projection = response instanceof Error ? response : {group, players: [player], matches: [], ...response};
    const c = setup(group, projection, {cached});
    await c.ctx.load();
    assert.equal(c.ctx.state.data.tournaments[0].competitionId, 'brescia');
  });
}
test('main: fresh static list removes TCL withdrawal without removing personal registrations', async () => {
  const tcl = {id: 'tcl', userAdded: false};
  const tournaments = [tcl, player].map(p => ({playerId: p.id, circuit: 'fitp', competitionId: 'brescia', startDate: '2099-10-17'}));
  const cached = {group: 'main', personalProjectionComplete: true, generatedAt: '2026-10-15T20:00:00Z', players: [tcl, player], tournaments, matches: []};
  const c = setup('main', new Error('offline'), {cached, staticData: {
    'players.json': {players: [tcl]},
    'tournaments.json': {generatedAt: '2026-10-16T00:00:00Z', tournaments: []},
  }});
  await c.ctx.load();
  assert.deepEqual(Array.from(c.saved().tournaments, t => t.playerId), ['a']);
});

for (const group of ['main', 'others']) test(`${group}: PC empty cache and phone stale ongoing registration converge after the same full D1 response`, async()=>{
 const old={playerId:player.id,circuit:'fitp',competitionId:'quanta',startDate:'2026-10-30',endDate:'2099-11-01'};
 const played={...old,competitionId:'played',startDate:'2026-09-01',endDate:'2026-09-07'};
 const match={playerId:player.id,circuit:'tennis-europe',competitionId:'played',matchId:'m-played',date:'2026-09-02',status:'completed',score:'6-2 6-3'};
 const fresh={group,generatedAt:'2026-10-31T12:00:00Z',players:[player],tournaments:[played],matches:[match]};
 const phone=setup(group,fresh,{cached:{group,personalProjectionComplete:true,generatedAt:'2026-10-30T12:00:00Z',players:[player],tournaments:[old,played],matches:[match]}});
 const pc=setup(group,fresh);await Promise.all([phone.ctx.load(),pc.ctx.load()]);
 assert.deepEqual(Array.from(phone.ctx.state.data.tournaments,t=>t.competitionId),Array.from(pc.ctx.state.data.tournaments,t=>t.competitionId));
 assert.equal(phone.ctx.state.data.tournaments.some(t=>t.competitionId==='quanta'),false);
 assert.equal(phone.ctx.state.data.matches[0].score,'6-2 6-3');
});
