import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function mergeProgressiveRankingFields('),source.indexOf('async function fetchProjection('));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(group='others'){
 let renders=0,saves=0,warnings=0;
 const ctx={playerRankingCache:new Map(),PLAYER_GROUP:group,state:{data:null},location:{hash:'#calendar'},Date,Map,Set,Promise,JSON,TextDecoder,Uint8Array,setTimeout,clearTimeout,console:{warn(){warnings++}},renderIfDataChanged(){renders++},saveCachedData(){saves++;return Promise.resolve()}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);
 const data={group,players:[{id:'p',name:'Katerýna',nationality:'UKR',tennisEuropeRanking:'old'}],tournaments:[{id:'t',name:'kept'}],matches:[{id:'m',playerId:'p',score:'6-0',playerTeRanking:99}],agenda:[{id:'m',playerId:'p',score:'6-0',playerTeRanking:99}]};
 let controller;const response=new Response(new ReadableStream({start(c){controller=c}})),encoder=new TextEncoder();
 const send=value=>controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));
 send({type:'snapshot',data});
 return{ctx,data,response,send,close:()=>controller.close(),get counts(){return{renders,saves,warnings}}};
}
const patch={group:'others',players:[{id:'p',tennisEuropeRanking:'n°10',tennisEuropeRankings:{u14:10},tennisEuropeRankingDates:{u14:'2026-11-03'},tennisEuropeLatestRankingDates:{G14:'2026-11-03'},name:'must not change',nationality:'X'}],matches:[{id:'m',playerId:'p',playerTeRanking:10,score:'must not change'}]};
test('initial complete data resolves before rankings and later patch changes only ranking fields in history and agenda',async()=>{
 const x=setup(),started=Date.now();const core=await x.ctx.readProgressiveProjection(x.response,started,'others',new AbortController(),10000);
 assert.equal(core.tournaments[0].name,'kept');assert.equal(x.counts.renders,0);x.ctx.state.data={...core,snapshotReadAt:new Date(started).toISOString()};
 x.send({type:'rankings',data:patch,durationMs:9000});x.close();await tick();
 const data=x.ctx.state.data;assert.equal(data.players[0].tennisEuropeRanking,'n°10');assert.equal(data.players[0].name,'Katerýna');assert.equal(data.players[0].nationality,'UKR');assert.equal(data.matches[0].score,'6-0');assert.equal(data.matches[0].playerTeRanking,10);assert.equal(data.agenda[0].playerTeRanking,10);assert.equal(data.tournaments[0].name,'kept');assert.equal(x.counts.renders,1);assert.equal(x.counts.saves,1);assert.equal(x.ctx.playerRankingCache.get('p').rankings[0].ranking,10);assert.equal(x.ctx.playerRankingCache.get('p').latestRankingDates.G14,'2026-11-03');
});
test('rankings arriving before publication are retained for that snapshot, without losing them on the second publication',async()=>{
 const x=setup(),started=Date.now(),core=await x.ctx.readProgressiveProjection(x.response,started,'others',new AbortController(),10000);
 x.send({type:'rankings',data:patch});x.close();await tick();assert.equal(core.players[0].tennisEuropeRanking,'n°10');
 x.ctx.state.data={...core,snapshotReadAt:new Date(started).toISOString()};x.ctx.applyPendingProgressiveRankings();assert.equal(x.ctx.state.data.players[0].tennisEuropeRanking,'n°10');assert.equal(x.ctx.state.data.matches[0].playerTeRanking,10);
});
for(const changed of ['group','snapshot'])test('late rankings cannot overwrite a changed '+changed,async()=>{
 const x=setup(),started=Date.now(),core=await x.ctx.readProgressiveProjection(x.response,started,'others',new AbortController(),10000);
 x.ctx.state.data=structuredClone({...core,snapshotReadAt:new Date(started+(changed==='snapshot'?1000:0)).toISOString()});if(changed==='group')x.ctx.PLAYER_GROUP='main';
 x.send({type:'rankings',data:patch});x.close();await tick();assert.equal(x.ctx.state.data.players[0].tennisEuropeRanking,'old');assert.equal(x.counts.renders,0);
});
test('ranking errors leave complete tournaments and matches visible without another request',async()=>{
 const x=setup(),started=Date.now(),core=await x.ctx.readProgressiveProjection(x.response,started,'others',new AbortController(),10000);x.ctx.state.data={...core,snapshotReadAt:new Date(started).toISOString()};
 x.send({type:'rankings_error'});x.close();await tick();assert.equal(x.ctx.state.data.tournaments.length,1);assert.equal(x.ctx.state.data.matches.length,1);assert.equal(x.counts.warnings,1);assert.equal(x.counts.renders,0);
});
test('a delayed ranking stream is cancelled without removing the initial data or retrying',async()=>{
 const x=setup(),started=Date.now(),controller=new AbortController(),core=await x.ctx.readProgressiveProjection(x.response,started,'others',controller,5);x.ctx.state.data={...core,snapshotReadAt:new Date(started).toISOString()};
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(controller.signal.aborted,true);assert.equal(x.ctx.state.data.tournaments.length,1);assert.equal(x.counts.warnings,1);
});
