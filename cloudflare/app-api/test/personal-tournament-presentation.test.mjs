import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeTournamentPresentation,fetchTournamentPresentation,tournamentPresentationContext} from '../lib/personal-tournament-presentation.mjs';
for(const circuit of ['itf','fitp','tennis-europe'])test(circuit+' preserves participation and restores official and club fields',()=>{
 const t={circuit,competitionId:'EXACT',sourceUrl:'',venueName:'',address:'',location:'',entryStatus:'withdrawn',event:'B-D-Q-KO'};
 const out=mergeTournamentPresentation(t,{sourceUrl:'https://official.invalid/event',club:'Official club',clubAddress:'Via Uno 1',location:'City, Country'});
 assert.equal(out.sourceUrl,'https://official.invalid/event');assert.equal(out.venueName,'Official club');assert.equal(out.address,'Via Uno 1');assert.equal(out.location,'City, Country');
 assert.equal(out.entryStatus,'withdrawn');assert.equal(out.event,'B-D-Q-KO');
 assert.equal(mergeTournamentPresentation({...out,sourceUrl:'https://existing.invalid/'},{sourceUrl:'https://other.invalid/'}).sourceUrl,'https://existing.invalid/');
});
test('uses exact circuit and ID and tolerates an unavailable catalogue',async()=>{
 const fetcher=async url=>{if(url.includes('history/'))throw Error('temporary');
 return {ok:true,json:async()=>({tournaments:[{circuit:'itf',competitionId:'EXACT',sourceUrl:'https://official.invalid/'},{circuit:'fitp',competitionId:'EXACT',club:'WRONG CIRCUIT'},{circuit:'itf',competitionId:'OTHER',club:'Different tournament'}]})};};
 const map=await fetchTournamentPresentation('itf',fetcher);
 assert.equal(map.get('itf|EXACT').sourceUrl,'https://official.invalid/');assert.equal(map.get('itf|EXACT').venueName,undefined);assert.equal(map.has('fitp|EXACT'),false);
});

test('ITF calendar starts on the official first qualifying day',()=>{
 const out=mergeTournamentPresentation({circuit:'itf',startDate:'2026-10-05',endDate:'2026-10-11'},{qualificationStartDate:'2026-10-03'});
 assert.equal(out.startDate,'2026-10-03');assert.equal(out.endDate,'2026-10-11');
 assert.equal(mergeTournamentPresentation({circuit:'itf',startDate:'2026-10-05'},{}).startDate,'2026-10-05');
});

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('recursive opponent renderer exposes official links without tournament locations',()=>{
 const ui=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),body={innerHTML:''};
 const ctx={iso:()=> '2026-10-14',withoutPucItfReferences:x=>x,$:id=>id==='opponentTournamentHistory'?body:null,circuit:t=>t.circuit,readableText:x=>x||'',esc:x=>String(x||''),state:{data:{tournaments:[]}},tournamentSurfaceLabel:()=>'',opponentTournamentEventLinks:()=>'',opponentTournamentDateLabel:()=>'',opponentHistoryMatchSectionsHtml:()=>'',bindParticipantNavigation:()=>{},tennisEuropeVenueLocation:t=>[t.venueName,t.address,t.location].filter(Boolean).join(', '),fitpSummerCenterPlace:()=>'',fitpClubCase:x=>x||'',fitpAddressCase:x=>x||'',fitpCityProvince:x=>x||''};
 vm.createContext(ctx);
 for(const [a,b] of [['function tournamentOfficialUrl(','function tournamentDrawUrl('],['function tournamentPlace(','function agendaOrderOfPlayUrl('],['function tournamentMapsUrl(','function tournamentSurfaceLabel('],['function opponentTournamentWindow(','function opponentHistoryKey(']])vm.runInContext(ui.slice(ui.indexOf(a),ui.indexOf(b)),ctx);
 for(const circuit of ['itf','fitp','tennis-europe']){
  ctx.renderOpponentHistory({tournaments:[{circuit,competitionId:'EXACT',name:'Event',startDate:'2026-10-01',endDate:'2026-10-07',matches:circuit==='tennis-europe'?[{matchId:'played',circuit}]:[],sourceUrl:'https://official.invalid/event',venueName:'Official Club',address:'Via Uno 1',location:'City'}]});
  assert.ok(!body.innerHTML.includes('https://www.google.com/maps/search/?api=1'));
  assert.ok(!body.innerHTML.includes('Official Club'));assert.ok(!body.innerHTML.includes('Via Uno 1'));assert.ok(!body.innerHTML.includes('📍'));
  assert.ok(body.innerHTML.includes('target="_blank"'));
  assert.match(body.innerHTML,/<header class="opponentHistoryTournamentHead"><div class="opponentTournamentTitle"><span class="completedTournamentLabel">CONCLUSO<\/span><h4>/);
  if(circuit!=='tennis-europe')assert.ok(body.innerHTML.includes('https://official.invalid/event'));
  else assert.ok(body.innerHTML.includes('https://te.tournamentsoftware.com/tournament/EXACT'));
 }
});


test('request preparation overlaps catalogues without changing tournament precedence or refetching empty results',async()=>{
 let finish,calls=0;
 const ctx=tournamentPresentationContext({itf:()=>{calls++;return new Promise(resolve=>{finish=resolve})}});
 const source={circuit:'itf',competitionId:'EXACT',location:'Observed location',entryStatus:'withdrawn',event:'GS'};
 ctx.prepare([source]);ctx.prepare([source]);assert.equal(calls,1);
 finish(new Map([['itf|EXACT',{location:'Official location',venueName:'Official club',qualificationStartDate:'2026-10-02'}]]));
 const [enriched]=await ctx.enrich([source]);assert.equal(enriched.location,'Observed location');assert.equal(enriched.venueName,'Official club');assert.equal(enriched.entryStatus,'withdrawn');assert.equal(enriched.event,'GS');assert.equal(calls,1);
 let emptyCalls=0;const empty=tournamentPresentationContext({itf:async()=>{emptyCalls++;return new Map()}});
 empty.prepare([source]);await empty.enrich([source]);await empty.enrich([source]);assert.equal(emptyCalls,1);
 assert.deepEqual(source,{circuit:'itf',competitionId:'EXACT',location:'Observed location',entryStatus:'withdrawn',event:'GS'});
});
