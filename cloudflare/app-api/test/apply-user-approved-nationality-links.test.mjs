import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,applyApprovedIdentityLinks} from '../scripts/apply-user-approved-nationality-links.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/user-approved-nationality-links-20261025.json',import.meta.url)));
const rules=approvedRules().map(r=>JSON.parse(r.value));
const rowsOf=g=>g.sources.map(r=>({...r,payload:JSON.stringify(r.payload)}));
function insert(d){for(const g of actual)for(const s of g.sources){const payload=JSON.stringify(s.payload);d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,payload]);d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[s.person_id,g.name,'{}']);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[s.source_key,s.person_id,g.name,s.circuit,s.official_id,s.normalized_name,s.display_name,s.birth_year,s.nationality,s.profile_url]);}d.execute('DELETE FROM player_identity_pending_sources');}
test('29 exact authorized cross-circuit pairs unite; other ITF identities and Daria stay separate',()=>{
 assert.equal(approval.associations.length,29);assert.equal(rules.length,31);
 for(const entry of approval.associations){
  const group=actual.find(g=>g.name===entry.nameKey),plan=buildIdentityMapping(rowsOf(group),{confirmedLinks:rules});
  const native=new Map(plan.links.map(r=>[r.circuit+'|'+r.official_id.toLowerCase(),r.canonical_id]));
  const ids=entry.identities.map(e=>native.get(e.circuit+'|'+e.officialId.toLowerCase()));
  assert.ok(ids.every(Boolean));assert.equal(new Set(ids).size,1,entry.nameKey);
  assert.equal(JSON.parse(plan.people.find(p=>p.canonical_id===ids[0]).payload).nationality,entry.currentNationality);
  for(const other of entry.excludedIdentities){assert.ok(native.has(other.circuit+'|'+other.officialId));assert.notEqual(native.get(other.circuit+'|'+other.officialId),ids[0]);}
 }
 const d=actual.find(g=>g.name==='DARIA VASILEVA');
 assert.deepEqual(buildIdentityMapping(rowsOf(d),{confirmedLinks:rules}).links,buildIdentityMapping(rowsOf(d)).links);
});
test('D1_TEST_INITIAL_IMPORT / D1_TEST_REAL_DELTAS_ONLY: 29 readbacks preserve previous rules and raw sources; later ordinary delta keeps link; D1_TEST_IDENTICAL_ZERO_WRITES: replay zero writes',async()=>{
 const d=database({identityMapping:true});try{
 insert(d);
 const previous=[
  {nameKey:'OLD FIRST',identities:[{circuit:'fitp',officialId:'1111111111'},{circuit:'tennis-europe',officialId:'11111111-1111-4111-8111-111111111111'}]},
  {nameKey:'OLD SECOND',identities:[{circuit:'fitp',officialId:'2222222222'},{circuit:'tennis-europe',officialId:'22222222-2222-4222-8222-222222222222'}]}
 ];
 previous.forEach((r,i)=>d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',['confirmedPlayerCircuitLink:prior:'+i,JSON.stringify(r),'2026-10-24']));
 const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');
 const r=await applyApprovedIdentityLinks(d.query);
 assert.equal(r.summary.emma,'separate_AUS_CAN_unchanged');assert.equal(r.remaining.groups.length,0);
 assert.equal(r.summary.approvedAssociationsVerified,29);assert.equal(r.summary.nationalitiesVerified,29);assert.equal(r.summary.daria,'separate_partition_unchanged');
 assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:prior:%'").length,2);
 assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);
 const before=d.writes(),calls=[];assert.equal((await applyApprovedIdentityLinks(sql=>{calls.push(sql);return d.query(sql)})).status,'already_completed');
 assert.equal(d.writes(),before);assert.equal(calls.length,1);
 const source=actual.find(g=>g.name==='ASO MAWLOOD').sources.find(s=>s.circuit==='itf'&&s.official_id==='800823212');
 d.execute('UPDATE observed_players SET payload=? WHERE source_key=?',[JSON.stringify({...source.payload,club:'updated club'}),source.source_key]);
 await syncPlayerIdentities(d.query);
 const keys=approval.associations.find(e=>e.nameKey==='ASO MAWLOOD').identities;
 const ids=d.execute("SELECT DISTINCT canonical_id FROM player_circuit_identities WHERE name_key='ASO MAWLOOD' AND (circuit IN ('tennis-europe','fitp') OR (circuit='itf' AND official_id='800823212'))");
 assert.equal(ids.length,1);
 for(const entry of approval.associations){const p=r.verified.find(v=>v.name===entry.nameKey);assert.equal(p.nationality,entry.currentNationality);const saved=d.execute('SELECT payload FROM player_identity_people WHERE canonical_id=?',[p.canonicalId])[0];assert.equal(JSON.parse(saved.payload).nationality,entry.currentNationality);}
 const emmaRows=d.execute("SELECT circuit,official_id,nationality,canonical_id FROM player_circuit_identities WHERE name_key='CAO EMMA'");assert.equal(new Set(emmaRows.map(r=>r.canonical_id)).size,2);assert.ok(emmaRows.filter(r=>r.circuit==='tennis-europe').every(r=>r.nationality==='AUS'));assert.ok(emmaRows.filter(r=>r.circuit==='itf').every(r=>r.nationality==='CAN'));
 for(const entry of approval.associations){const rows=d.execute('SELECT circuit,official_id,canonical_id FROM player_circuit_identities WHERE name_key=?',[entry.nameKey]);const canonical=rows.find(r=>r.circuit===entry.identities[0].circuit&&r.official_id.toLowerCase()===entry.identities[0].officialId.toLowerCase()).canonical_id;for(const other of entry.excludedIdentities)for(const r of rows.filter(r=>r.circuit===other.circuit&&r.official_id===other.officialId))assert.notEqual(r.canonical_id,canonical);}
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: absent originals stop before any rules or completion writes',async()=>{
 const d=database({identityMapping:true});try{const n=d.writes();await assert.rejects(applyApprovedIdentityLinks(d.query),/daria_not_separate/);assert.equal(d.writes(),n);}finally{d.close();}
});

test('resume after persisted rules uses exact key readback within D1 LIKE limit and never reinserts saved rules',async()=>{
 const d=database({identityMapping:true});try{
  insert(d);
  for(const r of approvedRules())d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[r.key,r.value,'2026-10-24']);
  let ruleWrites=0,exactRead=false;
  const query=async sql=>{
   for(const m of sql.matchAll(/\b(?:LIKE|GLOB)\s+'([^']*)'/gi))if(Buffer.byteLength(m[1])>50)throw Error('D1 LIKE/GLOB pattern exceeds 50 bytes');
   if(sql.startsWith('INSERT INTO app_state')&&sql.includes('confirmedPlayerCircuitLink:approved-nationalities-20261025:'))ruleWrites++;
   if(sql.startsWith('SELECT key,value FROM app_state WHERE key IN ('))exactRead=true;
   return d.query(sql);
  };
  const r=await applyApprovedIdentityLinks(query);
  assert.equal(r.summary.approvedAssociationsVerified,29);
  assert.equal(r.summary.nationalitiesVerified,29);
  assert.equal(r.summary.daria,'separate_partition_unchanged');
  assert.equal(ruleWrites,0);assert.equal(exactRead,true);
 }finally{d.close();}
});
