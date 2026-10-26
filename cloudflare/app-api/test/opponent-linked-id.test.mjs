import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
import {acquiredPlayer} from '../lib/acquired-player-index.mjs';
import {linkedOpponentIdentity} from '../lib/opponent-linked-identity.mjs';
import {otherCircuitOpponentHistory} from '../lib/opponent-canonical-history.mjs';
import {exactCurrentRankingRows} from '../lib/exact-current-ranking.mjs';

const native='12345678-1234-1234-1234-123456789abc',otherNative='22345678-1234-1234-1234-123456789abc';

test('official IDs resolve canonical people, bypass name spelling and refuse multiple canonical candidates',async()=>{
 const d=database({identityMapping:true});
 try {
  const person={canonicalId:'person:self',name:'Ivona Dirnbek',sourceCircuit:'tennis-europe',sourcePlayerId:native};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[person.canonicalId,'DIRNBEK IVONA',JSON.stringify(person)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['source:self',person.canonicalId,'DIRNBEK IVONA','tennis-europe',native,'IVONA DIRNBEK',person.name]);
  const calls=[],db={prepare(sql){calls.push(sql);return d.db.prepare(sql);}};
  assert.equal((await linkedOpponentIdentity(db,native.toUpperCase())).canonicalId,person.canonicalId);
  assert.ok(!calls.some(sql=>/normalized_name|name_key/.test(sql)));
  const query=calls.find(sql=>sql.includes('l.official_id IN'));
  const plan=d.execute('EXPLAIN QUERY PLAN '+query,['tennis-europe',native.toUpperCase(),native]);
  assert.ok(plan.some(row=>row.detail.includes('player_circuit_identity_official')),JSON.stringify(plan));
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['person:conflict','DIRNBEK IVONA',JSON.stringify({...person,canonicalId:'person:conflict'})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['source:conflict','person:conflict','DIRNBEK IVONA','tennis-europe',native,'IVONA DIRNBEK',person.name]);
  assert.equal(await linkedOpponentIdentity(d.db,native),null);
 } finally {d.close();}
});

test('a known native ID without a ranking never falls back to a same-name ranked person',async()=>{
 const calls=[],db={prepare(sql){return{bind(...values){calls.push({sql,values});return{all:async()=>({results:[]})}}}}};
 assert.deepEqual(await exactCurrentRankingRows(db,{playerId:'person:self',profileId:native,name:'Ivona Dirnbek'}),[]);
 assert.equal(calls.length,1);assert.ok(calls[0].sql.includes('profile_id IN'));
 assert.ok(!calls[0].sql.includes('normalized_name IN'));assert.ok(!calls[0].sql.includes('LIKE'));
});

