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
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: empty or malformed lists write diagnostics only and never player checkpoints',async()=>{
 const d=database({identityMapping:true});try{
  for(const doc of [{},{participants:[]},{participants:[{}]}])await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc),/incomplete/);
  assert.equal(d.execute('SELECT * FROM observed_players').length,0);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'acceptanceProfiles:%'").length,0);
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
test('unknown or conflicting FITP card names fail before player writes and never checkpoint',async()=>{
 const d=database({identityMapping:true});try{
  const doc={tournaments:{t:{participants:[{full1:'***************',membershipCard:'1234567890'}]}}};
  await assert.rejects(syncAcceptanceProfiles(d.query,'fitp',doc),/source_incomplete/);assert.equal(d.execute('SELECT * FROM observed_players').length,0);
  d.execute("INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES('a','fitp','1234567890','FIRST PERSON','First Person','{}'),('b','fitp','1234567890','OTHER PERSON','Other Person','{}')");
  const before=d.writes();await assert.rejects(syncAcceptanceProfiles(d.query,'fitp',doc),/source_incomplete/);assert.equal(d.writes(),before);
  assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'acceptanceProfiles:%'").length,0);
 }finally{d.close()}
});

test('new ID-less list players block player writes and checkpoint in all circuits',async()=>{
 for(const [c,doc] of fixtures){const d=database({identityMapping:true});try{
  const bad={name:'New Missing Person'},input=c==='itf'?{participants:[...doc.participants,bad]}:{tournaments:{a:{participants:[...doc.tournaments.a.participants,bad]}}};
  await assert.rejects(syncAcceptanceProfiles(d.query,c,input),/player_circuit_id_required/);
  assert.equal(d.execute('SELECT * FROM observed_players').length,0);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'acceptanceProfiles:%'").length,0);
 }finally{d.close()}}
});
test('ID readback is required before completing acceptance registration',async()=>{
 const d=database({identityMapping:true});try{
  const query=async sql=>sql.startsWith('SELECT source_key,circuit,official_id FROM observed_players')?[]:d.query(sql);
  await assert.rejects(syncAcceptanceProfiles(query,...fixtures[2]),/save_unverified/);
  assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'acceptanceProfiles:%'").length,0);
 }finally{d.close()}
});


test('known player entering another circuit gains its native ID on the same canonical person',async()=>{
 const d=database({identityMapping:true});try{
  const name='Known Circuit Person',nationality='ITA',birthYear=2011,card='123456789',guid='12345678-1234-1234-1234-123456789abc';
  const fitp={tournaments:{a:{participants:[{full1:name,membershipCard:card,nationality,birthYear}]}}};
  await syncAcceptanceProfiles(d.query,'fitp',fitp);
  const first=d.execute('SELECT canonical_id FROM player_identity_people')[0].canonical_id;
  const europe={tournaments:{b:{participants:[{playerName:name,participantId:guid,nationality,birthYear}]}}};
  await syncAcceptanceProfiles(d.query,'tennis-europe',europe);
  await syncAcceptanceProfiles(d.query,'itf',{participants:[{name,worldTennisId:'800123456',nationality,birthYear}]});
  const people=d.execute('SELECT * FROM player_identity_people');assert.equal(people.length,1);assert.equal(people[0].canonical_id,first);
  const links=d.execute('SELECT canonical_id,circuit,official_id FROM player_circuit_identities');
  assert.equal(links.length,3);assert.ok(links.every(p=>p.canonical_id===first));
  assert.deepEqual(new Set(links.map(p=>p.official_id)),new Set([card,guid,'800123456']));
  assert.equal(JSON.parse(people[0].payload).circuitProfiles.length,3);
 }finally{d.close()}
});

test('existing FITP ID cannot complete first Europe registration without the Europe ID',async()=>{
 const d=database({identityMapping:true});try{
  const name='Known Circuit Person',nationality='ITA',birthYear=2011;
  await syncAcceptanceProfiles(d.query,'fitp',{tournaments:{a:{participants:[{full1:name,membershipCard:'123456789',nationality,birthYear}]}}});
  const before=d.execute('SELECT * FROM player_circuit_identities');
  await assert.rejects(syncAcceptanceProfiles(d.query,'tennis-europe',{tournaments:{b:{participants:[{playerName:name,nationality,birthYear}]}}}),/player_circuit_id_required/);
  assert.deepEqual(d.execute('SELECT * FROM player_circuit_identities'),before);
  assert.equal(d.execute("SELECT * FROM observed_players WHERE circuit='tennis-europe'").length,0);
  assert.equal(d.execute("SELECT * FROM app_state WHERE key='acceptanceProfiles:tennis-europe'").length,0);
  const diagnostic=JSON.parse(d.execute("SELECT value FROM app_state WHERE key='acceptanceDiagnostics:tennis-europe'")[0].value);
  assert.equal(diagnostic.status,'blocked');assert.equal(diagnostic.unsaved[0].name,name);
 }finally{d.close()}
});
