import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {loadPlayerIdDiagnostics,renderPlayerIdDiagnostics} from '../lib/admin-player-id-diagnostics.mjs';
const guid='12345678-1234-1234-1234-123456789abc';
function add(d,key,person,circuit,id){d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,person,'SAME NAME',circuit,id,'SAME NAME','Same Name']);}
test('counts native IDs and canonical people without inflating missing aliases or other circuits',async()=>{
 const d=database({identityMapping:true});try{
  add(d,'f1','person1','fitp','123456');add(d,'f2','person1','fitp','123456');add(d,'f-old','person1','fitp','name:Same Name');
  add(d,'e1','person1','tennis-europe',guid);add(d,'e2','person1','tennis-europe',guid.toUpperCase());
  add(d,'e-missing','person2','tennis-europe','name:Same Name');add(d,'i1','person3','itf','800123456');
  const writes=d.writes(),rows=await loadPlayerIdDiagnostics(d.db);assert.equal(d.writes(),writes);
  assert.equal(rows.coverage.length,3);assert.equal(rows.coverage.find(r=>r.circuit==='tennis-europe').records_missing_circuit_id,1);
  assert.deepEqual(rows.map(({circuit,ids,players,missing})=>({circuit,ids,players,missing})),[
   {circuit:'fitp',ids:1,players:1,missing:0},{circuit:'tennis-europe',ids:1,players:2,missing:1},{circuit:'itf',ids:1,players:1,missing:0}
  ]);
 }finally{d.close()}
});
test('malformed and synthetic official IDs remain missing',async()=>{
 const d=database({identityMapping:true});try{
  for(const [i,circuit,id] of [[1,'fitp','12345'],[2,'fitp','12345a'],[3,'itf','801123456'],[4,'itf','80012345x'],[5,'tennis-europe',guid.replace('a','z')],[6,'tennis-europe',guid.replace('-','a')]])add(d,'s'+i,'p'+i,circuit,id);
  const rows=await loadPlayerIdDiagnostics(d.db);assert.ok(rows.every(r=>r.ids===0&&r.missing===2));
 }finally{d.close()}
});
test('empty valid mapping counts zero while missing schema and read failures show unavailable',async()=>{
 const d=database({identityMapping:true});try{assert.ok((await loadPlayerIdDiagnostics(d.db)).every(r=>r.ids===0&&r.missing===0));}finally{d.close()}
 const old=database();try{assert.equal(await loadPlayerIdDiagnostics(old.db),null);}finally{old.close()}
 assert.equal(await loadPlayerIdDiagnostics({prepare(){throw Error('unavailable')}}),null);
 assert.match(renderPlayerIdDiagnostics(null),/non disponibili/);assert.doesNotMatch(renderPlayerIdDiagnostics(null),/pill ok/);
});
test('pending mapping is visible and diagnostics refresh only on page load',async()=>{
 const d=database({identityMapping:true});try{
  d.execute("INSERT INTO player_identity_pending_sources VALUES('observed_players','pending',1)");
  const html=renderPlayerIdDiagnostics(await loadPlayerIdDiagnostics(d.db));assert.match(html,/1 fonti in attesa/);assert.match(html,/Aggiorna conteggi/);assert.doesNotMatch(html,/<script|http-equiv|Same Name/);
 }finally{d.close()}
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(source,/view==='diagnostica'\?renderPlayerIdDiagnostics/);
 assert.ok(source.includes("${view==='diagnostica'?'':'<meta http-equiv=\"refresh\" content=\"300\">'}"));
});
