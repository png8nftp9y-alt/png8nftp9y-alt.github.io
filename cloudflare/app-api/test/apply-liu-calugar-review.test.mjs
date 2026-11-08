import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {identityReviewKey} from '../lib/identity-review-queue.mjs';
import {approval,applyLiuCalugarReviews} from '../scripts/apply-liu-calugar-review.mjs';

const oldRule='confirmedPlayerCircuitLink:approved-three-itf-20261024:liu-yichen:0';
const alias='cw-6f161c0e35db01e70b5a9220b6856b43';

function seed(d, omit=''){
 for(const group of approval.groups){
  const first=group.partitions[0][0];
  for(const native of group.partitions.flat()){
   if(native===omit)continue;
   const [circuit,id]=native.split('|');
   const canonical=native.startsWith('tennis-europe|ecfa')||native.startsWith('tennis-europe|bc0f')?first:native;
   const name=group.nameKey;
   const payload=JSON.stringify({name,officialId:id,nationality:name==='LIU YICHEN'?'CHN':'ROU'});
   d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[native,circuit,id,name,name,payload]);
   d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[canonical,name,payload]);
   d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[native,canonical,name,circuit,id,name,name]);
  }
  d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewKey(group.nameKey),'{}','2026-11-08']);
 }
 d.execute('INSERT INTO player_identity_aliases(alias_id,canonical_id) VALUES(?,?)',[alias,'cw-3b74f341d08a7696d7ae0e96b7211113']);
 const legacy={nameKey:'LIU YICHEN',identities:[
  {circuit:'itf',officialId:'800794057'},
  {circuit:'tennis-europe',officialId:'ecfa5792-feca-4610-b16e-0798f597c180'},
 ]};
 d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[oldRule,JSON.stringify(legacy),'2026-10-24']);
}

test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES',async()=>{
 const d=database({identityMapping:true});
 try{
  seed(d);
  const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
  const {summary}=await applyLiuCalugarReviews(d.query);
  assert.equal(summary.closedCases,2);
  assert.deepEqual(summary.verified.map(g=>g.partitions.map(p=>p.ids.length)),[[2,2,1],[1,1,1]]);
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
  assert.equal(d.execute('SELECT key FROM app_state WHERE key=?',[oldRule]).length,0);
  const writes=d.writes();
  assert.equal((await applyLiuCalugarReviews(d.query)).status,'already_completed');
  assert.equal(d.writes(),writes);
 }finally{d.close();}
});

test('D1_TEST_INCOMPLETE_SOURCE_GUARD',async()=>{
 const d=database({identityMapping:true});
 try{
  seed(d,'itf|800882252');
  const writes=d.writes();
  await assert.rejects(applyLiuCalugarReviews(d.query),/review_native_scope_changed/);
  assert.equal(d.writes(),writes);
 }finally{d.close();}
});
