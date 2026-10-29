import test from 'node:test';import assert from 'node:assert/strict';
import {ensureRuntimeDocumentVersion} from '../lib/verify-runtime-version.mjs';
import {encodeDocument} from '../lib/runtime-document-plan.mjs';
import {database} from './search-sqlite-fixture.mjs';
function setup(){const d=database();const doc=encodeDocument('dist/v3/diagnostics.json',{status:'new',reason:'verified contents'});const text=doc.chunks.join('');doc.chunks=[text.slice(0,10),text.slice(10)];const reads=[];const query=async(sql,params=[])=>{reads.push(sql);return d.execute(sql,params)};return {d,doc,query,reads};}
test('new or partial immutable versions read back; complete replay reads contents once and writes zero',async()=>{
 const f=setup();try{
  f.d.execute('INSERT INTO runtime_document_chunks VALUES(?,?,0,?)',[f.doc.path,f.doc.hash,f.doc.chunks[0]]);
  assert.equal(await ensureRuntimeDocumentVersion(f.query,f.doc),true);
  assert.equal(f.reads.filter(x=>x.startsWith('SELECT')).length,2);
  f.reads.length=0;const before=f.d.writes();assert.equal(await ensureRuntimeDocumentVersion(f.query,f.doc),false);
  assert.equal(f.reads.length,1);assert.equal(f.d.writes(),before);
 }finally{f.d.close()}
});
test('conflicting stored content fails before mutation and a corrupt readback fails publication',async()=>{
 const f=setup();try{
  f.d.execute('INSERT INTO runtime_document_chunks VALUES(?,?,0,?)',[f.doc.path,f.doc.hash,'corrupt']);const before=f.d.writes();
  await assert.rejects(ensureRuntimeDocumentVersion(f.query,f.doc),/Immutable runtime chunk conflict/);assert.equal(f.d.writes(),before);
  f.d.execute('DELETE FROM runtime_document_chunks WHERE path=? AND content_hash=?',[f.doc.path,f.doc.hash]);
  let reads=0;await assert.rejects(ensureRuntimeDocumentVersion(async(sql,params)=>{const rows=await f.query(sql,params);if(sql.startsWith('SELECT')&&++reads===2)return [];return rows},f.doc),/chunks_missing/);
 }finally{f.d.close()}
});
