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
