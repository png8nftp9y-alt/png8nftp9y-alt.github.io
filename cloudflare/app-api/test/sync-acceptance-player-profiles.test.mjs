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
test('a refreshed ID-less acceptance retains the official GUID recovered on the same source',async()=>{
 const d=database({identityMapping:true});try{
  const player={playerName:'Known Europe Person',nationality:'IRL'},doc={tournaments:{t:{participants:[player]}}};
  const source=acceptancePlayers('tennis-europe',doc)[0],id='12345678-1234-1234-1234-123456789abc';
  const payload={...source.payload,officialId:id,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+id};
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[source.source_key,source.circuit,id,source.normalized_name,source.display_name,JSON.stringify(payload)]);
  const result=await syncAcceptanceProfiles(d.query,'tennis-europe',{tournaments:{t:{participants:[player,{playerName:'New Europe Person',nationality:'ITA',participantId:'22345678-1234-1234-1234-123456789abc'}]}}});
  const retained=d.execute('SELECT official_id,payload FROM observed_players WHERE source_key=?',[source.source_key])[0];
  assert.equal(retained.official_id,id);assert.equal(JSON.parse(retained.payload).profileUrl,payload.profileUrl);assert.equal(result.changed,1);
  const profile=await storedIdentity(d.db,source.source_key);assert.ok(profile.circuitProfiles.some(p=>p.url===payload.profileUrl));
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: empty or malformed lists never mutate D1 or mark checkpoints',async()=>{
 const d=database({identityMapping:true});try{
  for(const doc of [{},{participants:[]},{participants:[{}]}])await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc),/incomplete/);
  assert.equal(d.writes(),0);assert.equal(d.execute('SELECT * FROM app_state').length,0);
  assert.equal(acceptancePlayers('itf',{participants:[{name:'Same Name',nationality:'ITA'},{name:'Same Name',nationality:'FRA'}]}).length,2);
 }finally{d.close()}
});
test('malformed FITP name recovers only the same known official card and replay writes zero',async()=>{
 const d=database({identityMapping:true});try{
  const person={full1:'Known FITP Person',membershipCard:'1234567890'};
  await syncAcceptanceProfiles(d.query,'fitp',{tournaments:{t:{participants:[person]}}});
  const before=d.writes(),a=await syncAcceptanceProfiles(d.query,'fitp',{tournaments:{t:{participants:[{...person,full1:'***************',full2:'***************'}]}}});
  assert.equal(a.recoveredExistingFitpNames,1);assert.equal(a.changed,0);assert.equal(d.writes(),before);
  assert.equal(d.execute('SELECT display_name FROM observed_players')[0].display_name,person.full1);
  assert.equal(d.execute('SELECT * FROM player_identity_people').length,1);
 }finally{d.close()}
});
test('unknown or conflicting FITP card names fail before writes and never checkpoint',async()=>{
 const d=database({identityMapping:true});try{
  const doc={tournaments:{t:{participants:[{full1:'***************',membershipCard:'1234567890'}]}}};
  await assert.rejects(syncAcceptanceProfiles(d.query,'fitp',doc),/missing_or_ambiguous/);assert.equal(d.writes(),0);
  d.execute("INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES('a','fitp','1234567890','FIRST PERSON','First Person','{}'),('b','fitp','1234567890','OTHER PERSON','Other Person','{}')");
  const before=d.writes();await assert.rejects(syncAcceptanceProfiles(d.query,'fitp',doc),/missing_or_ambiguous/);assert.equal(d.writes(),before);
  assert.equal(d.execute('SELECT * FROM app_state').length,0);
 }finally{d.close()}
});

test('new ID-less list players block the whole import before any writes or checkpoint in all circuits',async()=>{
 for(const [c,doc] of fixtures){const d=database({identityMapping:true});try{
  const bad={name:'New Missing Person'},input=c==='itf'?{participants:[...doc.participants,bad]}:{tournaments:{a:{participants:[...doc.tournaments.a.participants,bad]}}};
  await assert.rejects(syncAcceptanceProfiles(d.query,c,input),/player_circuit_id_required/);
  assert.equal(d.writes(),0);assert.equal(d.execute('SELECT * FROM observed_players').length,0);assert.equal(d.execute('SELECT * FROM app_state').length,0);
 }finally{d.close()}}
});
test('ID readback is required before completing acceptance registration',async()=>{
 const d=database({identityMapping:true});try{
  const query=async sql=>sql.startsWith('SELECT source_key,circuit,official_id FROM observed_players')?[]:d.query(sql);
  await assert.rejects(syncAcceptanceProfiles(query,...fixtures[2]),/saved_circuit_id_unverified/);
  assert.equal(d.execute('SELECT * FROM app_state').length,0);
 }finally{d.close()}
});
