import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
test('ready opponent data resolves even when local persistence never finishes',async()=>{
 const idle=[],data={profile:{name:'Opponent'},tournaments:[]};let writes=0;
 const c={AbortController,PRIVATE_API:'/api',OPPONENT_HISTORY_CACHE:'cache',localStorage:{},
  opponentHistoryKey:()=>({asOf:'2026-10-17',requestKey:'opponent'}),opponentHistoryEpoch:()=>'',opponentHistoryIsFresh:()=>false,
  opponentHistoryRequests:new Map(),opponentHistoryCache:new Map(),opponentHistoryValidated:new Map(),
  fetch:async()=>({ok:true,json:async()=>data}),privateApiOptions:x=>x,mergeOpponentHistory:(a,b)=>b,preparedOpponentHistory:()=>null,
  saveEntries:()=>{writes++},saveDurableOpponent:()=>new Promise(()=>{}),requestIdleCallback:fn=>idle.push(fn),setTimeout,clearTimeout,console};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function fetchOpponentHistory('),source.indexOf('function preloadOpponentHistory(')),c);
 const timeout=new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('navigation waited for local storage')),100);timer.unref()});
 const result=await Promise.race([c.fetchOpponentHistory('Opponent','','id'),timeout]);
 assert.equal(result.profile.name,'Opponent');assert.equal(c.opponentHistoryCache.get('opponent'),data);assert.equal(c.opponentHistoryRequests.size,0);
 assert.equal(writes,0);for(const persist of idle)persist();assert.equal(writes,1);
});
