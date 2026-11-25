import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8'),html=readFileSync(new URL('../../v3.html',import.meta.url),'utf8');
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const event={id:'manual-12345678-1234-1234-1234-123456789abc',name:'ITF <Scuola>',location:'Monza',color:'purple',startDate:'2026-12-01',endDate:'2026-12-03',playerIds:['p1','p2']};
function harness(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,addEventListener(){},showModal(){this.open=true},close(){this.open=false},querySelectorAll(){return[]},focus(){},reset(){}});return nodes.get(id)};
 const values=new Map(Object.entries({...event,playerIds:event.playerIds}));const form=node('calendarEventForm');form.elements={name:{focus(){}},startDate:{value:''},endDate:{value:''}};
 let saved=0,renders=0,events=[],requests=[];
 const ctx={wireCalendarEventLocation(){},calendarEventCity:t=>t.location,displayDate:x=>x,state:{data:{players:[{id:'p1',name:'Anna'},{id:'p2',name:'Luca'}],tournaments:[{id:'official',playerId:'p1'}]},month:new Date('2026-12-01')},PLAYER_GROUP:'main',$:node,esc:escape,iso:()=>event.startDate,PRIVATE_API:'/app/api',crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},privateApiOptions:(options,group)=>({...options,group}),AbortSignal,FormData:class{get(k){return values.get(k)}getAll(k){return values.get(k)||[]}},saveCachedData:async()=>{saved++},renderIfDataChanged:()=>{renders++},fetch:async(url,options)=>{requests.push({url,options});if(options.method==='POST')events=[event];return {ok:true,json:async()=>({events})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function wireCalendarEvents()'),source.indexOf('function wire()')),ctx);ctx.wireCalendarEvents();
 return{ctx,node,values,requests,counts:()=>({saved,renders})};
}
test('calendar event controls follow players and precede month; form collects dates, place, players and only federal camps',()=>{
 assert.ok(html.indexOf('id="playerFilters"')<html.indexOf('id="addCalendarEvent"'));
 assert.ok(html.indexOf('id="addCalendarEvent"')<html.indexOf('class="calendarMonthNav"'));
 assert.ok(html.indexOf('id="playerFilters"')<html.indexOf('id="removeCalendarEvent"'));
 assert.ok(html.indexOf('id="removeCalendarEvent"')<html.indexOf('class="calendarMonthNav"'));
 for(const field of ['name','location','startDate','endDate','color'])assert.match(html,new RegExp('name="'+field+'"'));
 assert.match(html,/option value="purple"/);const types=html.slice(html.indexOf('<select name="color"'),html.indexOf('</select>',html.indexOf('<select name="color"')));for(const color of ['fitp','tennis-europe','itf','red','gray'])assert.ok(!types.includes('value="'+color+'"'));
});
test('save projects all involved players immediately without touching automatic tournaments or creating fake matches',async()=>{
 const x=harness();x.node('addCalendarEvent').onclick();x.node('calendarEventLocation').dataset={lat:'45.5',lon:'9.2'};x.node('calendarEventLocation').value='Monza';await x.node('calendarEventForm').onsubmit({preventDefault(){}});
 assert.equal(JSON.parse(x.requests[0].options.body).requestId,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');assert.equal(x.requests[0].options.group,'main');assert.equal(x.requests[0].options.method,'POST');assert.deepEqual(JSON.parse(x.requests[0].options.body).playerIds,['p1','p2']);
 const rows=x.ctx.state.data.tournaments;assert.equal(rows.length,3);assert.equal(rows[0].id,'official');assert.equal(rows[1].eventColor,'purple');assert.equal(rows[1].competitionId,rows[2].competitionId);assert.equal(rows[1].playerId,'p1');assert.equal(rows[2].playerId,'p2');assert.equal(rows[1].matches,undefined);
 assert.equal(x.node('calendarEventDialog').open,false);assert.deepEqual(x.counts(),{saved:1,renders:1});
});
test('invalid range, missing players and group switch never send writes',async()=>{
 for(const kind of ['dates','players','group']){const x=harness();x.node('addCalendarEvent').onclick();if(kind==='dates')x.values.set('endDate','2026-01-01');if(kind==='players')x.values.set('playerIds',[]);if(kind==='group')x.ctx.PLAYER_GROUP='others';await x.node('calendarEventForm').onsubmit({preventDefault(){}});assert.equal(x.requests.length,0);assert.ok(x.node('calendarEventError').textContent);}
});
test('daily agenda uses event dates, escapes names and links both players and tournament without claiming a played match',()=>{
 const tournament={...event,eventColor:event.color,manualEvent:true,people:[{playerId:'p1',playerName:'Anna <test>'},{playerId:'p2',playerName:'Luca'}]};
 const ctx={wireCalendarEventLocation(){},calendarEventCity:t=>t.location,displayDate:x=>x,circuit:t=>t.circuit||'manual',state:{selected:new Set(['p1','p2'])},esc:escape,groups:()=>[tournament],overlap:(t,a,b)=>t.startDate<=b&&t.endDate>=a,tournamentKey:()=>event.id};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('function wireCalendarEvents(')),ctx);
 const markup=ctx.manualCalendarAgendaHtml('2026-12-02');assert.match(markup,/data-open-tournament="manual-/);assert.match(markup,/data-open-player="p1"/);assert.match(markup,/data-open-player="p2"/);assert.match(markup,/ITF &lt;Scuola&gt;/);assert.match(markup,/Anna &lt;test&gt;/);assert.doesNotMatch(markup,/<Scuola>|6-0|Iscritto/);assert.equal(ctx.manualCalendarAgendaHtml('2026-12-04'),'');
});

test('daily manual events reuse the existing tournament index and preserve selected players',()=>{
 let calls=0;const t={...event,manualEvent:true,eventColor:event.color,people:[{playerId:'p1',playerName:'Anna'},{playerId:'p2',playerName:'Luca'}]},ctx={calendarEventCity:t=>t.location,displayDate:x=>x,circuit:t=>t.circuit||'manual',state:{selected:new Set(['p1'])},esc:escape,groups:()=>{calls++;return[t]},overlap:()=>true,tournamentKey:()=>event.id};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('function wireCalendarEvents(')),ctx);
 const html=ctx.manualCalendarAgendaHtml(event.startDate,[t]);assert.equal(calls,0);assert.match(html,/Anna/);assert.doesNotMatch(html,/Luca/);ctx.state.selected.clear();assert.equal(ctx.manualCalendarAgendaHtml(event.startDate,[t]),'');
 const render=source.slice(source.indexOf('function renderAgenda()'),source.indexOf('function tournamentKey('));
 assert.match(render,/createMatchTournamentResolver\(agendaTournaments\)/);assert.match(render,/manualCalendarAgendaHtml\(key, agendaTournaments\)/);
});

