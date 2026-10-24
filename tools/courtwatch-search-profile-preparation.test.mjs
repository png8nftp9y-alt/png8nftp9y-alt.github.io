import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../v3.js',import.meta.url),'utf8');
const part=(start,end)=>code.slice(code.indexOf(start),code.indexOf(end,code.indexOf(start)));
const result=n=>({sourceKey:'fitp|id:'+n,name:'Player '+n});
function harness(adding=false){
 const results=[1,2,3,4].map(result),buttons=results.map(r=>({isConnected:true,dataset:{searchPlayer:r.sourceKey,searchName:r.name}}));
 const loads=[],cached=new Map(),pending=new Map();
 const context={state:{data:{players:[]}},readablePerson:x=>x,monitoredOpponentPlayer:()=>null,
  opponentPrefetchActive:0,opponentPrefetchQueue:[],opponentPrefetchQueued:new Set(),
  opponentHistoryRequests:pending,opponentHistoryKey:(name,event,id)=>({requestKey:id}),opponentHistoryIsFresh:id=>cached.has(id),
  fetchOpponentHistory(name,event,id){if(cached.has(id))return Promise.resolve(cached.get(id));if(pending.has(id))return pending.get(id);let resolve;const p=new Promise(r=>resolve=r).then(data=>{cached.set(id,data);pending.delete(id);return data;});pending.set(id,p);loads.push({id,finish:()=>resolve({tournaments:[{name:'Ready tournament',matches:[{score:'6-0 6-0'}]}]})});return p;},
  preparedOpponentHistory:(name,event,id)=>cached.get(id),profileNavigationEpoch:0,location:{hash:'#player-search/test'},
  openProfile:()=>{throw Error('unexpected followed player')},openPlayerSearchResult:r=>context.openCurrentOpponent(r.sourceKey,r.name),addCourtWatchPlayerFromUi:r=>{context.added=r;},
 };
 vm.createContext(context);
 vm.runInContext(part('function runOpponentPrefetchQueue()', 'async function loadOpponentHistory(')+part('async function openCurrentOpponent(', 'function bindParticipantNavigation(')+part('function bindPlayerSearchResults(', 'async function renderPlayerSearchPage('),context);
 context.bindPlayerSearchResults({querySelectorAll:()=>buttons},results,adding);
 return {context,buttons,loads,cached};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('first two visible results prepare complete history before any click; requests remain bounded',async()=>{
 const {context,buttons,loads}=harness();assert.equal(loads.length,2);assert.equal(context.location.hash,'#player-search/test');
 buttons[0].onfocus();buttons[0].onpointerenter();buttons[0].ontouchstart();assert.equal(loads.length,2);
 buttons[2].onfocus();assert.equal(loads.length,2);loads[0].finish();await tick();assert.equal(loads.length,3);
 loads[1].finish();loads[2].finish();await tick();
});
test('click reuses in-flight preparation and opens only with tournaments and matches ready',async()=>{
 const {context,loads,cached}=harness();const opening=context.openCurrentOpponent('fitp|id:1','Player 1');
 assert.equal(loads.length,2);assert.equal(context.location.hash,'#player-search/test');
 loads[0].finish();await opening;
 assert.match(context.location.hash,/^opponent-profile/);assert.equal(cached.get('fitp|id:1').tournaments[0].matches.length,1);
 loads[1].finish();await tick();
});
test('changing route during preparation never sends the user back to the selected result',async()=>{
 const {context,loads}=harness();const opening=context.openCurrentOpponent('fitp|id:1','Player 1');context.location.hash='#agenda';loads[0].finish();await opening;assert.equal(context.location.hash,'#agenda');loads[1].finish();await tick();
});
test('add-player search does not start speculative profile history requests',()=>{
 const {context,buttons,loads}=harness(true);buttons[0].onfocus();assert.equal(loads.length,0);buttons[0].onclick();assert.equal(context.added.name,'Player 1');
});

test('queued preparation is discarded when search results are replaced',async()=>{
 const {buttons,loads}=harness();buttons[2].onfocus();buttons[2].isConnected=false;loads[0].finish();await tick();assert.equal(loads.length,2);loads[1].finish();await tick();
});
