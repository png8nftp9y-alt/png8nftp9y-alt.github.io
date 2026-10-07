import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const addition=source.slice(source.indexOf('const playerAdditionsInFlight ='),source.indexOf('function openPlayerSearchResult'));
const loader=source.slice(source.indexOf('async function load()'),source.indexOf('document.addEventListener("click", (event) => {',source.indexOf('async function load()')));
function context(response){
 const root={querySelector:()=>null,append(){this.error=true}},button={textContent:'Aggiungi giocatore',disabled:false,isConnected:true,closest:()=>root};
 const state={data:{players:[],tournaments:[]},selected:new Set()},opened=[],calls=[];
 const context=vm.createContext({console,Headers,Map,Set,Promise,Date,setTimeout,clearTimeout,state,PRIVATE_API:'/app/api',removedCourtWatchPlayers:new Set(),confirmedCourtWatchPlayers:new Map(),playerRemovalMode:false,
  privateApiOptions:x=>x,history:{state:{},replaceState(_s,_t,hash){context.location.hash=hash}},route(){opened.push(decodeURIComponent(context.location.hash.slice('#player/'.length)))},location:{hash:'#opponent-profile/101/Test'},document:{getElementById:()=>null,createElement:()=>({dataset:{},setAttribute(){}})},$:()=>root,
  apiProjection:async()=>({players:[{id:'cw-test',name:'Test Player',userAdded:true}],tournaments:[{playerId:'cw-test',competitionId:'cantu',name:'Cantù'}],matches:[]}),
  fetch:async(url,options)=>{calls.push({url,options});return response},saveUiState(){},saveCachedData(){},renderHome(){},openProfile:id=>opened.push(id),load(){},
 });vm.runInContext(addition,context);
 return{context,button,root,state,opened,calls};
}
test('confirmed POST changes opponent into a selected Court Watch player and opens player page',async()=>{
 const player={id:'cw-test',name:'Test Player',userAdded:true},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:'Test Player'},c.button);
 assert.equal(c.calls[0].options.method,'POST');assert.equal(c.state.data.players[0].id,player.id);assert.equal(c.state.selected.has(player.id),true);assert.deepEqual(c.opened,[player.id]);assert.equal(c.button.disabled,false);assert.equal(c.state.data.tournaments[0].competitionId,'cantu');assert.equal(c.state.data.personalProjectionComplete,true);
});
test('failed POST never promotes player and leaves a retryable button',async()=>{
 const c=context({ok:false,json:async()=>({error:'player_not_found'})});
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:'Test Player'},c.button);
 assert.equal(c.state.data.players.length,0);assert.equal(c.opened.length,0);assert.equal(c.root.error,true);assert.equal(c.button.textContent,'Aggiungi giocatore');assert.equal(c.button.disabled,false);
});
test('simultaneous clicks send one request, and navigation during save is respected',async()=>{
 let release;const response=new Promise(resolve=>release=resolve),c=context(null);
 c.context.fetch=async()=>{c.calls.push('POST');return response};
 const first=c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);
 await c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);assert.equal(c.calls.length,1);
 c.context.location.hash='#calendar';release({ok:true,json:async()=>({added:true,playerId:'cw-test',player:{id:'cw-test',name:'Test Player'}})});
 await first;assert.equal(c.state.data.players.length,1);assert.equal(c.opened.length,0);
});
test('normal reload retains a D1-added player absent from static JSON and their stored entries',async()=>{
 const person={id:'cw-test',name:'Test Player',userAdded:true},ctx={console,Map,Set,Promise,Date,state:{data:{players:[],tournaments:[]},selected:new Set()},loadRunning:false,uiSelectionRestored:true,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),cachedData:()=>null,saveCachedData(){},saveUiState(){},syncLabel(){},renderIfDataChanged(){},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,iso:d=>d.toISOString().slice(0,10),add:(d,n)=>new Date(+d+n*86400000),
  apiProjection:async()=>({generatedAt:'2026-10-01T00:00:00Z',players:[{id:'static-player',name:'Static Player'},person],tournaments:[{playerId:person.id,competitionId:'J30',circuit:'itf'}],matches:[]}),
  v3json:async name=>name==='players.json'?{generatedAt:'2026-10-06T00:00:00Z',players:[{id:'static-player',name:'Static Player'}]}:name==='tournaments.json'?{generatedAt:'2026-10-06T00:00:00Z',tournaments:[]}:{} };
 vm.createContext(ctx);vm.runInContext(loader,ctx);await ctx.load();
 assert.equal(ctx.state.data.players.some(p=>p.id===person.id),true);assert.equal(ctx.state.data.tournaments.some(t=>t.playerId===person.id),true);
});

