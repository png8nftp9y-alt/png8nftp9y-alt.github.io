import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {identityReviewKey} from '../lib/identity-review-queue.mjs';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,verifyPartitions,applyFiveReviews} from '../scripts/apply-five-reviewed-identities.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('./fixtures/five-reviewed-identities.json',import.meta.url)));
function seed(d){
 for(const r of rows){
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.payload]);
  d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[r.canonical_id,r.name_key,'{}']);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[r.source_key,r.canonical_id,r.name_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.birth_year,r.nationality,r.profile_url]);
 }
 d.execute('DELETE FROM player_identity_pending_sources');
}
test('all exact approved partitions preserve Canadian Cao, FITP 3.4 and both Lopez identities',()=>{
 const plan=buildIdentityMapping(rows,{currentLinks:rows,confirmedLinks:approvedRules().map(r=>JSON.parse(r.value))});
 assert.equal(verifyPartitions(plan.links).length,5);
 const thoma=plan.people.find(p=>p.name_key==='BOGATYREV THOMA');assert.equal(JSON.parse(thoma.payload).nationality,'AUS');
 assert.equal(approvedRules().length,5);assert.equal(approval.groups.length,5);
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: real SQLite application, case closure, raw preservation and replay',async()=>{
 const d=database({identityMapping:true});try{
  seed(d);for(const g of approval.groups)d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewKey(g.nameKey),JSON.stringify({id:g.caseId}),'2026-10-28']);const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
  const result=await applyFiveReviews(d.query);assert.equal(result.summary.closedCases,5);assert.equal(result.summary.verified.length,5);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewCase:%'").length,0);
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
  assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewDecision:%'").length,5);
  const before=d.writes();assert.equal((await applyFiveReviews(d.query)).status,'already_completed');assert.equal(d.writes(),before);
  const r=rows.find(r=>r.name_key==='BOGATYREV THOMA');d.execute('UPDATE observed_players SET payload=? WHERE source_key=?',[JSON.stringify({...JSON.parse(r.payload),club:'updated retained club'}),r.source_key]);
  await syncPlayerIdentities(d.query);
  verifyPartitions(d.execute("SELECT * FROM player_circuit_identities WHERE name_key IN ('CAO EMMA','LOPEZ LORENZO','BOGATYREV THOMA','FRANCESCONI TOMMASO','RYAN TANG')"));
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing approved native identity prevents all writes',async()=>{
 const d=database({identityMapping:true});try{seed(d);d.execute("DELETE FROM observed_players WHERE official_id='800747103'");const before=d.writes();await assert.rejects(applyFiveReviews(d.query),/original_source_missing/);assert.equal(d.writes(),before);}finally{d.close();}
});
