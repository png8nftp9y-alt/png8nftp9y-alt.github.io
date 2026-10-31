import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const mergeSource = source.slice(source.indexOf('function agendaKey('), source.indexOf('function clearDemographicFilters('));
const restore=source.slice(source.indexOf('function applyCachedProjection('),source.indexOf('function saveCachedData(data)'));
const filter=source.slice(source.indexOf('function renderFilters()'),source.indexOf('function matchTournament('));
const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
test('navigation renders only the requested section, including date and selection updates',()=>{
 const calls=[],ctx={state:{},location:{hash:''},saveUiState:()=>calls.push('save')};
 for(const name of ['renderFilters','renderAgenda','renderCalendar','renderPlayers','renderDiagnostics'])ctx[name]=()=>calls.push(name);
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function renderHome()'),source.indexOf('function renderDataSignature(')),ctx);
 for(const [hash,expected] of [
  ['#agenda',['renderFilters','renderAgenda','renderDiagnostics']],
  ['#calendar',['renderFilters','renderCalendar','renderDiagnostics']],
  ['#players',['renderPlayers','renderDiagnostics']],
  ['', ['renderDiagnostics']],
 ]){ctx.location.hash=hash;calls.length=0;ctx.renderHome();assert.deepEqual(calls,expected,hash||'home');}
 vm.runInContext(source.slice(source.indexOf('function renderSynchronizedDates()'),source.indexOf('function renderDatePopover(')),ctx);
 ctx.location.hash='#agenda';calls.length=0;ctx.renderSynchronizedDates();
 assert.deepEqual(calls,['save','renderFilters','renderAgenda','renderDiagnostics']);
});
test('render-local tournament index preserves exact IDs, circuit boundaries, first-match and missing-ID fallback semantics',()=>{
 const rows=[
  {name:'Shared',circuit:'fitp',competitionId:'7'},
  {name:'Shared',circuit:'tennis-europe'},
  {name:'Shared',circuit:'tennis-europe',competitionId:7},
  {name:'Second',circuit:'tennis-europe',competitionId:'7'},
  {name:'Shared',circuit:'itf',competitionId:'7'},
  {name:'No ID',circuit:'tennis-europe'},
 ];
 const ctx={circuit:m=>m.circuit||'fitp',readableText:x=>String(x||''),groups:()=>rows};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function createMatchTournamentResolver('),source.indexOf('function matchTournament(')),ctx);
 const resolve=ctx.createMatchTournamentResolver();
 for(const circuit of ['fitp','tennis-europe','itf'])for(const competitionId of [undefined,'',0,7,'7','absent'])for(const tournamentName of ['Shared','Second','No ID','Missing']){
  const m={circuit,competitionId,tournamentName};
  const expected=rows.find(t=>t.circuit===m.circuit&&(m.competitionId&&t.competitionId?String(m.competitionId)===String(t.competitionId):t.name===m.tournamentName));
  assert.equal(resolve(m),expected,JSON.stringify(m));
 }
 const updated=[{name:'Updated',circuit:'tennis-europe',competitionId:'7'}];
 assert.equal(ctx.createMatchTournamentResolver(updated)({circuit:'tennis-europe',competitionId:'7'}),updated[0]);
});
test('cached personal players and tournaments exist before the first route without awaiting network',()=>{
 const saved={players:[{id:'c',name:'Camilla Frigerio'},{id:'p',name:'Paolo Brambilla'},{id:'r',name:'Riccardo Galbiati'}],tournaments:[{playerId:'c',name:'Cantù'},{playerId:'p',name:'Cantù'},{playerId:'r',name:'Cantù'}]};
 const ctx={validProjection:d=>d&&Array.isArray(d.players)&&Array.isArray(d.tournaments),cachedData:()=>saved,state:{data:null,selected:new Set(['c','p','r'])},uiSelectionRestored:true};
 vm.createContext(ctx);vm.runInContext(restore,ctx);
 assert.equal(ctx.restoreCachedProjectionBeforeFirstRender(),true);
 assert.equal(ctx.state.data.tournaments.length,3);assert.equal(ctx.state.selected.size,3);
 const boot=source.slice(source.lastIndexOf('restoreCachedProjectionBeforeFirstRender();'));
 assert.ok(boot.indexOf('restoreCachedProjectionBeforeFirstRender();')<boot.indexOf('route();'));
 assert.ok(boot.indexOf('restoreDurableProjection()')<boot.indexOf('route();'));
});
test('mobile startup starts API and route while durable storage is still pending',async()=>{
 const calls=[],state={data:{players:[{id:'a'}],tournaments:[],matches:[]}};
 let releasePlayer,releaseOpponent;
 const ctx={state,restoreCachedProjectionBeforeFirstRender:()=>calls.push('web'),wire:()=>{},wireAccount:()=>{},
 restoreDurableProjection:()=>new Promise(resolve=>{releasePlayer=()=>{calls.push('durable-player');resolve(true);};}),
 restoreDurableOpponents:()=>new Promise(resolve=>{releaseOpponent=resolve;}),load:()=>{calls.push('api-start');return new Promise(()=>{});},
 route:()=>calls.push('route'),renderDataSignature:()=>'',syncLabel:()=>{},restoreUiScroll:()=>{},
 loadAccount:()=>{},refreshMatchAnalysisStatus:()=>{},setInterval:()=>{}};
 vm.createContext(ctx);
 const boot=source.slice(source.indexOf('async function startCourtWatch()'),source.lastIndexOf('startCourtWatch();'));
 vm.runInContext(boot+'\nglobalThis.testBoot=startCourtWatch();',ctx);
 await ctx.testBoot;
 assert.ok(calls.includes('api-start'));assert.ok(calls.includes('route'));
 assert.equal(calls.includes('durable-player'),false);
 releasePlayer();releaseOpponent();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.filter(x=>x==='api-start').length,1);
 assert.equal(calls.filter(x=>x==='route').length,2);
});
test('restoring cache preserves deselect all and an explicit player subset',()=>{
 const saved={players:[{id:'a'},{id:'b'}],tournaments:[]};
 for(const selected of [[],['b']]){
  const ctx={validProjection:d=>d&&Array.isArray(d.players)&&Array.isArray(d.tournaments),cachedData:()=>saved,state:{data:null,selected:new Set(selected)},uiSelectionRestored:true};
  vm.createContext(ctx);vm.runInContext(restore,ctx);ctx.restoreCachedProjectionBeforeFirstRender();
  assert.deepEqual(Array.from(ctx.state.selected),selected);
 }
});
test('no cache does not create an empty fabricated projection',()=>{
 const ctx={validProjection:d=>d&&Array.isArray(d.players)&&Array.isArray(d.tournaments),cachedData:()=>null,state:{data:null,selected:new Set()},uiSelectionRestored:false};
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

const cacheSource=source.slice(source.indexOf('let durableProjectionFallback'),source.indexOf('function syncLabel('));
function cacheContext(initial={},quota=Infinity) {
 const values=new Map(Object.entries(initial));
 const ctx={PLAYER_GROUP:"main",circuit:m=>m.circuit||"fitp",agendaKey:m=>`${m.playerId}|${m.matchId||m.id}`,Promise,validProjection:d=>d&&Array.isArray(d.players)&&Array.isArray(d.tournaments),LAST_GOOD_CACHE:'full',CALENDAR_CACHE:'calendar',console:{warn(){}},Date,
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
 Object.assign(ctx,{loadRunning:false,uiSelectionRestored:true,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),saveUiState(){},normalizeMatchProjection:x=>x,syncLabel(){},renderIfDataChanged(){},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,
 apiProjection:async()=>{throw Error('offline')},
 v3json:async name=>name==='players.json'?{players:[{id:'base'}]}:name==='tournaments.json'?{tournaments:[{playerId:'base',name:'Base'}]}:{}});
 ctx.state.data={players:[{id:'base'},{id:'new',userAdded:true}],tournaments:[{playerId:'new',name:'Cantù'}],matches:[]};
 const loader=source.slice(source.indexOf('async function load('),source.indexOf('document.addEventListener("click", (event) => {',source.indexOf('async function load(')));
 ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;ctx.PLAYER_GROUP='main';vm.runInContext(mergeSource+loader,ctx);await ctx.load();
 assert.deepEqual(Array.from(ctx.state.data.tournaments,t=>t.name).sort(),['Base','Cantù'].sort());
 assert.equal(ctx.cachedData().tournaments.some(t=>t.playerId==='new'),true);
});

test('quota fallback keeps all acquired historical matches across a page reload',()=>{
 const {ctx,values}=cacheContext({},4500);
 const old={id:'old',playerId:'a',circuit:'tennis-europe',date:'2026-01-01',score:'6-4 6-3'};
 ctx.saveCachedData({players:[{id:'a'}],tournaments:[],matches:[old],opponents:[{raw:'x'.repeat(10000)}],personalProjectionComplete:true});
 assert.equal(values.has('full'),false);
 assert.equal(ctx.cachedData().matches[0].id,'old');
 ctx.state.data=null;ctx.restoreCachedProjectionBeforeFirstRender();
 assert.equal(ctx.state.data.matches[0].score,'6-4 6-3');
});

test('a failed cache replacement never destroys the previous valid full snapshot',async()=>{
 const previous={players:[{id:'a'}],tournaments:[],matches:[{id:'known',playerId:'a',circuit:'tennis-europe'}],cachedAt:1};
 const serialized=JSON.stringify(previous),{ctx,values}=cacheContext({full:serialized},1);
 await ctx.saveCachedData({...previous,matches:[...previous.matches,{id:'new',playerId:'a',circuit:'tennis-europe'}]});
 assert.equal(values.get('full'),serialized);
 assert.equal(values.has('calendar'),false);
});
test('compact cache stores Europe matches once and does not retain FITP/ITF results',()=>{
 const {ctx}=cacheContext();
 const rows=['tennis-europe','fitp','itf'].map((circuit,i)=>({id:String(i),playerId:'a',circuit}));
 const snapshot=ctx.calendarCacheSnapshot({players:[{id:'a'}],tournaments:[],matches:rows,agenda:rows,results:rows},1);
 assert.equal(snapshot.matches.length,1);assert.equal(snapshot.agenda.length,0);assert.equal(snapshot.results.length,1);
});

test('queued projection writes keep the original group key after a group switch',async()=>{
 const {ctx}=cacheContext(),writes=[];
 ctx.writeDurableProjection=async(data,key)=>{writes.push({group:data.group,key});return true;};
 const saved=ctx.saveCachedData({group:'main',players:[{id:'a'}],tournaments:[],matches:[]});
 ctx.LAST_GOOD_CACHE='other-group';
 await saved;
 assert.deepEqual(writes,[{group:'main',key:'full'}]);
});

for(const change of ['fresh API','group switch','selection change'])test(`late IndexedDB restore cannot undo ${change}`,async()=>{
 const {ctx}=cacheContext();let release;
 ctx.readDurableProjection=()=>new Promise(resolve=>{release=resolve;});
 ctx.state.data={players:[{id:'fresh'}],tournaments:[],matches:[]};
 const pending=ctx.restoreDurableProjection();
 if(change==='fresh API')ctx.state.completeProjectionVersion=1;
 if(change==='group switch')ctx.PLAYER_GROUP='others';
 if(change==='selection change')ctx.state.playerSelectionEpoch=1;
 release({players:[{id:'old'}],tournaments:[{playerId:'old',competitionId:'quanta'}],cachedAt:999999});
 assert.equal(await pending,false);assert.equal(ctx.state.data.players[0].id,'fresh');
});
