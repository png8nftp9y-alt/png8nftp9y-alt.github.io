import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {approval,approvedRules,applyApprovedIdentityLinks} from '../scripts/apply-user-approved-eighteen-fitp-itf-links.mjs';
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/user-approved-eighteen-fitp-itf-links-20261025.json',import.meta.url)));
function insert(d){for(const g of actual)for(const s of g.sources){
 const payload=JSON.stringify(s.payload);
 if(s.circuit==='courtwatch')d.execute('INSERT INTO user_app_player_additions(user_id,courtwatch_id,observed_source_key,payload,created_at) VALUES(?,?,?,?,?)',['test-user',s.official_id,s.payload.sourceKey,payload,'2026-10-25']);
 else d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[s.source_key,s.circuit,s.official_id,s.normalized_name,s.display_name,payload]);
 d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?) ON CONFLICT DO NOTHING',[s.person_id,g.name,'{}']);
 d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[s.source_key,s.person_id,g.name,s.circuit,s.official_id,s.normalized_name,s.display_name,s.birth_year,s.nationality,s.profile_url]);
}d.execute('DELETE FROM player_identity_pending_sources');}
function check(d,r){assert.equal(r.summary.approvedAssociationsVerified,18);assert.equal(r.summary.nationalitiesVerified,0);assert.equal(r.summary.emma,'separate_AUS_CAN_unchanged');assert.equal(r.summary.daria,'separate_partition_unchanged');
 for(const e of approval.associations){const rows=d.execute("SELECT * FROM player_circuit_identities WHERE name_key=? OR (circuit='itf' AND official_id=?)",[e.nameKey,e.identities[1].officialId]);const fitp=rows.find(x=>x.circuit==='fitp'&&x.official_id===e.identities[0].officialId),itf=rows.find(x=>x.circuit==='itf'&&x.official_id===e.identities[1].officialId);assert.ok(fitp);assert.ok(itf);assert.equal(fitp.canonical_id,itf.canonical_id,e.nameKey);
 for(const id of e.excludedFitpCards)assert.ok(rows.filter(x=>x.circuit==='fitp'&&x.official_id===id).every(x=>x.canonical_id!==fitp.canonical_id),e.nameKey+' '+id);
 }
 const gal=d.execute("SELECT DISTINCT canonical_id FROM player_circuit_identities WHERE source_key IN ('courtwatch|cw-bf2fea0733aafed5c3b264e43f942de0','fitp|id:3726503025','itf|id:800721804')");assert.equal(gal.length,1);assert.equal(gal[0].canonical_id,'cw-bf2fea0733aafed5c3b264e43f942de0');
}
test('18 explicitly selected cards match supplied rankings; no nationality or general highest-rank rule',()=>{assert.equal(approval.associations.length,18);assert.equal(approvedRules().length,18);for(const e of approval.associations){assert.equal(e.currentNationality,undefined);assert.equal(actual.find(g=>g.name===e.nameKey).fitpMetadata.find(x=>x.membership_card===e.identities[0].officialId).ranking,e.selectedRanking);assert.ok(e.excludedFitpCards.length);}});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: real groups, homonyms, personal binding, raw originals, ordinary update and replay',async()=>{const d=database({identityMapping:true});try{
 insert(d);const old={nameKey:'PRIOR PERSON',identities:[{circuit:'fitp',officialId:'1111111111'},{circuit:'itf',officialId:'800000001'}]};d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',['confirmedPlayerCircuitLink:prior:keep',JSON.stringify(old),'2026-10-24']);
 const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key'),personal=d.execute('SELECT * FROM user_app_player_additions');
 const r=await applyApprovedIdentityLinks(d.query);check(d,r);assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);assert.deepEqual(d.execute('SELECT * FROM user_app_player_additions'),personal);assert.equal(d.execute("SELECT value FROM app_state WHERE key='confirmedPlayerCircuitLink:prior:keep'")[0].value,JSON.stringify(old));
 const source=actual.find(g=>g.name==='ACCARDO SIMONE').sources.find(s=>s.circuit==='itf');d.execute('UPDATE observed_players SET payload=? WHERE source_key=?',[JSON.stringify({...source.payload,club:'updated'}),source.source_key]);await syncPlayerIdentities(d.query);check(d,r);
 const before=d.writes(),calls=[];assert.equal((await applyApprovedIdentityLinks(sql=>{calls.push(sql);return d.query(sql)})).status,'already_completed');assert.equal(d.writes(),before);assert.equal(calls.length,1);
 }finally{d.close();}});
test('partial resume tolerates exact approved ID name variants without reinserting saved rules',async()=>{const d=database({identityMapping:true});try{insert(d);for(const r of approvedRules())d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[r.key,r.value,'2026-10-25']);
 for(const e of approval.associations)d.execute('UPDATE observed_players SET display_name=display_name||?,normalized_name=normalized_name||? WHERE circuit=? AND official_id=?',[' Junior',' JUNIOR','itf',e.identities[1].officialId]);
 let ruleWrites=0;const r=await applyApprovedIdentityLinks(sql=>{for(const m of sql.matchAll(/LIKE\s+'([^']*)'/gi))assert.ok(Buffer.byteLength(m[1])<=50);if(sql.startsWith('INSERT INTO app_state')&&sql.includes('confirmedPlayerCircuitLink:approved-eighteen-fitp-itf'))ruleWrites++;return d.query(sql)});assert.equal(ruleWrites,0);check(d,r);
 }finally{d.close();}});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing selected ID stops before any write',async()=>{const d=database({identityMapping:true});try{insert(d);d.execute("DELETE FROM player_circuit_identities WHERE circuit='itf' AND official_id='800714224'");const before=d.writes();await assert.rejects(applyApprovedIdentityLinks(d.query),/approved_identity_native_missing/);assert.equal(d.writes(),before);}finally{d.close();}});
