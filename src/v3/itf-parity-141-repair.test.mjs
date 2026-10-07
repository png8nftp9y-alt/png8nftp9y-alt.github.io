import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {repairTargets,exactSources,classifyExisting,assertNoConflict} from './repair-itf-parity-141.mjs';
import {documentRecord,documentSQL,verifyDocument} from './itf-draw-document-d1.mjs';

const doc={competitionId:'J-J100-ALG-2026-001',event:'B-S-Q-KO',status:'complete',generatedAt:'2026-10-01T00:00:00Z',players:[{name:'Łuca 🎾'}],matches:[{teams:[{players:[{name:'Łuca 🎾'}]}]}]};
const record=documentRecord(doc);
test('exact R2 hash is required; later versions cannot silently replace frozen source',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-repair-'));
 try{
  await fs.writeFile(path.join(root,'newer.json.gz'),gzipSync(JSON.stringify({...doc,generatedAt:'2026-10-08T00:00:00Z'})));
  assert.equal((await exactSources([record],[root])).size,0);
  await fs.writeFile(path.join(root,'original.json.gz'),gzipSync(JSON.stringify(doc)));
  const got=(await exactSources([record],[root])).get(record.drawKey);assert.equal(got.sha256,record.sha256);assert.deepEqual(got.chunks,record.chunks);
  await assert.rejects(()=>exactSources([{...record,bytes:1}],[root]),/metadata differs/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('diagnosis distinguishes no document, another version and saved unverified version',()=>{
 assert.equal(classifyExisting(record,[]),'draw_document_absent');
 assert.equal(classifyExisting(record,[{content_sha256:'b'.repeat(64)}]),'other_version_present');
 assert.equal(classifyExisting(record,[{content_sha256:record.sha256,acquisition_state:'saved_non_complete'}]),'exact_saved_non_complete');
 assert.equal(classifyExisting(record,[{content_sha256:record.sha256,acquisition_state:'complete'}]),'exact_complete_present');
});
test('partial identical chunks can resume; conflicting chunks or metadata forbid overwrite',()=>{
 assertNoConflict(record,record,[],[{chunk_index:0,content:record.chunks[0]}]);
 assert.throws(()=>assertNoConflict(record,record,[],[{chunk_index:0,content:'wrong'}]),/no overwrite/);
 assert.throws(()=>assertNoConflict(record,record,[{content_sha256:record.sha256,chunk_count:99}],[]),/no overwrite/);
});
test('real SQLite import is idempotent and preserves newer version and existing content',async()=>{
 const schema=(await fs.readFile('cloudflare/app-api/migrations/0025_itf_draw_documents.sql','utf8'))+(await fs.readFile('cloudflare/app-api/migrations/0026_itf_unverified_draw_archive.sql','utf8'));
 const newer=documentRecord({...doc,generatedAt:'2026-10-08T00:00:00Z',players:[{name:'NEW'}]});
 const payload={schema,newSQL:documentSQL(newer).join('\n'),repairSQL:documentSQL(record).join('\n'),oldSha:record.sha256,newSha:newer.sha256};
 const result=spawnSync('python3',['-c',`import sys,json,sqlite3
p=json.load(sys.stdin);db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.executescript(p['schema']);db.executescript(p['newSQL']);db.executescript(p['repairSQL'])
before=db.total_changes;db.executescript(p['repairSQL']);assert db.total_changes==before
assert db.execute('select content_sha256 from itf_current_draw_documents').fetchone()[0]==p['newSha']
assert db.execute('select count(*) from itf_draw_documents').fetchone()[0]==2
header=dict(db.execute('select * from itf_draw_documents where content_sha256=?',(p['oldSha'],)).fetchone())
chunks=[dict(r) for r in db.execute('select chunk_index,content from itf_draw_document_chunks where content_sha256=? order by chunk_index',(p['oldSha'],))]
print(json.dumps({'header':header,'chunks':chunks}))
`],{input:JSON.stringify(payload),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);assert.equal(verifyDocument(record,actual.header,actual.chunks),true);
});
test('repair scope is exactly the 141 failed keys; additional exceptions cannot be waived',()=>{
 const documents=Array.from({length:4892},(_,i)=>({drawKey:'J-J100-ALG-2026-'+String(i).padStart(3,'0')+'|B-S-Q-KO'}));
 const scope={resumedFromRun:37696656152,wanted:documents,userExcludedDraws:['J-J200-TUR-2026-002|G-S-Q-KO','J-J30-ALG-2026-004|G-S-Q-KO'].map(drawKey=>({drawKey}))};
 const failed={status:'failed',expectedDocuments:4892,verifiedDocuments:4751,missingOrCorrupt:documents.slice(0,141).map(d=>({drawKey:d.drawKey,error:'Missing D1 document: '+d.drawKey}))};
 assert.equal(repairTargets(scope,{documents},failed).length,141);
 assert.throws(()=>repairTargets(scope,{documents},{...failed,missingOrCorrupt:failed.missingOrCorrupt.slice(1)}),/Unexpected failed audit/);
 const invalid=structuredClone(failed);invalid.missingOrCorrupt[0].error='hash mismatch';assert.throws(()=>repairTargets(scope,{documents},invalid),/Unexpected failed document/);
});