test('backdrop closes but a click inside keeps the form open',()=>{
 const x=harness(),d=x.node('calendarEventDialog'),handlers={};d.addEventListener=(type,fn)=>{handlers[type]=fn};d.getBoundingClientRect=()=>({left:10,right:100,top:10,bottom:100});x.ctx.wireCalendarEvents();
 d.open=true;handlers.click({target:d,clientX:50,clientY:50});assert.equal(d.open,true);handlers.click({target:d,clientX:5,clientY:50});assert.equal(d.open,false);
});
test('one-day save sends only one date value and selected coordinates; unselected place cannot save',async()=>{
 const x=harness();x.node('addCalendarEvent').onclick();x.values.set('endDate','');await x.node('calendarEventForm').onsubmit({preventDefault(){}});assert.equal(x.requests.length,0);
 const place=x.node('calendarEventLocation');place.value='Via Boccaccio 3, Monza';place.dataset={lat:'45.5918465',lon:'9.2770933'};await x.node('calendarEventForm').onsubmit({preventDefault(){}});
 const body=JSON.parse(x.requests[0].options.body);assert.equal(body.endDate,body.startDate);assert.equal(body.locationLat,45.5918465);assert.match(body.location,/Boccaccio/);
});
test('remove event updates all projections only after successful deletion',async()=>{
 for(const ok of [true,false]){const x=harness();vm.runInContext(source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('function wireCalendarEventLocation(')),x.ctx);x.ctx.location={hash:'#tournament/test'};
 x.ctx.state.data.tournaments.push({manualEvent:true,manualEventId:'mine'},{manualEvent:true,manualEventId:'other'});x.ctx.fetch=async()=>({ok});await x.ctx.removeCalendarEventFromPage({manualEventId:'mine'});
 assert.equal(x.ctx.state.data.tournaments.some(t=>t.manualEventId==='mine'),!ok);assert.ok(x.ctx.state.data.tournaments.some(t=>t.manualEventId==='other'));assert.equal(x.ctx.location.hash,ok?'calendar':'#tournament/test');}
});
test('geocoding selects address and map coordinates, then invalidates selection on edit',async()=>{
 const x=harness(),tasks=[],buttons=[{dataset:{placeIndex:'0'}}];let request='';x.ctx.setTimeout=fn=>{tasks.push(fn);return tasks.length};x.ctx.clearTimeout=()=>{};x.ctx.AbortController=AbortController;
 x.ctx.fetch=async url=>{request=url;return{ok:true,json:async()=>({features:[{properties:{name:'Tennis Monza',street:'Via Boccaccio',housenumber:'3',city:'Monza'},geometry:{coordinates:[9.27,45.59]}}]})}};
 vm.runInContext(source.slice(source.indexOf('function wireCalendarEventLocation('),source.indexOf('function wireCalendarEvents(')),x.ctx);
 const place=x.node('calendarEventLocation'),results=x.node('calendarEventLocationResults');results.querySelectorAll=()=>buttons;x.ctx.wireCalendarEventLocation(x.node('calendarEventDialog'));place.value='tennis monza';place.oninput();await tasks[0]();
 assert.match(request,/q=tennis%20monza&limit=5$/);buttons[0].onclick();assert.match(place.value,/Via Boccaccio 3/);assert.equal(place.dataset.lat,'45.59');assert.equal(place.dataset.lon,'9.27');assert.match(x.node('calendarEventLocationStatus').innerHTML,/openstreetmap.org/);
 place.value='altro';place.oninput();assert.equal(place.dataset.lat,'');
});

