import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const search=source.slice(source.indexOf('async function searchPlayerPage('),source.indexOf('function playerCircuitLinksHtml('));
function searchContext(fetch){const ctx={AbortController,setTimeout:(fn)=>setTimeout(fn,15),clearTimeout,PRIVATE_API:'/api',privateApiOptions:x=>x,fetch};vm.createContext(ctx);vm.runInContext(search,ctx);return ctx;}
test('a stalled search aborts and can be retried rather than staying pending',async()=>{
 let stalled=true,aborted=false;
 const c=searchContext(async(url,{signal})=>{if(stalled)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'))}));return {ok:true,json:async()=>({results:[{name:'Alex'}]})};});
 await assert.rejects(c.searchPlayers('Alex'),/aborted/);assert.equal(aborted,true);
 stalled=false;assert.equal((await c.searchPlayers('Alex'))[0].name,'Alex');
});
test('superseded searches abort their transport and incomplete responses are rejected',async()=>{
 const controller=new AbortController();const c=searchContext(async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('superseded')))));
 const request=c.searchPlayers('old',controller.signal);controller.abort();await assert.rejects(request,/superseded/);
 c.fetch=async()=>({ok:true,json:async()=>({})});await assert.rejects(c.searchPlayers('Alex'),/incomplete/);
});
test('unrelated selections never disable a click; touch navigation remains usable',()=>{
 const element={contains:n=>n==='inside'},selection={isCollapsed:false,anchorNode:'outside',focusNode:'outside',toString:()=> 'selected'};
 const ctx={window:{getSelection:()=>selection},matchMedia:()=>({matches:false})};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function hasLocalMouseSelection('),source.indexOf('function bindPlayerHold(')),ctx);
 assert.equal(ctx.hasLocalMouseSelection({pointerType:'mouse'},element),false);
 selection.anchorNode='inside';assert.equal(ctx.hasLocalMouseSelection({pointerType:'mouse'},element),true);
 assert.equal(ctx.hasLocalMouseSelection({pointerType:'touch'},element),false);
});
test('stalled durable snapshot and opponent reads do not prevent application startup',async()=>{
 let closed=0;const db={transaction:()=>({objectStore:()=>({get:()=>({}),getAll:()=>({})})}),close:()=>closed++};
 const ctx={openProjectionDatabase:async()=>db,LAST_GOOD_CACHE:'cache',setTimeout:fn=>setTimeout(fn,10),clearTimeout,validProjection:()=>true,opponentHistoryCache:new Map()};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('async function readDurableProjection('),source.indexOf('async function restoreDurableProjection('))+source.slice(source.indexOf('async function restoreDurableOpponents('),source.indexOf('function cachedPersonalTournaments(')),ctx);
 assert.equal(await ctx.readDurableProjection(),null);await ctx.restoreDurableOpponents();assert.equal(closed,2);assert.equal(ctx.opponentHistoryCache.size,0);
});
