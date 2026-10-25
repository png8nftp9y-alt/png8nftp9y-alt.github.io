import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,applyApprovedIdentityLinks} from '../scripts/apply-user-approved-all-fitp-europe-links.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/user-approved-all-fitp-europe-links-20261025.json',import.meta.url)));
const nativeKey=r=>r.circuit+'|'+String(r.official_id||r.officialId).toLowerCase();
async function insert(d){
 const statements=[];
 for(const g of actual)for(const s of g.sources){
  const payload=JSON.stringify(s.payload);
  statements.push({sql:'INSERT INTO '+(s.source_table==='search_acquired_players'?'search_acquired_players':'observed_players')+'(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',values:[s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,payload]});
  statements.push({sql:'INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',values:[s.person_id,g.name,'{}']});
  statements.push({sql:'INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',values:[s.source_key,s.person_id,g.name,s.circuit,s.official_id,s.normalized_name,s.display_name,s.birth_year,s.nationality,s.profile_url]});
 }
 statements.push({sql:'DELETE FROM player_identity_pending_sources',values:[]});
 await d.db.batch(statements);
}
function check(d,r){
 assert.equal(r.summary.approvedAssociationsVerified,59);assert.equal(r.summary.nationalitiesVerified,0);
 assert.equal(r.summary.emma,'separate_AUS_CAN_unchanged');assert.equal(r.summary.daria,'separate_partition_unchanged');
 assert.deepEqual(r.preserved.map(x=>[x.number,x.status]),[[64,'separate_unchanged'],[94,'separate_unchanged']]);
 assert.deepEqual(r.remaining.groups,[]);
 const rows=d.execute('SELECT * FROM player_circuit_identities');
 for(const e of approval.associations){
  const wanted=new Set(e.identities.map(nativeKey)),selected=rows.filter(x=>wanted.has(nativeKey(x)));
  assert.equal(new Set(selected.map(nativeKey)).size,2,e.nameKey);
  const people=new Set(selected.map(x=>x.canonical_id));assert.equal(people.size,1,e.nameKey);
  const excluded=new Set([...e.excludedFitpCards.map(officialId=>nativeKey({circuit:'fitp',officialId})),...e.excludedIdentities.map(nativeKey)]);
  for(const x of rows.filter(x=>excluded.has(nativeKey(x))))assert.ok(!people.has(x.canonical_id),e.nameKey+' '+x.official_id);
 }
 const guid=rows.filter(x=>x.name_key==='GUIDI MATTEO'&&x.circuit==='tennis-europe');assert.ok(guid.length);assert.ok(guid.every(x=>x.nationality==='BEL'));
}
test('59 exact user selections, two separate decisions, #69 Brindisi: rankings identify cards without a highest-rank heuristic',()=>{
 assert.equal(approval.associations.length,59);assert.equal(approvedRules().length,59);
 for(const e of approval.associations){assert.equal(e.currentNationality,undefined);assert.equal(actual.find(g=>g.name===e.nameKey).fitpMetadata.find(m=>m.membership_card===e.identities[0].officialId).ranking,e.selectedRanking);}
 const byNumber=n=>approval.associations.find(e=>e.number===n);
 assert.equal(byNumber(49).identities[0].officialId,'4957110348');
 assert.equal(byNumber(50).identities[1].officialId.toLowerCase(),'b6f548e5-b4e0-4e3a-b6d0-1faa55e5b124');
 assert.deepEqual(byNumber(50).excludedIdentities.map(nativeKey),['tennis-europe|f7d330b8-9cf1-4a29-ab69-2057fa01cc7b']);
 assert.equal(byNumber(80).identities[0].officialId,'0325012776');
 assert.equal(byNumber(82).identities[0].officialId,'0456866208');
 assert.equal(byNumber(69).identities[0].officialId,'5178456772');assert.equal(byNumber(64),undefined);assert.equal(byNumber(94),undefined);
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: 59 D1 readbacks preserve other cards, former rules, raw originals and a later ordinary delta; replay writes zero',async()=>{
 const d=database({identityMapping:true});try{
  await insert(d);
  const previous={nameKey:'PRIOR PERSON',identities:[{circuit:'fitp',officialId:'1111111111'},{circuit:'itf',officialId:'800000001'}]};
  d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',['confirmedPlayerCircuitLink:prior:keep',JSON.stringify(previous),'2026-10-24']);
  const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key'),acquired=d.execute('SELECT * FROM search_acquired_players ORDER BY source_key'),controls=d.execute("SELECT * FROM player_circuit_identities WHERE name_key IN ('CAVALIERE FRANCESCO','GUIDI MATTEO') ORDER BY source_key");
  const r=await applyApprovedIdentityLinks(d.query);check(d,r);
  assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);assert.deepEqual(d.execute('SELECT * FROM search_acquired_players ORDER BY source_key'),acquired);
  assert.deepEqual(d.execute("SELECT * FROM player_circuit_identities WHERE name_key IN ('CAVALIERE FRANCESCO','GUIDI MATTEO') ORDER BY source_key"),controls);
  assert.equal(d.execute("SELECT value FROM app_state WHERE key='confirmedPlayerCircuitLink:prior:keep'")[0].value,JSON.stringify(previous));
  const e=approval.associations[0],source=actual.find(g=>g.name===e.nameKey).sources.find(s=>nativeKey(s)===nativeKey(e.identities[1]));
  d.execute('UPDATE '+source.source_table+' SET payload=? WHERE source_key=?',[JSON.stringify({...source.payload,club:'updated'}),source.source_key]);
  await syncPlayerIdentities(d.query);check(d,r);
  const writes=d.writes(),calls=[];assert.equal((await applyApprovedIdentityLinks(sql=>{calls.push(sql);return d.query(sql)})).status,'already_completed');assert.equal(d.writes(),writes);assert.equal(calls.length,1);
 }finally{d.close();}
});
test('partial rules resume accepts exact-ID name variants; renamed excluded homonym still stays separate; no repeated rule writes',async()=>{
 const d=database({identityMapping:true});try{
  await insert(d);
  await d.db.batch(approvedRules().map(r=>({sql:'INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',values:[r.key,r.value,'2026-10-25']})));
  await d.db.batch(approval.associations.flatMap(e=>['observed_players','search_acquired_players'].map(table=>({sql:"UPDATE "+table+" SET display_name=display_name||' Junior',normalized_name=normalized_name||' JUNIOR' WHERE circuit=? AND LOWER(official_id)=?",values:['tennis-europe',e.identities[1].officialId.toLowerCase()]}))));
  d.execute("UPDATE player_circuit_identities SET name_key='RENAMED EXCLUDED PERSON' WHERE circuit='fitp' AND official_id='1570236125'");
  let ruleWrites=0;
  const r=await applyApprovedIdentityLinks(sql=>{for(const m of sql.matchAll(/LIKE\s+'([^']*)'/gi))assert.ok(Buffer.byteLength(m[1])<=50);if(sql.startsWith('INSERT INTO app_state')&&sql.includes('confirmedPlayerCircuitLink:approved-fitp-europe-20261025:'))ruleWrites++;return d.query(sql)});
  assert.equal(ruleWrites,0);check(d,r);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing selected native ID fails before any rule or mapping write',async()=>{
 const d=database({identityMapping:true});try{await insert(d);d.execute("DELETE FROM player_circuit_identities WHERE circuit='fitp' AND official_id='4957110348'");const writes=d.writes();await assert.rejects(applyApprovedIdentityLinks(d.query),/approved_identity_native_missing/);assert.equal(d.writes(),writes);}finally{d.close();}
});
test('a user-kept-separate group already unified blocks before writes, instead of silently claiming success',async()=>{
 const d=database({identityMapping:true});try{await insert(d);d.execute("UPDATE player_circuit_identities SET canonical_id='unexpected-merge' WHERE name_key='GUIDI MATTEO'");const writes=d.writes();await assert.rejects(applyApprovedIdentityLinks(d.query),/approved_identity_preserved_already_merged/);assert.equal(d.writes(),writes);}finally{d.close();}
});

test('completed native mappings without the unified marker are verified without requeueing or rewriting rules',async()=>{
 const d=database({identityMapping:true});try{
  await insert(d);await applyApprovedIdentityLinks(d.query);
  d.execute("DELETE FROM app_state WHERE key='approvedAllFitpEuropeAssociations:20261025:v1'");
  let queued=0,rules=0;const r=await applyApprovedIdentityLinks(sql=>{
   if(sql.startsWith('INSERT INTO player_identity_pending_sources'))queued++;
   if(sql.startsWith('INSERT INTO app_state')&&sql.includes('confirmedPlayerCircuitLink:'))rules++;
   return d.query(sql);
  });check(d,r);assert.equal(queued,0);assert.equal(rules,0);
 }finally{d.close();}
});
