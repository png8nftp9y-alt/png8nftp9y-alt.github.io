import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseDrawWalkovers,recoverDrawWalkovers,isRecoveredDrawWalkover} from './tennis-europe-draw-walkovers.mjs';
const id='00523E1D-06C9-430A-B8B9-851B401381E3',url='https://te.tournamentsoftware.com/tournament/'+id+'/draw/1';
const player=(n,name)=>`<a data-player-id="${n}" data-nationality-id="ITA" href="/sport/player.aspx?id=${id}&amp;player=${n}"><span class="nav-link__value">${name}</span></a>`;
// Structure observed on the official BS12 Group A page: dated match cards,
// Round N header and no GetDrawContent form. The W/O is a synthetic fixture.
const card=(round,date='Mon 13/07/2026',winner='has-won')=>`<div class="match"><div class="match__header"><span title="Round ${round}" class="nav-link"><span class="nav-link__value">Round ${round}</span></span></div><div class="match__body"><div class="match__row ${winner}">${player('40','Manuel PEREGALLI')}</div><div class="match__row">${player('61','Mattia SENA')}</div><span class="match__message">Walkover</span></div><div class="match__footer">${date}</div></div>`;
const shell=html=>'<h4>BS12 - Group A</h4><span>Round Robin</span>'+html;
const options={competitionId:id,drawId:'1',event:'BS12 - Group A',startDate:'2026-07-11',endDate:'2026-07-18',sourceUrl:url};
test('inline round robin uses official dates and marks the format',()=>{
 const html=shell(card(1)),p=parseDrawWalkovers({...options,html});assert.equal(p.matches.length,1);assert.deepEqual(p.issues,[]);assert.equal(p.matches[0].date,'2026-07-13');assert.equal(p.matches[0].dateSource,'official_draw_date');assert.equal(p.matches[0].roundRobin,true);assert.equal(p.matches[0].round,'Round 1');assert(isRecoveredDrawWalkover(p.matches[0]));
});
test('undated first group W/O without a prior dated match uses tournament day three',()=>{
 const p=parseDrawWalkovers({...options,html:shell(card(1,''))});assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,'2026-07-13');assert.equal(p.matches[0].dateSource,'round_robin_third_day_fallback');assert(isRecoveredDrawWalkover(p.matches[0]));
});
test('missing winner and malformed round stay unresolved',()=>{
 const noWinner=parseDrawWalkovers({...options,html:shell(card(1,undefined,''))});assert.equal(noWinner.matches.length,0);assert(noWinner.issues.some(x=>x.reason==='walkover_participants_or_winner_unverified'));
 const badRound=parseDrawWalkovers({...options,html:shell(card('unexpected'))});assert.equal(badRound.matches.length,0);assert(badRound.issues.some(x=>x.reason==='round_robin_round_unverified'));
});
test('recovery reads inline group content without requesting an invented endpoint; repeated recovery deduplicates',async()=>{
 const matches=[],calls=[],get=async u=>{calls.push(u);if(u.endsWith('/draws'))return `<a href="${url}">BS12 - Group A</a>`;if(u===url)return shell(card(1));throw Error('unexpected URL '+u);};
 const tournament={competitionId:id,startDate:options.startDate,endDate:options.endDate};
 const p=await recoverDrawWalkovers({tournament,matches,get});assert.equal(p.status,'checked');assert.equal(matches.length,1);assert(calls.every(u=>!u.includes('GetDrawContent')));
 const second=await recoverDrawWalkovers({tournament,matches,get});assert.equal(matches.length,1);assert.equal(second.cases[0].disposition,'already_in_oop');
});
test('inline knockout keeps Avvenire date policies and strict validation',async()=>{
 const html=await fs.readFile(new URL('./fixtures/te-avvenire-bd14-walkovers.html',import.meta.url),'utf8'),comp='079DE5F9-FF49-47F1-A29D-92AB44CDD455',draw='https://te.tournamentsoftware.com/tournament/'+comp+'/draw/7',matches=[];
 const get=async u=>u.endsWith('/draws')?`<a href="${draw}">BD14 - Boys Doubles 14 Main Draw</a>`:'<h4>BD14 - Boys Doubles 14 Main Draw</h4>'+html;
 const p=await recoverDrawWalkovers({tournament:{competitionId:comp,startDate:'2026-05-30',endDate:'2026-06-06'},matches,get});assert.equal(p.status,'checked');assert.equal(matches.length,7);assert.equal(matches.find(m=>m.round==='Final').date,'2026-06-06');assert(matches.every(isRecoveredDrawWalkover));
});