test('actual tournament page: federal camp has no draws, one date, real map and removal; normal tournament keeps draws',()=>{
 for(const color of ['purple','red']){
  const x=harness(),t={manualEvent:true,manualEventId:event.id,competitionId:event.id,name:'Raduno',eventColor:color,circuit:'manual',location:'Via Boccaccio 3',locationLat:45.59,locationLon:9.27,startDate:'2026-12-01',endDate:'2026-12-01',people:[],playerIds:[]};
  Object.assign(x.ctx,{groups:()=>[t],tournamentKey:()=>event.id,tournamentPageKey:event.id,circuit:()=> 'manual',openTournamentPlayerKeys:new Set(),saveUiState(){},tournamentOfficialUrl:()=>'',tournamentAcceptanceUrl:()=>'',tournamentPlace:()=>t.location,tournamentMapsUrl:()=>'',tournamentDrawLinks:()=>'',tournamentSurfaceLabel:()=>'',bindParticipantNavigation(){},location:{hash:''}});
  for(const node of [x.node('removeProfilePlayer')])node.setAttribute=()=>{};for(const id of ['homeView','profileView'])x.node(id).classList={add(){},remove(){}};
  x.node('profileContent').insertAdjacentHTML=function(_,markup){this.innerHTML+=markup};
  vm.runInContext(source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('function wireCalendarEventLocation('))+source.slice(source.indexOf('function renderTournament(key)'),source.indexOf('const renderProfileWithoutStats')),x.ctx);
  x.ctx.renderTournament(event.id);const markup=x.node('profileContent').innerHTML;
  assert.equal(markup.includes('Tabelloni:'),color!=='purple');assert.equal(x.node('removeProfilePlayer').textContent,'Rimuovi evento');assert.equal(x.node('editCalendarEventParticipants').hidden,false);assert.match(markup,/query=45.59,9.27/);assert.equal((markup.match(/2026-12-01/g)||[]).length,1);assert.doesNotMatch(markup,/Inserito manualmente|Evento manuale/);
 }
});

