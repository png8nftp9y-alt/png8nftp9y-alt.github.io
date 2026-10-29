import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {database} from './search-sqlite-fixture.mjs';
import {birthDate,applyBirthEvidence,enrichPlayerBirthMetadata} from '../lib/player-birth-metadata.mjs';
import {parseOfficialBirth} from '../lib/official-player-birth.mjs';
import {syncObservedBirth,fetchOfficialBirth} from '../scripts/sync-observed-player-birth.mjs';
const guid='bb69621c-ece1-4968-a9aa-7e38f1120a7f';
function fixture(){const d=database({identityMapping:true});d.execute(fs.readFileSync(new URL('../migrations/0048_observed_player_birth_metadata.sql',import.meta.url),'utf8').split(';')[0]);d.execute('INSERT INTO app_players(id,seq,payload) VALUES(?,?,?)',['cw-test',1,JSON.stringify({id:'cw-test',name:'Tommaso Francesconi'})]);d.execute('INSERT INTO user_app_players(user_id,courtwatch_id,created_at) VALUES(?,?,?)',['owner','cw-test','2026-01-01']);d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?)',['cw-test','FRANCESCONI TOMMASO',JSON.stringify({name:'Tommaso Francesconi'})]);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,profile_url,normalized_name,display_name) VALUES(?,?,?,?,?,?,?,?)',['tennis-europe|id:'+guid,'cw-test','FRANCESCONI TOMMASO','tennis-europe',guid,'https://te.tournamentsoftware.com/player-profile/'+guid,'TOMMASO FRANCESCONI','Tommaso Francesconi']);return d;}
const jsonld='<h2>Tommaso Francesconi</h2><script type="application/ld+json">{"@type":"Person","name":"Tommaso Francesconi","birthDate":"2012-03-09"}</script>';
test('birth year extraction stores no day or month and never estimates year from age',()=>{
 assert.equal(birthDate('2012-02-30'),'');assert.equal(birthDate('2012'),'');assert.equal(birthDate('2012-03-09'),'2012-03-09');
 assert.equal(parseOfficialBirth(jsonld,{circuit:'tennis-europe',name:'Tommaso Francesconi'}).birth_year,2012);assert.equal(parseOfficialBirth(jsonld,{name:'Tommaso Francesconi'}).birth_date,undefined);
 const actual=fs.readFileSync(new URL('./fixtures/europe-birth-biography.html',import.meta.url),'utf8');
 assert.deepEqual(parseOfficialBirth(actual,{circuit:'tennis-europe',name:'Tommaso Francesconi'}),{birth_year:2012,status:'year_only'});
 assert.equal(parseOfficialBirth('<h2>Tommaso Francesconi</h2><p>Age 14</p>',{name:'Tommaso Francesconi'}).status,'not_public');
 assert.throws(()=>parseOfficialBirth(jsonld,{name:'Another Person'}),/identity_unverified/);
 assert.throws(()=>parseOfficialBirth('<script src="/_Incapsula_Resource"></script>',{name:'Tommaso Francesconi'}),/source_blocked/);
});
test('actual FITP public sheet without date remains not_public and masked card cannot bind another player',()=>{
 const sheet=JSON.parse(fs.readFileSync(new URL('./fixtures/fitp-birth-public-sheet.json',import.meta.url),'utf8'));
 assert.equal(parseOfficialBirth(sheet,{circuit:'fitp',name:'Andrea Tognolini',officialId:'8332671333'}).status,'not_public');
 assert.throws(()=>parseOfficialBirth(sheet,{circuit:'fitp',name:'Andrea Tognolini',officialId:'8332671999'}),/identity_mismatch/);
});
test('conflicting birth years are visible and never silently overridden',()=>{
 const p=applyBirthEvidence({birthYear:2012},[{birth_year:2013}]);assert.equal(p.birthYearStatus,'conflict');assert.equal(p.birthYear,undefined);
 assert.equal(applyBirthEvidence({birthYear:2012},[{birth_date:'2012-03-09',birth_year:2012}]).birthYearStatus,'year_only');
 assert.equal(applyBirthEvidence({birthYear:2013},[{birth_date:'2012-03-09',birth_year:2012}]).birthYearStatus,'conflict');
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: both lists, removed membership, acquisition, runtime readback and no-repeat replay',async()=>{
 const d=fixture();try{
 const query=(sql,args=[])=>Promise.resolve(d.execute(sql,args));let requests=0;
 d.execute('INSERT INTO user_app_other_players(user_id,courtwatch_id,created_at) VALUES(?,?,?)',['owner','cw-test','2026-01-01']);
 d.execute('INSERT INTO user_app_players(user_id,courtwatch_id,created_at) VALUES(?,?,?)',['other-user','not-owner','2026-01-01']);
 const fetchProfile=async()=>{requests++;return{birth_year:2012,status:'year_only',source_url:'https://te.tournamentsoftware.com/player-profile/'+guid+'/biography'}};
 const r=await syncObservedBirth({query,userId:'owner',fetchProfile});assert.equal(r.selected,1);assert.equal(r.counts.year_only,1);assert.equal(requests,1);
 const players=[{id:'cw-test',birthYear:2012}];await enrichPlayerBirthMetadata(d.db,players);assert.equal(players[0].birthYear,2012);assert.equal(players[0].birthDate,undefined);assert.ok(!d.execute('PRAGMA table_info(player_birth_metadata)').some(r=>r.name==='birth_date'));
 const before=d.writes(),again=await syncObservedBirth({query,userId:'owner',fetchProfile});assert.equal(again.writes,0);assert.equal(d.writes(),before);assert.equal(requests,1);
 d.execute('DELETE FROM user_app_other_players');d.execute('INSERT INTO user_app_player_removals(user_id,courtwatch_id,removed_at) VALUES(?,?,?)',['owner','cw-test','2026-01-02']);
 assert.equal((await syncObservedBirth({query,userId:'owner',fetchProfile})).selected,0);assert.equal(requests,1);
 }finally{d.close();}
});
test('source failure is distinct from an unavailable birth year, and can be retried only by explicit request',async()=>{
 const d=fixture();try{const query=(sql,args=[])=>Promise.resolve(d.execute(sql,args));let calls=0;
 const fetchProfile=async()=>{calls++;throw Error('birth_source_http_503')};
 const r=await syncObservedBirth({query,userId:'owner',fetchProfile});assert.equal(r.sourceErrors.length,1);assert.equal(r.counts.source_error,1);
 await syncObservedBirth({query,userId:'owner',fetchProfile});assert.equal(calls,1);
 await syncObservedBirth({query,userId:'owner',fetchProfile,retryUnavailable:true});assert.equal(calls,2);
 }finally{d.close();}
});
test('profile displays year only, also for legacy full dates, conflicts and unavailable values',()=>{
 const source=fs.readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),start=source.indexOf('function playerBirthLabel('),end=source.indexOf('const FITP_UPPER',start),c={Date,Intl,playerDemographics:p=>({birthYear:p.birthYear||Number(String(p.birthDate||'').slice(0,4))||undefined})};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 assert.equal(c.playerBirthLabel({birthDate:'2012-03-09'}),'anno di nascita 2012');assert.equal(c.playerBirthLabel({birthYear:2012}),'anno di nascita 2012');assert.equal(c.playerBirthLabel({}),'');assert.equal(c.playerBirthLabel({birthYearStatus:'conflict',birthYear:2012}),'');
});

test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing membership payload stops before external requests or writes',async()=>{
 const d=fixture();try{d.execute('DELETE FROM app_players');const before=d.writes();let calls=0;
 await assert.rejects(syncObservedBirth({query:(sql,args=[])=>Promise.resolve(d.execute(sql,args)),userId:'owner',fetchProfile:async()=>{calls++;throw Error('must not fetch')}}),/payload_incomplete/);
 assert.equal(calls,0);assert.equal(d.writes(),before);
 }finally{d.close();}
});

test('a retained year covers the selected player without any public profile request',async()=>{
 const d=fixture();try{d.execute('UPDATE app_players SET payload=? WHERE id=?',[JSON.stringify({id:'cw-test',name:'Tommaso Francesconi',birthYear:2012}),'cw-test']);
 let requests=0;const r=await syncObservedBirth({query:(sql,args=[])=>Promise.resolve(d.execute(sql,args)),userId:'owner',fetchProfile:async()=>{requests++;throw Error('unnecessary profile request')}});
 assert.equal(requests,0);assert.equal(r.counts.year_only,1);assert.equal(r.players[0].birthYear,2012);
 }finally{d.close();}
});
