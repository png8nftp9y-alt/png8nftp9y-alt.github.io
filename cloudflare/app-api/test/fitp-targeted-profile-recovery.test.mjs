import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {recoverConfirmedProfiles,fetchNamedProfile,inspectStoredOrigins} from '../../../tools/fitp-targeted-profile-recovery.mjs';
const target={membership_card:'1234567',canonical_id:'p1',name:'Name Surname'};
async function setup(fn){const d=database({identityMapping:true});try{
 await d.query(readFileSync(new URL('../migrations/0041_fitp_metadata_engine.sql',import.meta.url),'utf8'));
 d.execute("INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES('fitp|1234567','p1','NAME','fitp','1234567','NAME','Name Surname')");
 const ctx={query:async(s,p=[])=>d.execute(s,p),write:async(s,p=[])=>d.execute(s,p),targets:[target],fetchProfile:async card=>({membership_card:card,club:'Club',ranking:'4.1'})};await fn(d,ctx);
 }finally{d.close()}}
test('recovery verifies saved metadata before clearing unavailable ledger; replay writes zero',()=>setup(async(d,ctx)=>{
 d.execute("INSERT INTO fitp_metadata_failures VALUES('2026-10-18','1234567','p1','fitp_profile_missing')");
 const first=await recoverConfirmedProfiles(ctx);assert.equal(first.verified,1);assert.equal(first.dataWrites,1);assert.equal(first.clearedUnavailable,1);
 const before=d.writes();const second=await recoverConfirmedProfiles(ctx);assert.equal(second.dataWrites,0);assert.equal(d.writes(),before);
}));
test('no profile does not erase good data or clear the unresolved ledger',()=>setup(async(d,ctx)=>{
 await recoverConfirmedProfiles(ctx);d.execute("INSERT INTO fitp_metadata_failures VALUES('2026-10-18','1234567','p1','fitp_profile_missing')");
 const result=await recoverConfirmedProfiles({...ctx,fetchProfile:async()=>{throw Error('fitp_profile_missing')}});
 assert.equal(result.status,'recovery_incomplete');assert.equal(result.dataWrites,0);assert.equal(d.execute('SELECT club FROM fitp_player_metadata')[0].club,'Club');assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_metadata_failures')[0].n,1);
}));
test('changed or ambiguous identity refuses recovery before source calls or writes',()=>setup(async(d,ctx)=>{
 d.execute("UPDATE player_circuit_identities SET canonical_id='other'");let calls=0;
 await assert.rejects(recoverConfirmedProfiles({...ctx,fetchProfile:async()=>{calls++}}),/identity_changed/);assert.equal(calls,0);
}));
test('lost or unverified metadata write cannot clear failure ledger',()=>setup(async(d,ctx)=>{
 d.execute("INSERT INTO fitp_metadata_failures VALUES('2026-10-18','1234567','p1','fitp_profile_missing')");
 await assert.rejects(recoverConfirmedProfiles({...ctx,write:async()=>{}}),/write_not_verified/);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_metadata_failures')[0].n,1);
}));
test('exact official name and masked card must both match; source called once',async()=>{
 let calls=0;const response=()=>{calls++;return new Response(JSON.stringify({player:{Name:'Name',Surname:'Surname',MembershipCard:'****567',tennis_club_name:'Club',Ranking:'4.1'}}))};
 assert.equal((await fetchNamedProfile(target,response)).ranking,'4.1');assert.equal(calls,1);
 await assert.rejects(fetchNamedProfile({...target,name:'Different Person'},response),/name_mismatch/);
 await assert.rejects(fetchNamedProfile({...target,membership_card:'9999999'},response),/identity_mismatch/);
});
test('origin inspection preserves original seven-digit card and selects indexed source keys only',()=>setup(async(d,ctx)=>{
 d.execute("INSERT INTO search_acquired_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES('fitp|1234567','fitp','1234567','NAME','Name Surname','{}')");
 const before=d.writes(),result=await inspectStoredOrigins(ctx.query,['1234567']);assert.equal(result.identities,1);assert.equal(result.sourceRows,1);assert.equal(result.rows[0].official_id,'1234567');assert.equal(result.byTable.search_acquired_players,1);assert.equal(d.writes(),before);
}));
