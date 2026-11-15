import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');

async function profile(metadata){
 const identity={name:'Test Person',sourceCircuit:'fitp',sourcePlayerId:'9171628'};
 const c={
  linkedOpponentIdentity:async()=>identity,
  localEuropeOpponentIdentity:async()=>null,
  searchIdentityProfile:async()=>identity,
  playerCircuitIdentities:()=>[],
  tennisEuropeOpponentHistory:async()=>({profile:null,tournaments:[]}),
  playerEntryTournaments:async()=>[],
  otherCircuitOpponentHistory:async()=>[],
  opponentItfDocumentHistory:async()=>[],
  enrichIdentityNationalities:async()=>{},
  resolveCircuitProfiles:async()=>new Map(),
  enrichPersonalTournamentPresentation:async x=>x,
  currentTennisEuropePlayerRanking:async()=>({rankings:[]}),
  enrichFitpMetadata:async(db,people)=>Object.assign(people[0],metadata),
  opponentTournamentWindow:x=>x,circuitProfiles:()=>[],
  enrichItfJuniorRankings:async()=>{},opponentEuropeProfile:()=>null,
  Intl,Date,Map,Set
 };
 vm.createContext(c);
 const a=api.indexOf('async function universalOpponentHistory');
 const b=api.indexOf('function adminAuthorized',a);
 vm.runInContext(api.slice(a,b)+';this.run=universalOpponentHistory;',c);
 return c.run({DB:{prepare(){return{bind(){return{first:async()=>null}}}}}},
  {name:'Test Person',profileId:'9171628',asOf:'2026-11-15'});
}

test('archived rank reaches opponent API without sheet timestamp',async()=>{
 const d=await profile({
  fitpRanking:'3.2',fitpRankingSource:'observed',
  fitpRankingObservedAt:'2026-08-30T23:30:45.467Z'
 });
 assert.equal(d.fitpMetadata.ranking,'3.2');
 assert.equal(d.fitpMetadata.updatedAt,null);
 assert.equal(d.fitpMetadata.source,'observed');
 assert.equal(d.fitpMetadata.observedAt,'2026-08-30T23:30:45.467Z');
});

test('API preserves first-category and absent rankings',async()=>{
 assert.equal((await profile({
  fitpRanking:'1.11',fitpMetadataUpdatedAt:'2026-11-15'
 })).fitpMetadata.ranking,'1.11');
 assert.equal((await profile({})).fitpMetadata,null);
});

test('header displays FITP, archive date and Europe without hiding either',()=>{
 const c={
  displayDate:s=>s.slice(0,10),itfRankingText:()=>'',
  opponentHistoryProjection:x=>x,
  element:{textContent:'',hidden:true},
  $:id=>id==='opponentProfileRanking'?c.element:null
 };
 vm.createContext(c);
 const a=ui.indexOf('function opponentFitpRankingText(');
 const b=ui.indexOf('function opponentHistoryKey(',a);
 vm.runInContext(ui.slice(a,b),c);
 c.renderOpponentHistory({
  tournaments:[],profile:{ranking:12},
  fitpMetadata:{ranking:'3.2',source:'observed',observedAt:'2026-08-30'}
 });
 assert.equal(c.element.textContent,
  '3.2 FITP · (dato osservato il 2026-08-30) · n°12 TE');
 assert.equal(c.element.hidden,false);
 c.renderOpponentHistory({tournaments:[],profile:null,fitpMetadata:{ranking:'1.11'}});
 assert.equal(c.element.textContent,'1.11 FITP');
 c.renderOpponentHistory({tournaments:[],profile:null});
 assert.equal(c.element.hidden,true);
});
