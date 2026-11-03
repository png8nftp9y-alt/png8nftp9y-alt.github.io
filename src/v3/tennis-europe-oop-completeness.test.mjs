import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryOopPage,auditOopCompleteness,requireOopCompleteness} from './tennis-europe-oop-completeness.mjs';
// Structural reductions of the observed layout, not raw official HTML.
const card=({people=[['36','Jan GALAD'],['10','Sebastian PTASINSKI']],bye=false,event='BS12 - Boys Singles 12 Main Draw',round='Round of 16',sets='6-0 6-0',winner=0}={})=>`<div class="match match--list"><a href="/tournament/T/draw/1"><span class="nav-link__value">${event}</span></a><span title="${round}" class="nav-link"></span>${people.map(([id,name],i)=>`<div class="match__row ${i===winner?'has-won':''}"><a data-player-id="${id}">${name}</a></div>`).join('')}${bye?'Bye':''}${sets.split(' ').filter(Boolean).map(s=>`<ul class="points">${s.split('-').map(v=>`<li>${v}</li>`).join('')}</ul>`).join('')}</div>`;
const page=html=>inventoryOopPage(html,'T','20260826');
const match=()=>({id:'stored',competitionId:'T',date:'20260826',event:'BS12 - Boys Singles 12 Main Draw',round:'Round of 16',players:[{id:'36',name:'Jan GALAD'},{id:'10',name:'Sebastian PTASINSKI'}],score:'6-0 6-0',status:'completed',winnerPlayerIds:['36']});
const audit=(pages,matches)=>auditOopCompleteness({tournament:{competitionId:'T'},pages,matches});
test('Krakow completed Not scheduled card cannot silently disappear',()=>{const html='<h5 class="match-group__header">Not scheduled</h5>'+card(),r=audit([page(html)],[]);assert.equal(r.status,'incomplete');assert.equal(r.issues[0].reason,'official_card_not_acquired');assert.match(r.issues[0].evidenceHtml,/Jan GALAD/);assert.throws(()=>requireOopCompleteness({tournament:{competitionId:'T'},pages:[page(html)],matches:[]}),/unresolved/);});
test('duplicate result on another day does not invent a second date',()=>{const m=match();m.date='20260825';assert.equal(audit([page(card())],[m]).status,'complete');assert.equal(m.date,'20260825');});
test('explicit bye is exempt; missing real opponent remains unresolved',()=>{assert.equal(audit([page(card({people:[['36','Jan GALAD']],bye:true,sets:''}))],[]).status,'complete');assert.equal(audit([page(card({people:[['36','Jan GALAD']]}))],[]).issues[0].reason,'incomplete_native_participants');});
test('late additions, result changes and changed winner cannot pass',()=>{const m=match();assert.equal(audit([page(card())],[m]).status,'complete');assert.equal(audit([page(card()+card({people:[['6','Siamion KALACH'],['39','Serhii SUKHANOV']]}))],[m]).issues[0].reason,'official_card_not_acquired');assert.equal(audit([page(card({sets:'6-1 6-0'}))],[m]).issues[0].reason,'official_score_not_acquired');assert.equal(audit([page(card({winner:1}))],[m]).issues[0].reason,'official_winner_not_acquired');});
test('native ID, event and round must match',()=>{const m=match();m.players[0].id='999';assert.equal(audit([page(card())],[m]).status,'incomplete');for(const change of [{event:'BS14 - Boys Singles 14 Main Draw'},{round:'Quarter final'}])assert.equal(audit([page(card(change))],[match()]).status,'incomplete');});
test('empty, unavailable, unknown and zero-date sources are distinct',()=>{assert.equal(audit([page('Match schedule No matches found')],[]).status,'complete');assert.equal(audit([page('Verify you are human')],[]).status,'incomplete');assert.equal(audit([],[]).status,'incomplete');assert.equal(audit([page(card({event:'Team tie'}))],[]).issues[0].reason,'unsupported_oop_card');});
import {recoverOopResults,isVerifiedOopResult} from './tennis-europe-oop-completeness.mjs';
test('completed unnumbered result on one official day is recovered without invented court/time; replay is idempotent',()=>{
 const tournament={competitionId:'T',startDate:'2026-08-24',endDate:'2026-08-30'},matches=[],pages=[page(card())];
 assert.equal(recoverOopResults({tournament,pages,matches}).length,1);const m=matches[0];assert.equal(isVerifiedOopResult(m),true);assert.equal(m.date,'2026-08-26');assert.equal(m.court,'');assert.equal(m.time,'');assert.equal(m.courtMatchNumber,null);assert.equal(audit(pages,matches).status,'complete');assert.equal(recoverOopResults({tournament,pages,matches}).length,0);
 assert.equal(isVerifiedOopResult({...m,sourceUrl:'https://example.org'}),false);
});
test('multiple listed dates, missing winner, wrong bounds and identity remain unresolved',()=>{
 const tournament={competitionId:'T',startDate:'2026-08-24',endDate:'2026-08-30'};
 for(const pages of [[page(card()),inventoryOopPage(card(),'T','20260827')],[page(card({winner:-1}))],[page(card({people:[['36','Jan GALAD']]}))]]){const matches=[];assert.equal(recoverOopResults({tournament,pages,matches}).length,0);assert.equal(audit(pages,matches).status,'incomplete');}
 assert.equal(recoverOopResults({tournament:{...tournament,endDate:'2026-08-25'},pages:[page(card())],matches:[]}).length,0);
});
test('Team Montage: source listing on next day never replaces earlier verified scheduled date',()=>{const m=match();m.date='20260825';const matches=[m];assert.equal(recoverOopResults({tournament:{competitionId:'T'},pages:[page(card())],matches}).length,0);assert.equal(m.date,'20260825');});
test('Krakow observed ten omitted results: all ten retained, scored and recovered exactly once',()=>{
 const evidence=[['36','Jan GALAD','10','Sebastian PTASINSKI','6-0 6-0'],['39','Serhii SUKHANOV','6','Siamion KALACH','6-1 6-1'],['20','Antonina SZUL','45','Lilien BITERA','4-1 4-0'],['31','Lena SOMINKA','35','Viktorija TRIGUBOVA','4-0 4-0'],['8','Kornelia PTAK','15','Hanna RADKE','4-2 1-4 5-3'],['60','Aleksandra WALDZINSKA','38','Yelizaveta YABRYK','4-2 4-2'],['20','Antonina SZUL','57','Nikola KOZICKA','4-1 0-4 5-3'],['31','Lena SOMINKA','47','Kornelia SZKUDLARCZYK','4-0 4-0'],['8','Kornelia PTAK','43','Ronja VON HORN','4-1 2-4 4-2'],['17','Antonia TRON','60','Aleksandra WALDZINSKA','4-1 4-2']];
 const html=evidence.map(([a,an,b,bn,sets],i)=>card({people:[[a,an],[b,bn]],sets,event:i<2?'BS12 - Boys Singles 12 Main Draw':'GS12 - Girls Singles 12 Bonus Draw',round:i<6?'Round of 16':'Quarter final'})).join('');
 const pages=[page(html)],matches=[],tournament={competitionId:'T',startDate:'2026-08-22',endDate:'2026-08-30'};assert.equal(audit(pages,matches).issues.length,10);assert.equal(recoverOopResults({tournament,pages,matches}).length,10);assert.equal(audit(pages,matches).status,'complete');assert.equal(recoverOopResults({tournament,pages,matches}).length,0);
});
import {unexplainedOopRemovals} from './tennis-europe-oop-completeness.mjs';
test('disappearing acquired match blocks publication; legitimate new date and rolling out of live scope do not',()=>{
 const m=match(),previous={matches:[m]},current={tournaments:[{competitionId:'T'}],matches:[]};assert.equal(unexplainedOopRemovals(previous,current).length,1);
 current.matches=[{...m,id:'new-id',date:'20260827'}];assert.equal(unexplainedOopRemovals(previous,current).length,0);assert.equal(unexplainedOopRemovals(previous,{tournaments:[],matches:[]}).length,0);
});
test('future explicit empty publication is not confused with failed acquisition or acquired OOP',()=>{
 const args={tournament:{competitionId:'T',startDate:'2026-08-27'},pages:[],matches:[],listingHtml:'Match schedule No matches found',asOf:'2026-08-26'};
 assert.equal(requireOopCompleteness(args).status,'not_published');assert.throws(()=>requireOopCompleteness({...args,listingHtml:'unavailable'}),/unresolved/);assert.throws(()=>requireOopCompleteness({...args,asOf:'2026-08-27'}),/unresolved/);
});
