import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readProjectionRows} from '../../cloudflare/app-api/scripts/read-audit-projection.mjs';
test('bounded projection reads preserve payloads, missing IDs and deduplication without scanning unrelated history',async()=>{
 const ids=Array.from({length:45},(_,i)=>'match-'+i),calls=[];
 const query=async(sql,params)=>{calls.push({sql,params});assert.match(sql,/WHERE id IN/);assert.ok(params.length<=20);return params.filter(id=>id!=='match-7').map(id=>({id,payload:JSON.stringify({id,score:'6-4'})}));};
 const rows=await readProjectionRows(query,'matches',[...ids,ids[0]]);
 assert.equal(calls.length,3);assert.deepEqual(calls.flatMap(c=>c.params),ids);assert.equal(rows.length,44);assert.equal(rows.some(r=>r.id==='match-7'),false);assert.equal(JSON.parse(rows[0].payload).score,'6-4');
});
test('empty scope makes no request and failed batches are not retried',async()=>{
 let calls=0;const query=async()=>{calls++;throw Error('http_500');};
 assert.deepEqual(await readProjectionRows(query,'results',[]),[]);
 await assert.rejects(readProjectionRows(query,'results',['x']),/http_500/);assert.equal(calls,1);
 await assert.rejects(readProjectionRows(query,'matches; DELETE', ['x']),/invalid_audit/);assert.equal(calls,1);
});
