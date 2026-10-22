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

const memberSource=source.slice(source.indexOf('async function refreshPlayerMembership('),source.indexOf('async function apiProjection()'));
function live(c){
 Object.assign(c.ctx,{PRIVATE_API:'/app/api',AbortController,setTimeout,clearTimeout,privateApiOptions:x=>x,location:{hash:'#players'}});
 vm.runInContext(memberSource,c.ctx);
}
const a={id:'a',name:'Existing',club:'Rich Club',ranking:'2.1'},b={id:'b',name:'New'};
const cached={group:'others',personalProjectionComplete:true,players:[a],tournaments:[{playerId:'a',name:'History'}],matches:[],agenda:[]};
const full={group:'others',membershipIds:['a','b'],players:[a,{...b,club:'Complete Club'}],tournaments:[{playerId:'b',name:'New Tournament'}],matches:[]};
test('new membership paints before full history; one full load, existing data and deselections retained',async()=>{
 const c=setup('others',full,{cached});live(c);let finish,reads=0;
 c.ctx.state.data=structuredClone(cached);c.ctx.state.selected=new Set();c.ctx.uiSelectionRestored=true;
 c.ctx.apiProjection=()=>{reads++;return new Promise(r=>finish=r)};
 let listReads=0;c.ctx.fetch=async()=>{listReads++;return{ok:true,json:async()=>({group:'others',membershipIds:['a','b'],players:[{...a,club:'Old Club'},b]})}};
 const loading=c.ctx.load(null,null,true);
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(Array.from(c.ctx.state.data.players,p=>p.id),['a','b']);
 assert.equal(c.ctx.state.data.players[0].club,'Rich Club');assert.equal(c.ctx.state.data.players[1].membershipPending,true);
 assert.equal(c.ctx.state.data.tournaments[0].name,'History');
 assert.deepEqual(Array.from(c.ctx.state.selected),['b']);assert.equal(reads,1);assert.equal(listReads,1);
 finish(full);await loading;
 assert.equal(c.ctx.state.data.players[1].club,'Complete Club');assert.equal(c.ctx.state.data.players[1].membershipPending,undefined);
 assert.equal(c.ctx.state.data.tournaments.some(t=>t.name==='New Tournament'),true);
 c.ctx.apiProjection=async()=>{reads++;return full};await c.ctx.load();assert.equal(listReads,1,'normal background load adds no list request');
});
test('late list cannot overwrite complete snapshot; wrong group and epoch are ignored',async()=>{
 const c=setup('others',full,{cached});live(c);c.ctx.state.data=structuredClone(cached);
 let release;c.ctx.fetch=()=>new Promise(r=>release=r);
 await c.ctx.load(null,null,true);
 release({ok:true,json:async()=>({group:'others',membershipIds:['a'],players:[a]})});
 await new Promise(r=>setImmediate(r));assert.equal(c.ctx.state.data.players.length,2);
 for(const list of [{group:'main',players:[],membershipIds:[]},{group:'others',players:[b],membershipIds:[]}]){
  const before=JSON.stringify(c.ctx.state.data);
  c.ctx.fetch=async()=>({ok:true,json:async()=>list});
  await c.ctx.refreshPlayerMembership('others',0,()=>false);
  assert.equal(JSON.stringify(c.ctx.state.data),before);
 }
 c.ctx.state.playerSelectionEpoch=1;c.ctx.fetch=async()=>({ok:true,json:async()=>({group:'others',players:[],membershipIds:[]})});
 await c.ctx.refreshPlayerMembership('others',0,()=>false);assert.equal(c.ctx.state.data.players.length,2);
});
test('failed lightweight request retains cache; prepared/group-switch snapshots add no request',async()=>{
 const c=setup('others',full,{cached});live(c);c.ctx.state.data=structuredClone(cached);const before=JSON.stringify(c.ctx.state.data);
 c.ctx.fetch=async()=>{throw Error('offline')};
 await c.ctx.refreshPlayerMembership('others',0,()=>false);assert.equal(JSON.stringify(c.ctx.state.data),before);
 let calls=0;c.ctx.fetch=async()=>{calls++;throw Error('must not request')};
 await c.ctx.load(full,{},true);assert.equal(calls,0);
});
test('list loading has no timer loop and avoids presenting pending tournaments as absent',()=>{
 assert.doesNotMatch(memberSource,/setInterval|setTimeout\([^,]*refreshPlayerMembership/);
 assert.match(source,/p.membershipPending \? "Caricamento tornei…"/);
});
test('resume refresh bypasses a blocked existing full load and coalesces simultaneous membership requests',async()=>{
 const c=setup('others',full,{cached});live(c);c.ctx.state.data=structuredClone(cached);
 let finish,list,fullReads=0,listReads=0;
 c.ctx.apiProjection=()=>{fullReads++;return new Promise(r=>finish=r)};
 c.ctx.fetch=()=>{listReads++;return new Promise(r=>list=r)};
 const initial=c.ctx.load();
 await new Promise(r=>setImmediate(r));
 const resume=c.ctx.load(null,null,true),duplicate=c.ctx.load(null,null,true);
 assert.equal(fullReads,1);assert.equal(listReads,1);
 list({ok:true,json:async()=>({group:'others',players:[a,b],membershipIds:['a','b']})});
 await new Promise(r=>setImmediate(r));
 assert.equal(c.ctx.state.data.players[1].id,'b');assert.equal(c.ctx.state.data.players[1].membershipPending,true);
 finish(full);await Promise.all([initial,resume,duplicate]);assert.equal(fullReads,1);
});
