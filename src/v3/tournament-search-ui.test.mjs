import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../v3.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('const catalogueTournamentPages ='),source.indexOf('async function renderTournamentSearchPage'));
function setup(groups=[]){
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,innerHTML:'',classList:{add(){}},setAttribute(){}});return elements.get(id);};
 const rendered=[],context={Map,URLSearchParams,AbortSignal,location:{hash:'#catalog-tournament/itf/ID1'},PRIVATE_API:'/app-api',privateApiOptions:x=>x,$:element,groups:()=>groups,circuit:t=>t.circuit,tournamentKey:t=>t.competitionId+'|'+t.circuit,renderTournament:k=>rendered.push(k),fetch:async()=>({ok:true,json:async()=>({tournament:{name:'J30 Test',circuit:'itf',competitionId:'ID1'}})})};
 vm.createContext(context);vm.runInContext(body,context);return{context,rendered,element};
}
test('catalogue navigation reuses existing group tournament including its participants',async()=>{
 const {context,rendered}=setup([{circuit:'itf',competitionId:'ID1',people:[{playerId:'our-player'}]}]);context.fetch=()=>{throw Error('unnecessary catalogue request');};await context.renderCatalogueTournament('itf','ID1');assert.deepEqual(rendered,['ID1|itf']);
});
test('untracked tournament opens metadata only; late responses cannot replace another route',async()=>{
 const {context,rendered}=setup();await context.renderCatalogueTournament('itf','ID1');assert.deepEqual(rendered,['ID1|itf']);const t=vm.runInContext("catalogueTournamentPages.get('ID1|itf')",context);assert.equal(t.catalogueOnly,true);assert.equal(t.people.length,0);
 context.fetch=async()=>{context.location.hash='#calendar';return{ok:true,json:async()=>({tournament:{competitionId:'ID2',circuit:'itf'}})};};await context.renderCatalogueTournament('itf','ID2');assert.equal(rendered.length,1);
});
test('calendar tournament tools follow players and precede month; routes and heading-only rendering are wired',async()=>{
 const html=await readFile(new URL('../../v3.html',import.meta.url),'utf8');const players=html.indexOf('id="playerFilters"'),toolbar=html.indexOf('id="calendarTournamentToolbar"'),search=html.indexOf('id="tournamentSearchForm"'),month=html.indexOf('class="calendarMonthNav"');assert.ok(players<toolbar&&toolbar<search&&search<month);const header=html.slice(html.indexOf('class="cardHead calendarHead"'),players);assert.match(header,/class="demographicFilters"/);assert.match(header,/id="toggleAll"/);assert.doesNotMatch(header,/calendarTitleActions|tournamentSearchForm/);
 assert.match(source,/if \(tournamentSearch\) renderTournamentSearchPage/);assert.match(source,/if\(t\.catalogueOnly\)\{[\s\S]*?querySelector\('\.tournamentMatches'\)\?\.remove/);
});
