import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const id='5C795C29-2EB4-40E7-B1EB-F49A08231149',t={circuit:'tennis-europe',competitionId:id,catalogueOnly:true};
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function context(){
 const slot={dataset:{internationalDrawLinks:'tennis-europe|'+id},outerHTML:'',textContent:'',append(){}};
 const ctx={URL,URLSearchParams,Map,Set,Date,AbortSignal,Response,PRIVATE_API:'/app/api',privateApiOptions:x=>x,esc,circuit:t=>t.circuit,readableText:v=>String(v||''),state:{data:{players:[],tournaments:[],matches:[]},selected:new Set()},document:{querySelectorAll:()=>[slot],createElement:()=>({})},navigator:{userAgent:'Macintosh'}};
 vm.createContext(ctx);
 vm.runInContext(js.slice(js.indexOf('function agendaGenderClass('),js.indexOf('function agendaRoundCode(')),ctx);
 vm.runInContext(js.slice(js.indexOf('function tournamentOfficialUrl('),js.indexOf('function tournamentAcceptanceUrl(')),ctx);
 vm.runInContext(js.split('// FITP_INLINE_DRAW_LINKS_START')[1].split('// FITP_INLINE_DRAW_LINKS_END')[0],ctx);
 return {ctx,slot};
}
function seed(ctx,draws){ctx.rows=draws;vm.runInContext(`internationalDrawCatalogueCache.set('tennis-europe|${id}',{draws:rows,complete:true,savedAt:Date.now()})`,ctx);}
const draws=[{event:'BS14',drawId:'1',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/1`},{event:'GD14',drawId:'2',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/2`}];
test('catalog-only tournament shows every available draw; adding an observed participant switches the same cached tournament to observed draws',()=>{
 const {ctx}=context();seed(ctx,draws);
 let html=ctx.tournamentDrawLinks(t,[]);assert.match(html,/>SM14 /);assert.match(html,/>DF14 /);
 ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...t,playerId:'x',draws:['BS14']}];
 html=ctx.tournamentDrawLinks(t,[]);assert.match(html,/>SM14 /);assert.doesNotMatch(html,/>DF14 /);
 assert.equal(ctx.state.data.tournaments.length,1);assert.equal(ctx.state.data.matches.length,0);
});
test('calendar selection cannot broaden the draw catalog, and matches alone prove observed participation',()=>{
 const {ctx}=context();seed(ctx,draws);ctx.state.data.players=[{id:'x'}];ctx.state.data.matches=[{...t,playerId:'x',event:'GD14',drawUrl:draws[1].drawUrl}];ctx.state.selected=new Set();
 const html=ctx.tournamentDrawLinks(t,[]);assert.match(html,/>DF14 /);assert.doesNotMatch(html,/>SM14 /);
});
test('nonparticipating observed players and same-name tournaments in another circuit do not restrict this tournament',()=>{
 const {ctx}=context();seed(ctx,draws);ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...t,playerId:'x',circuit:'fitp',draws:['BS14']}];
 assert.match(ctx.tournamentDrawLinks(t,[]),/>DF14 /);
});
test('late all-draw response cannot restore hidden categories after player addition',async()=>{
 const {ctx,slot}=context();let finish;ctx.fetch=async()=>new Promise(resolve=>finish=()=>resolve(Response.json({circuit:t.circuit,competitionId:id,complete:true,draws})));
 const pending=ctx.loadInternationalTournamentDrawLinks(t);
 ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...t,playerId:'x',draws:['BS14']}];finish();await pending;
 assert.match(slot.outerHTML,/>SM14 /);assert.doesNotMatch(slot.outerHTML,/>DF14 /);
});
test('removing the last observed participant restores the full public list with no stale personal filter',()=>{
 const {ctx}=context();seed(ctx,draws);ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...t,playerId:'x',draws:['BS14']}];assert.doesNotMatch(ctx.tournamentDrawLinks(t,[]),/>DF14 /);
 ctx.state.data.players=[];assert.match(ctx.tournamentDrawLinks(t,[]),/>DF14 /);
});
test('FITP uses the same live scope and keeps its public catalogue independent of participants',()=>{
 const {ctx}=context();const fitp={...t,circuit:'fitp'},base='https://www.fitp.it/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3?tournamentId=222&phaseId=CFE780A3-8CF2-4684-A51D-B1B3B0EECA0C';
 const rows=[{categoryCode:'SM14',label:'SM14',url:base},{categoryCode:'DF14',label:'DF14',url:base.replace('222','223')}];
 assert.match(ctx.fitpObservedDrawHtml(fitp,rows),/>DF14/);
 ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...fitp,playerId:'x',subscriptionRegistrations:[{category:'SM14'}]}];
 const html=ctx.fitpObservedDrawHtml(fitp,rows);assert.match(html,/>SM14/);assert.doesNotMatch(html,/>DF14/);
});
test('catalog route always resolves an existing observed group before cached metadata',async()=>{
 const {ctx}=context();let calls=0,current=[],rendered=[];const node={classList:{add(){}},innerHTML:'',hidden:false};
 ctx.$=()=>node;ctx.location={hash:'#catalog-tournament/tennis-europe/'+id};ctx.groups=selected=>{assert.equal(selected,false);return current;};ctx.tournamentKey=row=>row.circuit+'|'+row.competitionId;ctx.tournamentSearchRequest=async()=>{calls++;return {tournament:t}};ctx.renderTournament=key=>rendered.push({key,observed:current.length});
 vm.runInContext('const catalogueTournamentPages=new Map();'+js.slice(js.indexOf('async function renderCatalogueTournament('),js.indexOf('async function renderTournamentSearchPage(')),ctx);
 await ctx.renderCatalogueTournament(t.circuit,id);assert.equal(calls,1);
 current=[{...t,people:[{playerId:'x'}],catalogueOnly:false}];await ctx.renderCatalogueTournament(t.circuit,id);assert.equal(calls,1);assert.equal(rendered[1].observed,1);assert.equal(rendered[0].key,rendered[1].key);
});

test('public catalogue draw fields cannot leak into observed-only scope while participation metadata is incomplete',()=>{
 const {ctx}=context();seed(ctx,draws);ctx.state.data.players=[{id:'x'}];ctx.state.data.tournaments=[{...t,playerId:'x'}];ctx.state.data.matches=[{...t,playerId:'x',event:'BS14'}];
 const html=ctx.tournamentDrawLinks({...t,draws:['BS14','GD14']},[]);assert.match(html,/>SM14 /);assert.doesNotMatch(html,/>DF14 /);
});

test('no draw status or retry message is rendered while empty, unavailable or loading',async()=>{
 const {ctx,slot}=context();assert.doesNotMatch(ctx.tournamentDrawLinks(t,[]),/Caricamento|Nessun|inventario|aggiornamento|disponibili|Riprova/);
 seed(ctx,[]);assert.doesNotMatch(ctx.tournamentDrawLinks(t,[]),/Caricamento|Nessun|inventario|aggiornamento|disponibili|Riprova/);
 vm.runInContext('internationalDrawCatalogueCache.clear()',ctx);ctx.fetch=async()=>new Response('',{status:503});await ctx.loadInternationalTournamentDrawLinks(t);assert.equal(slot.textContent,'');
 assert.match(fs.readFileSync(new URL('../../v3.css',import.meta.url),'utf8'),/\.tournamentHero \.tournamentDraws\[hidden\]\{display:none!important\}/);
 assert.match(js,/<div class="tournamentDraws"\$\{\/<a\\s/);
});
