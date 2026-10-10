import test from 'node:test';
import assert from 'node:assert/strict';
import {syncAcceptanceProfiles,acceptancePlayers} from '../scripts/sync-acceptance-player-profiles.mjs';
import {database} from './search-sqlite-fixture.mjs';
import {storedIdentity} from '../lib/player-identity-lookup.mjs';
const fixtures=[
 ['fitp',{tournaments:{a:{participants:[{full1:'New FITP Person',membershipCard:'123456789',nationality:'ITA'}]}}}],
 ['tennis-europe',{tournaments:{a:{participants:[{playerName:'New Europe Person',participantId:'00000000-0000-0000-0000-000000000001',nationality:'ITA'}]}}}],
 ['itf',{participants:[{name:'New ITF Person',worldTennisId:'800123456',nationality:'ITA'}]}]
];
test('D1_TEST_INITIAL_IMPORT: every circuit acceptance creates a searchable app identity',async()=>{
 const d=database({identityMapping:true});try{
  for(const [c,doc] of fixtures){const a=await syncAcceptanceProfiles(d.query,c,doc);assert.equal(a.changed,1);assert.equal(a.identity.status,'ready');const source=acceptancePlayers(c,doc)[0];const profile=await storedIdentity(d.db,source.source_key);assert.ok(profile?.canonicalId);assert.equal(profile.circuitProfiles.length,1);}
  assert.equal(d.execute('SELECT * FROM player_identity_people').length,3);
  assert.equal(d.execute('SELECT * FROM player_circuit_identities').length,3);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated lists and timestamp changes skip source scans and writes',async()=>{
 const d=database({identityMapping:true});try{
  const [c,doc]=fixtures[2];await syncAcceptanceProfiles(d.query,c,doc);const n=d.writes(),sql=[];
  const a=await syncAcceptanceProfiles(async q=>{sql.push(q);return d.query(q)},c,{...doc,generatedAt:'new'});
  assert.equal(d.writes(),n);assert.equal(a.changed,0);assert.equal(a.unchanged,true);assert.ok(!sql.some(q=>q.includes('FROM observed_players')));
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: a new name becomes a profile while retained metadata and older players survive',async()=>{
 const d=database({identityMapping:true});try{
  const [c,doc]=fixtures[2];await syncAcceptanceProfiles(d.query,c,doc);
  const r=d.execute('SELECT * FROM observed_players')[0],p={...JSON.parse(r.payload),clubName:'Retained club'};
  d.execute('UPDATE observed_players SET monitored=1,payload=? WHERE source_key=?',[JSON.stringify(p),r.source_key]);
  const a=await syncAcceptanceProfiles(d.query,c,{participants:[{name:'Other ITF Person',worldTennisId:'800654321',nationality:'ITA'}]});
  assert.equal(a.changed,1);assert.equal(d.execute('SELECT * FROM player_identity_people').length,2);
  assert.equal(JSON.parse(d.execute('SELECT payload FROM observed_players WHERE source_key=?',[r.source_key])[0].payload).clubName,'Retained club');
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: empty or malformed lists never mutate D1 or mark checkpoints',async()=>{
 const d=database({identityMapping:true});try{
  for(const doc of [{},{participants:[]},{participants:[{}]}])await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc),/incomplete/);
  assert.equal(d.writes(),0);assert.equal(d.execute('SELECT * FROM app_state').length,0);
  assert.equal(acceptancePlayers('itf',{participants:[{name:'Same Name',nationality:'ITA'},{name:'Same Name',nationality:'FRA'}]}).length,2);
 }finally{d.close()}
});