test('pencil editor loads checked players and replaces participants in all local projections',async()=>{
 const x=harness(),existing={...event,playerIds:['p1']};x.ctx.tournamentKey=()=>event.id;x.ctx.renderTournament=()=>{};
 x.ctx.state.data.tournaments.push({manualEvent:true,manualEventId:event.id,playerId:'p1'});x.values.set('playerIds',['p2']);
 x.ctx.fetch=async(url,options)=>{x.requests.push({url,options});return{ok:true,json:async()=>options.method==='PATCH'?{event:{...existing,playerIds:['p2']}}:{events:[existing]}}};
 vm.runInContext(source.slice(source.indexOf('async function openCalendarParticipants('),source.indexOf('function wireCalendarEventLocation(')),x.ctx);
 await x.ctx.openCalendarParticipants({manualEventId:event.id});assert.match(x.node('calendarParticipantsList').innerHTML,/value="p1" checked/);assert.doesNotMatch(x.node('calendarParticipantsList').innerHTML,/value="p2" checked/);
 await x.node('calendarParticipantsForm').onsubmit({preventDefault(){}});const request=x.requests.find(r=>r.options.method==='PATCH');assert.deepEqual(JSON.parse(request.options.body).expectedPlayerIds,['p1']);assert.deepEqual(JSON.parse(request.options.body).playerIds,['p2']);
 assert.equal(x.ctx.state.data.tournaments.filter(t=>t.manualEvent).length,1);assert.equal(x.ctx.state.data.tournaments.find(t=>t.manualEvent).playerId,'p2');assert.ok(x.ctx.state.data.tournaments.some(t=>t.id==='official'));assert.equal(x.node('calendarParticipantsDialog').open,false);
});
test('event controls share player-removal toolbar and agenda uses both standard grid columns',()=>{
 const toolbar=html.slice(html.indexOf('<div class="profileNav">'),html.indexOf('<div id="profileContent"'));
 assert.match(toolbar,/class="profileNavActions"/);assert.ok(toolbar.indexOf('id="removeProfilePlayer"')<toolbar.indexOf('id="editCalendarEventParticipants"'));
 assert.doesNotMatch(source,/calendarEventDeleteSection/);
 const t={...event,circuit:'manual',eventColor:'purple',manualEvent:true,people:[{playerId:'p1',playerName:'Anna'},{playerId:'p2',playerName:'Luca'}]},x=harness();
 Object.assign(x.ctx,{circuit:t=>t.circuit,tournamentKey:()=>event.id,overlap:()=>true});x.ctx.state.selected=new Set(['p1','p2']);vm.runInContext(source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('function wireCalendarEventLocation(')),x.ctx);
 const rendered=x.ctx.manualCalendarAgendaHtml(event.startDate,[t]);assert.equal((rendered.match(/class="agendaWhen"/g)||[]).length,1);assert.equal((rendered.match(/class="agendaMatchBody"/g)||[]).length,1);assert.equal((rendered.match(/class="agendaMatchRow matches-1"/g)||[]).length,1);
 const css=readFileSync(new URL('../../v3.css',import.meta.url),'utf8');assert.doesNotMatch(css,/\.agendaTournamentBlock\[data-event-color\].*\.agendaTournamentHead/);assert.doesNotMatch(css,/\.profileTournament\[data-event-color\]:not\([^)]*\) \.profileTournamentHead/);
});

