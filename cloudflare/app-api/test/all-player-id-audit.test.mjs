import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storedIdentity,mappedProfiles} from '../lib/player-identity-lookup.mjs';
import {loadPlayerIdDiagnostics} from '../lib/admin-player-id-diagnostics.mjs';
import {spawnSync} from 'node:child_process';
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
  const rows=await loadPlayerIdDiagnostics(d.db);assert.ok(rows.every(row=>row.ids===1&&row.players===1&&row.missing===0));
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
  add(d,'missing','itf','name:Other Player','Other Player');await syncPlayerIdentities(d.query);let result=await audit(d);assert.equal(result.passed,false);assert.equal(result.players_without_id,1);assert.deepEqual(JSON.parse(result.missing_by_link_circuit),[{circuit:'itf',players:1}]);
  d.execute("UPDATE search_acquired_players SET official_id='800123456' WHERE source_key='missing'");await syncPlayerIdentities(d.query);result=await audit(d);assert.equal(result.passed,true);assert.equal(result.players_without_id,0);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: unmapped observed/configured/manual profiles, pending mapping and empty mapping cannot pass',async()=>{
 const d=fixture();try{
  assert.equal((await audit(d)).passed,false);add(d,'f','fitp','123456','Player One');await syncPlayerIdentities(d.query);
  add(d,'new','itf','800123456','New Player');let result=await audit(d);assert.equal(result.passed,false);assert.equal(result.unmapped_or_ambiguous_sources,1);assert.equal(result.pending_mapping,1);
  await syncPlayerIdentities(d.query);assert.equal((await audit(d)).passed,true);
  d.execute("INSERT INTO app_players(id,payload,seq) VALUES('unmapped-configured','{}',1)");d.execute("INSERT INTO manual_overrides VALUES('override','player','unmapped-manual','upsert','{}',1)");result=await audit(d);assert.equal(result.passed,false);assert.equal(result.unmapped_or_ambiguous_sources,2);assert.deepEqual(JSON.parse(result.unmapped_by_source_class),[{source:'configured',records:1},{source:'override',records:1}]);
 }finally{d.close()}
});


test('Cloudflare audit failures preserve actionable error codes and redact secrets and quoted source values',()=>{
 const error=cloudflareAuditError(400,{errors:[{code:7500,message:"no such table: missing_table; token secret_token; account secret_account; source 'Moez Ben-Amor'; 22cc93f0-672e-41ee-85f1-561829ed9315"}]},['secret_token','secret_account']);
 assert.match(error,/7500/);assert.match(error,/no such table: missing_table/);assert.doesNotMatch(error,/secret_token|secret_account|Moez|22cc93f0/);
 assert.match(cloudflareAuditError(400,{errors:[{code:7500,message:'Your account has exceeded daily row read limit.'}]}),/daily row read limit/);
});


test('complete six-source audit compiles with a compound SELECT limit of three',async()=>{
 const d=fixture();try{
  const schema=(await d.query("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL")).map(row=>row.sql).join(';');
  const code="import sqlite3,json,sys\np=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.executescript(p['schema']);c.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,3)\ntry:\n c.execute('SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6');raise Exception('original regression not reproduced')\nexcept sqlite3.OperationalError as e:\n assert 'too many terms' in str(e)\nc.execute(p['sql']).fetchall()\n";
  const result=spawnSync('python3',['-c',code],{encoding:'utf8',input:JSON.stringify({schema,sql:allPlayerIdAuditSql})});assert.equal(result.status,0,result.stderr);
 }finally{d.close()}
});


