import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const mergeSource = source.slice(source.indexOf('function agendaKey('), source.indexOf('function clearDemographicFilters('));
const addition=source.slice(source.indexOf('function recordPlayerLoadTiming('),source.indexOf('async function fetchProjection('))+source.slice(source.indexOf('const playerAdditionsInFlight ='),source.indexOf('function openPlayerSearchResult'));
const loader=source.slice(source.indexOf('async function load('),source.indexOf('document.addEventListener("click", (event) => {',source.indexOf('async function load(')));
function context(response){
 const root={querySelector:()=>null,append(node){if(Object.hasOwn(node.dataset||{},'playerAddError'))this.error=true;else this.notice=true}},button={textContent:'Aggiungi giocatore',disabled:false,isConnected:true,closest:()=>root};
 const state={data:{players:[],tournaments:[]},selected:new Set()},opened=[],calls=[];
 const context=vm.createContext({console,Headers,Map,Set,Promise,Date,setTimeout,clearTimeout,PLAYER_GROUP:'main',loadRunning:false,activeLoadCompletion:Promise.resolve(),circuit:m=>m.circuit||"fitp",state,PRIVATE_API:'/app/api',fetchProjection:()=>new Promise(()=>{}),iso:()=> '2026-10-17',normalizeMatchProjection:x=>x,applyKnownResultUpdates:x=>x,renderIfDataChanged(){},removedCourtWatchPlayers:new Set(),confirmedCourtWatchPlayers:new Map(),playerRemovalMode:false,
  agendaKey:m=>`${m.playerId}|${m.matchId||m.id}`,privateApiOptions:x=>x,history:{state:{},replaceState(_s,_t,hash){context.location.hash=hash}},route(){opened.push(decodeURIComponent(context.location.hash.slice('#player/'.length)))},location:{hash:'#opponent-profile/101/Test'},document:{getElementById:()=>null,createElement:()=>({dataset:{},setAttribute(){}})},$:()=>root,
  apiProjection:async()=>({players:[{id:'cw-test',name:'Test Player',userAdded:true}],tournaments:[{playerId:'cw-test',competitionId:'cantu',name:'Cantù'}],matches:[]}),
  fetch:async(url,options)=>{calls.push({url,options});return response},saveUiState(){},saveCachedData(){},renderHome(){},openProfile:id=>opened.push(id),load(){},
 });vm.runInContext(mergeSource+addition,context);
 return{context,button,root,state,opened,calls};
}
test('confirmed POST changes opponent into a selected Court Watch player and opens player page',async()=>{
 const player={id:'cw-test',name:'Test Player',userAdded:true},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:'Test Player'},c.button);
 assert.equal(c.calls[0].options.method,'POST');assert.equal(c.state.data.players[0].id,player.id);assert.equal(c.state.selected.has(player.id),true);assert.deepEqual(c.opened,[player.id]);assert.equal(c.button.disabled,false);assert.equal(c.state.data.tournaments.length,0);assert.equal(c.state.data.personalProjectionComplete,false);
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
 assert.equal(c.state.data.players.length,0,'unconfirmed POST must not add membership');
 await c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);assert.equal(c.calls.length,1);
 c.context.location.hash='#calendar';release({ok:true,json:async()=>({added:true,playerId:'cw-test',player:{id:'cw-test',name:'Test Player'}})});
 await first;assert.equal(c.state.data.players.length,1);assert.equal(c.opened.length,0);
});
test('normal reload retains a D1-added player absent from static JSON and their stored entries',async()=>{
 const person={id:'cw-test',name:'Test Player',userAdded:true},ctx={console,Map,Set,Promise,Date,circuit:m=>m.circuit||"fitp",normalizeMatchProjection:x=>x,state:{data:{players:[],tournaments:[]},selected:new Set()},loadRunning:false,uiSelectionRestored:true,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),cachedData:()=>null,saveCachedData(){},saveUiState(){},syncLabel(){},renderIfDataChanged(){},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,iso:d=>d.toISOString().slice(0,10),add:(d,n)=>new Date(+d+n*86400000),
  apiProjection:async()=>({generatedAt:'2026-10-01T00:00:00Z',players:[{id:'static-player',name:'Static Player'},person],tournaments:[{playerId:person.id,competitionId:'J30',circuit:'itf'}],matches:[]}),
  v3json:async name=>name==='players.json'?{generatedAt:'2026-10-06T00:00:00Z',players:[{id:'static-player',name:'Static Player'}]}:name==='tournaments.json'?{generatedAt:'2026-10-06T00:00:00Z',tournaments:[]}:{} };
 ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);ctx.PLAYER_GROUP='main';vm.runInContext(mergeSource+loader,ctx);await ctx.load();
 assert.equal(ctx.state.data.players.some(p=>p.id===person.id),true);assert.equal(ctx.state.data.tournaments.some(t=>t.playerId===person.id),true);assert.equal(ctx.state.data.personalProjectionComplete,true);
});