test('event deletion uses the same confirmation style as player removal and No never deletes',async()=>{
 for(const accept of [false,true]){
  const controls={},node=id=>controls[id]??={focus(){},disabled:false},dialog={setAttribute(){},querySelector:node,showModal(){},close(){this.closed=true},remove(){}};let deletes=0;
  const ctx={esc:escape,document:{getElementById:()=>null,createElement:()=>dialog,body:{append(){}}},removeCalendarEventFromPage:async()=>{deletes++;return true}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function requestCalendarEventRemoval('),source.indexOf('async function removeCalendarEventFromPage(')),ctx);
  ctx.requestCalendarEventRemoval({manualEvent:true,name:'Raduno federale'});assert.equal(dialog.className,'playerRemovalDialog');assert.match(dialog.innerHTML,/Sei davvero sicuro/);assert.equal(deletes,0);
  await controls[accept?'[data-removal-yes]':'[data-removal-no]'].onclick();assert.equal(deletes,accept?1:0);assert.equal(dialog.closed,true);
 }
});

test('real calendar shows event name, municipality and all players while retaining full address for the event page',()=>{
 const location='Centro sportivo, Via Milano 12, 25036 Palazzolo sull’Oglio, Lombardia, Italia',t={name:'Raduno Under 10',location,manualEvent:true,circuit:'manual',eventColor:'purple',startDate:'2026-12-01',endDate:'2026-12-01',players:['Anna','Luca'],playerIds:['p1','p2']};
 for(const structured of [false,true]){
  const nodes={},node=id=>nodes[id]??={},ctx={state:{month:new Date('2026-12-01T12:00:00')},$:node,document:{querySelectorAll:()=>[]},circuit:t=>t.circuit,readableText:v=>String(v||''),fitpSummerCenterPlace:()=>'',cityCountry:v=>v,monthFmt:()=> 'dicembre',monday:d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x},add:(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x},iso:d=>d.toISOString().slice(0,10),fmt:()=>'',groups:()=>[{...t,...(structured?{locationCity:'Palazzolo sull’Oglio'}:{})}],overlap:(t,a,b)=>t.startDate<=b&&t.endDate>=a,tournamentDisplayName:t=>t.name,tournamentKey:()=> 'test',esc:escape};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function calendarEventCity('),source.indexOf('function tennisEuropeVenueLocation('))+source.slice(source.indexOf('function renderCalendar()'),source.indexOf('function syncPlayersColumnHeight()')),ctx);ctx.renderCalendar();
  const markup=node('calendar').innerHTML;assert.match(markup,/Raduno Under 10/);assert.match(markup,/Palazzolo sull’Oglio/);assert.match(markup,/Anna/);assert.match(markup,/Luca/);assert.doesNotMatch(markup,/Via Milano|25036|Centro sportivo|Lombardia|Italia/);assert.equal(t.location,location);
 }
});

test('agenda camps show municipality, one participant line and the uppercase federal badge',()=>{
 const x=harness(),t={...event,name:'Raduno Under 10',location:'Via Milano 12, 25036 Palazzolo sull’Oglio, Lombardia, Italia',eventColor:'purple',manualEvent:true,people:[{playerId:'p1',playerName:'Anna'},{playerId:'p2',playerName:'Luca'}]};
 Object.assign(x.ctx,{readableText:v=>v,circuit:()=> 'manual',tournamentKey:()=>event.id,overlap:()=>true});x.ctx.state.selected=new Set(['p1','p2']);
 vm.runInContext(source.slice(source.indexOf('function calendarEventCity('),source.indexOf('function tournamentLocationLabel('))+source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('async function openCalendarParticipants(')),x.ctx);
 const markup=x.ctx.manualCalendarAgendaHtml(event.startDate,[t]);assert.match(markup,/Raduno Under 10/);assert.match(markup,/Palazzolo sull’Oglio/);assert.doesNotMatch(markup,/Via Milano|25036|Lombardia|Italia/);assert.equal((markup.match(/class="agendaTitle calendarEventParticipantLine"/g)||[]).length,1);assert.match(markup,/RADUNO FEDERALE/);
});
test('actual player profile displays event analysis; camp headers never receive match statistics',()=>{
 const x=harness(),camp={...event,location:"Accademia Tennis Vavassori- campo coperto, Via Alessandro Manzoni, 25036 Palazzolo sull'Oglio, Lombardia, Italia",playerId:'p1',competitionId:event.id,manualEventId:event.id,manualEvent:true,eventColor:'purple',eventAnalysis:'Nota'};
 x.ctx.state.data.tournaments=[camp];x.ctx.state.data.matches=[];
 Object.assign(x.ctx,{location:{hash:''},activeOpponentRouteKey:'',playerTournamentEligible:()=>true,circuit:()=> 'manual',tournamentKey:()=>event.id,fitpSummerCenterPlace:()=>'',agendaVenueLocation:()=> 'Palazzolo sull’Oglio',tournamentSurfaceLabel:()=>'',effectiveAcceptanceLabel:()=>'',initials:()=>'',readableText:x=>x,readablePerson:x=>x,playerCircuitLinksHtml:()=>'',personalPlayerAffiliationHtml:()=>'',playerBirthLabel:()=>'',playerRankingSummary:()=>'',loadCurrentPlayerRanking(){},bindParticipantNavigation(){}});
 for(const id of ['homeView','profileView'])x.node(id).classList={add(){},remove(){}};
 vm.runInContext(source.slice(source.indexOf('function calendarEventCity('),source.indexOf('function tournamentLocationLabel('))+source.slice(source.indexOf('function calendarEventAnalysisButton('),source.indexOf('async function openCalendarParticipants('))+source.slice(source.indexOf('function renderProfile(id)'),source.indexOf('function matchHistoryRowHtml(')),x.ctx);x.ctx.renderProfile('p1');
 const markup=x.node('profileContent').innerHTML;assert.match(markup,/Accademia Tennis Vavassori · Palazzolo sull&#39;Oglio BS|Accademia Tennis Vavassori · Palazzolo sull'Oglio BS/);assert.doesNotMatch(markup,/campo coperto|Via Alessandro Manzoni|25036/);assert.match(markup,/data-federal-camp="true"/);assert.match(markup,/data-calendar-analysis-player="p1"/);assert.match(markup,/hasAnalysis/);assert.doesNotMatch(markup,/data-match-analysis/);
 let stats=0;const body={hidden:false},head={insertAdjacentHTML(){stats++}},section={dataset:{federalCamp:'true'},querySelectorAll:()=>[],querySelector:q=>q==='.profileTournamentMatches'?body:head};
 x.ctx.list={querySelectorAll:()=>[section]};x.ctx.openProfileTournamentKeys=new Set();
 const start=source.indexOf('  for (const section of list?.querySelectorAll(".profileTournament") || []) {',source.indexOf('renderProfile = function (id)'));
 const end=source.indexOf('  const circuitSelect',start);vm.runInContext(source.slice(start,end),x.ctx);assert.equal(stats,0);assert.equal(body.hidden,true);
});
test('full pencil editor sends updated event details and preserves optimistic version',async()=>{
 const x=harness(),existing={...event,playerIds:['p1']};x.ctx.state.data.tournaments.push({manualEvent:true,manualEventId:event.id,playerId:'p1'});let saved;
 x.ctx.fetch=async(url,options)=>({ok:true,json:async()=>{if(options.method==='PATCH'){saved=JSON.parse(options.body);return{event:{...existing,...saved}}}return{events:[existing]}}});
 vm.runInContext(source.slice(source.indexOf('async function openCalendarParticipants('),source.indexOf('function wireCalendarEventLocation(')),x.ctx);await x.ctx.openCalendarParticipants({manualEventId:event.id});
 x.node('calendarEditName').value='Raduno nuovo';x.node('calendarEditStart').value='2026-12-05';x.node('calendarEditEnd').value='2026-12-06';const place=x.node('calendarEditLocation');place.value='Monza, Via Boccaccio 3';place.dataset={lat:'45.59',lon:'9.27',city:'Monza'};
 await x.node('calendarParticipantsForm').onsubmit({preventDefault(){}});assert.equal(saved.name,'Raduno nuovo');assert.equal(saved.locationCity,'Monza');assert.equal(saved.startDate,'2026-12-05');assert.equal(saved.endDate,'2026-12-06');assert.equal(saved.expectedEvent.name,event.name);
});

test('event analysis UI saves and deletes notes through calendar events without creating or editing matches',async()=>{
 for(const action of ['save','delete']){
  const x=harness(),controls={},editor={hidden:true,querySelector:q=>controls[q]??={},querySelectorAll:()=>[]};let patch;
  const existing={...event,playerIds:['p1'],playerAnalyses:{p1:'Nota precedente'}};x.ctx.state.data.matches=[{id:'official-match'}];x.ctx.state.data.tournaments.push({manualEvent:true,manualEventId:event.id,playerId:'p1'});
  Object.assign(x.ctx,{analysisEditor:()=>editor,editMatchAnalysis:async(initial,canDelete,title)=>{assert.equal(initial,'Nota precedente');assert.equal(title,'Analisi del raduno');return{action,analysis:'Nota aggiornata'}},alert:message=>assert.fail(message)});
  x.ctx.fetch=async(url,options)=>{assert.ok(url.endsWith('/calendar-events'));if(options.method==='PATCH'){patch=JSON.parse(options.body);return{ok:true,json:async()=>({event:{...existing,playerAnalyses:action==='delete'?{}:{p1:'Nota aggiornata'}}})}}return{ok:true,json:async()=>({events:[existing]})}};
  vm.runInContext(source.slice(source.indexOf('async function openCalendarEventAnalysis('),source.indexOf('function calendarEventAnalysisButton(')),x.ctx);await x.ctx.openCalendarEventAnalysis(event.id,'p1');
  assert.equal(patch.analysisPlayerId,'p1');assert.equal(patch.expectedAnalysis,'Nota precedente');assert.equal(patch.analysis,action==='delete'?'':'Nota aggiornata');assert.equal(x.ctx.state.data.matches.length,1);assert.equal(x.ctx.state.data.matches[0].id,'official-match');assert.equal(x.ctx.state.data.tournaments.find(t=>t.manualEvent).eventAnalysis,action==='delete'?'':'Nota aggiornata');
 }
});

test('camp profile venue displays club, city and province without the indoor suffix; full stored address is preserved',()=>{
 const ctx={readableText:v=>String(v||'')};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function calendarEventCity('),source.indexOf('function tournamentLocationLabel(')),ctx);
 const location="Accademia Tennis Vavassori- campo coperto, Via Alessandro Manzoni, 25036 Palazzolo sull'Oglio, Lombardia, Italia";
 assert.equal(ctx.calendarEventProfilePlace({location}),"Accademia Tennis Vavassori · Palazzolo sull'Oglio BS");
 assert.equal(ctx.calendarEventProfilePlace({location,locationVenue:'Accademia Tennis Vavassori- campo coperto',locationCity:"Palazzolo sull'Oglio",locationProvince:'Brescia'}),"Accademia Tennis Vavassori · Palazzolo sull'Oglio BS");
 assert.doesNotMatch(ctx.cleanCalendarVenue(location),/campo coperto/i);assert.match(ctx.cleanCalendarVenue(location),/Via Alessandro Manzoni/);assert.match(location,/campo coperto/);
 assert.equal(ctx.calendarEventProfilePlace({location:'Via Milano 12, 20900 Monza, Lombardia, Italia',locationVenue:'Circolo di prova',locationCity:'Monza',locationProvince:'MB'}),'Circolo di prova · Monza MB');
});
