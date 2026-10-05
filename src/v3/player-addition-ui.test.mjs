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
  privateApiOptions:x=>x,location:{hash:'#opponent-profile/101/Test'},document:{getElementById:()=>null,createElement:()=>({dataset:{},setAttribute(){}})},$:()=>root,
  fetch:async(url,options)=>{calls.push({url,options});return response},saveUiState(){},saveCachedData(){},renderHome(){},openProfile:id=>opened.push(id),load(){},
 });vm.runInContext(addition,context);
 return{context,button,root,state,opened,calls};
}
test('confirmed POST changes opponent into a selected Court Watch player and opens player page',async()=>{
 const player={id:'cw-test',name:'Test Player',userAdded:true},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:'Test Player'},c.button);
 assert.equal(c.calls[0].options.method,'POST');assert.equal(c.state.data.players[0].id,player.id);assert.equal(c.state.selected.has(player.id),true);assert.deepEqual(c.opened,[player.id]);assert.equal(c.button.disabled,false);
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
