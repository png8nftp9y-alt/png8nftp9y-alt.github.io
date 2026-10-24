import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,applyApprovedIdentityLinks} from '../scripts/apply-user-approved-four-identity-links.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/user-approved-four-identity-links-20261024.json',import.meta.url)));
const rules=approvedRules().map(r=>JSON.parse(r.value));
const rowsOf=g=>g.sources.map(r=>({...r,payload:JSON.stringify(r.payload)}));
function insert(d){for(const g of actual)for(const s of g.sources){const payload=JSON.stringify(s.payload);d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,payload]);d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[s.person_id,g.name,'{}']);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[s.source_key,s.person_id,g.name,s.circuit,s.official_id,s.normalized_name,s.display_name,s.birth_year,s.nationality,s.profile_url]);}d.execute('DELETE FROM player_identity_pending_sources');}
test('four exact authorized FITP-Europe pairs unite; closed empty cards and Daria stay separate',()=>{
 assert.equal(approval.associations.length,4);assert.equal(rules.length,4);
 for(const entry of approval.associations){
  const group=actual.find(g=>g.name===entry.nameKey),plan=buildIdentityMapping(rowsOf(group),{confirmedLinks:rules});
  const native=new Map(plan.links.map(r=>[r.circuit+'|'+r.official_id.toLowerCase(),r.canonical_id]));
  const ids=entry.identities.map(e=>native.get(e.circuit+'|'+e.officialId));
  assert.ok(ids.every(Boolean));assert.equal(new Set(ids).size,1,entry.nameKey);
  for(const card of entry.excludedFitpCards)if(native.has('fitp|'+card))assert.notEqual(native.get('fitp|'+card),ids[0]);
 }
 const d=actual.find(g=>g.name==='DARIA VASILEVA');
 assert.deepEqual(buildIdentityMapping(rowsOf(d),{confirmedLinks:rules}).links,buildIdentityMapping(rowsOf(d)).links);
});
test('D1_TEST_INITIAL_IMPORT / D1_TEST_REAL_DELTAS_ONLY: four readbacks preserve previous rules and raw sources; later ordinary delta keeps link; D1_TEST_IDENTICAL_ZERO_WRITES: replay zero writes',async()=>{
 const d=database({identityMapping:true});try{
 insert(d);
 const previous=[
  {nameKey:'OLD FIRST',identities:[{circuit:'fitp',officialId:'1111111111'},{circuit:'tennis-europe',officialId:'11111111-1111-4111-8111-111111111111'}]},
  {nameKey:'OLD SECOND',identities:[{circuit:'fitp',officialId:'2222222222'},{circuit:'tennis-europe',officialId:'22222222-2222-4222-8222-222222222222'}]}
 ];
 previous.forEach((r,i)=>d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',['confirmedPlayerCircuitLink:prior:'+i,JSON.stringify(r),'2026-10-24']));
 const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
 const r=await applyApprovedIdentityLinks(d.query);
 assert.equal(r.summary.approvedAssociationsVerified,4);assert.equal(r.summary.fitpEuropeVerified,4);assert.equal(r.summary.daria,'separate_partition_unchanged');
 assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:prior:%'").length,2);
 assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
 const before=d.writes(),calls=[];assert.equal((await applyApprovedIdentityLinks(sql=>{calls.push(sql);return d.query(sql)})).status,'already_completed');
 assert.equal(d.writes(),before);assert.equal(calls.length,1);
 const source=actual.find(g=>g.name==='BAJO SARA').sources.find(s=>s.circuit==='fitp'&&s.official_id==='9840733024');
 d.execute('UPDATE observed_players SET payload=? WHERE source_key=?',[JSON.stringify({...source.payload,club:'updated club'}),source.source_key]);
 await syncPlayerIdentities(d.query);
 const keys=approval.associations.find(e=>e.nameKey==='BAJO SARA').identities;
 const ids=d.execute("SELECT DISTINCT canonical_id FROM player_circuit_identities WHERE name_key='BAJO SARA' AND (circuit='tennis-europe' OR (circuit='fitp' AND official_id='9840733024'))");
 assert.equal(ids.length,1);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: absent originals stop before any rules or completion writes',async()=>{
 const d=database({identityMapping:true});try{const n=d.writes();await assert.rejects(applyApprovedIdentityLinks(d.query),/daria_not_separate/);assert.equal(d.writes(),n);}finally{d.close();}
});
