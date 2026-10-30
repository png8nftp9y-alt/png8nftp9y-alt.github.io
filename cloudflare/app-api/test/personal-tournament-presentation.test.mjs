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
  ctx.renderOpponentHistory({tournaments:[{circuit,competitionId:'EXACT',name:'Event',startDate:'2026-10-01',endDate:'2026-10-07',matches:['tennis-europe','itf'].includes(circuit)?[{matchId:'played',circuit}]:[],sourceUrl:'https://official.invalid/event',venueName:'Official Club',address:'Via Uno 1',location:'City'}]});
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

test('ITF exact-ID factsheet overrides stale calendar copies for both past and future editions',async()=>{
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith('itf_official_metadata.json')?{tournaments:{EXACT:{venueName:'Verified club',address:'Official street'}}}:{tournaments:[{circuit:'itf',competitionId:'EXACT',venueName:'Stale club',location:'Official City, Country'}]}});
 const map=await fetchTournamentPresentation('itf',fetcher);
 assert.equal(map.get('itf|EXACT').venueName,'Verified club');
 for(const startDate of ['2026-01-01','2027-01-01']){
  const out=mergeTournamentPresentation({circuit:'itf',competitionId:'EXACT',startDate,venueName:'Sede da confermare',location:'Città e luogo da confermare'},map.get('itf|EXACT'));
  assert.equal(out.venueName,'Verified club');assert.equal(out.location,'Official City, Country');assert.equal(out.address,'Official street');assert.equal(out.startDate,startDate);
 }
});
test('unavailable official data never erases a stored verified ITF venue or borrows another ID',async()=>{
 const map=await fetchTournamentPresentation('itf',async()=>{throw Error('unavailable');});
 const out=mergeTournamentPresentation({circuit:'itf',venueName:'Saved club',location:'Saved city'},map.get('itf|MISSING'));
 assert.equal(out.venueName,'Saved club');assert.equal(out.location,'Saved city');
});

test('public presentation maps reuse verified content across requests but check the release and immediately follow changed hashes',async()=>{
 const {storedPresentationLoaders}=await import('../lib/personal-tournament-presentation.mjs');
 let reads=0,releases=0,version=1,unavailable=false;
 const documents=()=>({release:async()=>{releases++;return {documents:['dist/v3/source_fitp_tournaments.json','dist/v3/tournaments.json'].map(path=>({path,hash:'presentation-cache-fixture-'+version,bytes:500,chunks:1}))};},get:async()=>{reads++;if(unavailable)throw Error('injected_catalogue_failure');return {tournaments:[{circuit:'fitp',competitionId:'CACHE-EXACT',club:'Club '+version,location:'Official city'}]};}});
 const first=await storedPresentationLoaders(documents()).fitp();assert.equal(first.get('fitp|CACHE-EXACT').venueName,'Club 1');assert.equal(reads,2);
 const second=await storedPresentationLoaders(documents()).fitp();assert.deepEqual(second,first);assert.equal(reads,2);assert.equal(releases,2);
 const rendered=mergeTournamentPresentation({circuit:'fitp',competitionId:'CACHE-EXACT',entryStatus:'withdrawn'},second.get('fitp|CACHE-EXACT'));rendered.venueName='User-specific change';
 assert.equal((await storedPresentationLoaders(documents()).fitp()).get('fitp|CACHE-EXACT').venueName,'Club 1');
 version=2;const updated=await storedPresentationLoaders(documents()).fitp();assert.equal(updated.get('fitp|CACHE-EXACT').venueName,'Club 2');assert.equal(reads,4);
 version=3;unavailable=true;await assert.rejects(storedPresentationLoaders(documents()).fitp(),/injected_catalogue_failure/);unavailable=false;
 const recovered=await storedPresentationLoaders(documents()).fitp();assert.equal(recovered.get('fitp|CACHE-EXACT').venueName,'Club 3');assert.equal(reads,8);
});
