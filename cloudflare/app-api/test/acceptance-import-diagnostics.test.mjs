import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {syncAcceptanceProfiles} from '../scripts/sync-acceptance-player-profiles.mjs';
import {loadAcceptanceImportDiagnostics,renderAcceptanceImportDiagnostics,saveAcceptanceImportDiagnostics} from '../lib/acceptance-import-diagnostics.mjs';
const doc={participants:[{name:'Good Test Player',worldTennisId:'800123456'},{name:'Missing Test Player'}]};
test('D1_TEST_INITIAL_IMPORT: all new unsaved names visible including valid players blocked with the list',async()=>{
 const d=database({identityMapping:true});try{
  await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc),/id_required/);
  const rows=await loadAcceptanceImportDiagnostics(d.db);assert.equal(rows[0].unsaved.length,2);
  assert.deepEqual(rows[0].unsaved.map(p=>p.reason).sort(),['id_required','import_blocked']);
  assert.equal(d.execute('SELECT * FROM observed_players').length,0);
  const html=renderAcceptanceImportDiagnostics(rows);assert.match(html,/Good Test Player/);assert.match(html,/Missing Test Player/);assert.doesNotMatch(html,/800123456/);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: replay of the same failure does not rewrite diagnostics',async()=>{
 const d=database({identityMapping:true});try{
  await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc));const before=d.writes();
  await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc));assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: resolved list clears blocked names after ID save verification',async()=>{
 const d=database({identityMapping:true});try{
  await assert.rejects(syncAcceptanceProfiles(d.query,'itf',doc));
  await syncAcceptanceProfiles(d.query,'itf',{participants:doc.participants.map((p,i)=>({...p,worldTennisId:i?'800654321':'800123456'}))});
  const rows=await loadAcceptanceImportDiagnostics(d.db);assert.equal(rows[0].status,'complete');assert.equal(rows[0].unsaved.length,0);assert.equal(d.execute('SELECT * FROM observed_players').length,2);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: malformed sources show unavailable counts without player writes',async()=>{
 const d=database({identityMapping:true});try{
  await assert.rejects(syncAcceptanceProfiles(d.query,'itf',{}));const rows=await loadAcceptanceImportDiagnostics(d.db);assert.equal(rows[0].unsaved,null);assert.match(renderAcceptanceImportDiagnostics(rows),/Non disponibile/);assert.equal(d.execute('SELECT * FROM observed_players').length,0);
 }finally{d.close()}
});
test('unavailable registry differs from no run and names are escaped in admin output',async()=>{
 assert.equal(await loadAcceptanceImportDiagnostics({prepare(){throw Error()}}),null);
 assert.match(renderAcceptanceImportDiagnostics(null),/non disponibile/);assert.match(renderAcceptanceImportDiagnostics([]),/Non ancora verificato/);
 const d=database({identityMapping:true});try{
  await saveAcceptanceImportDiagnostics(d.query,'itf',{rows:[{source_key:'test',circuit:'itf',display_name:'<script>test</script>',official_id:''}],status:'blocked',reason:'id_required'});
  const html=renderAcceptanceImportDiagnostics(await loadAcceptanceImportDiagnostics(d.db));assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 }finally{d.close()}
});