test('confirmed membership opens and caches immediately while enrichment is still pending',async()=>{
 const player={id:'cw-test',name:'Test Player',club:'Tennis Club Lecco'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 let release,refreshes=0,saved=0;
 c.context.fetchProjection=()=>{refreshes++;return new Promise(resolve=>release=resolve)};
 c.context.saveCachedData=()=>{saved++};
 c.state.data.matches=[{id:'known',playerId:'other',circuit:'tennis-europe',score:'6-4 6-3'}];
 await c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);
 assert.equal(c.state.data.players[0].club,'Tennis Club Lecco');assert.deepEqual(c.opened,[player.id]);assert.equal(saved,1);assert.equal(refreshes,1);assert.equal(c.state.data.matches[0].id,'known');
 assert.equal(c.button.textContent,'Apri giocatore');assert.equal(c.button.disabled,false);
 release({playerId:player.id,group:'main',players:[player],tournaments:[],matches:[]});
});
test('Others addition is immediately interactive without a blocking projection request',async()=>{
 const player={id:'cw-test',name:'Test Player'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});c.context.PLAYER_GROUP='others';let refreshed=0;
 c.context.apiProjection=()=>{throw Error('blocking projection must not run')};c.context.fetchProjection=()=>{refreshed++;return new Promise(()=>{})};
 await c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);
 assert.equal(c.state.data.players[0].id,player.id);assert.equal(c.state.selected.has(player.id),true);assert.equal(refreshed,1);assert.deepEqual(c.opened,[player.id]);
});
test('shared profile button keeps its new remove action and label after addition',async()=>{
 const player={id:'cw-test',name:'Test Player'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});let removed='';
 const start=source.indexOf('  const remove = $("removeProfilePlayer");'),end=source.indexOf('  if (profileFilterPlayerId',start);
 c.button.setAttribute=()=>{};c.context.$=id=>id==='removeProfilePlayer'?c.button:c.root;c.context.requestPlayerRemoval=id=>{removed=id};
 vm.runInContext('function activateRemoval(id){'+source.slice(start,end)+'}',c.context);
 c.context.route=()=>c.context.activateRemoval(player.id);
 await c.context.addCourtWatchPlayerFromUi({identity:'101'},c.button);
 assert.equal(c.button.textContent,'Rimuovi giocatore');assert.equal(c.button.disabled,false);c.button.onclick();assert.equal(removed,player.id);
});
test('targeted enrichment starts during an older full load and ignores late replies after removal or group switch',async()=>{
 for(const changed of ['removed','group']){
  const c=context(null),player={id:'cw-test',userAdded:true};c.state.data.players=[player];c.context.loadRunning=true;
  c.context.activeLoadCompletion=new Promise(()=>{});let release,url;
  c.context.load=()=>{throw Error('full reload must not run')};
  c.context.fetchProjection=(value)=>{url=value;return new Promise(resolve=>release=resolve)};
  const request=c.context.refreshAfterPlayerAddition(1,'main',player.id);
  assert.ok(url.endsWith('/app-snapshot?playerId=cw-test'));
  if(changed==='removed')c.context.removedCourtWatchPlayers.add(player.id);else c.context.PLAYER_GROUP='others';
  release({group:'main',playerId:player.id,players:[player],tournaments:[{playerId:player.id}],matches:[]});await request;
  assert.equal(c.state.data.tournaments.length,0);
 }
});
test('targeted snapshots preserve other players and history, accept empty entries and reject another player',async()=>{
 const c=context(null),player={id:'cw-test',userAdded:true};
 c.state.data.players=[player,{id:'other'}];c.state.data.matches=[{id:'old-match',playerId:'cw-test',circuit:'tennis-europe'},{id:'other-match',playerId:'other',circuit:'tennis-europe'}];
 c.state.data.tournaments=[{id:'past',playerId:player.id,startDate:'2026-09-01'},{id:'withdrawn',playerId:player.id,startDate:'2026-11-01'},{id:'other',playerId:'other'}];
 c.context.fetchProjection=async()=>({group:'main',playerId:player.id,players:[{...player,club:'Club'}],tournaments:[],matches:[]});
 await c.context.refreshAfterPlayerAddition(1,'main',player.id);
 assert.equal(c.state.data.players[0].club,'Club');assert.equal(c.state.data.players[1].id,'other');
 assert.deepEqual(Array.from(c.state.data.tournaments,t=>t.id),['past','other']);assert.equal(c.state.data.matches.length,2);
 assert.ok(c.state.data.personalEnrichedPlayerIds.includes(player.id));
 c.context.fetchProjection=async()=>({group:'main',playerId:player.id,players:[{id:'foreign'}],tournaments:[],matches:[]});
 await assert.rejects(c.context.refreshAfterPlayerAddition(2,'main',player.id),/Snapshot del giocatore errato/);
});
test('older Worker response is scoped locally during rollout and an enriched empty player stops showing pending',async()=>{
 const c=context(null);c.state.data.players=[{id:'a',userAdded:true},{id:'b'}];c.state.data.personalProjectionComplete=false;
 c.context.fetchProjection=async()=>({group:'main',players:[{id:'a'},{id:'b'}],tournaments:[{playerId:'b',id:'foreign'}],matches:[]});
 await c.context.refreshAfterPlayerAddition(1,'main','a');assert.equal(c.state.data.tournaments.length,0);assert.ok(c.state.data.personalEnrichedPlayerIds.includes('a'));
 const start=source.indexOf('function playerTournamentsEmptyHtml('),end=source.indexOf('function renderProfile(id)',start);vm.runInContext(source.slice(start,end),c.context);
 assert.ok(c.context.playerTournamentsEmptyHtml('a').includes('Nessun torneo pubblicato'));
});
test('concurrent added players merge independently and a newer request for the same player wins',async()=>{
 const c=context(null);c.state.data.players=[{id:'a'},{id:'b'}];const pending=[];
 c.context.fetchProjection=url=>new Promise(resolve=>pending.push({url,resolve}));
 const a=c.context.refreshAfterPlayerAddition(1,'main','a'),b=c.context.refreshAfterPlayerAddition(2,'main','b'),fresh=c.context.refreshAfterPlayerAddition(3,'main','a');
 for(const [i,id,label] of [[1,'b','B'],[2,'a','fresh'],[0,'a','old']])pending[i].resolve({group:'main',playerId:id,players:[{id,club:label}],tournaments:[{id,playerId:id}],matches:[]});
 await Promise.all([a,b,fresh]);assert.equal(c.state.data.players.find(p=>p.id==='a').club,'fresh');assert.equal(c.state.data.players.find(p=>p.id==='b').club,'B');assert.equal(c.state.data.tournaments.length,2);
});
test('home player without matches opens immediately even after the transient confirmation is gone',async()=>{
 const c=context(null);c.context.profileNavigationEpoch=0;c.state.initialMatchProjectionPending=true;c.state.data.matches=[];c.state.data.players=[{id:'new',userAdded:true,membershipPending:true}];
 let release;c.context.initialProjectionRequest=new Promise(resolve=>release=resolve);
 const start=source.indexOf('function hasAvailablePlayerProfile('),end=source.indexOf('async function openCurrentOpponent(',start);vm.runInContext(source.slice(start,end),c.context);
 assert.equal(c.context.confirmedCourtWatchPlayers.size,0);
 await c.context.openProfile('new');assert.equal(c.context.location.hash,'player/new');
 c.context.location.hash='#players';const opening=c.context.openProfile('other');assert.equal(c.context.location.hash,'#players');release();await opening;assert.equal(c.context.location.hash,'#players');
 c.context.removedCourtWatchPlayers.add('new');await c.context.openProfile('new');assert.equal(c.context.location.hash,'#players');
});
test('profile route renders an available player without waiting for matches',()=>{
 const start=source.indexOf('  if (player && (!state.data'),end=source.indexOf('  if (currentOpponent)',start);
 const ctx={state:{data:{players:[{id:'new'}],matches:[]},initialMatchProjectionPending:true},removedCourtWatchPlayers:new Set(),player:['#player/new','new'],location:{hash:'#player/new'},requestedHash:'#player/new',initialProjectionRequest:new Promise(()=>{}),load(){throw Error('must not load')},route(){},Promise,decodeURIComponent};
 vm.createContext(ctx);const helper=source.slice(source.indexOf('function shouldKeepPlayerRefreshPreview('),source.indexOf('async function openProfile('));
 vm.runInContext(helper+'function checkRoute(){'+source.slice(start,end)+'return "render";} ',ctx);
 assert.equal(ctx.checkRoute(),'render');
 ctx.location.pathname='/v3.html';ctx.location.search='';ctx.window={courtWatchRefreshPreview:{route:'/v3.html#player/new'}};assert.equal(ctx.checkRoute(),undefined);
 delete ctx.window.courtWatchRefreshPreview;assert.equal(ctx.checkRoute(),'render');
 ctx.state.data.players=[];assert.equal(ctx.checkRoute(),undefined);
});
test('cold reload discards a partial old cache and first renders all personal tournaments together',async()=>{
 const person={id:'cw-test',name:'Test Player',userAdded:true},renders=[],partial={players:[person],tournaments:[]};
 let release;
 const ctx={console,Map,Set,Promise,Date,circuit:m=>m.circuit||"fitp",normalizeMatchProjection:x=>x,state:{data:null,selected:new Set()},loadRunning:false,uiSelectionRestored:false,confirmedCourtWatchPlayers:new Map(),FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),cachedData:()=>partial,saveCachedData(){},saveUiState(){},syncLabel(){},renderIfDataChanged(){renders.push(ctx.state.data.tournaments.length)},restoreUiScroll(){},agendaKey:m=>m.id,mergeAgenda:a=>a,iso:d=>d.toISOString().slice(0,10),add:(d,n)=>new Date(+d+n*86400000),
 apiProjection:()=>new Promise(resolve=>release=resolve),
 v3json:async name=>name==='players.json'?{players:[{id:'base',name:'Base'}]}:name==='tournaments.json'?{tournaments:[]}:{}};
 ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);ctx.PLAYER_GROUP='main';vm.runInContext(mergeSource+loader,ctx);const loading=ctx.load();
 assert.equal(renders.length,0);
 release({generatedAt:'2026-10-07T21:00:00Z',players:[person],tournaments:[{playerId:person.id,name:'Cantù'}],matches:[]});
 await loading;assert.ok(renders.length>0);assert.ok(renders.every(count=>count===1));assert.equal(ctx.state.data.personalProjectionComplete,true);
});
test('calendar order uses canonical player names even when entry names use surname first',()=>{
 const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
 const group=source.slice(source.indexOf('function tournamentConcluded('),source.indexOf('function renderCalendar('));
 const ctx={state:{data:{players:[{id:'c',name:'Camilla Frigerio'},{id:'p',name:'Paolo Brambilla'},{id:'r',name:'Riccardo Galbiati'}],tournaments:[{playerId:'r',playerName:'GALBIATI RICCARDO',competitionId:'cantu'},{playerId:'p',playerName:'BRAMBILLA PAOLO',competitionId:'cantu'},{playerId:'c',playerName:'FRIGERIO CAMILLA',competitionId:'cantu'}]},selected:new Set(['c','p','r'])},readableText:x=>String(x||''),active:()=>true,tournamentKey:t=>t.competitionId,circuitRank:()=>0};
 ctx.iso=()=> '2026-10-12';ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);vm.runInContext(readable+group,ctx);
 assert.deepEqual(Array.from(ctx.groups()[0].players),['Camilla Frigerio','Paolo Brambilla','Riccardo Galbiati']);
});

