import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {progressiveOpponentProfile} from '../lib/progressive-opponent-profile.mjs';
import {enrichFitpMetadata} from '../lib/fitp-player-metadata.mjs';
import {enrichItfJuniorRankings} from '../lib/itf-junior-ranking-enrichment.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
const code=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
function assembler({history,metadata={},onProfile}={}){
 const calls={identity:0,metadata:0,history:0},person={name:'Test Person',sourceCircuit:'fitp',sourcePlayerId:'9171628',membershipCard:'9171628'};
 const context={
  linkedOpponentIdentity:async()=>{calls.identity++;return person;},playerCircuitIdentities:()=>[],
  tennisEuropeOpponentHistory:()=>{calls.history++;return history||Promise.resolve({profile:null,tournaments:[]});},
  playerEntryTournaments:async()=>[],otherCircuitOpponentHistory:async()=>[],opponentItfDocumentHistory:async()=>[],
  enrichIdentityNationalities:async()=>{},resolveCircuitProfiles:async()=>new Map(),
  enrichPersonalTournamentPresentation:async rows=>rows,currentTennisEuropePlayerRanking:async()=>({rankings:[]}),
  enrichFitpMetadata:async(db,people)=>{calls.metadata++;Object.assign(people[0],metadata);},
  enrichItfJuniorRankings:async(db,people,matches,tournaments,options)=>{if(!options?.skipPlayers)people[0].itfJuniorRanking={ranking:321};},
  opponentEuropeProfile:()=>({}),opponentTournamentWindow:x=>x,circuitProfiles:()=>[],Intl,Date,Map,Set
 };
 vm.createContext(context);vm.runInContext(code.slice(code.indexOf('async function universalOpponentHistory'),code.indexOf('function adminAuthorized'))+';this.run=universalOpponentHistory;',context);
 const run=()=>context.run({DB:{prepare(){return{bind(){return{first:async()=>null}}}}}},
  {name:'Test Person',profileId:'9171628',asOf:'2026-11-16',onProfile});
 return {run,calls};
}
test('real assembler emits ranking before slow history; exact identity and FITP metadata are read once',{timeout:1500},async()=>{
 const slow=deferred(),first=deferred();
 const a=assembler({history:slow.promise,metadata:{fitpRanking:'3.2',fitpRankingSource:'observed',fitpRankingObservedAt:'2026-08-30'},onProfile:first.resolve});
 let done=false;const complete=a.run().then(x=>{done=true;return x;});
 const header=await first.promise;assert.equal(done,false);assert.equal(header.fitpMetadata.ranking,'3.2');
 assert.equal(header.fitpMetadata.observedAt,'2026-08-30');assert.equal(header.profile.itfJuniorRanking.ranking,321);assert.equal(header.historyPending,true);
 slow.resolve({profile:null,tournaments:[]});const full=await complete;
 assert.equal(full.historyPending,false);assert.equal(full.profile.itfJuniorRanking.ranking,321);
 assert.deepEqual(a.calls,{identity:1,metadata:1,history:1});
});
test('stream sends primary data first, measures history, preserves error distinction and never caches publicly',async()=>{
 const slow=deferred(),response=progressiveOpponentProfile(async(send,measure)=>{
  send({historyPending:true,profile:{ranking:10}});
  await measure('opponent_history',()=>slow.promise);return {historyPending:false,tournaments:[]};
 });
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 const first=JSON.parse(decoder.decode((await reader.read()).value));assert.equal(first.type,'profile');
 slow.resolve();const final=JSON.parse(decoder.decode((await reader.read()).value));
 assert.equal(final.type,'history');assert.equal(typeof final.serverTiming.opponent_history,'number');assert.equal((await reader.read()).done,true);
 const error=await progressiveOpponentProfile(async send=>{send({profile:{ranking:10}});throw Error('private SQL details');}).text();
 assert.match(error,/"type":"error"/);assert.doesNotMatch(error,/private SQL|"type":"history"/);
});
test('stream cancellation ignores later completion without enqueueing into a closed response',async()=>{
 const slow=deferred(),response=progressiveOpponentProfile(async send=>{send({profile:{}});await slow.promise;return {tournaments:[]};});
 const reader=response.body.getReader();await reader.read();await reader.cancel();slow.resolve();await new Promise(setImmediate);
});
test('history ranking pass preserves the already-read current ITF ranking',async()=>{
 const person={membershipCard:'9171628',itfJuniorRanking:{ranking:321}};
 await enrichItfJuniorRankings({prepare(){assert.fail('no ITF history or targets means no reads');}},[person],[],[],{skipPlayers:true});
 assert.equal(person.itfJuniorRanking.ranking,321);
});
