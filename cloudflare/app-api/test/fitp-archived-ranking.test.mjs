import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichFitpMetadata} from '../lib/fitp-player-metadata.mjs';

test('archived FITP ranking is a dated fallback and preserves available rankings',async()=>{
 const cases=[
  {row:{observed_ranking:'3.2',observed_at:'2026-08-30'},expected:'3.2',fallback:true},
  {row:{observed_ranking:'4.NC',observed_at:'2026-09-12'},expected:'4.NC',fallback:true},
  {row:{ranking:'2.7',observed_ranking:'3.2'},expected:'2.7'},
  {row:{entry_ranking:JSON.stringify({ranking:'3.1'}),observed_ranking:'3.2'},expected:'3.1'},
  {row:{observed_ranking:'abc'},expected:undefined},
  {row:{observed_ranking:'3.2'},initial:'2.1',expected:'2.1'}
 ];
 for(const c of cases){
  const p={membershipCard:'123456',...(c.initial?{ranking:c.initial}:{})};
  await enrichFitpMetadata(null,[p],new Map([['123456',c.row]]));
  assert.equal(p.ranking,c.expected);
  if(c.fallback){
   assert.equal(p.fitpRankingSource,'observed');
   assert.equal(p.fitpRankingObservedAt,c.row.observed_at);
  }
 }
});

test('indexed query retrieves archived ranking without sheet metadata',async()=>{
 const {database}=await import('./search-sqlite-fixture.mjs');
 const d=database();
 try{
  d.execute('CREATE TABLE fitp_player_metadata(membership_card TEXT PRIMARY KEY,club TEXT,ranking TEXT,updated_at TEXT)');
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,last_observed_at,payload) VALUES(?,?,?,?,?,?,?)',
   ['fitp|id:9171628','fitp','9171628','ALYSSA COCCHI','Alyssa Cocchi','2026-08-30T23:30:45.467Z',JSON.stringify({ranking:'3.2'})]);
  const p={membershipCard:'9171628'};
  await enrichFitpMetadata(d.db,[p]);
  assert.equal(p.ranking,'3.2');
  assert.equal(p.fitpRankingObservedAt,'2026-08-30T23:30:45.467Z');
  assert.equal(p.fitpMetadataUpdatedAt,null);
 }finally{d.close()}
});
