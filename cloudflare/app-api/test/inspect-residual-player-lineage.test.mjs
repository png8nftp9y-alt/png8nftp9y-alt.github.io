import test from 'node:test';import assert from 'node:assert/strict';
import {assertReadOnlyQuery} from '../lib/read-only-d1-query.mjs';
test('D1_TEST_INITIAL_IMPORT: diagnostics accept only read queries, including SQL keywords inside quoted values',()=>{
 assert.equal(assertReadOnlyQuery("SELECT payload FROM observed_players WHERE source_key='DELETE FROM;UPDATE person'"),"SELECT payload FROM observed_players WHERE source_key='DELETE FROM;UPDATE person'");
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated diagnostics remain read-only',()=>{
 for(let i=0;i<2;i++)assert.equal(assertReadOnlyQuery('SELECT 1'),'SELECT 1');
});
test('D1_TEST_REAL_DELTAS_ONLY: diagnostics cannot apply even one actual row mutation',()=>{
 for(const sql of ['INSERT INTO x VALUES(1)','UPDATE x SET y=1','DELETE FROM x','SELECT 1; DELETE FROM x','PRAGMA user_version=1','WITH x AS (SELECT 1) DELETE FROM t'])assert.throws(()=>assertReadOnlyQuery(sql),/read_only_guard/);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: absent queries and multi-statement input cannot become writes',()=>{
 for(const sql of ['',null,undefined,'SELECT 1; /* comment */ UPDATE x SET y=1'])assert.throws(()=>assertReadOnlyQuery(sql),/read_only_guard/);
});