test('undated group W/O uses the previous dated round, even if only the current round is rendered',()=>{
 const previous=parseDrawWalkovers({...options,html:shell(card(1))}).matches[0];
 const p=parseDrawWalkovers({...options,html:shell(card(2,'')),knownMatches:[previous]});
 assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,'2026-07-14');assert.equal(p.matches[0].dateSource,'previous_match_plus_one_day');assert.equal(p.matches[0].previousMatchDate,'2026-07-13');assert.deepEqual(p.matches[0].previousMatchIds,[previous.id]);assert(isRecoveredDrawWalkover(p.matches[0]));
});
test('same group and team required; later or other-circuit anchors cannot set a date',()=>{
 const previous=parseDrawWalkovers({...options,html:shell(card(1))}).matches[0];
 for(const altered of [{...previous,drawId:'99'},{...previous,competitionId:'OTHER'},{...previous,round:'Round 3'},{...previous,event:'GS12 - Group A'},{...previous,players:previous.players.map(p=>({...p,name:'Other '+p.name}))}]){
  const p=parseDrawWalkovers({...options,html:shell(card(2,'')),knownMatches:[altered]});assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,'2026-07-13');assert.equal(p.matches[0].dateSource,'round_robin_third_day_fallback');
 }
});
test('official group date prevails and inferred date stays inside tournament bounds',()=>{
 const previous=parseDrawWalkovers({...options,html:shell(card(1))}).matches[0];
 const official=parseDrawWalkovers({...options,html:shell(card(2,'Wed 15/07/2026')),knownMatches:[previous]}).matches[0];assert.equal(official.date,'2026-07-15');assert.equal(official.dateSource,'official_draw_date');
 for(const date of ['2026-07-18','2026-07-01']){const p=parseDrawWalkovers({...options,html:shell(card(2,'')),knownMatches:[{...previous,date}]});assert.equal(p.matches.length,0);assert.equal(p.pending.length,1);}
});
test('dated earlier card can anchor a later group W/O in the same document',()=>{
 const p=parseDrawWalkovers({...options,html:shell(card(1)+card(2,''))});assert.equal(p.matches.length,2);assert.equal(p.matches.find(m=>m.round==='Round 2').date,'2026-07-14');
});
test('reversed card order resolves consecutive undated rounds in ordinal order',()=>{
 const p=parseDrawWalkovers({...options,html:shell(card(3,'')+card(2,'')+card(1))});assert.equal(p.matches.length,3);assert.equal(p.matches.find(m=>m.round==='Round 2').date,'2026-07-14');assert.equal(p.matches.find(m=>m.round==='Round 3').date,'2026-07-15');
});

test('third day fallback handles month rollover and missing prior match in a later group round',()=>{
 const p=parseDrawWalkovers({...options,startDate:'2026-07-30',endDate:'2026-08-05',html:shell(card(2,''))});assert.equal(p.matches[0].date,'2026-08-01');assert(isRecoveredDrawWalkover(p.matches[0]));
});
test('third day fallback never exceeds tournament end or accepts a missing start',()=>{
 for(const patch of [{startDate:''},{endDate:'2026-07-12'}]){const p=parseDrawWalkovers({...options,...patch,html:shell(card(1,''))});assert.equal(p.matches.length,0);assert.equal(p.pending.length,1);}
});
test('fallback validator rejects forged date and knockout records',()=>{
 const m=parseDrawWalkovers({...options,html:shell(card(1,''))}).matches[0];assert(!isRecoveredDrawWalkover({...m,date:'2026-07-14'}));assert(!isRecoveredDrawWalkover({...m,roundRobin:false}));
});
test('fallback seeds subsequent undated group rounds, preserving ordinal progression',()=>{
 const p=parseDrawWalkovers({...options,html:shell(card(3,'')+card(2,'')+card(1,''))});assert.equal(p.matches.length,3);assert.deepEqual(p.matches.map(m=>m.date),['2026-07-13','2026-07-14','2026-07-15']);assert(p.matches.every(isRecoveredDrawWalkover));
});
