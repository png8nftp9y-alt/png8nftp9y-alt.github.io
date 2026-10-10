import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities,profileRecoveryAudit,recoverMissingProfiles} from '../scripts/sync-player-identities.mjs';
import {unresolvedSources} from '../scripts/repair-archived-player-profiles.mjs';
import {loadPlayerIdDiagnostics,renderPlayerIdDiagnostics} from '../lib/admin-player-id-diagnostics.mjs';
const key='tennis-europe|name:MOEZ BEN AMOR';
const guid='22cc93f0-672e-41ee-85f1-561829ed9315';
function add(d,key,id,name){d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,'tennis-europe',id,name.toUpperCase(),name,JSON.stringify({name,officialId:id})]);}
test('excluded legacy source stays stored but does not count as missing or enter recovery',async()=>{
 const d=database({identityMapping:true});try{
  add(d,key,'','Moez Ben-Amor');await syncPlayerIdentities(d.query);const writes=d.writes();
  const audit=await profileRecoveryAudit(d.query);assert.equal(audit.unresolved,0);assert.equal(audit.excluded,1);assert.deepEqual(audit.residual,[]);
  assert.deepEqual(await unresolvedSources(d.query),[]);assert.equal((await recoverMissingProfiles(d.query)).examined,0);
  const rows=await loadPlayerIdDiagnostics(d.db),te=rows.find(r=>r.circuit==='tennis-europe');assert.equal(te.players,0);assert.equal(te.missing,0);assert.equal(te.excluded,1);
  assert.match(renderPlayerIdDiagnostics(rows),/Record esclusi dalla verifica/);
  assert.equal((await d.query('SELECT COUNT(*) AS n FROM search_acquired_players'))[0].n,1);assert.equal((await d.query('SELECT COUNT(*) AS n FROM player_circuit_identities'))[0].n,1);assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('Adam native ID and unrelated missing players remain included',async()=>{
 const d=database({identityMapping:true});try{
  add(d,key,'','Moez Ben-Amor');add(d,'adam',guid,'Adam Ben-Amor');add(d,'other','', 'Other Player');await syncPlayerIdentities(d.query);
  const audit=await profileRecoveryAudit(d.query);assert.equal(audit.excluded,1);assert.equal(audit.unresolved,1);assert.equal(audit.residual[0].source_key,'other');
  assert.deepEqual((await unresolvedSources(d.query)).map(r=>r.source_key),['other']);
  const te=(await loadPlayerIdDiagnostics(d.db)).find(r=>r.circuit==='tennis-europe');assert.equal(te.ids,1);assert.equal(te.players,2);assert.equal(te.missing,1);
 }finally{d.close()}
});
