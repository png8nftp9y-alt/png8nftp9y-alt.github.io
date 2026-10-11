import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {perCircuitPlayerIdAuditSql,perCircuitPlayerIdAuditResult} from '../lib/per-circuit-player-id-audit.mjs';
import {allPlayerIdAuditSql,allPlayerIdAuditResult} from '../lib/all-player-id-audit.mjs';
const guid='22cc93f0-672e-41ee-85f1-561829ed9315';
function fixture(){const d=database({identityMapping:true});d.execute('CREATE TABLE manual_overrides(id TEXT,entity_type TEXT,entity_id TEXT,action TEXT,payload TEXT,active INTEGER)');return d;}
function add(d,key,circuit,id,name='Same Player'){d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,name.toUpperCase(),name,JSON.stringify({name,birthYear:2014,nationality:'GER'})]);}
async function audit(d){return perCircuitPlayerIdAuditResult(await d.query(perCircuitPlayerIdAuditSql));}
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY: one player in three circuits needs all three circuit IDs, even when the old audit is green',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456');add(d,'te','tennis-europe','');add(d,'i','itf','');await syncPlayerIdentities(d.query);
  assert.equal(allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]).passed,true);
  let r=await audit(d);assert.equal(r.passed,false);assert.deepEqual(r.circuits.map(c=>c.records_missing_circuit_id),[0,1,1]);
  d.execute('UPDATE search_acquired_players SET official_id=? WHERE source_key=?',[guid,'te']);d.execute("UPDATE search_acquired_players SET official_id='800123456' WHERE source_key='i'");await syncPlayerIdentities(d.query);
  r=await audit(d);assert.equal(r.passed,true);assert.deepEqual(r.circuits.map(c=>c.records_missing_circuit_id),[0,0,0]);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: separate people with valid own-circuit IDs pass without unification or a pending-map requirement',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456','Player One');add(d,'te','tennis-europe',guid,'Player Two');add(d,'i','itf','800123456','Player Three');
  const before=d.writes();const first=await audit(d);assert.equal(first.passed,true);assert.deepEqual(first.circuits.map(c=>c.source_records),[1,1,1]);assert.ok(first.circuits.every(c=>c.pending_mapping===3));assert.deepEqual(await audit(d),first);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: excluded legacy source stays excluded while another missing Europe record fails',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456');add(d,'te','tennis-europe',guid);add(d,'i','itf','800123456');add(d,'tennis-europe|name:MOEZ BEN AMOR','tennis-europe','','Moez Ben-Amor');await syncPlayerIdentities(d.query);
  let r=await audit(d);assert.equal(r.passed,true);assert.equal(r.circuits[1].source_records,1);assert.equal(r.circuits[1].excluded_records,1);
  add(d,'missing','tennis-europe','','Other Player');r=await audit(d);assert.equal(r.passed,false);assert.equal(r.circuits[1].records_missing_circuit_id,1);
 }finally{d.close()}
});
test('validated same-circuit stored profile covers a source with an empty field; foreign circuit cannot',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456');add(d,'te','tennis-europe',guid);add(d,'i','itf','800123456');await syncPlayerIdentities(d.query);
  const person=(await d.query("SELECT canonical_id FROM player_circuit_identities WHERE source_key='te'"))[0].canonical_id;
  d.execute("UPDATE search_acquired_players SET official_id='' WHERE source_key='te'");d.execute("UPDATE player_circuit_identities SET official_id='' WHERE source_key='te'");
  assert.equal((await audit(d)).circuits[1].records_missing_circuit_id,1);
  d.execute("INSERT INTO player_circuit_identities(source_key,canonical_id,circuit,official_id,name_key,profile_url,normalized_name,display_name) VALUES('courtwatch|configured',?,'courtwatch','configured','SAME PLAYER','','SAME PLAYER','Same Player')",[person]);
  d.execute('UPDATE player_identity_people SET payload=? WHERE canonical_id=?',[JSON.stringify({circuitProfiles:[{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/'+guid}]}),person]);
  const r=await audit(d);assert.equal(r.passed,true);assert.equal(r.circuits[1].records_with_direct_id,0);assert.equal(r.circuits[1].distinct_official_ids,1);
 }finally{d.close()}
});
test('per-circuit SQL compiles with the D1 compound SELECT limit of three',async()=>{
 const d=fixture();try{
  const schema=(await d.query("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL")).map(r=>r.sql).join(';');
  const code="import sqlite3,json,sys\np=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.executescript(p['schema']);c.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,3);c.execute(p['sql']).fetchall()\n";
  const r=spawnSync('python3',['-c',code],{encoding:'utf8',input:JSON.stringify({schema,sql:perCircuitPlayerIdAuditSql})});assert.equal(r.status,0,r.stderr);
 }finally{d.close()}
});
test('empty or incomplete circuit results cannot certify full per-circuit coverage',()=>{
 assert.equal(perCircuitPlayerIdAuditResult([]).passed,false);assert.equal(perCircuitPlayerIdAuditResult(null).passed,false);
 assert.equal(perCircuitPlayerIdAuditResult(['fitp','tennis-europe','itf'].map(circuit=>({circuit,source_records:0,records_with_circuit_id:0,records_missing_circuit_id:0}))).passed,false);
});
