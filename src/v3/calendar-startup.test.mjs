import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const restore=source.slice(source.indexOf('function restoreCachedProjectionBeforeFirstRender()'),source.indexOf('function saveCachedData(data)'));
const filter=source.slice(source.indexOf('function renderFilters()'),source.indexOf('function matchTournament('));
const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
test('cached personal players and tournaments exist before the first route without awaiting network',()=>{
 const saved={players:[{id:'c',name:'Camilla Frigerio'},{id:'p',name:'Paolo Brambilla'},{id:'r',name:'Riccardo Galbiati'}],tournaments:[{playerId:'c',name:'Cantù'},{playerId:'p',name:'Cantù'},{playerId:'r',name:'Cantù'}]};
 const ctx={cachedData:()=>saved,state:{data:null,selected:new Set(['c','p','r'])},uiSelectionRestored:true};
 vm.createContext(ctx);vm.runInContext(restore,ctx);
 assert.equal(ctx.restoreCachedProjectionBeforeFirstRender(),true);
 assert.equal(ctx.state.data.tournaments.length,3);assert.equal(ctx.state.selected.size,3);
 const boot=source.slice(source.lastIndexOf('restoreCachedProjectionBeforeFirstRender();'));
 assert.ok(boot.indexOf('restoreCachedProjectionBeforeFirstRender();')<boot.indexOf('route();'));
 assert.ok(boot.indexOf('route();')<boot.indexOf('load();'));
});
test('restoring cache preserves deselect all and an explicit player subset',()=>{
 const saved={players:[{id:'a'},{id:'b'}],tournaments:[]};
 for(const selected of [[],['b']]){
  const ctx={cachedData:()=>saved,state:{data:null,selected:new Set(selected)},uiSelectionRestored:true};
  vm.createContext(ctx);vm.runInContext(restore,ctx);ctx.restoreCachedProjectionBeforeFirstRender();
  assert.deepEqual(Array.from(ctx.state.selected),selected);
 }
});
test('no cache does not create an empty fabricated projection',()=>{
 const ctx={cachedData:()=>null,state:{data:null,selected:new Set()},uiSelectionRestored:false};
 vm.createContext(ctx);vm.runInContext(restore,ctx);
 assert.equal(ctx.restoreCachedProjectionBeforeFirstRender(),false);assert.equal(ctx.state.data,null);
});
test('select-deselect calendar chips are alphabetical and keep the chosen IDs',()=>{
 const nodes={},players=[{id:'r',name:'RICCARDO GALBIATI'},{id:'p',name:'PAOLO BRAMBILLA'},{id:'c',name:'CAMILLA FRIGERIO'},{id:'a',name:'Anna Test'}];
 const state={data:{players},selected:new Set(['p','c']),sexFilter:'all',categoryFilters:new Set()};
 const ctx={state,readableText:x=>String(x||''),$:id=>nodes[id]??={},
 calendarEligiblePlayers:()=>players,esc:x=>String(x??''),document:{querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext(readable+filter,ctx);ctx.renderFilters();
 const html=nodes.playerFilters.innerHTML;
 assert.ok(html.indexOf('Anna Test')<html.indexOf('Camilla Frigerio'));
 assert.ok(html.indexOf('Camilla Frigerio')<html.indexOf('Paolo Brambilla'));
 assert.ok(html.indexOf('Paolo Brambilla')<html.indexOf('Riccardo Galbiati'));
 assert.deepEqual(Array.from(state.selected),['p','c']);
 assert.deepEqual(players.map(p=>p.id),['r','p','c','a']);
});

const cacheSource=source.slice(source.indexOf('function cachedData()'),source.indexOf('function syncLabel('));
function cacheContext(initial={},quota=Infinity) {
 const values=new Map(Object.entries(initial));
 const ctx={LAST_GOOD_CACHE:'full',CALENDAR_CACHE:'calendar',console:{warn(){}},Date,
 iso:date=>date.toISOString().slice(0,10),add:(date,days)=>new Date(date.getTime()+days*86400000),
 state:{data:null,selected:new Set()},uiSelectionRestored:false,
 localStorage:{getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key),
 setItem(key,value){const total=[...values].filter(([k])=>k!==key).reduce((n,[,v])=>n+v.length,0)+value.length;if(total>quota)throw Error('QuotaExceededError');values.set(key,value);}}};
 vm.createContext(ctx);vm.runInContext(cacheSource,ctx);return {ctx,values};
}
test('large history exceeding storage quota still restores all personal tournaments before first route',()=>{
 const stale={players:[{id:'base'}],tournaments:[],padding:'x'.repeat(3000)};
 const {ctx,values}=cacheContext({full:JSON.stringify(stale)},4000);
 const data={players:[{id:'base'},{id:'new',userAdded:true}],tournaments:[{playerId:'new',name:'Cantù'}],matches:[],opponents:[{raw:'x'.repeat(10000)}],personalProjectionComplete:true};
 ctx.saveCachedData(data);
 assert.ok(values.has('calendar'));
 ctx.restoreCachedProjectionBeforeFirstRender();
 assert.equal(ctx.state.data.tournaments[0].playerId,'new');
 assert.ok(ctx.state.selected.has('new'));
});
test('new lightweight calendar takes precedence over stale full snapshot',()=>{
 const {ctx}=cacheContext({full:JSON.stringify({players:[],tournaments:[],cachedAt:1}),calendar:JSON.stringify({players:[{id:'r'}],tournaments:[{playerId:'r'}],cachedAt:2})});
 assert.equal(ctx.cachedData().tournaments[0].playerId,'r');
});
test('corrupt full snapshot does not hide valid calendar cache',()=>{
 const {ctx}=cacheContext({full:'invalid JSON',calendar:JSON.stringify({players:[{id:'r'}],tournaments:[{playerId:'r'}],cachedAt:2})});
 assert.equal(ctx.cachedData().players[0].id,'r');
});
test('API failure fallback retains personal tournaments and omits removed players',()=>{
 const {ctx}=cacheContext();
 const previous={tournaments:[{playerId:'base'},{playerId:'new'},{playerId:'removed'}]};
 const result=ctx.cachedPersonalTournaments(previous,[{id:'base'},{id:'new',userAdded:true}]);
 assert.deepEqual(Array.from(result,t=>t.playerId),['new']);
 assert.ok(source.includes('cachedPersonalTournaments(previous, visiblePlayers)'));
});

test('actual load with unavailable API keeps cached personal calendar after JSON refresh',async()=>{
 const {ctx}=cacheContext();
 Object.assign(ctx,{loadRunning:false,uiSelectionRestored:true,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),saveUiState(){},syncLabel(){},renderIfDataChanged(){},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,
 apiProjection:async()=>{throw Error('offline')},
 v3json:async name=>name==='players.json'?{players:[{id:'base'}]}:name==='tournaments.json'?{tournaments:[{playerId:'base',name:'Base'}]}:{}});
 ctx.state.data={players:[{id:'base'},{id:'new',userAdded:true}],tournaments:[{playerId:'new',name:'Cantù'}],matches:[]};
 const loader=source.slice(source.indexOf('async function load()'),source.indexOf('document.addEventListener("click", (event) => {',source.indexOf('async function load()')));
 vm.runInContext(loader,ctx);await ctx.load();
 assert.deepEqual(Array.from(ctx.state.data.tournaments,t=>t.name),['Base','Cantù']);
 assert.equal(ctx.cachedData().tournaments.some(t=>t.playerId==='new'),true);
});