test('real opponent API joins native matches and verified local aliases, keeps homonyms out, and reads native entries despite stale names',async()=>{
 const d=database({identityMapping:true}),originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try {
  d.execute('CREATE INDEX IF NOT EXISTS match_participants_source_player ON match_participants(source_player_id)');
  const raw={id:'78',name:'Ivona Dirnbek',nationality:'SLO'},alias=acquiredPlayer('tennis-europe',raw),otherRaw={...raw,birthYear:2011},otherAlias=acquiredPlayer('tennis-europe',otherRaw);
  const person={id:'person:self',canonicalId:'person:self',sourceKey:alias.sourceKey,name:raw.name,nationality:'SLO',sourceCircuit:'tennis-europe',sourcePlayerId:native};
  for(const [key,id,guid,payload] of [[alias.sourceKey,person.id,native,person],[otherAlias.sourceKey,'person:other',otherNative,{...person,id:'person:other',canonicalId:'person:other',sourceKey:otherAlias.sourceKey,sourcePlayerId:otherNative}]]){
   d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'DIRNBEK IVONA',JSON.stringify(payload)]);
   d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,id,'DIRNBEK IVONA','tennis-europe',guid,'IVONA DIRNBEK',person.name]);
  }
  d.execute('CREATE TABLE opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,payload TEXT)');
  for(const [id,n] of [[native,'Correct Upcoming'],[otherNative,'Wrong Upcoming']])d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?)',['tennis-europe',id,'old spelling',JSON.stringify({tournaments:[{competitionId:id,name:n,startDate:'2026-10-20',endDate:'2026-10-25'},...[8,9,10].map(day=>({competitionId:id+'-entry-'+day,name:'Acceptance only '+day,startDate:'2026-10-'+String(day).padStart(2,'0'),endDate:'2026-10-'+String(day).padStart(2,'0')}))]})]);
  for(const [mid,id,name,payload] of [['native-match',native,'New Spelling',{}],['local-match','78',person.name,raw],['wrong-native',otherNative,person.name,{}],['wrong-local','78',person.name,otherRaw]]){
   const tid='t-'+mid;
   d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',[tid,'tennis-europe',tid,'2026-10-01','2026-10-07',JSON.stringify({name:tid,startDate:'2026-10-01',endDate:'2026-10-07'})]);
   d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[mid,tid,'tennis-europe','2026-10-02',JSON.stringify({event:'GS14',round:'Quarter final',score:'6-2 6-3',status:'completed'})]);
   for(const [key,pid,display,team,winner,data] of [['self',id,name,0,1,payload],['other',otherNative,'Other Player',1,0,{}]])d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,key,pid,display,display.toLowerCase(),'SLO',team,winner,JSON.stringify(data)]);
  }
  // Only the other person is ranked: their rank cannot populate this header.
  d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[otherNative,'2026-10-13','pub','week','G14',12,person.name,person.name.toLowerCase(),'https://example.test','2026-10-13']);
  d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[otherNative,'2026-10-01','old-pub','week','G14',30,person.name,person.name.toLowerCase(),'https://example.test','2026-10-01']);
  const before=d.writes(),calls=[],db={prepare(sql){calls.push(sql);return d.db.prepare(sql);}};
  const response=await worker.fetch(new Request('https://example.test/app/api/opponent-profile?profileId='+native+'&name=Ivona%20Dirnbek&event=GS14&asOf=2026-10-14',{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}}),{DB:db});
  assert.equal(response.status,200,await response.clone().text());const body=await response.json();
  const matches=body.tournaments.flatMap(t=>t.matches||[]);
  assert.deepEqual(new Set(matches.map(m=>m.matchId)),new Set(['native-match','local-match']));
  assert.ok(!body.profile?.ranking);
  assert.equal(body.profile.nationality,'SLO');
  assert.equal(body.profile.europeRankingStatus,'unranked');
  assert.ok(matches.every(m=>m.opponents[0].profileId===otherNative&&m.opponents[0].ranking===30&&m.opponents[0].rankingDate==='2026-10-01'));
  assert.ok(body.tournaments.some(t=>t.name==='Correct Upcoming'));
  assert.equal(body.tournaments.filter(t=>t.historyKind==='past').length,2);
  assert.ok(body.tournaments.filter(t=>t.historyKind==='past').every(t=>t.matches.length>0));
  assert.ok(!body.tournaments.some(t=>t.name.startsWith('Acceptance only')));
  assert.ok(!body.tournaments.some(t=>t.name==='Wrong Upcoming'));
  assert.ok(!calls.some(sql=>/FROM observed_players|FROM search_acquired_players/.test(sql)),calls.join('\n'));
  assert.ok(!calls.some(sql=>/FROM opponent_entry_profiles WHERE normalized_name/.test(sql)));
  const nativeSql=calls.find(sql=>sql.includes('WITH candidate_matches'));
  const plan=d.execute('EXPLAIN QUERY PLAN '+nativeSql,[native,native.toUpperCase(),JSON.stringify(['local-match']),'2026-10-14','']);
  assert.ok(plan.some(row=>row.detail.includes('SEARCH match_participants USING INDEX match_participants_source_player')),JSON.stringify(plan));
  assert.equal(d.writes(),before);
 } finally {globalThis.fetch=originalFetch;d.close();}
});

test('a Europe-only linked identity cannot borrow FITP or ITF history from a homonym',async()=>{
 const db={prepare(){throw Error('unrelated circuit read');}};
 assert.deepEqual(await otherCircuitOpponentHistory(db,{name:'Ivona Dirnbek',asOf:'2026-10-14',identity:{sourceCircuit:'tennis-europe',sourcePlayerId:native}}),[]);
});