test('calendar hides acceptance only for confirmed participant, leaving another player live',()=>{
 const helper=source.slice(source.indexOf('function tournamentConcluded('),source.indexOf('function groups('));
 const ctx={iso:()=> '2026-10-12'};ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);vm.runInContext(helper,ctx);
 assert.equal(ctx.effectiveAcceptanceLabel({calendarListLabel:'MD-3',calendarState:'draw_confirmed'}),'');
 assert.equal(ctx.effectiveAcceptanceLabel({calendarListLabel:'Q-4',entryStatus:'official_draw'}),'');
 assert.equal(ctx.effectiveAcceptanceLabel({calendarListLabel:'MD-3',drawUrl:'https://example.org/draw'}),'MD-3');
});

test('confirmed durable addition remains successful when snapshot refresh fails',async()=>{
 const player={id:'cw-test',name:'Test Player'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 c.context.fetchProjection=async()=>{throw Error('snapshot unavailable')};
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:'Test Player'},c.button);
 assert.equal(c.state.data.players[0].id,player.id);assert.equal(c.state.selected.has(player.id),true);assert.equal(c.state.data.personalProjectionComplete,false);assert.deepEqual(c.opened,[player.id]);assert.equal(c.button.disabled,false);
});

test('protected app with external base navigates after addition on its own origin',async()=>{
 const player={id:'cw-test',name:'Test Player'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})});
 c.context.location.href='https://courtwatch-app-api.ckrk9ggvrb.workers.dev/app#opponent-profile/fitp%7Cid%3A5754459584/Test/-';
 const urls=[];c.context.history.replaceState=(_state,_title,value)=>{const url=new URL(value,'https://png8nftp9y-alt.github.io/');assert.equal(url.origin,'https://courtwatch-app-api.ckrk9ggvrb.workers.dev');urls.push(url.href);c.context.location.hash=url.hash;};
 await c.context.addCourtWatchPlayerFromUi({identity:'fitp|id:5754459584',name:player.name},c.button);
 assert.deepEqual(urls,['https://courtwatch-app-api.ckrk9ggvrb.workers.dev/app#player/cw-test']);assert.deepEqual(c.opened,[player.id]);assert.equal(c.state.selected.has(player.id),true);assert.equal(c.root.error,undefined);
});


