import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../../cloudflare/app-api/test/search-sqlite-fixture.mjs';
import {countPlayerClubs} from '../count-fitp-player-clubs.mjs';
import {assertReadOnlyQuery} from '../../cloudflare/app-api/lib/read-only-d1-query.mjs';
test('club count merges verified circuits and personal metadata; unknown identities stay separate without guessing by name',async()=>{
 const d=database({identityMapping:true});try{
  for(const [id,club]of [['p1',''],['p2','Tesseramento da completare']])d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,id,JSON.stringify({name:'Same Name',club})]);
  for(const [key,id,circuit,official]of [['f1','p1','fitp','123456'],['t1','p1','tennis-europe','guid1'],['f2','p2','fitp','222222']])d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,id,id,circuit,official,'SAME NAME','Same Name']);
  d.execute('INSERT INTO player_identity_aliases VALUES(?,?)',['old-p1','p1']);
  d.execute('INSERT INTO user_app_player_additions(user_id,courtwatch_id,observed_source_key,payload,created_at) VALUES(?,?,?,?,?)',['owner','old-p1','f1',JSON.stringify({club:'Recovered Club'}),'2026-01-01']);
  for(const [key,circuit,official,payload]of [['f1','fitp','123456','{}'],['t1','tennis-europe','guid1','{}'],['unknown1','fitp','333333','{"club":"Other Club"}'],['unknown2','itf','333333','{}'],['blank1','fitp','','{}'],['blank2','fitp','','{"club":" \t "}']])d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[key,circuit,official,'SAME NAME','Same Name',payload]);
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['acquired-duplicate','fitp','333333','SAME NAME','Same Name','{}']);
  d.execute('INSERT INTO app_players(seq,id,payload) VALUES(?,?,?)',[1,'configured',JSON.stringify({membershipCard:'123456',name:'Same Name'})]);
  const before=d.writes();
  const result=await countPlayerClubs(async (sql,params=[])=>{assertReadOnlyQuery(sql);assert.doesNotMatch(sql,/OFFSET|JOIN|EXISTS/i);return (await d.db.prepare(sql).bind(...params).all()).results},{pageSize:2});
  assert.deepEqual(result.rows,[{scope:'verified_players',total:2,with_club:1,without_club:1},{scope:'unmapped_profiles',total:3,with_club:1,without_club:2}]);
  assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('failed queries cannot produce a false zero count',async()=>{await assert.rejects(countPlayerClubs(async()=>{throw Error('unavailable')}),/unavailable/);await assert.rejects(countPlayerClubs(async()=>[],{pageSize:0}),/invalid_page_size/)});
