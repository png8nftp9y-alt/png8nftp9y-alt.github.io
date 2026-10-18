import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';
import {database} from '../../cloudflare/app-api/test/search-sqlite-fixture.mjs';
import {TARGETS,repairDocuments,savedSources} from '../../src/v3/repair-itf-cached-qualification-documents.mjs';
import {documentRecord,documentSQL,digest} from '../../src/v3/itf-draw-document-d1.mjs';
const raw=t=>({...t,status:'complete',generatedAt:'2026-10-16T16:00:00Z',players:[{name:'Player'}],matches:[{teams:[{players:[{name:'Player'}]}]}]});
const sources=()=>new Map(TARGETS.map(t=>[t.drawKey,documentRecord(raw(t))]));
async function setup(fn){const d=database();try{await fn(d,{query:async(sql,params)=>d.execute(sql,params),write:async sql=>d.execute(sql),sources:sources()});}finally{d.close();}}
test('D1_TEST_INITIAL_IMPORT: exactly four raw documents verified, no matches/results inserted',()=>setup(async(d,ctx)=>{
 const report=await repairDocuments(ctx);assert.equal(report.status,'all_four_documents_verified');assert.equal(report.insertedDocuments,4);assert.equal(d.execute('SELECT COUNT(*) AS n FROM itf_current_draw_documents')[0].n,4);
 for(const table of ['matches','results'])assert.equal(d.execute('SELECT COUNT(*) AS n FROM '+table)[0].n,0);
}));
test('D1_TEST_IDENTICAL_ZERO_WRITES: valid current documents need neither R2 sources nor writes',()=>setup(async(d,ctx)=>{
 await repairDocuments(ctx);const before=d.writes();const report=await repairDocuments({...ctx,sources:new Map()});assert.equal(report.insertedDocuments,0);assert.equal(d.writes(),before);
}));
test('D1_TEST_REAL_DELTAS_ONLY: existing newer document is preserved and only three missing are restored',()=>setup(async(d,ctx)=>{
 const newer=documentRecord({...raw(TARGETS[0]),generatedAt:'2026-10-18T20:00:00Z'});for(const sql of documentSQL(newer))d.execute(sql);
 const report=await repairDocuments(ctx);assert.equal(report.insertedDocuments,3);assert.equal(d.execute('SELECT content_sha256 FROM itf_current_draw_documents WHERE draw_key=?',[newer.drawKey])[0].content_sha256,newer.sha256);
}));
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing sources and conflicting chunks fail explicitly without overwriting',()=>setup(async(d,ctx)=>{
 await assert.rejects(repairDocuments({...ctx,sources:new Map()}),/No complete saved R2 source/);assert.equal(d.writes(),0);
 const r=ctx.sources.get(TARGETS[0].drawKey);d.execute('INSERT INTO itf_draw_document_chunks VALUES(?,?,?,?)',[r.drawKey,r.sha256,0,'bad']);const before=d.writes();await assert.rejects(repairDocuments(ctx),/Conflicting immutable/);assert.equal(d.writes(),before);
}));
test('R2 compressed hashes are mandatory; pending data cannot become complete',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-four-'));
 try{const bytes=gzipSync(JSON.stringify(raw(TARGETS[0])));await fs.writeFile(path.join(root,digest(bytes)+'.json.gz'),bytes);assert.equal((await savedSources(root)).size,1);
  const pending=gzipSync(JSON.stringify({...raw(TARGETS[1]),status:'retry',error:'http_500'}));await fs.writeFile(path.join(root,digest(pending)+'.json.gz'),pending);assert.equal((await savedSources(root)).size,1);
  await fs.writeFile(path.join(root,'bad.json.gz'),bytes);await assert.rejects(savedSources(root),/filename hash mismatch/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