test('configured players with stored native profile URLs are covered in FITP, TE and ITF',async()=>{
 const d=fixture();try{
  const urls=['https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('1234567890'), 'https://te.tournamentsoftware.com/player-profile/'+guid, 'https://www.itftennis.com/en/players/test-person/800123456/ger/jt/s/overview/'];
  for(let i=0;i<urls.length;i++)d.execute('INSERT INTO app_players(id,payload,seq) VALUES(?,?,?)',['configured'+i,JSON.stringify({name:['Ada Example','Bela Sample','Ciro Fixture'][i],nationality:'GER',birthYear:2014,profileUrl:urls[i]}),i]);
  await syncPlayerIdentities(d.query);const result=await audit(d);assert.equal(result.passed,true);assert.equal(result.players_with_id,3);assert.equal(result.players_without_id,0);assert.deepEqual([result.fitp_ids,result.tennis_europe_ids,result.itf_ids],[1,1,1]);const rows=await loadPlayerIdDiagnostics(d.db);assert.ok(rows.every(row=>row.ids===1&&row.players===1&&row.missing===0));
 }finally{d.close()}
});

test('personal and membership source-key lookups resolve exactly as the application does',async()=>{
 const d=fixture();try{
  add(d,'acquired|f','fitp','123456','Player One');await syncPlayerIdentities(d.query);
  d.execute("INSERT INTO user_app_players VALUES('owner','acquired|f','today')");
  d.execute("INSERT INTO user_app_player_additions VALUES('owner','acquired|f','old-observed-source','{}','today')");
  const result=await audit(d);assert.equal(result.unmapped_or_ambiguous_sources,0);assert.equal(result.players_with_id,1);
 }finally{d.close()}
});

test('foreign native profiles and malformed encoded FITP cards cannot pass ID coverage',async()=>{
 const d=fixture();try{
  d.execute("INSERT INTO app_players(id,payload,seq) VALUES('configured','{\"name\":\"Player One\"}',1)");await syncPlayerIdentities(d.query);
  for(const profile of [{circuit:'tennis-europe',url:'https://example.com/player-profile/'+guid},{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('123456\0bad')},{circuit:'itf',url:'https://www.itftennis.com/en/players/player/80012345x/ger/jt/s/overview/'}]){
   d.execute('UPDATE player_identity_people SET payload=? WHERE canonical_id=?',[JSON.stringify({name:'Player One',circuitProfiles:[profile]}),'configured']);
   assert.equal((await audit(d)).players_without_id,1);
  }
 }finally{d.close()}
});


test('unresolved and ambiguous references are distinguished without exporting identities',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456','Player One');add(d,'other','itf','800123456','Player Two');await syncPlayerIdentities(d.query);
  d.execute("INSERT INTO user_app_players VALUES('owner','unknown-reference','today')");
  let result=await audit(d);assert.deepEqual(JSON.parse(result.unmapped_mapping_breakdown),[{source:'membership',mapped_players:0,records:1}]);
  const ids=await d.query("SELECT canonical_id FROM player_circuit_identities WHERE source_key IN ('f','other') ORDER BY source_key");
  d.execute("INSERT INTO player_identity_aliases VALUES('f',?)",[ids[1].canonical_id]);
  d.execute("INSERT INTO user_app_players VALUES('owner','f','today')");
  result=await audit(d);assert.deepEqual(JSON.parse(result.unmapped_mapping_breakdown),[{source:'acquired',mapped_players:2,records:1},{source:'membership',mapped_players:0,records:1},{source:'membership',mapped_players:2,records:1}]);assert.equal(result.passed,false);
  assert.equal(result.unresolved_refs_to_excluded_identity,0);
 }finally{d.close()}
});


test('explicit canonical alias redirects override retained canonical rows for app and audit',async()=>{
 const d=fixture();try{
  add(d,'f','fitp','123456','Player One');add(d,'other','itf','800123456','Player Two');await syncPlayerIdentities(d.query);
  const ids=await d.query("SELECT canonical_id FROM player_circuit_identities WHERE source_key IN ('f','other') ORDER BY source_key");
  const old=ids[0].canonical_id,target=ids[1].canonical_id;
  d.execute('UPDATE player_identity_aliases SET canonical_id=? WHERE alias_id=?',[target,old]);
  d.execute("INSERT INTO user_app_players VALUES('owner',?,'today')",[old]);
  d.execute("INSERT INTO user_app_player_additions VALUES('owner',?,'f','{}','today')",[old]);
  const result=await audit(d);assert.equal(result.unmapped_or_ambiguous_sources,0);assert.equal(result.passed,true);
  const person=await storedIdentity(d.db,old);assert.equal(person.canonicalId,target);assert.equal((await storedIdentity(d.db,'f')).canonicalId,target);
  const players=[{id:old,sourceKey:'f'}];const profiles=await mappedProfiles(d.db,players);assert.deepEqual(profiles.get(players[0]),person.circuitProfiles);
  assert.equal((await d.query('SELECT COUNT(*) AS n FROM player_identity_people'))[0].n,2);
 }finally{d.close()}
});
