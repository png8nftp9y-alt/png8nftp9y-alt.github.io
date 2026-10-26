import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {localEuropeOpponentIdentity} from '../lib/opponent-local-identity.mjs';
import {participantSourceKey} from '../lib/personal-tennis-europe-history.mjs';
import {searchIdentityProfile} from '../lib/paginated-player-search.mjs';
import {opponentEuropeProfile} from '../lib/opponent-europe-profile.mjs';
import worker from '../src/index.js';
const native='5f12de40-51b6-4778-bb3e-66f1743374d0',name='Kateryna Ushchapovska',canonical='cw-b9d4be0d8f1b9c4b2aef4b6e454cc857';
async function seed(d,{mid='kateryna',display=name,year=null,personId=canonical,profileId=native,map=true}={}){
 const raw=year?{birthYear:year}:{},p={match_id:mid,participant_key:'self',source_player_id:'49',display_name:display,normalized_name:display.toLowerCase(),nationality:'UKR',payload:JSON.stringify(raw)};
 d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['t-'+mid,'tennis-europe','t-'+mid,'2026-10-24','2026-10-31',JSON.stringify({name:'Tournament '+mid,startDate:'2026-10-24',endDate:'2026-10-31'})]);
 d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',[mid,'t-'+mid,'tennis-europe','2026-10-26',JSON.stringify({event:'GS14',status:'completed',score:'6-1 6-0'})]);
 d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',[mid,'self','49',display,display.toLowerCase(),'UKR',0,1,p.payload]);
 const key=await participantSourceKey('tennis-europe',p);
 const person={canonicalId:personId,name:display,circuit:'tennis-europe',sourcePlayerId:profileId,nationality:'UKR',birthYear:year||2014,circuitProfiles:[{circuit:'tennis-europe',url:'https://te.tournamentsoftware.com/player-profile/'+profileId}]};
 if(map){d.execute('INSERT OR IGNORE INTO player_identity_people VALUES(?,?,?)',[personId,display.toUpperCase(),JSON.stringify(person)]);d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality) VALUES(?,?,?,?,?,?,?,?)',[key,personId,display.toUpperCase(),'tennis-europe',profileId,display.toUpperCase(),display,'UKR']);}
 return{key,person};
}
test('actual Agenda ID 49 resolves the same UKR/U12/Europe identity as Search, using acquired hash evidence',async()=>{
 const d=database({identityMapping:true});try{
 const {key}=await seed(d);assert.equal(key,'acquired|tennis-europe|name:5acc64a9620bad07f20eee57');
 await seed(d,{mid:'different',display:'Different Player',personId:'other',profileId:'12345678-1234-1234-1234-123456789abc'});
 d.execute('CREATE INDEX IF NOT EXISTS match_participants_source_player ON match_participants(source_player_id)');
 const calls=[],db={prepare(sql){calls.push(sql);return d.db.prepare(sql);}};
 const before=d.writes(),local=await localEuropeOpponentIdentity(db,{profileId:'49',name}),search=await searchIdentityProfile(d.db,name,key);
 const sql=calls.find(s=>s.includes('p.source_player_id=?'));const plan=d.execute('EXPLAIN QUERY PLAN '+sql,['49',name.toUpperCase(),name.toLowerCase(),'USHCHAPOVSKA KATERYNA','ushchapovska kateryna']);assert.ok(plan.some(r=>r.detail.includes('match_participants_source_player')),JSON.stringify(plan));
 assert.equal(local.canonicalId,search.canonicalId);assert.equal(local.sourcePlayerId,native);assert.equal(local.nationality,'UKR');assert.equal(local.birthYear,2014);assert.deepEqual(local.circuitProfiles,search.circuitProfiles);
 assert.equal(opponentEuropeProfile({person:local,event:'GS14',year:2026}).europeRankingStatus,'unranked-u12');assert.equal(d.writes(),before);
 }finally{d.close();}
});
test('same local ID and name mapping to two established people is refused',async()=>{
 const d=database({identityMapping:true});try{await seed(d);await seed(d,{mid:'homonym',year:2011,personId:'homonym',profileId:'12345678-1234-1234-1234-123456789abc'});assert.equal(await localEuropeOpponentIdentity(d.db,{profileId:'49',name}),null);}finally{d.close();}
});
test('unmapped participant evidence and native IDs cannot trigger a name-only merge',async()=>{
 const d=database({identityMapping:true});try{await seed(d,{map:false});assert.equal(await localEuropeOpponentIdentity(d.db,{profileId:'49',name}),null);assert.equal(await localEuropeOpponentIdentity({prepare(){throw Error('must not query')}},{profileId:native,name}),null);}finally{d.close();}
});
test('real API responses from Agenda 49 and Search have identical profile, circuit links and tournaments',async()=>{
 const d=database({identityMapping:true});try{
 const {key}=await seed(d),headers={'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'},env={DB:d.db};
 const call=async id=>{const r=await worker.fetch(new Request('https://example.test/app/api/opponent-profile?profileId='+encodeURIComponent(id)+'&name='+encodeURIComponent(name)+'&event=GS14&asOf=2026-10-27',{headers}),env);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const before=d.writes(),a=await call('49'),b=await call(key);
 assert.deepEqual(a.profile,b.profile);assert.equal(a.profile.nationality,'UKR');assert.equal(a.profile.europeRankingStatus,'unranked-u12');assert.deepEqual(a.circuitProfiles,b.circuitProfiles);assert.ok(a.circuitProfiles.some(p=>p.url.endsWith(native)));assert.deepEqual(a.tournaments,b.tournaments);assert.equal(d.writes(),before);
 }finally{d.close();}
});