test('mixed-case source surnames are readable in search, observed list and player hero',()=>{
 const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
 const ctx={readableText:x=>String(x||'')};ctx.refreshKnownMatchResults=()=>{};ctx.applyKnownResultUpdates=x=>x;vm.createContext(ctx);vm.runInContext(readable,ctx);
 assert.equal(vm.runInContext('readablePerson("Anna PIZZI")',ctx),'Anna Pizzi');
 assert.equal(vm.runInContext('readablePerson("Anna ARGINELLI")',ctx),'Anna Arginelli');
 assert.equal(vm.runInContext('readablePerson("Anna McDonald")',ctx),'Anna McDonald');
 assert.ok(source.includes('<h2>${esc(readablePerson(p.name))}</h2>'));
});

test('new player never reports no tournaments while enrichment or restored partial cache is pending',()=>{
 const c=context(null),start=source.indexOf('function playerTournamentsEmptyHtml('),end=source.indexOf('function renderProfile(id)',start);
 vm.runInContext(source.slice(start,end),c.context);
 c.state.data.players=[{id:'new',userAdded:true}];c.state.data.personalProjectionComplete=false;
 assert.match(c.context.playerTournamentsEmptyHtml('new'),/role="status"/);
 assert.doesNotMatch(c.context.playerTournamentsEmptyHtml('new'),/Nessun torneo/);
 c.state.data.personalProjectionComplete=true;c.context.confirmedCourtWatchPlayers.set('new',{});
 assert.doesNotMatch(c.context.playerTournamentsEmptyHtml('new'),/Nessun torneo/);
 c.context.confirmedCourtWatchPlayers.delete('new');assert.match(c.context.playerTournamentsEmptyHtml('new'),/Nessun torneo/);
 const signature=source.slice(source.indexOf('function renderDataSignature('),source.indexOf('function renderIfDataChanged('));
 c.context.iso=d=>d.toISOString().slice(0,10);vm.runInContext(signature,c.context);
 assert.notEqual(c.context.renderDataSignature({...c.state.data,personalProjectionComplete:false}),c.context.renderDataSignature({...c.state.data,personalProjectionComplete:true}),'finished empty response must repaint the pending view');
});

