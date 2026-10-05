import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {documentRecord,documentSQL,verifyDocument} from './itf-draw-document-d1.mjs';
const doc={competitionId:'J-J30-MAD-2026-002',event:'B-S-M-KO',status:'complete',generatedAt:'2026-10-04T20:00:00Z',players:[{name:"O'Connor 🎾"}],matches:[{matchId:1,teams:[{players:[{name:"O'Connor 🎾"}]}]}]};
function remote(row){return{chunk_count:row.chunkCount,content_bytes:row.bytes,player_count:row.playerCount,match_count:row.matchCount}}
test('only confirmed empty Hanko qualification is resolved; technical errors are not',()=>{
 const empty={competitionId:'J-J30-FIN-2026-004',event:'G-S-Q-KO',status:'retry',error:'draw_not_published_or_incomplete',players:[],matches:Array.from({length:24},(_,i)=>({matchId:i,teams:[]}))};
 const row=documentRecord(empty);assert.equal(row.acquisitionState,'resolved_empty_qualification');
 assert.equal(verifyDocument(row,remote(row),row.chunks.map((content,chunk_index)=>({content,chunk_index}))),true);
 assert.ok(documentSQL(row).at(-1).includes('itf_draw_unverified_documents'));
 assert.equal(documentRecord({...empty,error:'HTTP 403'}),null);
 assert.equal(documentRecord({...empty,competitionId:'J-J30-FIN-2026-999'}),null);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'courtwatch-hanko-resolved-'));
 try{
  const draws=path.join(temp,'draws');fs.mkdirSync(draws);fs.writeFileSync(path.join(draws,'empty.json.gz'),gzipSync(JSON.stringify(empty)));
  const run=spawnSync(process.execPath,[path.resolve('src/v3/build-itf-draw-d1-seed.mjs'),draws],{cwd:temp,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const audit=JSON.parse(fs.readFileSync(path.join(temp,'dist/v3/audits/itf-draw-d1-sync.json'),'utf8'));
  assert.deepEqual(audit.resolvedEmptyQualifications,[row.drawKey]);assert.deepEqual(audit.pendingTasks,[]);assert.deepEqual(audit.archivedUnverified,[]);assert.equal(audit.matches,0);assert.equal(audit.completeDocuments,0);assert.equal(audit.storedDocuments,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('full Unicode content survives chunking and exact hash verification',()=>{const row=documentRecord({...doc,raw:'🎾é'.repeat(50000)});assert.ok(row.chunkCount>1);assert.equal(verifyDocument(row,remote(row),row.chunks.map((content,chunk_index)=>({content,chunk_index}))),true);assert.ok(documentSQL(row).every(x=>Buffer.byteLength(x)<99000))});
test('empty, retry and incomplete RR are not certified',()=>{assert.equal(documentRecord({...doc,players:[],matches:[]}),null);assert.equal(documentRecord({...doc,status:'retry'}),null);assert.equal(documentRecord({...doc,event:'B-S-M-RR'}),null);assert.ok(documentRecord({...doc,event:'B-S-M-RR',roundRobin:{declaredGroups:2,completeGroups:2,missingGroups:[]}}))});
test('missing or corrupted remote content fails',()=>{const row=documentRecord(doc);assert.throws(()=>verifyDocument(row,undefined,[]));assert.throws(()=>verifyDocument(row,remote(row),[]));assert.throws(()=>verifyDocument(row,remote(row),[{chunk_index:0,content:'{}'}]))});
test('D1 SQLite replay writes zero; old recovery cannot replace newest document',()=>{
 const old=documentRecord({...doc,generatedAt:'2026-10-01T00:00:00Z'}),current=documentRecord(doc);
 const python=`import json,sqlite3,sys\np=json.load(sys.stdin)\nc=sqlite3.connect(':memory:')\nc.executescript(p['schema'])\nc.executescript(p['current'])\nn=c.total_changes\nc.executescript(p['current'])\nassert c.total_changes==n\nc.executescript(p['old'])\nassert c.execute('select content_sha256 from itf_current_draw_documents').fetchone()[0]==p['sha']\nassert c.execute('select count(*) from itf_draw_documents').fetchone()[0]==2\nprint('sqlite replay/current-view OK')\n`;
 const result=spawnSync('python3',['-c',python],{encoding:'utf8',input:JSON.stringify({schema:fs.readFileSync('cloudflare/app-api/migrations/0025_itf_draw_documents.sql','utf8'),current:documentSQL(current).join('\n'),old:documentSQL(old).join('\n'),sha:current.sha256})});assert.equal(result.status,0,result.stderr);
});
test('builder chooses newest complete document, ignores later retries, and SQL imports idempotently',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'courtwatch-itf-d1-test-'));
 try{
  const draws=path.join(temp,'draws');fs.mkdirSync(draws);
  for(const [name,value] of [['old',{...doc,generatedAt:'2026-10-01T00:00:00Z'}],['new',doc],['retry',{...doc,generatedAt:'2026-10-05T00:00:00Z',status:'retry',matches:[]}]])fs.writeFileSync(path.join(draws,name+'.json.gz'),gzipSync(JSON.stringify(value)));
  const run=spawnSync(process.execPath,[path.resolve('src/v3/build-itf-draw-d1-seed.mjs'),draws],{cwd:temp,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const audit=JSON.parse(fs.readFileSync(path.join(temp,'dist/v3/audits/itf-draw-d1-sync.json'),'utf8'));assert.equal(audit.completeDocuments,1);assert.equal(audit.documents[0].sha256,documentRecord(doc).sha256);
  const directory=path.join(temp,'seed-itf-draws'),sql=fs.readdirSync(directory).sort().map(p=>fs.readFileSync(path.join(directory,p),'utf8')).join('\n');
  const schema=fs.readFileSync('cloudflare/app-api/migrations/0025_itf_draw_documents.sql','utf8')+`\nCREATE TABLE tournaments(id TEXT PRIMARY KEY,circuit TEXT,source_tournament_id TEXT,start_date TEXT,end_date TEXT,payload TEXT);CREATE TABLE matches(id TEXT PRIMARY KEY,tournament_id TEXT,circuit TEXT,played_date TEXT,payload TEXT);CREATE TABLE results(id TEXT PRIMARY KEY,tournament_id TEXT,match_id TEXT,circuit TEXT,played_date TEXT,payload TEXT);`;
  const result=spawnSync('python3',['-c',`import sys,json,sqlite3\np=json.load(sys.stdin)\nc=sqlite3.connect(':memory:')\nc.executescript(p['schema'])\nc.executescript(p['sql'])\nn=c.total_changes\nc.executescript(p['sql'])\nassert c.total_changes==n\nassert c.execute('select count(*) from matches').fetchone()[0]==1\nassert c.execute('select count(*) from itf_draw_documents').fetchone()[0]==1\nprint('builder import/replay OK')`],{encoding:'utf8',input:JSON.stringify({schema,sql})});assert.equal(result.status,0,result.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('empty Finland archived qualification is stored without certifying players or matches',()=>{
 const empty={competitionId:'J-J30-FIN-2026-999',event:'G-S-Q-KO',status:'complete',players:[],matches:[]};
 assert.equal(documentRecord(empty),null);
 const row=documentRecord(empty,{archiveEvidence:true});assert.equal(row.acquisitionState,'archived_unverified');assert.equal(row.matchCount,0);
 assert.equal(verifyDocument(row,remote(row),row.chunks.map((content,chunk_index)=>({content,chunk_index}))),true);
 const schema=fs.readFileSync('cloudflare/app-api/migrations/0025_itf_draw_documents.sql','utf8')+fs.readFileSync('cloudflare/app-api/migrations/0026_itf_unverified_draw_archive.sql','utf8');
 const result=spawnSync('python3',['-c',`import sys,json,sqlite3\np=json.load(sys.stdin)\nc=sqlite3.connect(':memory:')\nc.executescript(p['schema'])\nc.executescript(p['sql'])\nn=c.total_changes\nc.executescript(p['sql'])\nassert c.total_changes==n\nassert c.execute('select count(*) from itf_draw_documents').fetchone()[0]==0\nassert c.execute('select match_count from itf_draw_unverified_documents').fetchone()[0]==0`],{encoding:'utf8',input:JSON.stringify({schema,sql:documentSQL(row).join('\n')})});assert.equal(result.status,0,result.stderr);
});
test('archive builder transfers unknown document instead of blocking valid acquired draws',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'courtwatch-itf-archive-'));
 try{
  const archive=path.join(temp,'archive');fs.mkdirSync(archive);
  const empty={competitionId:'J-J30-FIN-2026-999',event:'G-S-Q-KO',status:'complete',players:[],matches:[]};
  fs.writeFileSync(path.join(archive,'finland.json.gz'),gzipSync(JSON.stringify(empty)));
  fs.writeFileSync(path.join(archive,'complete.json.gz'),gzipSync(JSON.stringify(doc)));
  const run=spawnSync(process.execPath,[path.resolve('src/v3/build-itf-draw-d1-seed.mjs'),archive],{cwd:temp,encoding:'utf8',env:{...process.env,ITF_D1_REQUIRED_ARCHIVE_ROOT:archive}});assert.equal(run.status,0,run.stderr);
  const audit=JSON.parse(fs.readFileSync(path.join(temp,'dist/v3/audits/itf-draw-d1-sync.json'),'utf8'));
  assert.equal(audit.storedDocuments,2);assert.equal(audit.completeDocuments,1);assert.deepEqual(audit.archiveMissing,[]);assert.deepEqual(audit.archivedUnverified,['J-J30-FIN-2026-999|G-S-Q-KO']);assert.equal(audit.matches,1);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
