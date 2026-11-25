import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {identityReviewKey} from '../lib/identity-review-queue.mjs';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,verifyPartitions,applyThreeReviews} from '../scripts/apply-three-reviewed-identities.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('./fixtures/three-reviewed-identities.json',import.meta.url)));
function seed(d){
 for(const r of rows){
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.payload]);
  d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[r.canonical_id,r.name_key,'{}']);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[r.source_key,r.canonical_id,r.name_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.birth_year,r.nationality,r.profile_url]);
 }
 d.execute('DELETE FROM player_identity_pending_sources');
}
test('exact user partitions keep all Mazzotta/Gallo homonyms separate and join the three Pepe circuits',()=>{
 const plan=buildIdentityMapping(rows,{currentLinks:rows,confirmedLinks:approvedRules().map(r=>JSON.parse(r.value))});
 assert.equal(verifyPartitions(plan.links).length,3);
 assert.equal(approvedRules().length,4);assert.equal(approval.groups.length,3);
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: real SQLite application, case closure, raw preservation and replay',async()=>{
 const d=database({identityMapping:true});try{
  seed(d);for(const g of approval.groups)d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewKey(g.nameKey),JSON.stringify({id:g.caseId}),'2026-11-25']);const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
  const result=await applyThreeReviews(d.query);assert.equal(result.summary.closedCases,3);assert.equal(result.summary.verified.length,3);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewCase:%'").length,0);
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
  assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewDecision:%'").length,3);
  const before=d.writes();assert.equal((await applyThreeReviews(d.query)).status,'already_completed');assert.equal(d.writes(),before);
  const r=rows.find(r=>r.name_key==='ENRICO PEPE');d.execute('UPDATE observed_players SET payload=? WHERE source_key=?',[JSON.stringify({...JSON.parse(r.payload),club:'updated retained club'}),r.source_key]);
  await syncPlayerIdentities(d.query);
  verifyPartitions(d.execute("SELECT * FROM player_circuit_identities WHERE name_key IN ('EDOARDO MAZZOTTA','ENRICO PEPE','EDOARDO GALLO')"));
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing approved native identity prevents all writes',async()=>{
 const d=database({identityMapping:true});try{seed(d);d.execute("DELETE FROM observed_players WHERE official_id='800704508'");const before=d.writes();await assert.rejects(applyThreeReviews(d.query),/original_source_missing/);assert.equal(d.writes(),before);}finally{d.close();}
});

test('new native IDs reopen review and prevent applying an outdated decision',async()=>{
 const d=database({identityMapping:true});try{
  seed(d);const r=rows[0];
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:9999999999','fitp','9999999999',r.normalized_name,r.display_name,r.payload]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['fitp|id:9999999999',r.canonical_id,r.name_key,'fitp','9999999999',r.normalized_name,r.display_name]);
  const before=d.writes();await assert.rejects(applyThreeReviews(d.query),/native_scope_changed/);assert.equal(d.writes(),before);
 }finally{d.close();}
});

test('production source variants complete the same approved partitions',async()=>{
 const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/three-reviewed-live-before.json',import.meta.url)));
 const d=database({identityMapping:true});try{
  for(const r of actual){
   d.execute('INSERT INTO '+r.source_table+'(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.payload]);
   d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[r.canonical_id,r.name_key,'{}']);
   d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[r.source_key,r.canonical_id,r.name_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.birth_year,r.nationality,r.profile_url]);
  }
  // Resume after the first production attempt already saved the original rules.
  for(const rule of approvedRules()){
   const value=JSON.parse(rule.value);delete value.sourceKeys;
   d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[rule.key.replace(':retained-v2',''),JSON.stringify(value),'2026-11-25']);
  }
  const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
  const result=await applyThreeReviews(d.query);assert.equal(result.summary.closedCases,3);
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
  const links=d.execute("SELECT * FROM player_circuit_identities WHERE name_key='ENRICO PEPE'");
  assert.equal(new Set(links.map(r=>r.canonical_id)).size,1);
  const before=d.writes();assert.equal((await applyThreeReviews(d.query)).status,'already_completed');assert.equal(d.writes(),before);
 }finally{d.close();}
});
