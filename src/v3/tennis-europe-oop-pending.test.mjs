import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inventoryOopPage,requireOopCompleteness} from './tennis-europe-oop-completeness.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/te-live-pending-41733397435.json',import.meta.url)));
function example(f){
 const page=inventoryOopPage(f.evidenceHtml,f.competitionId,f.date);
 // Acquired pending-slot contract; schedule metadata is synthetic in this unit fixture.
 const m={id:'stored-slot',competitionId:f.competitionId,date:f.date,event:f.event,round:f.round,players:f.players,opponentPending:true,status:'scheduled',score:'',winnerPlayerIds:[],sourceUrl:f.sourceUrl,court:'Synthetic fixture court',courtMatchNumber:1,courtMatchNumberSource:'official_schedule_subheader'};
 return {tournament:{competitionId:f.competitionId},pages:[page],matches:[m],asOf:'2026-11-03'};
}
test('real Kalymnos and Vierumaki future cards pass only as actually acquired pending-opponent slots',()=>{
 assert.equal(fixtures.length,2);
 for(const f of fixtures){const args=example(f);const r=requireOopCompleteness(args);assert.equal(r.status,'complete');assert.equal(r.days[0].pendingOpponents,1);assert.equal(r.days[0].covered,1);assert.equal(args.matches[0].status,'scheduled');assert.equal(args.matches[0].players.length,1);}
});
test('pending exemption never hides a missing slot, wrong identity/day/round, missing schedule or completed result',()=>{
 for(const f of fixtures){
  const initial=example(f);
  for(const change of [{players:[{id:'wrong',name:f.players[0].name}]},{date:'20261105'},{round:'Final'},{event:'BS12'},{sourceUrl:'https://example.org'},{opponentPending:false},{courtMatchNumber:null},{courtMatchNumberSource:''},{court:''},{status:'completed'},{score:'6-0 6-0'},{winnerPlayerIds:[f.players[0].id]}]){
   assert.throws(()=>requireOopCompleteness({...initial,matches:[{...initial.matches[0],...change}]}),/unresolved/);
  }
  assert.throws(()=>requireOopCompleteness({...initial,matches:[]}),/unresolved/);
  assert.throws(()=>requireOopCompleteness({...initial,asOf:'2026-11-05'}),/unresolved/);
  assert.throws(()=>requireOopCompleteness({...initial,asOf:''}),/unresolved/);
  for(const change of [{score:'W/O'},{score:'6-0 6-0'},{winnerIds:[f.players[0].id]},{retired:true}]){
   assert.throws(()=>requireOopCompleteness({...initial,pages:[{...initial.pages[0],cards:[{...initial.pages[0].cards[0],...change}]}]}),/unresolved/);
  }
 }
});
import vm from 'node:vm';
import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
import {tennisEuropeOopDates} from './tennis-europe-source-discovery.mjs';
import {officialRetirement} from './tennis-europe-retirement.mjs';
test('production live parser preserves both actual card bodies as scheduled pending slots accepted by audit',()=>{
 const source=readFileSync(new URL('./run-tennis-europe-oop-live.mjs',import.meta.url),'utf8');
 const context=vm.createContext({URL,process:{env:{}},tennisEuropeParticipant,tennisEuropeOopDates,officialRetirement});
 vm.runInContext(source.slice(source.indexOf("const BASE="),source.indexOf('const manualMatches='))+';globalThis.parse=parsePage;',context);
 for(const f of fixtures){
  // Synthetic surrounding schedule exercises the production parser; body is exact failed-run evidence.
  const prefix='<h5 class="match-group__header">Synthetic court</h5><li class="match-group__item"><div class="match-group__subheader">1. Starting at 10:00</div>';
  const matches=context.parse(prefix+f.evidenceHtml,f.competitionId,f.date);
  assert.equal(matches.length,1);assert.equal(matches[0].opponentPending,true);assert.equal(matches[0].status,'scheduled');
  const args=example(f);args.matches=matches;
  assert.equal(requireOopCompleteness(args).days[0].pendingOpponents,1);
 }
});
