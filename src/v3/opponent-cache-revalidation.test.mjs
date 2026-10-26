import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
function fixture(fetch){
 const context={state:{data:{generatedAt:'first',schemaVersion:'1'}},iso:()=> '2026-10-15',readablePerson:x=>x,circuit:t=>t.circuit||'tennis-europe',Map,Set,Date,AbortController,setTimeout,clearTimeout,
  opponentHistoryCache:new Map(),opponentHistoryValidated:new Map(),opponentHistoryRequests:new Map(),savedActiveOpponent:()=>null,
  PRIVATE_API:'/app/api',privateApiOptions:x=>x,OPPONENT_HISTORY_CACHE:'test-cache',localStorage:{},saveEntries:()=>{},saveDurableOpponent:async()=>{},fetch};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function opponentHistoryKey('),source.indexOf('function preloadOpponentHistory(')),context);
 return context;
}
const data=n=>({tournaments:[{id:'T',competitionId:'T',circuit:'tennis-europe',startDate:'2026-10-01',matches:Array.from({length:n},(_,i)=>({matchId:'m'+i,status:'completed'}))}]});

test('a restored empty history displays immediately but must fetch its matches once per page/projection',async()=>{
 let requests=0;const c=fixture(async()=>{requests++;return{ok:true,json:async()=>data(requests)}});
 const key=c.opponentHistoryKey('Test Person','GS14','id').requestKey;
 c.opponentHistoryCache.set(key,data(0));
 assert.equal(c.preparedOpponentHistory('Test Person','GS14','id').tournaments[0].matches.length,0);
 assert.equal((await c.fetchOpponentHistory('Test Person','GS14','id')).tournaments[0].matches.length,1);
 await c.fetchOpponentHistory('Test Person','GS14','id');assert.equal(requests,1);
 c.state.data.generatedAt='next-generation';
 assert.equal((await c.fetchOpponentHistory('Test Person','GS14','id')).tournaments[0].matches.length,2);
 assert.equal(requests,2);
});

test('concurrent intent and click share one request, and a failed update preserves acquired matches',async()=>{
 let requests=0,resolve,fail=false;
 const c=fixture(()=>{requests++;if(fail)return Promise.reject(Error('offline'));return new Promise(r=>resolve=r);});
 const a=c.fetchOpponentHistory('Test Person'),b=c.fetchOpponentHistory('Test Person');
 assert.equal(requests,1);resolve({ok:true,json:async()=>data(2)});await Promise.all([a,b]);
 const key=c.opponentHistoryKey('Test Person').requestKey;
 c.state.data.generatedAt='new';fail=true;
 await assert.rejects(c.fetchOpponentHistory('Test Person'),/offline/);
 assert.equal(c.opponentHistoryCache.get(key).tournaments[0].matches.length,2);
 assert.equal(c.opponentHistoryIsFresh(key),false);
});

test('old ID-reader revisions remain provisional and never prevent a current backend read',async()=>{
 let requests=0;const c=fixture(async()=>{requests++;return{ok:true,json:async()=>data(3)}});
 const current=c.opponentHistoryKey('Test Person','GS14','id').requestKey;
 const old=current.replace('played-history-v8-current-profile','linked-ids-v6-live-europe');
 assert.notEqual(old,current);c.opponentHistoryCache.set(old,data(1));
 assert.equal(c.preparedOpponentHistory('Test Person','GS14','id').tournaments[0].matches.length,1);
 assert.equal((await c.fetchOpponentHistory('Test Person','GS14','id')).tournaments[0].matches.length,3);
 assert.equal(requests,1);
});
