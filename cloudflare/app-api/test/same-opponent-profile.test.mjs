import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {searchIdentityProfile} from '../lib/paginated-player-search.mjs';
import {opponentEuropeProfile} from '../lib/opponent-europe-profile.mjs';
import {circuitProfiles} from '../lib/player-circuit-profiles.mjs';
test('Agenda local ID resolves the same canonical person, UKR, U12 and Europe link as Search',async()=>{
 const d=database({identityMapping:true});
 try{
  const native='5f12de40-51b6-4778-bb3e-66f1743374d0',source='tennis-europe|name:KATERYNA USHCHAPOVSKA',id='cw-b9d4be0d8f1b9c4b2aef4b6e454cc857',url='https://te.tournamentsoftware.com/player-profile/'+native;
  const person={canonicalId:id,name:'Kateryna Ushchapovska',circuit:'tennis-europe',sourcePlayerId:native,nationality:'UKR',birthYear:2014,circuitProfiles:[{circuit:'tennis-europe',url}]};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[id,'KATERYNA USHCHAPOVSKA',JSON.stringify(person)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality) VALUES(?,?,?,?,?,?,?,?)',[source,id,'KATERYNA USHCHAPOVSKA','tennis-europe',native,'KATERYNA USHCHAPOVSKA',person.name,'UKR']);
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[source,'tennis-europe','78','KATERYNA USHCHAPOVSKA',person.name,'{}']);
  const before=d.writes(),search=await searchIdentityProfile(d.db,person.name,source),agenda=await searchIdentityProfile(d.db,person.name,'78');
  assert.equal(agenda.canonicalId,search.canonicalId);assert.equal(agenda.sourcePlayerId,native);
  for(const p of [search,agenda]){assert.equal(p.nationality,'UKR');assert.equal(p.birthYear,2014);const profile=opponentEuropeProfile({person:p,event:'GS14',year:2026});assert.equal(profile.europeRankingStatus,'unranked-u12');assert.equal(profile.nationality,'UKR');assert.equal(circuitProfiles(p)[0].url,url);}
  assert.equal(d.writes(),before);
  assert.equal(await searchIdentityProfile(d.db,person.name,'different-local-id'),null);
 }finally{d.close();}
});