test('addition does not promote or cache a player before their full snapshot arrives',async()=>{
 const player={id:'cw-test',name:'Test Player',club:'Tennis Club Lecco'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 let release,started;const began=new Promise(resolve=>started=resolve);
 c.context.apiProjection=()=>{started();return new Promise(resolve=>release=resolve)};
 const operation=c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);
 await began;assert.equal(c.state.data.players.length,0);assert.equal(c.opened.length,0);
 release({players:[player],tournaments:[{playerId:player.id,name:'Cantù',competitionId:'cantu'}],matches:[]});
 await operation;assert.equal(c.state.data.tournaments[0].name,'Cantù');assert.equal(c.state.data.players[0].club,'Tennis Club Lecco');
});
test('cold reload discards a partial old cache and first renders all personal tournaments together',async()=>{
 const person={id:'cw-test',name:'Test Player',userAdded:true},renders=[],partial={players:[person],tournaments:[]};
 let release;
 const ctx={console,Map,Set,Promise,Date,state:{data:null,selected:new Set()},loadRunning:false,uiSelectionRestored:false,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),cachedData:()=>partial,saveCachedData(){},saveUiState(){},syncLabel(){},renderIfDataChanged(){renders.push(ctx.state.data.tournaments.length)},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,iso:d=>d.toISOString().slice(0,10),add:(d,n)=>new Date(+d+n*86400000),
 apiProjection:()=>new Promise(resolve=>release=resolve),
 v3json:async name=>name==='players.json'?{players:[{id:'base',name:'Base'}]}:name==='tournaments.json'?{tournaments:[]}:{}};
 vm.createContext(ctx);vm.runInContext(loader,ctx);const loading=ctx.load();
 assert.equal(renders.length,0);
 release({generatedAt:'2026-10-07T21:00:00Z',players:[person],tournaments:[{playerId:person.id,name:'Cantù'}],matches:[]});
 await loading;assert.deepEqual(renders,[1]);assert.equal(ctx.state.data.personalProjectionComplete,true);
});
test('calendar order uses canonical player names even when entry names use surname first',()=>{
 const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
 const group=source.slice(source.indexOf('function groups('),source.indexOf('function renderCalendar('));
 const ctx={state:{data:{players:[{id:'c',name:'Camilla Frigerio'},{id:'p',name:'Paolo Brambilla'},{id:'r',name:'Riccardo Galbiati'}],tournaments:[{playerId:'r',playerName:'GALBIATI RICCARDO',competitionId:'cantu'},{playerId:'p',playerName:'BRAMBILLA PAOLO',competitionId:'cantu'},{playerId:'c',playerName:'FRIGERIO CAMILLA',competitionId:'cantu'}]},selected:new Set(['c','p','r'])},readableText:x=>String(x||''),active:()=>true,tournamentKey:t=>t.competitionId,circuitRank:()=>0};
 vm.createContext(ctx);vm.runInContext(readable+group,ctx);
 assert.deepEqual(Array.from(ctx.groups()[0].players),['Camilla Frigerio','Paolo Brambilla','Riccardo Galbiati']);
});
