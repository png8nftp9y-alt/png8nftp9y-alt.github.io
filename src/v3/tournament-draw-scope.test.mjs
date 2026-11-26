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

test('Szentes: a qualifying-only entry is enriched by exact acquired main and doubles participation, never by unrelated draws',()=>{
 const {ctx}=context();const competitionId='J-J30-HUN-2026-002',sz={circuit:'itf',competitionId,sourceUrl:'https://www.itftennis.com/en/tournament/j30-szentes/hun/2026/j-j30-hun-2026-002/'};
 ctx.state.data.players=[{id:'martina-danesi',name:'Martina Danesi',worldTennisId:'800792690'}];ctx.state.data.tournaments=[{...sz,playerId:'martina-danesi',draws:['Girls Singles Qualifying']}];
 ctx.draws=['G-S-Q-KO','G-S-M-KO','G-D-M-KO','B-S-M-KO'].map(event=>({event,drawUrl:sz.sourceUrl+'draws-and-results/',participants:[{id:event[0]==='G'?'800792690':'800123456',name:event[0]==='G'?'Martina Danesi':'Other Player'}]}));
 vm.runInContext(`internationalDrawCatalogueCache.set('itf|${competitionId}',{draws,complete:true,savedAt:Date.now()})`,ctx);
 const html=ctx.tournamentDrawLinks(sz,[]);assert.match(html,/>SF18 Qualificazioni/);assert.match(html,/>SF18 Tabellone principale/);assert.match(html,/>DF18 Tabellone principale/);assert.doesNotMatch(html,/>SM18/);
});
test('Europe RR: two observed players in different groups create two precise links, unobserved groups stay hidden',()=>{
 const {ctx}=context();ctx.state.data.players=[{id:'a',name:'First Player'},{id:'b',name:'Second Player'}];ctx.state.data.tournaments=[{...t,playerId:'a',draws:['BS12']},{...t,playerId:'b',draws:['BS12']}];
 const rows=['A','B','C'].map((group,i)=>({event:'BS12 - Group '+group,group,drawId:String(i+1),drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/${i+1}`,participants:[{id:'',name:['First Player','Second Player','Third Player'][i]}]}));seed(ctx,rows);
 const html=ctx.tournamentDrawLinks(t,[]);assert.match(html,/Round Robin - Gruppo A/);assert.match(html,/Round Robin - Gruppo B/);assert.doesNotMatch(html,/Gruppo C/);assert.equal((html.match(/Round Robin - Gruppo /g)||[]).length,4);assert.match(html,/draw\/1/);assert.match(html,/draw\/2/);
 // The generic entry must not add an invented main draw alongside acquired groups.
 assert.doesNotMatch(html,/Tabellone principale/);
});
test('full-text Europe age and per-group keys work without a compact category code',()=>{
 const {ctx}=context();seed(ctx,[{event:'Boys Singles 12 - Group A',drawId:'1',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/1`},{event:'Boys Singles 12 - Group B',drawId:'2',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/2`}]);
 const html=ctx.tournamentDrawLinks(t,[]);assert.equal((html.match(/<a /g)||[]).length,2);assert.match(html,/Gruppo A/);assert.match(html,/Gruppo B/);assert.doesNotMatch(html,/Tabellone principale/);
});
test('observed tournament still loads publication metadata and requests participants',async()=>{
 const {ctx,slot}=context();ctx.state.data.players=[{id:'a',name:'First Player'}];ctx.state.data.tournaments=[{...t,playerId:'a',draws:['BS12']}];let request='';
 ctx.fetch=async url=>{request=url;return Response.json({circuit:t.circuit,competitionId:id,complete:true,draws:[{event:'BS12 - Group A',group:'A',drawId:'1',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/1`,participants:[{name:'First Player'}]}]});};
 await ctx.loadInternationalTournamentDrawLinks(t);assert.match(request,/withParticipants=1/);assert.match(slot.outerHTML,/Round Robin - Gruppo A/);
});
test('native ID mismatch never associates a namesake draw',()=>{
 const {ctx}=context();ctx.state.data.players=[{id:'a',name:'Same Name',profileSync:{tennisEurope:{profileId:'11111111-1111-1111-1111-111111111111'}}}];ctx.state.data.tournaments=[{...t,playerId:'a',draws:[]}];seed(ctx,[{event:'BS12 - Group C',group:'C',drawId:'3',drawUrl:`https://te.tournamentsoftware.com/tournament/${id}/draw/3`,participants:[{id:'22222222-2222-2222-2222-222222222222',name:'Same Name'}]}]);assert.doesNotMatch(ctx.tournamentDrawLinks(t,[]),/<a /);
});
test('ITF RR group URLs open the exact protected group view and never the generic main draw',()=>{
 const {ctx}=context(),itf={circuit:'itf',competitionId:'J-J30-HUN-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-szentes/hun/2026/j-j30-hun-2026-002/'};
 const rows=['A','B'].map(group=>({event:'G-S-M-RR',group,drawUrl:'/app/api/tournament-draw-view?'+new URLSearchParams({circuit:'itf',competitionId:itf.competitionId,event:'G-S-M-RR',group})}));
 const html=ctx.internationalTournamentDrawHtml(itf,rows);assert.equal((html.match(/<a /g)||[]).length,2);assert.match(html,/group=A/);assert.match(html,/group=B/);assert.match(html,/tournament-draw-view/);assert.doesNotMatch(html,/Tabellone principale/);
});
test('real archived Szentes evidence identifies Danesi in RR even when the frontend has only her Europe profile',()=>{
 const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/szentes-danesi-draw-evidence.json',import.meta.url),'utf8'));
 assert.equal(evidence.players[0].id,'800792690');assert.equal(evidence.event,'G-S-M-RR');assert.equal(evidence.acquisitionProof.complete,true);
 const {ctx}=context(),sz={circuit:'itf',competitionId:evidence.competitionId,sourceUrl:'https://www.itftennis.com/en/tournament/j30-szentes/hun/2026/j-j30-hun-2026-002/'};
 ctx.state.data.players=[{id:'martina-danesi',name:'Martina Danesi',profileSync:{tennisEurope:{profileId:'46010E1A-5310-41AB-95AF-6D1B0BC54EB6'}}}];ctx.state.data.tournaments=[{...sz,playerId:'martina-danesi',draws:['Girls Singles Qualifying']}];
 // The label A here is a test group, not a claim about Danesi's official group.
 ctx.rows=[{event:evidence.event,group:'A',participants:evidence.players,drawUrl:'/app/api/tournament-draw-view?'+new URLSearchParams({circuit:'itf',competitionId:evidence.competitionId,event:evidence.event,group:'A'})}];vm.runInContext(`internationalDrawCatalogueCache.set('itf|${evidence.competitionId}',{draws:rows,savedAt:Date.now()})`,ctx);
 assert.match(ctx.tournamentDrawLinks(sz,[]),/Round Robin - Gruppo A/);
});
