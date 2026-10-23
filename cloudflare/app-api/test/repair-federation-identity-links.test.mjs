import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {officialPlayerUrl} from '../lib/player-circuit-profiles.mjs';
import {mergeSearchIdentities} from '../lib/paginated-player-search.mjs';
import {playerFederationMatchKey} from '../lib/player-nationality.mjs';
import {federationRecoveryCandidate,reviewAndRepairFederationIdentities} from '../scripts/repair-federation-identity-links.mjs';
const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/cross-circuit-federation-evidence.json',import.meta.url),'utf8'));
const rows=g=>g.sources.map(s=>({source_key:s.sourceKey,circuit:s.circuit,official_id:s.officialId,display_name:s.name,normalized_name:s.name.toUpperCase(),person_id:s.canonicalId,name_key:g.nameKey,original_missing:0,payload:JSON.stringify({nationality:s.nationality,birthYear:s.birthYear,profileUrl:officialPlayerUrl(s.circuit,{name:s.name,officialId:s.officialId,nationality:s.nationality})})}));
test('D1_TEST_INITIAL_IMPORT: actual reviewed aliases identify 15 safe groups and preserve Daria and competing FITP homonyms',()=>{
 const safe=evidence.filter(g=>federationRecoveryCandidate(rows(g)).status==='safe_federation_alias_recovery');assert.equal(safe.length,15);
 for(const name of ['DARIA VASILEVA','ASO MAWLOOD','AMBROSINI EDOARDO'])assert.equal(federationRecoveryCandidate(rows(evidence.find(g=>g.nameKey===name))).status,'needs_identity_evidence');
 assert.equal(playerFederationMatchKey('tennis-europe','RTF'),'RUS');assert.equal(playerFederationMatchKey('itf','RTF'),'RTF');assert.equal(playerFederationMatchKey('tennis-europe','BTF'),'BLR');assert.equal(playerFederationMatchKey('itf','LIB'),'LBN');assert.equal(playerFederationMatchKey('itf','LBY'),'LBY');
});
test('D1_TEST_REAL_DELTAS_ONLY and D1_TEST_IDENTICAL_ZERO_WRITES: recovery keeps sources, follows old aliases and does not repeat writes',async()=>{const d=database({identityMapping:true});try{
 const selected=evidence.filter(g=>['ALEKSANDR ROGACHEV','MIRAL PHARAON','ASO MAWLOOD'].includes(g.nameKey));
 for(const g of selected){const people=new Map();for(const r of rows(g)){const table=r.source_key.startsWith('acquired|')?'search_acquired_players':'observed_players';d.execute(`INSERT INTO ${table}(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)`,[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,r.payload]);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality,birth_year) VALUES(?,?,?,?,?,?,?,?,?)',[r.source_key,r.person_id,g.nameKey,r.circuit,r.official_id,r.normalized_name,r.display_name,JSON.parse(r.payload).nationality,JSON.parse(r.payload).birthYear]);people.set(r.person_id,r);}
  for(const [id,r]of people)d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,g.nameKey,JSON.stringify({name:r.display_name,canonicalId:id,circuit:r.circuit,sources:[r.circuit]})]);
 }
 d.execute('DELETE FROM player_identity_pending_sources');d.execute("INSERT INTO player_identity_sync VALUES('current','ready')");
 const before=await d.query('SELECT source_key,payload FROM observed_players ORDER BY source_key'),r=await reviewAndRepairFederationIdentities(d.query,{names:selected.map(g=>g.nameKey)});assert.deepEqual(r.summary,{reviewed:3,reconciled:2,alreadyUnified:0,remaining:1});assert.deepEqual(await d.query('SELECT source_key,payload FROM observed_players ORDER BY source_key'),before);
 const old=evidence.find(g=>g.nameKey==='ALEKSANDR ROGACHEV').canonicalIds;for(const id of old){const aliases=await d.query(`SELECT canonical_id FROM player_identity_aliases WHERE alias_id='${id}'`);assert.equal(aliases.length,1);assert.equal(aliases[0].canonical_id,r.reviews.find(x=>x.name==='ALEKSANDR ROGACHEV').canonicalId);}
 const writes=d.writes();assert.equal((await reviewAndRepairFederationIdentities(d.query)).status,'already_completed');assert.equal(d.writes(),writes);
}finally{d.close()}});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing baseline group cannot be acknowledged or written',async()=>{const d=database({identityMapping:true});try{const before=d.writes();await assert.rejects(reviewAndRepairFederationIdentities(d.query,{names:['MISSING PLAYER']}),/group_missing/);assert.equal(d.writes(),before);}finally{d.close()}});
