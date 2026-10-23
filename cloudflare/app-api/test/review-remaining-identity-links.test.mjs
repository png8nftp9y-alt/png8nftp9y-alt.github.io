import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {reviewRemainingIdentityLinks} from '../scripts/review-remaining-identity-links.mjs';
// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/personal-native-identity-evidence.json',import.meta.url)));
function setup(){const d=database({identityMapping:true});d.execute('CREATE TABLE fitp_player_metadata(membership_card TEXT PRIMARY KEY,club TEXT,ranking TEXT,updated_at TEXT)');d.execute('CREATE TABLE opponent_entry_profiles(circuit TEXT,source_player_id TEXT,display_name TEXT,payload TEXT,updated_at TEXT)');return d;}
function insert(d,g){for(const s of g.sources){const p=JSON.stringify(s.payload),person=s.person_id;
 if(s.circuit==='courtwatch')d.execute('INSERT INTO app_players(id,payload) VALUES(?,?)',[s.official_id,p]);
 else d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,p]);
 d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[person,g.name,'{}']);
 d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality,birth_year) VALUES(?,?,?,?,?,?,?,?,?)',[s.source_key,person,g.name,s.circuit,s.official_id,s.normalized_name,s.display_name,s.nationality,s.birth_year]);
 }d.execute('DELETE FROM player_identity_pending_sources');}
test('D1_TEST_INITIAL_IMPORT: actual Vitali repair verifies every source and preserves unrelated card and raw documents; D1_TEST_IDENTICAL_ZERO_WRITES: completed run reads only checkpoint',async()=>{const d=setup();try{
 const g=fixture.find(g=>g.name==='FILIPPO VITALI');insert(d,g);const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key'),personal=d.execute('SELECT * FROM app_players');
 d.execute('INSERT INTO fitp_player_metadata VALUES(?,?,?,?)',['4246777481','Tennis Club Lecco','3.3','2026-10-24']);
 d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?)',['tennis-europe','6D381ABF-684B-48A4-8F31-7AB2DF775C3D','Filippo Vitali',JSON.stringify({birthYear:2014}),'2026-10-24']);
 const report=await reviewRemainingIdentityLinks(d.query,{names:[g.name]});assert.equal(report.summary.groupsWithExactBindingsRepaired,1);assert.equal(report.summary.groupsStillSplit,1);assert.equal(report.reviews[0].afterPeople,2);assert.equal(report.reviews[0].retainedProfiles.length,1);assert.equal(report.reviews[0].fitpMetadata[0].club,'Tennis Club Lecco');
 const saved=report.reviews[0].saved,own=saved.find(r=>r.source_key==='courtwatch|filippo-vitali').person_id;assert.equal(saved.find(r=>r.source_key==='fitp|id:4246777481').person_id,own);assert.notEqual(saved.find(r=>r.source_key==='fitp|id:0766246839').person_id,own);
for(const old of new Set(g.sources.filter(r=>r.official_id!=='0766246839').map(r=>r.person_id)))assert.equal(d.execute('SELECT canonical_id FROM player_identity_aliases WHERE alias_id=?',[old])[0]?.canonical_id,own);
 assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);assert.deepEqual(d.execute('SELECT * FROM app_players'),personal);
 const before=d.writes(),queries=[];assert.equal((await reviewRemainingIdentityLinks(sql=>{queries.push(sql);return d.query(sql)},{names:[g.name]})).status,'already_completed');assert.equal(d.writes(),before);assert.equal(queries.length,1);
}finally{d.close()}});
test('D1_TEST_REAL_DELTAS_ONLY: already correct actual personal binding receives no mapping writes',async()=>{const d=setup();try{const g=fixture.find(g=>g.name==='ANGELINI LORENZO');insert(d,g);const writes=[];await reviewRemainingIdentityLinks(sql=>{if(/^(INSERT|UPDATE|DELETE)/.test(sql))writes.push(sql);return d.query(sql)},{names:[g.name]});assert.equal(writes.length,1);assert.ok(writes[0].startsWith('INSERT INTO app_state'));}finally{d.close()}});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing group cannot be acknowledged as completed',async()=>{const d=setup();try{const before=d.writes();await assert.rejects(reviewRemainingIdentityLinks(d.query,{names:['ABSENT PLAYER']}),/group_missing/);assert.equal(d.writes(),before);await assert.rejects(reviewRemainingIdentityLinks(d.query,{names:[]}),/scope_invalid/);}finally{d.close()}});
