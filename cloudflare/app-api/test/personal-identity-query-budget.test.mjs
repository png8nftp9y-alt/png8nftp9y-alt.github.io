import test from 'node:test';import assert from 'node:assert/strict';import {database} from './search-sqlite-fixture.mjs';import {storedIdentity,storedIdentities} from '../lib/player-identity-lookup.mjs';
test('eight personal identities use one indexed read with exactly the single-lookup results, including aliases and ambiguity',async()=>{const d=database({identityMapping:true});try{
 const keys=[];for(let i=0;i<8;i++){const id='person-'+i,source='source-'+i;d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'PERSON '+i,JSON.stringify({canonicalId:id,name:'Person '+i})]);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[source,id,'PERSON '+i,'fitp','12345'+i,'PERSON '+i,'Person '+i]);d.execute('INSERT INTO player_identity_aliases VALUES(?,?)',['alias-'+i,id]);keys.push(source)}
 keys.push('alias-0','person-1','missing');d.execute('INSERT INTO player_identity_aliases VALUES(?,?)',['source-0','person-2']);
 const expected=new Map();for(const key of keys)expected.set(key,await storedIdentity(d.db,key));
 let calls=0;const db={prepare(sql){calls++;return d.db.prepare(sql)}};const actual=await storedIdentities(db,keys);
 assert.deepEqual(actual,expected);assert.equal(calls,1);assert.equal(actual.get('source-0'),null);
 }finally{d.close()}});
