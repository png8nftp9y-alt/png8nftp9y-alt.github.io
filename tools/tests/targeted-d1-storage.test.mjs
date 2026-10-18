import test from 'node:test';import assert from 'node:assert/strict';
import {compareCatalogue,verifyFour,TARGETS,sourceDocuments} from '../verify-d1-targeted-storage.mjs';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';
import {documentRecord} from '../../src/v3/itf-draw-document-d1.mjs';
import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
test('catalogue proof detects missing identities even with equal counts',()=>{
 const result=compareCatalogue({tournaments:{a:{competitionId:'a'},b:{competitionId:'B'}}},[{competitionId:'A'},{competitionId:'c'}]);
 assert.deepEqual(result,{expected:2,present:1,missing:['B']});assert.throws(()=>compareCatalogue({tournaments:[]},[]));
});
const sources=()=>new Map(TARGETS.map(id=>{const [competitionId,event]=id.split('|');return[id,documentRecord({competitionId,event,status:'complete',generatedAt:'2026-10-16T16:59:16Z',players:[{name:'Saved'}],matches:[{teams:[{players:[{name:'Saved'}]}]}]})]}));
test('original artifact scope requires all four exact draws, never unrelated green acquisitions',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'four-draw-proof-'));
 try{const records=[...sources().values()];for(let i=0;i<records.length;i++)await fs.writeFile(path.join(dir,i+'.json.gz'),gzipSync(records[i].chunks.join('')));
  assert.deepEqual([...(await sourceDocuments(dir)).keys()],TARGETS);
  await fs.rm(path.join(dir,'0.json.gz'));await assert.rejects(sourceDocuments(dir),/missing_original_artifact/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('all four exact documents require matching hashes and complete content, without mutations',async()=>{
 const records=sources(),{query}=createReadOnlyD1Client(async(sql,params)=>{const r=records.get(params[0]);assert.ok(r);if(sql.includes('itf_draw_document_chunks'))return r.chunks.map((content,chunk_index)=>({content,chunk_index}));return[{chunk_count:r.chunkCount,content_bytes:r.bytes,player_count:r.playerCount,match_count:r.matchCount}];});
 assert.ok((await verifyFour(query,records)).every(x=>x.status==='verified_exact_original'));
});
test('missing, alternative-version and corrupt documents are never certified',async()=>{
 const records=sources(),result=await verifyFour(async(sql,params)=>{
  if(params[0]===TARGETS[0])return [];
  if(params[0]===TARGETS[1])return sql.includes('current_draw')?[{content_sha256:'different'}]:[];
  const r=records.get(params[0]);return sql.includes('chunks')?[{chunk_index:0,content:'corrupt'}]:[{chunk_count:r.chunkCount,content_bytes:r.bytes,player_count:r.playerCount,match_count:r.matchCount}];
 },records);assert.deepEqual(result.map(r=>r.status),['missing','other_version_present','corrupt','corrupt']);
});
