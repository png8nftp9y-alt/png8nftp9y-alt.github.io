import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {identityReviewKey} from '../lib/identity-review-queue.mjs';
import {approveUrsino,rule} from '../scripts/approve-ursino-identity.mjs';
function fixture(){const d=database({identityMapping:true});for(const [i,id] of rule.identities.entries()){
 const sk=id.circuit+'|'+id.officialId,p=JSON.stringify({name:'Domenico Ursino',nationality:i?'SUI':'ITA',birthYear:2012,profileUrl:i?'https://te.tournamentsoftware.com/player-profile/'+id.officialId:'https://www.fitp.it/Pagina-Giocatore/?cardNumber=NjQ3NTkwMTQzOQ%3D%3D'});
 d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[sk,id.circuit,id.officialId,'DOMENICO URSINO','Domenico Ursino',p]);
 d.execute('INSERT INTO player_identity_people(canonical_id,name_key,payload) VALUES(?,?,?)',['cw-test-'+i,rule.nameKey,'{}']);
 d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,birth_year,nationality,profile_url) VALUES(?,?,?,?,?,?,?,?,?,?)',[sk,'cw-test-'+i,rule.nameKey,id.circuit,id.officialId,rule.nameKey,'Domenico Ursino',2012,i?'SUI':'ITA','']);
 }d.execute('DELETE FROM player_identity_pending_sources');d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewKey(rule.nameKey),'{}','2026-11-02']);return d;}
test('confirmed exact pair unifies despite nationality mismatch; original payloads survive; replay writes zero',async()=>{const d=fixture();try{const raw=d.execute('SELECT * FROM observed_players ORDER BY source_key');const r=await approveUrsino(d.query);assert.equal(r.status,'verified');assert.equal(r.caseClosed,true);assert.deepEqual(d.execute('SELECT * FROM observed_players ORDER BY source_key'),raw);const writes=d.writes();assert.equal((await approveUrsino(d.query)).status,'already_verified');assert.equal(d.writes(),writes);}finally{d.close();}});
test('missing native ID fails before any mutation',async()=>{const d=fixture();try{d.execute("DELETE FROM player_circuit_identities WHERE circuit='fitp'");const n=d.writes();await assert.rejects(approveUrsino(d.query),/native_missing/);assert.equal(d.writes(),n);}finally{d.close();}});

test('new same-name native identity stops approval before writes',async()=>{const d=fixture();try{d.execute("INSERT INTO player_circuit_identities SELECT 'other',canonical_id,name_key,circuit,'1111111111',normalized_name,display_name,birth_year,nationality,profile_url FROM player_circuit_identities WHERE circuit='fitp'");const n=d.writes();await assert.rejects(approveUrsino(d.query),/extra_native/);assert.equal(d.writes(),n);}finally{d.close();}});
