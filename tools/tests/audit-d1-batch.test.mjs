import test from 'node:test';import assert from 'node:assert/strict';
import {auditD1Batch} from '../lib/audit-d1-batch.mjs';
const config={account:'account',token:'private',databaseId:'cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda'};
test('four bound SELECTs use one REST call and preserve separate ordered results and costs',async()=>{let calls=0,metrics=[];const c=auditD1Batch({...config,onMetrics:r=>metrics.push(...r),fetcher:async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.batch.length,4);assert.deepEqual(body.batch.map(q=>q.params[0]),[1,2,3,4]);return Response.json({success:true,result:body.batch.map(q=>({success:true,results:[{id:q.params[0]}],meta:{rows_read:1,rows_written:0}}))});}});assert.deepEqual(await c.batch([1,2,3,4].map(id=>({sql:'SELECT id FROM t WHERE id=?',params:[id]}))),[1,2,3,4].map(id=>[{id}]));assert.equal(calls,1);assert.equal(metrics.length,4);assert.deepEqual(c.metrics,{requests:1,queries:4});});
test('a write in any member, oversize body or invalid count stops the complete batch before network',async()=>{let calls=0;const c=auditD1Batch({...config,fetcher:async()=>{calls++;}});await assert.rejects(c.batch([{sql:'SELECT 1'},{sql:'DELETE FROM t'}]));await assert.rejects(c.batch([]));await assert.rejects(c.batch(Array.from({length:5},()=>({sql:'SELECT 1'}))));await assert.rejects(c.batch([{sql:'SELECT ?',params:['x'.repeat(70000)]}]));assert.equal(calls,0);});
test('7500 and 7429 never split or automatically retry the failed batch',async()=>{for(const code of [7500,7429]){let calls=0;const c=auditD1Batch({...config,fetcher:async()=>{calls++;return Response.json({success:false,errors:[{code}]},{status:500});}});await assert.rejects(c.batch([{sql:'SELECT 1'}]),new RegExp('codes_'+code));assert.equal(calls,1);}});
test('partial, failed or malformed results never certify a successful subset',async()=>{for(const result of [[],[{success:false,results:[]}],[{success:true}],[{success:true,results:[],meta:{rows_written:1}}]]){const c=auditD1Batch({...config,fetcher:async()=>Response.json({success:true,result})});await assert.rejects(c.batch([{sql:'SELECT 1'}]));}});

test('splits by serialized UTF-8 size and preserves query order',async()=>{
 const bodies=[];
 const client=auditD1Batch({...config,fetcher:async(_url,{body})=>{
  assert.ok(Buffer.byteLength(body)<=65536);
  const {batch}=JSON.parse(body);
  bodies.push(batch.map(q=>q.params[0]));
  return Response.json({success:true,result:batch.map(q=>({success:true,results:[{id:q.params[0]}]}))});
 }});
 const queries=[1,2,3,4].map(id=>({sql:'SELECT ?, ?',params:[id,'è'.repeat(14000)]}));
 assert.deepEqual(await client.batch(queries),[1,2,3,4].map(id=>[{id}]));
 assert.deepEqual(bodies,[[1,2],[3,4]]);
 assert.deepEqual(client.metrics,{requests:2,queries:4});
 await assert.rejects(client.batch([queries[0],{sql:'SELECT ?',params:['è'.repeat(40000)]}]),/audit_batch_too_large/);
 assert.equal(bodies.length,2);
});
