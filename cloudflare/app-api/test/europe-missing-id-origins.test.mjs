import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {europeMissingIdOriginsSql,europeMissingIdOriginsResult} from '../lib/europe-missing-id-origins.mjs';
test('D1_TEST_INITIAL_IMPORT / D1_TEST_REAL_DELTAS_ONLY: origin audit counts distinct people and overlapping legacy/acquired records without writes',async()=>{const d=database({identityMapping:true});try{
 d.execute("INSERT INTO player_identity_people VALUES('person','TEST PERSON','{}')");
 for(const [key,id]of [['tennis-europe|name:TEST PERSON',''],['acquired|tennis-europe|name:hash','local-id']])d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,'person','TEST PERSON','tennis-europe',id,'TEST PERSON','Test Person']);
 d.execute("INSERT INTO observed_players(source_key,circuit,normalized_name,display_name,payload) VALUES('tennis-europe|name:TEST PERSON','tennis-europe','TEST PERSON','Test Person','{}')");
 const before=d.writes(),r=europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]);assert.equal(d.writes(),before);assert.equal(r.missingPeople,1);assert.equal(r.origins.length,2);assert.ok(r.origins.some(x=>x.origin==='legacy_observed_name'&&x.storage==='observed_players'));assert.ok(r.origins.some(x=>x.idState==='invalid_format'));
 d.execute("UPDATE player_circuit_identities SET official_id='12345678-1234-1234-1234-123456789abc' WHERE source_key='acquired|tennis-europe|name:hash'");
 assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,0);
}finally{d.close()}});
test('blocked acceptance diagnostics distinguish missing IDs from valid records blocked by the list',()=>{
 const r=europeMissingIdOriginsResult({missing_people:24,pending_mapping:0,origins:'[]',acceptance_diagnostic:JSON.stringify({status:'blocked',reason:'id_required',participants:100,unsaved:[{name:'Private Name',reason:'id_required'},{reason:'import_blocked'}]})});
 assert.deepEqual(r.acceptance.reasons,{id_required:1,import_blocked:1});assert.equal(r.acceptance.unsavedRecords,2);assert.ok(!JSON.stringify(r).includes('Private Name'));
});

test('D1_TEST_IDENTICAL_ZERO_WRITES: replay gives identical counts with zero mutations',async()=>{const d=database({identityMapping:true});try{const before=d.writes();const a=europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]);const b=europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]);assert.deepEqual(a,b);assert.equal(d.writes(),before);}finally{d.close()}});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: unavailable counts cannot be reported as zero',()=>{for(const row of [undefined,{}, {missing_people:null,pending_mapping:0},{missing_people:0,pending_mapping:'bad'}])assert.throws(()=>europeMissingIdOriginsResult(row),/unavailable/);});

test('configured canonical Europe profile is counted identically to admin evidence',async()=>{const d=database({identityMapping:true});try{
 const guid='12345678-1234-1234-1234-123456789abc';
 d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['p','TEST PERSON',JSON.stringify({circuitProfiles:[{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/'+guid}]})]);
 for(const [key,circuit]of [['courtwatch|p','courtwatch'],['tennis-europe|name:TEST PERSON','tennis-europe']])d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,'p','TEST PERSON',circuit,'','TEST PERSON','Test Person']);
 assert.equal(europeMissingIdOriginsResult((await d.query(europeMissingIdOriginsSql))[0]).missingPeople,0);
}finally{d.close()}});
