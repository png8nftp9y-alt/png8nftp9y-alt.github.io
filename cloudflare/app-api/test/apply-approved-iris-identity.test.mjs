import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {applyIrisIdentity} from '../scripts/apply-approved-iris-identity.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/iris-grosso-identity-20261025.json',import.meta.url)));
async function seed(d){
 const statements=[];
 for(const r of fixture.sources)statements.push({sql:'INSERT INTO '+r.source_table+'(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',values:[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,JSON.stringify(r.payload)]});
 for(const r of fixture.search)statements.push({sql:'INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?)',values:[r.canonicalId,'GROSSO IRIS',JSON.stringify(r)]});
 for(const r of fixture.links)statements.push({sql:'INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',values:[r.source_key,r.canonical_id,r.name_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.birth_year,r.nationality,r.profile_url]});
 statements.push({sql:'INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',values:[fixture.savedCase.key,JSON.stringify(fixture.savedCase.value),fixture.savedCase.updated_at]});
 statements.push({sql:'DELETE FROM player_identity_pending_sources',values:[]});await d.db.batch(statements);
}
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: actual Iris records unify, search returns one GBR result, review closes and raw ITA evidence survives; ordinary update and completed replay retain result',async()=>{
 const d=database({identityMapping:true});try{
  await seed(d);d.execute("INSERT INTO app_state(key,value,updated_at) VALUES('confirmedPlayerCircuitLink:old','{\"nameKey\":\"OTHER PERSON\",\"identities\":[{\"circuit\":\"fitp\",\"officialId\":\"1111111111\"},{\"circuit\":\"itf\",\"officialId\":\"800000001\"}]}','now')");
  const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key'),acquired=d.execute('SELECT * FROM search_acquired_players ORDER BY source_key');
  const r=await applyIrisIdentity(d.query,{db:d.db});assert.equal(r.summary.nativeIdsVerified,3);assert.equal(r.summary.searchEntries,1);assert.equal(r.summary.nationality,'GBR');assert.equal(r.summary.reviewCase,'closed');
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);assert.deepEqual(d.execute('SELECT * FROM search_acquired_players ORDER BY source_key'),acquired);assert.equal(d.execute("SELECT * FROM app_state WHERE key='confirmedPlayerCircuitLink:old'").length,1);
  assert.equal(d.execute('SELECT * FROM app_state WHERE key=?',[fixture.savedCase.key]).length,0);
  d.execute("UPDATE search_acquired_players SET payload=json_set(payload,'$.club','Updated') WHERE source_key='acquired|itf|id:800748612'");await syncPlayerIdentities(d.query);
  assert.equal(d.execute("SELECT DISTINCT canonical_id FROM player_circuit_identities WHERE name_key='GROSSO IRIS'").length,1);
  assert.equal(JSON.parse(d.execute('SELECT payload FROM player_identity_people WHERE canonical_id=?',[r.summary.canonicalId])[0].payload).nationality,'GBR');
  const writes=d.writes(),calls=[];assert.equal((await applyIrisIdentity(sql=>{calls.push(sql);return d.query(sql)},{db:d.db})).status,'already_completed');assert.equal(calls.length,1);assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: a missing approved native ID fails before writes',async()=>{
 const d=database({identityMapping:true});try{await seed(d);d.execute("DELETE FROM player_circuit_identities WHERE circuit='itf'");const writes=d.writes();await assert.rejects(applyIrisIdentity(d.query,{db:d.db}),/iris_native_id_missing/);assert.equal(d.writes(),writes);}finally{d.close()}
});
test('unexpected fourth native ID or missing original cannot be merged by this approval',async()=>{
 const d=database({identityMapping:true});try{await seed(d);d.execute("INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES('other','other','GROSSO IRIS','fitp','9999999999','IRIS GROSSO','Iris Grosso')");const writes=d.writes();await assert.rejects(applyIrisIdentity(d.query,{db:d.db}),/iris_sources_changed/);assert.equal(d.writes(),writes);}finally{d.close()}
});
