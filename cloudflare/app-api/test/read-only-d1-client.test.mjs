import test from 'node:test';import assert from 'node:assert/strict';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
test('D1_TEST_READ_ONLY_TRANSPORT: SELECT and WITH reads reach the transport without exposing run/batch writes',async()=>{
 const calls=[],client=createReadOnlyD1Client(async(sql,params)=>{calls.push([sql,params]);return[{n:1}]});
 assert.equal((await client.db.prepare('WITH x AS (SELECT 1 AS n) SELECT n FROM x').first()).n,1);
 assert.equal((await client.db.prepare('SELECT ? AS n').bind(1).all()).results[0].n,1);
 assert.equal(calls.length,2);assert.equal(client.db.batch,undefined);assert.equal(client.db.prepare('SELECT 1').run,undefined);
});
test('D1_TEST_MUTATIONS_REJECTED: mutation statements fail before any outbound request',async()=>{
 let calls=0;const client=createReadOnlyD1Client(async()=>{calls++;return[]});
 for(const sql of ['UPDATE t SET x=1','INSERT INTO t VALUES(1)','DELETE FROM t','WITH x AS (SELECT 1) DELETE FROM t','SELECT 1; UPDATE t SET x=2','PRAGMA user_version=1'])await assert.rejects(client.query(sql),/read_only_guard/);
 assert.equal(calls,0);
});
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
async function remoteTest(fn){const before={account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN};process.env.CLOUDFLARE_ACCOUNT_ID='account';process.env.CLOUDFLARE_API_TOKEN='secret-never-log';try{await fn();}finally{for(const[key,value]of [['CLOUDFLARE_ACCOUNT_ID',before.account],['CLOUDFLARE_API_TOKEN',before.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;}}
const ok=value=>new Response(JSON.stringify({success:true,result:value}),{status:200});
test('failed HTTP requests are made once, including temporary errors, without exposing body or credentials',async()=>remoteTest(async()=>{
 for(const status of [400,403,408,429,500,503]){let calls=0;
  await assert.rejects(openReadOnlyD1({fetcher:async()=>{calls++;return new Response(JSON.stringify({success:false,errors:[{code:7500,message:'private SQL secret-never-log'}]}),{status});}}),error=>{assert.match(error.message,new RegExp('http_'+status+':codes_7500'));assert.doesNotMatch(error.message,/private|secret-never-log/);return true;});
  assert.equal(calls,1);
 }
}));
test('network timeout fails once without retries',async()=>remoteTest(async()=>{let calls=0;await assert.rejects(openReadOnlyD1({fetcher:async()=>{calls++;throw new DOMException('private timeout','TimeoutError');}}),/diagnostic_d1_network_failed/);assert.equal(calls,1);}));
test('successful read-only queries still work and mutation attempts never reach transport',async()=>remoteTest(async()=>{let calls=0;const c=await openReadOnlyD1({fetcher:async(url,options)=>{calls++;return !options.body?ok([{name:'courtwatch-app',uuid:'db'}]):ok([{success:true,results:[{n:1}]}]);}});assert.equal((await c.query('SELECT 1 AS n'))[0].n,1);assert.equal(calls,2);await assert.rejects(c.query('DELETE FROM players'));assert.equal(calls,2);}));
test('malformed HTTP error bodies remain sanitized without retries',async()=>remoteTest(async()=>{let calls=0;await assert.rejects(openReadOnlyD1({fetcher:async()=>{calls++;return new Response('private upstream body',{status:502});}}),/http_502:codes_none/);assert.equal(calls,1);}));
