import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {repairNationalityIdentityLinks} from '../scripts/repair-nationality-identity-links.mjs';
import {paginatedPlayerSearch,mergeSearchIdentities} from '../lib/paginated-player-search.mjs';
import {storedIdentity,mappedPlayerId} from '../lib/player-identity-lookup.mjs';
import {playerNationalityKey} from '../lib/player-nationality.mjs';
const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/david-dumitru-identity-evidence.json',import.meta.url),'utf8'));
function seed(d){for(const r of evidence.sources)d.execute(`INSERT INTO ${r.source_table}(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)`,[r.source_key,r.circuit,r.official_id,r.normalized_name,r.display_name,JSON.stringify(r.payload)]);for(const p of evidence.people)d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[p.canonicalId,'DAVID DUMITRU',JSON.stringify(p)]);for(const r of evidence.links){const keys=Object.keys(r);d.execute(`INSERT INTO player_circuit_identities(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,Object.values(r));}d.execute('DELETE FROM player_identity_pending_sources');d.execute("INSERT INTO player_identity_sync VALUES('current','ready')");}
test('real D1 evidence goes from three results to one with three official circuits; raw evidence and followed ID stay intact',async()=>{const d=database({identityMapping:true});try{seed(d);const old=evidence.people.find(p=>p.circuit==='fitp').canonicalId;d.execute('INSERT INTO user_app_players VALUES(?,?,?)',['owner',old,'2026-10-01']);const rawBefore=await d.query('SELECT * FROM search_acquired_players ORDER BY source_key');assert.equal((await paginatedPlayerSearch(d.db,'David Dumitru',null)).results.length,3);
 for(const [key,circuit,id,nation]of [['other-f','fitp','123456','MGO'],['other-e','tennis-europe','12345678-1234-1234-1234-123456789abc','MNE']]){
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',[key,circuit,id,'ANOTHER PERSON','Another Person',JSON.stringify({nationality:nation,birthYear:2010})]);
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[key,'ANOTHER PERSON',JSON.stringify({name:'Another Person',canonicalId:key})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name,nationality,birth_year) VALUES(?,?,?,?,?,?,?,?,?)',[key,key,'ANOTHER PERSON',circuit,id,'ANOTHER PERSON','Another Person',nation,2010]);
 }
 d.execute('DELETE FROM player_identity_pending_sources');
 const report=await repairNationalityIdentityLinks(d.query);assert.equal(report.groups,2);assert.equal((await paginatedPlayerSearch(d.db,'Another Person',null)).results.length,1);assert.equal(new Set(report.david.map(r=>r.canonical_id)).size,1);const page=await paginatedPlayerSearch(d.db,'David Dumitru','owner');assert.equal(page.results.length,1);assert.equal(page.results[0].birthYear,2012);assert.equal(page.results[0].circuitProfiles.length,3);assert.equal(page.results[0].courtwatchId,old);assert.deepEqual(new Set(page.results[0].sources),new Set(['fitp','itf','tennis-europe']));
 for(const p of evidence.people){assert.equal((await storedIdentity(d.db,p.canonicalId)).canonicalId,page.results[0].canonicalId);assert.equal((await mappedPlayerId(d.db,p.canonicalId,'owner')).playerId,old);}
 assert.deepEqual(await d.query('SELECT * FROM search_acquired_players ORDER BY source_key'),rawBefore);const before=d.writes();assert.equal((await repairNationalityIdentityLinks(d.query)).status,'already_reconciled');assert.equal(d.writes(),before);
}finally{d.close()}});
test('future equivalent-code groups merge; real country, birth year and native ID conflicts remain separate',()=>{
 const rows=evidence.sources.map(r=>({...r,payload:JSON.stringify(r.payload)}));assert.equal(mergeSearchIdentities(rows,new Map()).length,1);
 const same=(id,nation,year=2012)=>({source_key:id,circuit:'itf',official_id:id,display_name:'Another Person',payload:JSON.stringify({nationality:nation,birthYear:year})});
 const base=[same('800111111','MGO'),{...same('800111111','MNE'),source_key:'alias'}];assert.equal(mergeSearchIdentities(base,new Map()).length,1);
 for(const conflict of [same('800111112','MNE'),same('800111111','MNE',2011),same('800111111','ITA')])assert.ok(mergeSearchIdentities([...base,conflict],new Map()).length>1);
 assert.equal(playerNationalityKey(' rom '),'ROU');assert.equal(playerNationalityKey('MGO'),'MNE');
});
