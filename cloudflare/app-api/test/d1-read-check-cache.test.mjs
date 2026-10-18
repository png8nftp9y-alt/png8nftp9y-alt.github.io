import test from 'node:test';import assert from 'node:assert/strict';
import {cachedReadCheck} from '../lib/d1-read-check-cache.mjs';
import {database} from './search-sqlite-fixture.mjs';
const names=['profile-evidence','europe-profiles','native-profiles','search-sources','universal-counts','observed-counts','europe-counts'];
const create=()=>database({identityMapping:true,readChecks:true});
const check=(d,name,work=async()=>({verified:0}),version='v1',options)=>cachedReadCheck(d.query,name,version,work,options);
test('D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES: successful check reused with bounded schema and indexed checkpoint lookups and zero repeat writes',async()=>{
 const d=create();try{let calls=0;const work=async()=>{calls++;return{missing:0}};
 assert.equal((await check(d,'europe-profiles',work)).reused,false);const before=d.writes();let queries=0;
 const replay=await cachedReadCheck(async sql=>{queries++;assert.match(sql,/^SELECT (state,version,result_json,verified_at FROM d1_read_check_cache WHERE name=|name FROM sqlite_master)/);return d.query(sql)},'europe-profiles','v1',work);
 assert.equal(replay.reused,true);assert.equal(calls,1);assert.equal(queries,2);assert.equal(d.writes(),before);
 const plan=d.execute("EXPLAIN QUERY PLAN SELECT state FROM d1_read_check_cache WHERE name='europe-profiles'").map(r=>r.detail).join('\n');assert.match(plan,/SEARCH/);assert.doesNotMatch(plan,/SCAN/);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: dependency insert/update/delete invalidates checked result; repeated dirty changes coalesce',async()=>{
 const d=create();try{
 await check(d,'europe-profiles');const before=d.writes();
 d.execute("INSERT INTO player_identity_people VALUES('p','P','{}')");assert.equal(d.execute("SELECT state FROM d1_read_check_cache WHERE name='europe-profiles'")[0].state,'dirty');
 const after=d.writes();d.execute("UPDATE player_identity_people SET payload='{}' WHERE canonical_id='p'");assert.equal(d.writes()-after,1); // only the caller's UPDATE, no cache write
 assert.equal((await check(d,'europe-profiles')).reused,false);assert.equal((await check(d,'europe-profiles')).reused,true);
 d.execute("UPDATE player_identity_people SET payload='{\"nationality\":\"ITA\"}' WHERE canonical_id='p'");assert.equal((await check(d,'europe-profiles')).reused,false);
 d.execute("DELETE FROM player_identity_people WHERE canonical_id='p'");assert.equal((await check(d,'europe-profiles')).reused,false);assert.ok(d.writes()>before);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: failure and concurrent mutation cannot publish a reusable checkpoint',async()=>{
 const d=create();try{
 await assert.rejects(check(d,'europe-profiles',async()=>{throw Error('source failure')}),/source failure/);
 assert.equal(d.execute("SELECT state FROM d1_read_check_cache WHERE name='europe-profiles'")[0].state,'running');
 const concurrent=await check(d,'europe-profiles',async()=>{d.execute("INSERT INTO player_identity_people VALUES('p','P','{}')");return{missing:0}});
 assert.equal(concurrent.cacheSaved,false);assert.equal((await check(d,'europe-profiles')).reused,false);assert.equal((await check(d,'europe-profiles')).reused,true);
 }finally{d.close()}
});
test('code changes and explicit full repair bypass reuse; unfinished batches are not cached',async()=>{
 const d=create();try{
 await check(d,'profile-evidence');assert.equal((await check(d,'profile-evidence',undefined,'v2')).reused,false);
 assert.equal((await check(d,'profile-evidence',undefined,'v2',{force:true})).reused,false);
 assert.equal((await check(d,'profile-evidence',async()=>({limited:true}),'v3',{canCache:r=>!r.limited})).cacheSaved,false);
 assert.equal((await check(d,'profile-evidence',undefined,'v3')).reused,false);
 }finally{d.close()}
});
test('all declared consumers are present; count-only checks ignore metadata and react to added rows',async()=>{
 const d=create();try{
 assert.deepEqual(d.execute('SELECT name FROM d1_read_check_cache ORDER BY name').map(r=>r.name),[...names].sort());
 await check(d,'observed-counts');d.execute("INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES('p','fitp','123456','P','P','{}')");assert.equal((await check(d,'observed-counts')).reused,false);
 d.execute("UPDATE observed_players SET payload='{\"ranking\":\"2.8\"}' WHERE source_key='p'");assert.equal((await check(d,'observed-counts')).reused,true);
 d.execute("UPDATE observed_players SET circuit='itf' WHERE source_key='p'");assert.equal((await check(d,'observed-counts')).reused,false);
 }finally{d.close()}
});
test('pending identity changes, match evidence and raw draw changes invalidate their dependent checks',async()=>{
 const d=create();try{
 for(const name of names)await check(d,name);
 d.execute("INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('observed_players','x')");
 for(const name of ['profile-evidence','europe-profiles','native-profiles'])assert.equal((await check(d,name)).reused,false);
 d.execute("INSERT INTO matches(id,tournament_id,circuit,payload) VALUES('m','t','tennis-europe','{}')");
 for(const name of ['profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts'])assert.equal((await check(d,name)).reused,false);
 d.execute("INSERT INTO itf_draw_documents VALUES('draw','sha','J-J30-X','B-S-M','2026',1,1,2,1)");assert.equal((await check(d,'search-sources')).reused,false);
 }finally{d.close()}
});
test('real profile, native recovery and acquired-search functions perform no source scans on unchanged replay',async()=>{
 const {syncPlayerIdentities,recoverMissingProfiles}=await import('../scripts/sync-player-identities.mjs');
 const {recoverEuropeMatchProfiles}=await import('../lib/europe-match-profile-recovery.mjs');
 const {recoverCircuitNativeSources}=await import('../lib/circuit-native-source-recovery.mjs');
 const {syncAcquiredSearch}=await import('../scripts/sync-acquired-player-search.mjs');
 const d=create();try{
 await syncPlayerIdentities(d.query,{allowBulk:true});
 const forbidden=async()=>{throw Error('unexpected source request')};
 for(const [name,work] of [
  ['profile-evidence',()=>recoverMissingProfiles(d.query)],
  ['europe-profiles',()=>recoverEuropeMatchProfiles(d.query,{publicPage:forbidden})],
  ['native-profiles',()=>recoverCircuitNativeSources(d.query,{officialJson:forbidden})],
  ['search-sources',()=>syncAcquiredSearch(d.query)]
 ]){
  await check(d,name,work);let queries=0;const before=d.writes();
  const replay=await cachedReadCheck(async sql=>{queries++;assert.match(sql,/^SELECT (name FROM sqlite_master|state,version,result_json,verified_at FROM d1_read_check_cache)/);return d.query(sql)},name,'v1',async()=>{throw Error('unexpected repeated full scan')});
  assert.equal(replay.reused,true,name);assert.equal(queries,2);assert.equal(d.writes(),before);
 }
 let countScans=0;await syncPlayerIdentities(async sql=>{if(/COUNT\(\*\) FROM player_identity_people|COUNT\(\*\) FROM player_circuit_identities/.test(sql))countScans++;return d.query(sql)});assert.equal(countScans,0);
 }finally{d.close()}
});
test('deployment before additive migration runs the full check rather than returning a false cached success',async()=>{
 const d=database({identityMapping:true});try{let calls=0;const r=await check(d,'europe-profiles',async()=>{calls++;return{missing:0}});assert.equal(r.migrationPending,true);assert.equal(r.reused,false);assert.equal(calls,1);}finally{d.close()}
});
test('actual general and Europe verifier SQL keeps all required guards after removing ignored counts',async()=>{
 const {readFileSync}=await import('node:fs');const {ownershipSelect}=await import('../scripts/player-ownership-policy.mjs');
 const d=create();try{
  for(const file of ['verify-d1.mjs','verify-tennis-europe-agenda-d1.mjs']){
   const source=readFileSync(new URL('../scripts/'+file,import.meta.url),'utf8'),literal=source.match(/const query=(`[^`]+`);/)[1];
   const sql=Function('ownershipSelect','return '+literal)(ownershipSelect),row=(await d.query(sql))[0];
   const required=file==='verify-d1.mjs'?['players','entries','appInvalid','ownerUsers','ownerMissingBaseLinks','ownerUnresolvedLinks','ownerUnresolvedOtherLinks','ownerAnalyses','legacyAnalyses']:['teMatches','teSchedules','teResults','teParticipants','appInvalid','appMissingCourtMatchNumbers'];
   for(const field of required)assert.ok(Number.isFinite(row[field]),file+':'+field);
   if(file==='verify-d1.mjs')assert.doesNotMatch(sql,/FROM match_participants|FROM schedules|FROM results|FROM matches\b/);
  }
 }finally{d.close()}
});
test('reserved CRUD probe changes preserve count cache; real analysis insertion invalidates it',async()=>{
 const d=create();try{
 await check(d,'universal-counts');
 d.execute("INSERT INTO user_match_analyses(user_id,match_key,analysis,updated_at) VALUES('u','__courtwatch_analysis_crud_probe__','x','now')");assert.equal((await check(d,'universal-counts')).reused,true);
 d.execute("UPDATE user_match_analyses SET match_key='real' WHERE user_id='u'");assert.equal((await check(d,'universal-counts')).reused,false);
 }finally{d.close()}
});
