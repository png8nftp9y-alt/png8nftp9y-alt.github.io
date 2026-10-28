import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
function fixture(){const targets=[{dataset:{futureEuropeRanking:'one',futureEuropeCategories:'14'},textContent:''},{dataset:{futureEuropeRanking:'two',futureEuropeCategories:'16'},textContent:''}];const c={Date,readableText:String,location:{hash:'#tournament/T'},$:()=>({querySelectorAll:()=>targets}),loadCurrentPlayerRanking:async()=>({rankings:[],latestRankingDates:{B14:'2026-10-26'}})};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function currentRankingCategoryAllowed'),source.indexOf('async function loadCurrentPlayerRanking')),c);vm.runInContext(source.slice(source.indexOf('function futureTournamentEuropeRanking'),source.indexOf('function renderTournament(')),c);return {c,targets};}
test('future tournament uses latest Europe publication and short NR, never FITP ranking',()=>{const {c}=fixture(),p={id:'one',birthYear:new Date().getUTCFullYear()-14,ranking:'3.1'},data={latestRankingDates:{B14:'2026-10-26'},rankings:[{category:'B14',ranking:42,ranking_date:'2026-10-26'}]};assert.equal(c.futureTournamentEuropeRanking(p,data,['14']),'n°42 TE U14');assert.equal(c.futureTournamentEuropeRanking(p,{...data,rankings:[]}),'NR');assert.equal(c.futureTournamentEuropeRanking(p,{...data,rankings:[{...data.rankings[0],ranking_date:'2026-10-19'}]}),'NR');assert.equal(c.futureTournamentEuropeRanking(p,undefined),'');});
test('async future header updates the correct players and ignores failed requests and navigation',async()=>{const {c,targets}=fixture();await c.loadFutureTournamentEuropeRankings('T',[{id:'one'}]);assert.equal(targets[0].textContent,' · NR');assert.equal(targets[1].textContent,'');c.loadCurrentPlayerRanking=async()=>undefined;await c.loadFutureTournamentEuropeRankings('T',[{id:'two'}]);assert.equal(targets[1].textContent,'');c.loadCurrentPlayerRanking=async()=>{c.location.hash='#player/elsewhere';return {rankings:[]}};await c.loadFutureTournamentEuropeRankings('T',[{id:'two'}]);assert.equal(targets[1].textContent,'');});
test('future Europe rendering uses current lookup; historical rankings retain the match-date path',()=>{const render=source.slice(source.indexOf('function renderTournament('),source.indexOf('const renderProfileWithoutStats'));assert.ok(render.includes("source === 'tennis-europe' && String(t.startDate || '') > iso(new Date())"));assert.ok(render.includes('if (futureEurope) loadFutureTournamentEuropeRankings'));assert.ok(render.includes('!futureEurope && playerRanking'));assert.ok(render.includes('.find((row) => row.playerTeRanking)?.playerTeRanking'));});
test('registration category filters current ranks independently of player age',()=>{
 const {c}=fixture(),p={birthYear:new Date().getUTCFullYear()-13};
 const data={latestRankingDates:{B14:'2026-10-26',B16:'2026-10-26'},rankings:[{category:'B14',ranking:42,ranking_date:'2026-10-26'},{category:'B16',ranking:135,ranking_date:'2026-10-26'}]};
 assert.equal(c.futureTournamentEuropeRanking(p,data,['14']),'n°42 TE U14');
 assert.equal(c.futureTournamentEuropeRanking(p,data,['16']),'n°135 TE U16');
 assert.equal(c.futureTournamentEuropeRanking(p,{...data,rankings:[data.rankings[0]]},['16']),'NR');
 assert.equal(c.futureTournamentEuropeRanking(p,data,['12']),'NR');
 assert.equal(c.futureTournamentEuropeRanking(p,data,[]),'NR');
 assert.equal(c.futureTournamentEuropeRanking(p,{...data,rankings:[{...data.rankings[1],ranking_date:'2026-10-19'}]},['16']),'NR');
});
test('category comes from registration then matches then tournament, never birth year',()=>{
 const {c}=fixture(),cats=(...args)=>Array.from(c.futureTournamentEuropeCategories(...args));
 assert.deepEqual(cats({event:'BS16'},[],{category:'U14'}),['16']);
 assert.deepEqual(cats({category:'U12'},[{event:'BS14'}],{category:'U16'}),['12']);
 assert.deepEqual(cats({},[{event:'GD14'}],{category:'U16'}),['14']);
 assert.deepEqual(cats({},[],{category:'16 & Under'}),['16']);
 assert.deepEqual(cats({category:'Under 14'}),['14']);
 assert.deepEqual(cats({birthYear:2012}),[]);
});
test('async header uses its own registration category on the shared ranking response',async()=>{
 const {c,targets}=fixture();
 c.loadCurrentPlayerRanking=async()=>({latestRankingDates:{B14:'2026-10-26',B16:'2026-10-26'},rankings:[{category:'B14',ranking:42,ranking_date:'2026-10-26'},{category:'B16',ranking:135,ranking_date:'2026-10-26'}]});
 await c.loadFutureTournamentEuropeRankings('T',[{id:'one'},{id:'two'}]);
 assert.equal(targets[0].textContent,' · n°42 TE U14');
 assert.equal(targets[1].textContent,' · n°135 TE U16');
});

import './junior-masters-playoff.test.mjs';
