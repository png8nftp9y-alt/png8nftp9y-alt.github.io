import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {boundedDeleteMissing,assertStatementBudget,filterSeedSections,remoteSeedHashes,MAX_SQL_BYTES} from '../../cloudflare/app-api/lib/seed-statement-plan.mjs';
const ids=Array.from({length:7499},(_,i)=>'tournament_'+String(i).padStart(25,'0'));
test('D1_TEST_INITIAL_IMPORT: 7499 retained IDs fit every D1 statement and partition deletions without loss',()=>{
 const sql=boundedDeleteMissing('tournaments',ids.map(id=>({id})),"circuit!='itf' AND id NOT LIKE 'te-oop:%'");assert.ok(sql.length>1);assert.ok(sql.every(s=>Buffer.byteLength(s)<=MAX_SQL_BYTES));
 const r=spawnSync('python3',['-c',`import sqlite3,json,sys
p=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.execute('create table tournaments(id text primary key,circuit text)')
d.executemany('insert into tournaments values(?,?)',[(x,'fitp') for x in p['ids']]+[('!before','fitp'),('tournament_0000000000000000000000000a','fitp'),('zz-after','fitp'),('itf-preserved','itf'),('te-oop:preserved','tennis-europe')])
if hasattr(d,'setlimit'):d.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH,100000)
old="DELETE FROM tournaments WHERE circuit!='itf' AND id NOT IN ("+','.join("'"+x+"'" for x in p['ids'])+');'
assert len(old.encode())>100000
if hasattr(d,'setlimit'):
 try:d.execute(old);raise AssertionError('oversized statement accepted')
 except sqlite3.DataError:pass
for s in p['sql']:d.execute(s)
actual={r[0] for r in d.execute('select id from tournaments')};assert actual==set(p['ids'])|{'itf-preserved','te-oop:preserved'}
print(len(actual))`],{input:JSON.stringify({ids,sql}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(Number(r.stdout),7501);
});
test('D1_TEST_IDENTICAL_ZERO_WRITES / D1_TEST_REAL_DELTAS_ONLY: completed hashes remove unchanged table reads and retain only changed sections',()=>{
 const sql=['DELETE FROM tournaments WHERE 1=1;','INSERT INTO tournaments VALUES(1);','DELETE FROM entries WHERE 1=1;','INSERT INTO entries VALUES(1);',"INSERT OR REPLACE INTO generations VALUES('current');"];
 assert.deepEqual(filterSeedSections(sql,{tournaments:'a',entries:'b'},{tournaments:'a',entries:'b'}),[sql[4]]);
 assert.deepEqual(filterSeedSections(sql,{tournaments:'a',entries:'new'},{tournaments:'a',entries:'b'}),sql.slice(2));
 assert.deepEqual(filterSeedSections(sql,{tournaments:'a',entries:'b'},{}),sql);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: oversize, malformed generation and invalid IDs fail before remote mutation',()=>{
 assert.throws(()=>assertStatementBudget(['x'.repeat(100001)]),/exceeds/);assert.throws(()=>boundedDeleteMissing('tournaments',[{id:''}]),/invalid/);
 assert.throws(()=>remoteSeedHashes({results:[{counts_json:'broken'}]}));assert.deepEqual(remoteSeedHashes({results:[]}),{});assert.deepEqual(remoteSeedHashes({counts_json:'{}'}),{});
 assert.deepEqual(remoteSeedHashes({results:[{counts_json:JSON.stringify({seedPlanVersion:2,seedSectionHashes:{tournaments:'a'}})}]}),{tournaments:'a'});
 assert.throws(()=>remoteSeedHashes([{counts_json:'{}'},{counts_json:'{}'}]),/ambiguous/);
});
test('empty expected set still cleans its full owned scope; quoted/unicode IDs are safe',()=>{
 assert.deepEqual(boundedDeleteMissing('tournaments',[],"circuit='fitp'"),["DELETE FROM tournaments WHERE circuit='fitp';"]);
 assert.doesNotThrow(()=>assertStatementBudget(boundedDeleteMissing('tournaments',[{id:"x'🎾"},{id:'é'}])));
});
