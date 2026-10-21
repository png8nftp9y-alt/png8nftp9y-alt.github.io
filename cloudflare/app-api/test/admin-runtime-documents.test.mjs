import test from 'node:test';
import assert from 'node:assert/strict';
import {adminRuntimeDocuments} from '../lib/admin-runtime-documents.mjs';
import {RUNTIME_DOCUMENT_FILES,encodeDocument,releasePlan} from '../lib/runtime-document-plan.mjs';

function fixture(){
 let documents,release,broken=false;const reads=[];
 const publish=total=>{documents=RUNTIME_DOCUMENT_FILES.map(path=>encodeDocument(path,{status:'fixture_complete',players:[{}],tournaments:[{}],ordinary:{total},extraordinary:{total:0}}));release=releasePlan(documents,'source-'+total).value;};publish(5);
 const db={prepare(sql){
  reads.push(sql);
  return {first:async()=>({value:release}),bind(path,hash){
   return {all:async()=>({results:documents.find(d=>d.path===path&&d.hash===hash).chunks.map((data,seq)=>({seq,data:broken?'invalid':data}))})};
  }};
 }};
 return{db,reads,publish,break:value=>{broken=value;}};
}
const path='dist/v3/itf_metadata_queue_status.json';
test('reopening Admin reads the current D1 release but reuses verified unchanged chunks',async()=>{
 const f=fixture();assert.equal((await adminRuntimeDocuments(f.db).get(path)).ordinary.total,5);
 assert.equal(f.reads.length,2);
 await adminRuntimeDocuments(f.db).get(path);
 assert.equal(f.reads.length,3);assert.equal(f.reads.filter(s=>s.includes('runtime_document_chunks')).length,1);
});
test('a new D1 release immediately removes resolved tournaments from Admin without TTL, HTTP or R2',async()=>{
 const f=fixture();await adminRuntimeDocuments(f.db).get(path);f.publish(0);
 assert.equal((await adminRuntimeDocuments(f.db).get(path)).ordinary.total,0);
 assert.equal(f.reads.length,4);
});
test('concurrent openings share verification, failures are not cached, databases stay isolated',async()=>{
 const f=fixture();await Promise.all([adminRuntimeDocuments(f.db).get(path),adminRuntimeDocuments(f.db).get(path)]);
 assert.equal(f.reads.filter(s=>s.includes('runtime_document_chunks')).length,1);
 const other=fixture();other.break(true);await assert.rejects(adminRuntimeDocuments(other.db).get(path));other.break(false);
 assert.equal((await adminRuntimeDocuments(other.db).get(path)).ordinary.total,5);
});
test('player documents never enter the shared Admin cache',async()=>{
 const f=fixture();await adminRuntimeDocuments(f.db).get('dist/v3/players.json');await adminRuntimeDocuments(f.db).get('dist/v3/players.json');
 assert.equal(f.reads.filter(s=>s.includes('runtime_document_chunks')).length,2);
});

test('cold one-SELECT preload executes on SQLite with indexed chunks, exact data and zero writes',async()=>{
 const {database}=await import('./search-sqlite-fixture.mjs');const d=database();
 try{
  const paths=['dist/v3/itf_t1_queue_status.json',path];
  d.publishRuntimeDocuments({[path]:{ordinary:{total:5},extraordinary:{total:0}}});
  const calls=[];const db={prepare(sql){calls.push(sql);return d.db.prepare(sql)}};const before=d.writes();
  const reader=adminRuntimeDocuments(db);await reader.preload(paths);
  assert.equal((await reader.get(path)).ordinary.total,5);await reader.get(paths[0]);assert.equal(calls.length,1);assert.equal(d.writes(),before);
  const plan=d.execute('EXPLAIN QUERY PLAN '+calls[0],paths);assert.ok(plan.some(row=>/SEARCH c USING PRIMARY KEY/.test(row.detail)),JSON.stringify(plan));
  d.publishRuntimeDocuments({[path]:{ordinary:{total:0},extraordinary:{total:0}}});
  const next=adminRuntimeDocuments(db);await next.preload(paths);assert.equal((await next.get(path)).ordinary.total,0);
 }finally{d.close();}
});
