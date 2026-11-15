import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {progressiveOpponentProfile} from '../../cloudflare/app-api/lib/progressive-opponent-profile.mjs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function client(fetch){
 const calls=[],rendered=[];
 const c={state:{data:{generatedAt:'first',schemaVersion:1}},iso:()=> '2026-11-16',readablePerson:x=>x,circuit:t=>t.circuit||'fitp',
  Map,Set,Date,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,console,
  opponentHistoryCache:new Map(),opponentHistoryValidated:new Map(),opponentHistoryRequests:new Map(),savedActiveOpponent:()=>null,
  PRIVATE_API:'/app/api',privateApiOptions:x=>x,OPPONENT_HISTORY_CACHE:'cache',saveEntries:()=>{},saveDurableOpponent:async()=>{},
  requestIdleCallback:()=>{},activeOpponentRouteKey:'id|Person|',renderOpponentHistory:data=>rendered.push(data),
  recordStartupTiming:(stage)=>calls.push(stage),fetch};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function opponentHistoryKey('),source.indexOf('function preloadOpponentHistory(')),c);
 return {c,calls,rendered};
}
test('click changes page immediately even when profile fetch never resolves',async()=>{
 let fetches=0;const c={location:{hash:'#players'},profileNavigationEpoch:0,readablePerson:x=>x,monitoredOpponentPlayer:()=>null,
  preparedOpponentHistory:()=>null,fetchOpponentHistory:()=>{fetches++;return new Promise(()=>{});}};
 vm.createContext(c);const start=source.indexOf('async function openCurrentOpponent('),end=source.indexOf('function bindParticipantNavigation',start);
 vm.runInContext(source.slice(start,end),c);c.openCurrentOpponent('id','Person');
 assert.equal(c.location.hash,'opponent-profile/id/Person/-');assert.equal(fetches,0);
});
test('router renders the profile shell before data exists instead of waiting on a fetch',()=>{
 let rendered=0;const nodes={classList:{remove(){},toggle(){},add(){}}};
 const c={location:{hash:'#opponent-profile/id/Person/-',search:'',pathname:'/app'},PLAYER_GROUP:'main',groupSwitchRunning:false,
  state:{data:{}},syncAdaptiveNavigation(){},normalizeMatchProjection:x=>x,withoutPucItfReferences:x=>x,
  document:{querySelectorAll:()=>[],documentElement:{dataset:{}}},$:()=>nodes,
  profileYearFilter:'',profileStatusPlayerId:'',tournamentPageKey:'',window:{},finishAdaptiveNavigation(){},
  renderOpponentProfile:()=>rendered++,monitoredOpponentPlayer:()=>null,preparedOpponentHistory:()=>null,
  fetchOpponentHistory:()=>{assert.fail('router must not wait on the profile endpoint');},Date};
 vm.createContext(c);const a=source.indexOf('function route()'),b=source.indexOf('function syncMonthFromAgenda()',a);
 vm.runInContext(source.slice(a,b),c);c.route();assert.equal(rendered,1);
});
test('intent, click and completed prefetch reuse one stream; header renders before history',{timeout:1500},async()=>{
 const slow=deferred();let requests=0;
 const response=progressiveOpponentProfile(async send=>{send({profile:{ranking:10},historyPending:true,tournaments:[]});await slow.promise;return {profile:{ranking:10},historyPending:false,tournaments:[]};});
 const {c,rendered}=client(()=>{requests++;return Promise.resolve(response);});
 const intent=c.fetchOpponentHistory('Person','','id'),click=c.fetchOpponentHistory('Person','','id');
 await new Promise(setImmediate);assert.equal(requests,1);assert.equal(rendered[0].profile.ranking,10);
 assert.equal(c.opponentHistoryIsFresh(c.opponentHistoryKey('Person','','id').requestKey),false);
 slow.resolve();await Promise.all([intent,click]);await c.fetchOpponentHistory('Person','','id');
 assert.equal(requests,1);assert.equal(c.opponentHistoryIsFresh(c.opponentHistoryKey('Person','','id').requestKey),true);
});
test('slow old profile never overwrites a newly opened player',async()=>{
 const slow=deferred();const {c,rendered}=client(()=>Promise.resolve(progressiveOpponentProfile(async send=>{await slow.promise;send({profile:{ranking:10},historyPending:true,tournaments:[]});return {tournaments:[]};})));
 const pending=c.fetchOpponentHistory('Person','','id');c.activeOpponentRouteKey='other|Another|';slow.resolve();await pending;assert.equal(rendered.length,0);
});
test('history error preserves received metadata but never validates an incomplete cache',async()=>{
 const {c}=client(()=>Promise.resolve(progressiveOpponentProfile(async send=>{send({fitpMetadata:{ranking:'3.2'},historyPending:true,tournaments:[]});throw Error('history failed');})));
 await assert.rejects(c.fetchOpponentHistory('Person','','id'),/unavailable/);
 const key=c.opponentHistoryKey('Person','','id').requestKey;
 assert.equal(c.opponentHistoryCache.get(key).fitpMetadata.ranking,'3.2');assert.equal(c.opponentHistoryIsFresh(key),false);
});
test('pending profile leaves tournament section empty and never adds loading or false empty-result text',()=>{
 const body={innerHTML:'',setAttribute(k,v){this[k]=v;}};
 const c={opponentHistoryProjection:x=>x,$:id=>id==='opponentTournamentHistory'?body:null};vm.createContext(c);
 const a=source.indexOf('function renderOpponentHistory('),b=source.indexOf('function opponentHistoryKey(',a);vm.runInContext(source.slice(a,b),c);
 c.renderOpponentHistory({historyPending:true,tournaments:[]});assert.equal(body.innerHTML,'');assert.equal(body['aria-busy'],'true');
});
