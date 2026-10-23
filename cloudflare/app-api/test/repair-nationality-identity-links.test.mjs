// D1_TEST_INITIAL_IMPORT: the imported production-evidence test reconciles all seven sources.
// D1_TEST_IDENTICAL_ZERO_WRITES: the imported test replays the completed recovery and asserts zero writes.
// D1_TEST_REAL_DELTAS_ONLY: it preserves raw sources and followed IDs while reconciling affected groups.
import './nationality-identity-repair.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {repairNationalityIdentityLinks} from '../scripts/repair-nationality-identity-links.mjs';
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing original source stops before writes or checkpoint',async()=>{
 const d=database({identityMapping:true});try{
  d.execute("INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality) VALUES('missing-source','old','DAVID DUMITRU','tennis-europe','','DAVID DUMITRU','David Dumitru','ROM')");
  const before=d.writes();
  await assert.rejects(repairNationalityIdentityLinks(d.query),/nationality_repair_original_source_missing/);
  assert.equal(d.writes(),before);
  assert.equal((await d.query("SELECT key FROM app_state WHERE key='identityNationalityAliases:ROM-ROU:MGO-MNE:v1'")).length,0);
 }finally{d.close()}
});
