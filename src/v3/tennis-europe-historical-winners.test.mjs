import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {tennisEuropeParticipant} from './tennis-europe-metadata.mjs';
import {tennisEuropeOopDates} from './tennis-europe-source-discovery.mjs';
import {officialRetirement} from './tennis-europe-retirement.mjs';
import {inventoryOopPage,requireOopCompleteness} from './tennis-europe-oop-completeness.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/te-historical-winners-41733397384.json',import.meta.url)));
for(const name of ['backfill-tennis-europe-oop-shard','recover-tennis-europe-oop-shard','run-tennis-europe-oop-live'])test(name+': five real official winners survive nested rows, empty scores and unusual scoring',()=>{
 const s=readFileSync(new URL('./'+name+'.mjs',import.meta.url),'utf8');
 const context=vm.createContext({URL,resumeSource:null,process:{env:{}},tennisEuropeParticipant,tennisEuropeOopDates,officialRetirement});
 vm.runInContext(s.slice(s.indexOf('const BASE='),s.indexOf('const manualMatches='))+';globalThis.parse=parsePage;',context);
 assert.equal(fixtures.length,5);
 for(const f of fixtures){
  // Exact card body; synthetic preceding court/order header because failed artifacts retain only card excerpts.
  const prefix='<h5 class="match-group__header">Synthetic court</h5><li class="match-group__item"><div class="match-group__subheader">1. Starting at 10:00</div>';
  const matches=context.parse(prefix+f.evidenceHtml,f.competitionId,f.date);
  assert.equal(matches.length,1);assert.equal(matches[0].status,'completed');
  assert.deepEqual([...matches[0].winnerPlayerIds].sort(),[...f.winnerIds].sort());
  assert.equal(matches[0].score,f.score);
  const pages=[inventoryOopPage(f.evidenceHtml,f.competitionId,f.date)];
  assert.equal(requireOopCompleteness({tournament:{competitionId:f.competitionId},pages,matches}).status,'complete');
 }
});
