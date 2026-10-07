import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {resolvedScope,selectDocuments} from './prepare-itf-resolved-parity.mjs';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {digest,verifyDocument} from './itf-draw-document-d1.mjs';
const id='J-J30-CAN-2026-001',event='B-S-M-KO';
const row={competitionId:id,classification:'complete',events:[{event,family:'B-S-M',structure:'KO'}],checks:[{event,acquired:true}]};
const audit={criterion:AUDIT_CRITERION,tournaments:[row,{competitionId:'J-J30-CAN-2026-002',classification:'cancelled_no_draws'},{competitionId:'J-J30-CAN-2026-003',classification:'missing_draws'}]};
test('resolved scope includes cancellation, separates pending and rejects missing or changed evidence',()=>{
 const s=resolvedScope(audit,2);assert.equal(s.completeTournaments,1);assert.equal(s.cancelledNoDraws,1);assert.equal(s.wanted.length,1);assert.equal(s.excluded.length,1);
 assert.throws(()=>resolvedScope(audit,863),/Scope changed/);
 assert.throws(()=>resolvedScope({...audit,tournaments:[{...row,checks:[]}]},1),/Missing acquisition/);
 assert.throws(()=>resolvedScope({...audit,tournaments:[row,row]},2),/Duplicate/);
});
test('selects newest complete source, preserves original hash, ignores newer empty retry and reports missing R2',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'resolved-parity-'));
 try{
  const doc={competitionId:id,event,status:'complete',generatedAt:'2026-10-07T12:00:00Z',players:[{name:'Łuca 🎾'}],matches:[{matchId:'1',teams:[{players:[{name:'Łuca 🎾'}]}]}]};
  for(const [name,value] of [['old',{...doc,generatedAt:'2026-10-06T12:00:00Z'}],['new',doc],['retry',{...doc,status:'retry',generatedAt:'2026-10-08T00:00:00Z',players:[],matches:[]}]] )await fs.writeFile(path.join(dir,name+'.json.gz'),gzipSync(JSON.stringify(value)));
  const s=resolvedScope(audit,2),selected=await selectDocuments(s,[dir]);assert.equal(selected.missing.length,0);assert.equal(selected.documents[0].sha256,digest(JSON.stringify(doc)));
  const record=selected.documents[0],remote={chunk_count:1,content_bytes:record.bytes,player_count:1,match_count:1};
  assert.equal(verifyDocument(record,remote,[{chunk_index:0,content:JSON.stringify(doc)}]),true);
  assert.throws(()=>verifyDocument(record,remote,[{chunk_index:0,content:JSON.stringify({...doc,players:[]})}]),/mismatch/);
  assert.throws(()=>verifyDocument(record,undefined,[]),/Missing D1/);
  assert.equal((await selectDocuments({...s,wanted:[{drawKey:'absent'}]},[dir])).missing.length,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('live manifests choose one populated complete version, skip newer retries and reject invalid object keys',()=>{
 const result=spawnSync('python3',['-c',`import importlib.util
spec=importlib.util.spec_from_file_location('download','src/v3/download-itf-resolved-live.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
cid='J-J30-CAN-2026-001';event='B-S-M-KO';sha='a'*64
d={'competitionId':cid,'event':event,'status':'complete','players':2,'matches':1,'sha256':sha,'key':f'tournaments/{cid}/{event}/{sha}.json.gz'}
old={'generatedAt':'2026-10-06T12:00:00Z','documents':[d]}
new={'generatedAt':'2026-10-07T12:00:00Z','documents':[{**d,'status':'retry','players':0}]}
s=m.choose([old,new],{cid+'|'+event});assert len(s)==1 and s[cid+'|'+event]==d
try:m.choose([{**old,'documents':[{**d,'key':'../invalid'}]}],{cid+'|'+event})
except ValueError:pass
else:raise AssertionError('invalid key accepted')
`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});

test('final certification fails for incomplete D1 verification and accepts exact scope parity',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'parity-final-'));
 try{
  const folder=path.join(root,'dist/v3/audits');await fs.mkdir(folder,{recursive:true});
  const scope={...resolvedScope(audit,2),missingR2:[]};
  await fs.writeFile(path.join(folder,'itf-resolved-parity-scope.json'),JSON.stringify(scope));
  const file=path.join(folder,'itf-draw-d1-content-verification.json');
  await fs.writeFile(file,JSON.stringify({expectedDocuments:1,verifiedDocuments:0,missingOrCorrupt:[],status:'verified_acquired_documents'}));
  const script=path.resolve('src/v3/prepare-itf-resolved-parity.mjs');
  assert.notEqual(spawnSync('node',[script,'finalize'],{cwd:root}).status,0);
  await fs.writeFile(file,JSON.stringify({expectedDocuments:1,verifiedDocuments:1,missingOrCorrupt:[],status:'verified_acquired_documents'}));
  assert.equal(spawnSync('node',[script,'finalize'],{cwd:root}).status,0);
  const report=JSON.parse(await fs.readFile(path.join(folder,'itf-resolved-parity.json'),'utf8'));
  assert.equal(report.databaseParity,'verified');assert.equal(report.fullPeriodCertified,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