test('refresh keeps the saved profile until match projection is ready without blocking new home links',()=>{
 const ctx={state:{initialMatchProjectionPending:true,data:{players:[{id:'new'}],matches:[]}},location:{pathname:'/v3.html',search:'?group=others',hash:'#player/new'},window:{courtWatchRefreshPreview:{route:'/v3.html?group=others#player/new'}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function shouldKeepPlayerRefreshPreview('),source.indexOf('function hasAvailablePlayerProfile(')),ctx);
 assert.equal(ctx.shouldKeepPlayerRefreshPreview('new'),true);
 ctx.state.data.matches=[{playerId:'new'}];assert.equal(ctx.shouldKeepPlayerRefreshPreview('new'),false);
 ctx.state.data.matches=[];ctx.state.initialMatchProjectionPending=false;assert.equal(ctx.shouldKeepPlayerRefreshPreview('new'),false);
 ctx.state.initialMatchProjectionPending=true;ctx.location.hash='#players';assert.equal(ctx.shouldKeepPlayerRefreshPreview('new'),false);
 ctx.location.hash='#player/new';delete ctx.window.courtWatchRefreshPreview;assert.equal(ctx.shouldKeepPlayerRefreshPreview('new'),false);
});

test('pending synchronized player shows loading on a previously complete snapshot',()=>{
 const ctx={state:{data:{personalProjectionComplete:true,personalEnrichedPlayerIds:['new'],players:[{id:'new',membershipPending:true}]}},confirmedCourtWatchPlayers:new Map()};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function playerTournamentsEmptyHtml('),source.indexOf('function renderProfile(')),ctx);
 assert.match(ctx.playerTournamentsEmptyHtml('new'),/role="status"/);
 assert.doesNotMatch(ctx.playerTournamentsEmptyHtml('new'),/Nessun torneo/);
 ctx.state.data.players[0].membershipPending=false;assert.match(ctx.playerTournamentsEmptyHtml('new'),/Nessun torneo/);
});

test('confirmed addition starts exactly one targeted read before local cache serialization or rendering',async()=>{
 const player={id:'cw-test',name:'Test Player'},c=context({ok:true,json:async()=>({added:true,playerId:player.id,player})}),events=[];
 c.context.fetchProjection=url=>{assert.ok(c.state.data.players.some(p=>p.id===player.id));assert.ok(c.state.selected.has(player.id));events.push('snapshot');assert.ok(url.endsWith('playerId=cw-test'));return new Promise(()=>{});};
 c.context.saveCachedData=()=>events.push('cache');c.context.renderHome=()=>events.push('render');c.context.route=()=>events.push('profile');
 await c.context.addCourtWatchPlayerFromUi({identity:'101',name:player.name},c.button);
 assert.deepEqual(events,['snapshot','cache','render','profile']);assert.equal(c.button.disabled,false);assert.equal(c.state.data.personalProjectionComplete,false);
});
