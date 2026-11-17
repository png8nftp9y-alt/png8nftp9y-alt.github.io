import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';import {spawnSync} from 'node:child_process';
import {documentRecord} from '../../../src/v3/itf-draw-document-d1.mjs';
import {existingDocumentManifest,storedDocumentMatches} from '../lib/itf-existing-document-manifest.mjs';
const person={id:'800852239',name:'Lola Bourdenet'};
const doc={competitionId:'J-J30-FRA-2026-003',event:'G-S-Q-KO',status:'complete',generatedAt:'2026-11-01T00:00:00Z',players:[person],matches:[{matchId:'one',teams:[{players:[person]},{players:[{id:'800792690',name:'Martina Danesi'}]}]}]};
test('D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES: presence builder emits missing documents and reuses identical versions without document writes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-presence-test-'));try{
  fs.mkdirSync(path.join(root,'draws'));fs.writeFileSync(path.join(root,'draws','draw.json.gz'),gzipSync(JSON.stringify(doc)));
  const row=documentRecord(doc),stored={table:'itf_draw_documents',draw_key:row.drawKey,content_sha256:row.sha256,competition_id:row.competitionId,event:row.event,content_bytes:row.bytes,chunk_count:row.chunkCount,player_count:row.playerCount,match_count:row.matchCount};
  const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify({documents:[stored]}));
  const script=new URL('../../../src/v3/build-itf-draw-d1-seed.mjs',import.meta.url).pathname;
  for(const reuse of [true,false]){
   const result=spawnSync(process.execPath,[script,path.join(root,'draws')],{cwd:root,env:{...process.env,ITF_D1_PRESENCE_ONLY:'1',ITF_D1_EXISTING_DOCUMENTS:reuse?manifest:'',ITF_D1_REQUIRED_ARCHIVE_ROOT:''},encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   const sql=fs.readdirSync(path.join(root,'seed-itf-draws')).map(f=>fs.readFileSync(path.join(root,'seed-itf-draws',f),'utf8')).join('\n');
   assert.match(sql,/INSERT INTO itf_draw_participations/);assert.match(sql,/800852239/);assert.match(sql,/800792690/);
   assert.doesNotMatch(sql,/INSERT INTO (matches|results|match_participants)\b/);
   assert.equal(sql.includes('INSERT INTO itf_draw_document_chunks'),!reuse);
   const audit=JSON.parse(fs.readFileSync(path.join(root,'dist/v3/audits/itf-draw-d1-sync.json')));
   assert.equal(audit.presence.confirmedRelations,2);assert.equal(audit.reusedDocuments,reuse?1:0);assert.equal(audit.presenceOnly,true);
  }
  assert.equal(storedDocumentMatches(row,{...stored,content_bytes:row.bytes+1}),false);
  assert.equal(storedDocumentMatches(row,{...stored,table:'itf_draw_unverified_documents'}),false);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: document manifest follows bounded keyset pages and rejects a repeated or failed page',async()=>{
 const rows=Array.from({length:500},(_,i)=>({draw_key:String(i).padStart(4,'0'),content_sha256:'hash'})),queries=[];
 const manifest=await existingDocumentManifest(async sql=>{queries.push(sql);return queries.length===1?rows:[]});
 assert.equal(manifest.documents.length,500);assert.equal(queries.length,3);assert.ok(queries.every(q=>/LIMIT 500/.test(q)&&!/^\s*(INSERT|UPDATE|DELETE)/.test(q)));
 await assert.rejects(existingDocumentManifest(async()=>rows),/Unordered/);
 await assert.rejects(existingDocumentManifest(async()=>{throw Error('read failed')}),/read failed/);
});
test('D1_TEST_REAL_DELTAS_ONLY: changed hashes, sizes, event, tournament or acquisition state cannot reuse stored document evidence',()=>{
 const row=documentRecord(doc),stored={table:'itf_draw_documents',draw_key:row.drawKey,content_sha256:row.sha256,competition_id:row.competitionId,event:row.event,content_bytes:row.bytes,chunk_count:row.chunkCount,player_count:row.playerCount,match_count:row.matchCount};
 assert.equal(storedDocumentMatches(row,stored),true);
 for(const change of [{content_sha256:'different'},{content_bytes:row.bytes+1},{chunk_count:row.chunkCount+1},{player_count:row.playerCount+1},{match_count:row.matchCount+1},{competition_id:'OTHER'},{event:'OTHER'},{table:'itf_draw_unverified_documents'}])assert.equal(storedDocumentMatches(row,{...stored,...change}),false);
 assert.equal(storedDocumentMatches(row,null),false);
});
