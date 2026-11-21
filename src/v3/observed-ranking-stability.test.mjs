import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const date='2026-11-17';
const row={category:'G14',ranking:194,ranking_date:date};
function fixture(){
 const target={textContent:''};let response={rankings:[row],latestRankingDates:{G14:date}};
 const ctx={Date,Map,Set,location:{hash:'#player/aila'},readableText:String,esc:String,
  playerRankingCache:new Map(),playerRankingRequests:new Map(),PRIVATE_API:'/app/api',PLAYER_RANKING_CACHE:'rankings',
  privateApiOptions:x=>x,saveEntries(){},$:()=>target,
  fetch:async()=>{if(response instanceof Error)throw response;return {ok:true,json:async()=>response};}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const itfRankingText ='),source.indexOf('const normalizedDesignation ='))+';globalThis.summary=playerRankingSummary;',ctx);
 return {ctx,target,setResponse(value){response=value;}};
}
test('reopening a reconstructed observed profile keeps cached TE rank with its verification date',()=>{
 const {ctx}=fixture();ctx.playerRankingCache.set('aila',{rankings:[row],latestRankingDates:{G14:date}});
 for(let i=0;i<4;i++)assert.match(ctx.summary({id:'aila',ranking:'2.8'}),/2.8 FITP.*n°194 TE U14/);
});
test('live TE data persists in the player record and remains visible across failed refreshes',async()=>{
 const {ctx,target,setResponse}=fixture(),player={id:'aila',ranking:'2.8'};
 await ctx.loadCurrentPlayerRanking(player);
 assert.equal(player.tennisEuropeRankings.u14,194);
 assert.equal(player.tennisEuropeRankingDates.u14,date);
 assert.equal(player.tennisEuropeLatestRankingDates.G14,date);
 assert.match(target.textContent,/n°194 TE U14/);
 setResponse(Error('offline'));
 await ctx.loadCurrentPlayerRanking(player);
 assert.match(ctx.summary({...player}),/n°194 TE U14/);
 ctx.playerRankingCache.clear();assert.match(ctx.summary({...player}),/n°194 TE U14/);
});
test('a newer publication invalidates an older cached rank; verified absence clears the record',async()=>{
 const {ctx,setResponse}=fixture(),player={id:'aila',ranking:'2.8'};
 await ctx.loadCurrentPlayerRanking(player);
 assert.doesNotMatch(ctx.summary({...player,tennisEuropeLatestRankingDates:{G14:'2026-11-24'}}),/n°194/);
 setResponse({rankings:[],latestRankingDates:{G14:'2026-11-24'}});
 await ctx.loadCurrentPlayerRanking(player);
 assert.deepEqual(Object.keys(player.tennisEuropeRankings),[]);
 assert.doesNotMatch(ctx.summary({...player}),/TE U14/);
 assert.match(ctx.summary({...player}),/2.8 FITP/);
});
test('snapshot assembly preserves TE publication evidence alongside rank and ranking date',()=>{
 const start=source.indexOf('const visiblePlayers ='),end=source.indexOf('const visibleIds =',start);
 const block=source.slice(start,end).replace('const visiblePlayers =','globalThis.result =');
 const retained={id:'aila',tennisEuropeRankings:{u14:194},tennisEuropeRankingDates:{u14:date},tennisEuropeLatestRankingDates:{G14:date}};
 const ctx={playerCandidates:[{id:'aila',ranking:'2.8'}],FORMER_PLAYERS:new Set(),removedCourtWatchPlayers:new Set(),
  projection:{},projectedPlayers:new Map([['aila',retained]]),previousPlayers:new Map(),verifiedMembership:null,
  confirmedCourtWatchPlayers:new Map(),previous:{}};
 vm.createContext(ctx);vm.runInContext(block,ctx);
 assert.equal(ctx.result[0].tennisEuropeLatestRankingDates.G14,date);
 const view=fixture();assert.match(view.ctx.summary(ctx.result[0]),/n°194 TE U14/);
});
