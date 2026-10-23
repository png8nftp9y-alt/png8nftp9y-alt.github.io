import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
import {auditSplitPlayerIdentities} from '../scripts/audit-split-player-identities.mjs';
function add(d,key,circuit,id,name,payload={},person=key){d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,name.toUpperCase(),name,JSON.stringify(payload)]);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality,birth_year) VALUES(?,?,?,?,?,?,?,?,?)',[key,person,name.toUpperCase(),circuit,id,name.toUpperCase(),name,payload.nationality||'',payload.birthYear||null]);}
test('D1_TEST_READ_ONLY_TRANSPORT: all split names are inspected, repeated IDs cross spellings, real conflicts remain explicit, aliases avoid false duplicates',async()=>{const d=database({identityMapping:true});try{
 add(d,'d-f','fitp','2543087015','David Dumitru',{nationality:'ROU',birthYear:2012});add(d,'d-i','itf','800695612','David Dumitru',{nationality:'ROM',birthYear:2012});
 add(d,'h1','itf','800111111','Same Name',{nationality:'ITA',birthYear:2010});add(d,'h2','itf','800111112','Same Name',{nationality:'SUI',birthYear:2011});
 add(d,'v1','itf','800222222','Original Name');add(d,'v2','itf','800222222','Corrected Name');
 add(d,'a1','itf','800333333','Linked Player');add(d,'a2','fitp','123456','Linked Player');d.execute("INSERT INTO player_identity_aliases VALUES('a2','a1')");
 d.execute('DELETE FROM player_identity_pending_sources');d.execute("INSERT INTO player_identity_sync VALUES('current','ready')");
 const client=createReadOnlyD1Client((sql,params)=>d.execute(sql,params)),before=d.writes(),queries=[];
 const r=await auditSplitPlayerIdentities((sql,params)=>{queries.push(sql);return client.query(sql,params)},{pageSize:1});
 assert.equal(d.writes(),before);assert.equal(r.consistent,true);assert.equal(r.groups.length,2);assert.equal(r.summary.splitOfficialIds,1);assert.equal(r.sameOfficial.length,2);
 assert.deepEqual(r.groups.find(g=>g.nameKey==='DAVID DUMITRU').reasons,['compatible_sources_still_separate']);
 assert.deepEqual(new Set(r.groups.find(g=>g.nameKey==='SAME NAME').reasons),new Set(['birth_year_conflict','nationality_conflict','distinct_official_ids_in_same_circuit']));
 assert.ok(!r.groups.some(g=>g.nameKey==='LINKED PLAYER'));assert.ok(queries.filter(s=>s.includes('WITH page AS')).every(s=>s.includes('CROSS JOIN player_circuit_identities')));
 d.execute("INSERT INTO player_identity_pending_sources VALUES('search_acquired_players','d-f',1)");const pending=await auditSplitPlayerIdentities(client.query);assert.equal(pending.consistent,false);assert.equal(pending.status,'inconclusive_mapping_changed_or_pending');
}finally{d.close()}});
test('D1_TEST_MUTATIONS_REJECTED: incomplete source evidence is reported and guard rejects writes before transport',async()=>{const d=database({identityMapping:true});try{
 add(d,'f','fitp','123456','Source Missing',{nationality:'ITA'});add(d,'i','itf','800444444','Source Missing',{nationality:'ITA'});d.execute("DELETE FROM search_acquired_players WHERE source_key='i'");d.execute('DELETE FROM player_identity_pending_sources');d.execute("INSERT INTO player_identity_sync VALUES('current','ready')");
 let calls=0;const client=createReadOnlyD1Client((sql,params)=>{calls++;return d.execute(sql,params)}),r=await auditSplitPlayerIdentities(client.query);assert.ok(r.groups[0].reasons.includes('original_source_missing'));assert.ok(!r.groups[0].reasons.includes('compatible_sources_still_separate'));
 const before=calls;await assert.rejects(client.query('DELETE FROM player_circuit_identities'),/read_only_guard/);assert.equal(calls,before);
}finally{d.close()}});
