import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {statements,validateFile,importSeeds} from '../scripts/import-tennis-europe-query.mjs';
test('SQL scanner preserves payload semicolons, escaped quotes and comments',()=>{
 const sql="PRAGMA foreign_keys=ON;\nINSERT INTO x VALUES('O''Brien; final',\"semi;colon\");\n-- ignored ;\nDELETE FROM x;\n";
 assert.equal(statements(sql).length,3);
 assert.equal(validateFile(sql,'fixture'),3);
 assert.throws(()=>statements("INSERT INTO x VALUES('unterminated);"),/INCOMPLETE/);
 assert.throws(()=>validateFile("SELECT '"+'x'.repeat(100000)+"';",'huge'),/STATEMENT_TOO_LARGE/);
});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'te-query-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const directory=path.join(root,'seeds');await fs.mkdir(directory);
 const config=path.join(root,'config.json');await fs.writeFile(config,JSON.stringify({d1_databases:[{database_name:'courtwatch-app',database_id:'cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda'}]}));
 return {directory,config,env:{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-only'},log:()=>{},wait:async()=>{}};
}
const ok=()=>({ok:true,status:200,json:async()=>({success:true,result:[{success:true,meta:{rows_read:4,rows_written:2}}]})});
test('one request per whole file; order and child cleanup remain intact',async t=>{
 const f=await fixture(t),calls=[];
 const shard="DELETE FROM changed;\nINSERT INTO changed VALUES('match');\nDELETE FROM children;\nINSERT INTO matches VALUES('match');\nINSERT INTO children VALUES('match');\n";
 await fs.writeFile(path.join(f.directory,'03-shard.sql'),shard);await fs.writeFile(path.join(f.directory,'00-reset.sql'),'PRAGMA foreign_keys=ON;\n');
 const result=await importSeeds({...f,request:async(url,init)=>{assert.ok(url.endsWith('/query'));calls.push(JSON.parse(init.body).sql);return ok();}});
 assert.deepEqual(calls,['PRAGMA foreign_keys=ON;\n',shard]);assert.deepEqual(result,{files:2,statements:6,rowsRead:8,rowsWritten:4});
});
test('oversized later file stops the complete plan before any remote reset',async t=>{
 const f=await fixture(t);let calls=0;
 await fs.writeFile(path.join(f.directory,'00-reset.sql'),'DELETE FROM matches;');
 await fs.writeFile(path.join(f.directory,'03-shard.sql'),"SELECT '"+'x'.repeat(100000)+"';");
 await assert.rejects(importSeeds({...f,request:async()=>{calls++;return ok();}}),/STATEMENT_TOO_LARGE/);assert.equal(calls,0);
});
test('provider failure stops without retry or subsequent files',async t=>{
 const f=await fixture(t);let calls=0;
 for(const name of ['00-reset.sql','03-shard.sql'])await fs.writeFile(path.join(f.directory,name),'SELECT 1;');
 await assert.rejects(importSeeds({...f,request:async()=>{calls++;return {ok:false,status:503,json:async()=>({success:false,errors:[{code:7009}]})};}}),/7009/);assert.equal(calls,1);
});
test('HTTP 200 with failed statement is never accepted',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.directory,'00-reset.sql'),'SELECT 1;');
 await assert.rejects(importSeeds({...f,request:async()=>({ok:true,status:200,json:async()=>({success:true,result:[{success:false}]})})}),/TE_QUERY_FAILED/);
});
test('transport timeout is not automatically replayed',async t=>{
 const f=await fixture(t);let calls=0;await fs.writeFile(path.join(f.directory,'00-reset.sql'),'SELECT 1;');
 await assert.rejects(importSeeds({...f,request:async()=>{calls++;throw Error('timeout');}}),/timeout/);assert.equal(calls,1);
});

test('CPU rejection is distinguished from request rate limiting and never retried',async t=>{
 const f=await fixture(t);let calls=0;
 await fs.writeFile(path.join(f.directory,'03-shard.sql'),'SELECT 1;');
 await assert.rejects(importSeeds({...f,request:async()=>{calls++;return {ok:false,status:429,json:async()=>({success:false,errors:[{code:7429,message:'D1 DB exceeded its CPU time limit and was reset.'}]})};}}),/codes=7429 reason=cpu_limit/);
 assert.equal(calls,1);
});

test('new requests are paced after acknowledgement; no overlapping request or replay',async t=>{
 const f=await fixture(t),timeline=[];
 for(const name of ['00.sql','01.sql','02.sql'])await fs.writeFile(path.join(f.directory,name),'SELECT 1;');
 await importSeeds({...f,wait:async ms=>timeline.push(['wait',ms]),request:async()=>{timeline.push(['request']);return {ok:true,status:200,json:async()=>({success:true,result:[{success:true,meta:{rows_read:1,rows_written:0,duration:900}}]})};}});
 assert.deepEqual(timeline,[['request'],['wait',1800],['request'],['wait',1800],['request']]);
 const report=JSON.parse(await fs.readFile(path.join(f.directory,'import-report.json'),'utf8'));assert.equal(report.status,'imported_not_parity_verified');assert.equal(report.confirmed.length,3);
});
test('7429 overload stops once and preserves only confirmed costs plus the safe rejection category',async t=>{
 const f=await fixture(t);for(const name of ['00.sql','01.sql','02.sql'])await fs.writeFile(path.join(f.directory,name),'SELECT 1;');let calls=0;
 await assert.rejects(importSeeds({...f,request:async()=>{calls++;return calls===1?ok():{ok:false,status:429,json:async()=>({success:false,errors:[{code:7429,message:'D1 DB is overloaded. Requests queued for too long. secret SQL SELECT private'}]})};}}),/queue=queued_too_long/);
 assert.equal(calls,2);const text=await fs.readFile(path.join(f.directory,'import-report.json'),'utf8'),r=JSON.parse(text);
 assert.equal(r.status,'incomplete');assert.equal(r.confirmed.length,1);assert.equal(r.totals.rowsWritten,2);assert.equal(r.failed.file,'01.sql');assert.equal(r.failed.outcome,'unconfirmed');assert.equal(r.failed.queueCause,'queued_too_long');assert.doesNotMatch(text,/secret SQL|SELECT private|test-only/);
});
test('file mutation during pacing prevents that request',async t=>{
 const f=await fixture(t);for(const name of ['00.sql','01.sql'])await fs.writeFile(path.join(f.directory,name),'SELECT 1;');let calls=0;
 await assert.rejects(importSeeds({...f,wait:async()=>fs.writeFile(path.join(f.directory,'01.sql'),'SELECT 2;'),request:async()=>{calls++;return ok();}}),/FILE_CHANGED/);assert.equal(calls,1);
});
test('minimum breathing interval and bounded slow-batch interval do not add a retry',async t=>{
 for(const [duration,expected] of [[0,1000],[10000,5000]]){
  const f=await fixture(t);for(const name of ['00.sql','01.sql'])await fs.writeFile(path.join(f.directory,name),'SELECT 1;');const gaps=[];
  await importSeeds({...f,wait:async ms=>gaps.push(ms),request:async()=>({ok:true,status:200,json:async()=>({success:true,result:[{success:true,meta:{rows_read:0,rows_written:0,duration}}]})})});assert.deepEqual(gaps,[expected]);
 }
});
