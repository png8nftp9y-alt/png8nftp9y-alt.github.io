import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
import {inspectSearchIdentitySplit} from '../scripts/inspect-search-identity-split.mjs';
test('diagnosis distinguishes stale separate canonical people from compatible sources without writing',async()=>{const d=database({identityMapping:true});try{
 for(const [key,circuit,id,nation]of [['f','fitp','2543087015',''],['e','tennis-europe','d583abbf-29a7-4963-a408-6591f34c34db','ROU'],['i','itf','800695612','ROU']]){
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,'DAVID DUMITRU','David Dumitru',JSON.stringify({nationality:nation})]);
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[key,'DAVID DUMITRU',JSON.stringify({canonicalId:key,name:'David Dumitru',sources:[circuit]})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,key,'DAVID DUMITRU',circuit,id,'DAVID DUMITRU','David Dumitru']);
 }
 d.execute("INSERT INTO player_identity_sync VALUES('current','ready')");
 const before=d.writes(),client=createReadOnlyD1Client((sql,values)=>d.execute(sql,values)),r=await inspectSearchIdentitySplit(client.query,client.db);
 assert.equal(r.savedCanonicalIds.length,3);assert.equal(r.search.results.length,3);assert.equal(r.sourceGrouping.length,1);assert.equal(r.projection.people.length,1);assert.equal(r.sources.length,3);assert.equal(d.writes(),before);
 // A genuine same-circuit homonym must be reported, not silently collapsed.
 d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['other','itf','800695613','DAVID DUMITRU','David Dumitru','{"birthYear":1990,"nationality":"ITA"}']);
 const r2=await inspectSearchIdentitySplit(client.query,client.db);assert.ok(r2.sourceGrouping.length>1);assert.ok(r2.projection.people.length>1);
}finally{d.close()}});
