import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
import {currentRankingCategoryAllowed} from '../lib/current-ranking-category.mjs';
test('current categories follow calendar-year upper age limits without guessing missing birth years',()=>{
 assert.equal(currentRankingCategoryAllowed('B14',{birthYear:2011},2026),false);
 assert.equal(currentRankingCategoryAllowed('B16',{birthYear:2011},2026),true);
 assert.equal(currentRankingCategoryAllowed('G14',{birthYear:2012},2026),true);
 assert.equal(currentRankingCategoryAllowed('G16',{birthYear:2009},2026),false);
 assert.equal(currentRankingCategoryAllowed('B14',{},2026),true);
});
test('player ranking response excludes aged-out U14 while retaining stored history and performing zero writes',async()=>{
 const d=database({identityMapping:true});try{
  const year=new Date().getUTCFullYear(),guid='12345678-1234-1234-1234-123456789abc';
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['person:test','PLAYER TEST',JSON.stringify({canonicalId:'person:test',name:'Test Player',birthYear:year-15})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['selected','person:test','PLAYER TEST','tennis-europe',guid,'TEST PLAYER','Test Player']);
  for(const [category,date,ranking] of [['B14',`${year-1}-12-01`,10],['B16',`${year}-10-01`,50]])d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[guid,date,'pub','week',category,ranking,'Test Player','test player','https://example.test',date]);
  const before=d.writes(),r=await worker.fetch(new Request('https://example.test/app/api/player-ranking?playerId=person:test&name=Test%20Player',{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}}),{DB:d.db});
  assert.equal(r.status,200);assert.deepEqual((await r.json()).rankings.map(r=>r.category),['B16']);
  assert.equal(d.execute('SELECT COUNT(*) AS n FROM tennis_europe_ranking_history')[0].n,2);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('UI filters aged-out categories in live rows, cached rows and legacy summary labels',()=>{
 const s=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),block=s.slice(s.indexOf('function currentRankingCategoryAllowed('),s.indexOf('async function loadCurrentPlayerRanking('));
 const ctx={Date,readableText:x=>String(x)};vm.createContext(ctx);vm.runInContext(block,ctx);
 const player={birthYear:new Date().getUTCFullYear()-15,tennisEuropeRanking:'n°10 TE U14 · n°50 TE U16'};
 assert.deepEqual(Array.from(ctx.currentPlayerRankingLabels(player,[{category:'B14',ranking:10},{category:'B16',ranking:50}])),['n°50 TE U16']);
 assert.deepEqual(Array.from(ctx.currentPlayerRankingLabels(player)),['n°50 TE U16']);
 assert.ok(s.includes('labels = currentPlayerRankingLabels(player, cached?.rankings || []);'));
});
