import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {allPlayerIdAuditSql,allPlayerIdAuditResult,cloudflareAuditError} from '../lib/all-player-id-audit.mjs';
const guid='22cc93f0-672e-41ee-85f1-561829ed9315';
function fixture(){const d=database({identityMapping:true});d.execute('CREATE TABLE manual_overrides(id TEXT,entity_type TEXT,entity_id TEXT,action TEXT,payload TEXT,active INTEGER)');return d;}
function add(d,key,circuit,id,name){d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,name.toUpperCase(),name,JSON.stringify({name,birthYear:2014,nationality:'GER'})]);}
async function audit(d){return allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]);}
test('D1_TEST_INITIAL_IMPORT: one ID per person suffices; multi-circuit aliases and excluded record are counted correctly',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456','Adam Ben-Amor');add(d,'te','tennis-europe',guid,'Adam Ben-Amor');add(d,'i','itf','800123456','Other Player');add(d,'tennis-europe|name:MOEZ BEN AMOR','tennis-europe','','Moez Ben-Amor');await syncPlayerIdentities(d.query);
  const result=await audit(d);assert.equal(result.passed,true);assert.equal(result.players,2);assert.equal(result.players_with_id,2);assert.equal(result.players_without_id,0);assert.equal(result.players_with_multiple_circuits,1);assert.equal(result.excluded_records,1);assert.equal(result.unmapped_or_ambiguous_sources,0);
  assert.deepEqual([result.fitp_ids,result.tennis_europe_ids,result.itf_ids],[1,1,1]);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated full audits perform no writes or exports',async()=>{
 const d=fixture();try{add(d,'f','fitp','123456','Player One');await syncPlayerIdentities(d.query);const writes=d.writes();assert.deepEqual(await audit(d),await audit(d));assert.equal(d.writes(),writes);
  const script=readFileSync(new URL('../scripts/all-player-id-audit.mjs',import.meta.url),'utf8');assert.doesNotMatch(script,/writeFile|console\.log\([^\n]*payload/);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: a newly missing person fails until a valid circuit ID is mapped',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456','Player One');await syncPlayerIdentities(d.query);assert.equal((await audit(d)).passed,true);
  add(d,'missing','itf','name:Other Player','Other Player');await syncPlayerIdentities(d.query);let result=await audit(d);assert.equal(result.passed,false);assert.equal(result.players_without_id,1);
  d.execute("UPDATE search_acquired_players SET official_id='800123456' WHERE source_key='missing'");await syncPlayerIdentities(d.query);result=await audit(d);assert.equal(result.passed,true);assert.equal(result.players_without_id,0);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: unmapped observed/configured/manual profiles, pending mapping and empty mapping cannot pass',async()=>{
 const d=fixture();try{
  assert.equal((await audit(d)).passed,false);add(d,'f','fitp','123456','Player One');await syncPlayerIdentities(d.query);
  add(d,'new','itf','800123456','New Player');let result=await audit(d);assert.equal(result.passed,false);assert.equal(result.unmapped_or_ambiguous_sources,1);assert.equal(result.pending_mapping,1);
  await syncPlayerIdentities(d.query);assert.equal((await audit(d)).passed,true);
  d.execute("INSERT INTO app_players(id,payload,seq) VALUES('unmapped-configured','{}',1)");d.execute("INSERT INTO manual_overrides VALUES('override','player','unmapped-manual','upsert','{}',1)");result=await audit(d);assert.equal(result.passed,false);assert.equal(result.unmapped_or_ambiguous_sources,2);
 }finally{d.close()}
});


test('Cloudflare audit failures preserve actionable error codes and redact secrets and quoted source values',()=>{
 const error=cloudflareAuditError(400,{errors:[{code:7500,message:"no such table: missing_table; token secret_token; account secret_account; source 'Moez Ben-Amor'; 22cc93f0-672e-41ee-85f1-561829ed9315"}]},['secret_token','secret_account']);
 assert.match(error,/7500/);assert.match(error,/no such table: missing_table/);assert.doesNotMatch(error,/secret_token|secret_account|Moez|22cc93f0/);
 assert.match(cloudflareAuditError(400,{errors:[{code:7500,message:'Your account has exceeded daily row read limit.'}]}),/daily row read limit/);
});
