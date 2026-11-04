import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {historyReadDb} from '../lib/history-read-batch.mjs';
const python=`import sqlite3,json,sys
p=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row
c.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5)
c.execute('CREATE TABLE match_participants(source_player_id,display_name)')
c.executemany('INSERT INTO match_participants VALUES(?,?)',[(i,'Player '+str(i)) for i in range(12)])
try:
 rows=[dict(r) for r in c.execute(p['sql'],p['params'])]
 print(json.dumps({'results':rows,'writes':0}))
except sqlite3.Error as e:print(json.dumps({'error':str(e)}))
`;
const execute=(sql,params)=>{const result=spawnSync('python3',['-c',python],{input:JSON.stringify({sql,params}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout)};
test('real SQLite with workerd compound limit 5 reproduces old six-term failure and preserves all grouped reads',async()=>{
 const sql='SELECT display_name FROM match_participants WHERE source_player_id=?';
 const legacy=Array.from({length:6},(_,i)=>`SELECT ${i} AS __cw_history_slot,h.* FROM (${sql}) h`).join(' UNION ALL ');
 assert.match(execute(legacy,[0,1,2,3,4,5]).error,/too many terms in compound SELECT/);
 const calls=[];
 const db={prepare(sql){const statement=params=>({bind:(...values)=>statement(values),async all(){calls.push({sql,params});const result=execute(sql,params);if(result.error)throw Error(result.error);return result}});return statement([])}};
 assert.throws(()=>historyReadDb(db,{limit:6}),/history_batch_limit/);
 const reader=historyReadDb(db),rows=await Promise.all(Array.from({length:12},(_,i)=>reader.prepare(sql).bind(i).all()));
 assert.deepEqual(rows.map(r=>r.results[0].display_name),Array.from({length:12},(_,i)=>'Player '+i));
 assert.deepEqual(calls.map(c=>c.params.length),[5,5,2]);
 // An original two-term CTE remains legal inside each five-term outer group.
 const nested='WITH ids AS (SELECT match_id FROM (SELECT ? AS match_id) UNION SELECT match_id FROM (SELECT ? AS match_id)) SELECT display_name FROM match_participants WHERE source_player_id IN (SELECT match_id FROM ids)';
 const result=await Promise.all(Array.from({length:6},(_,i)=>reader.prepare(nested).bind(i,i).all()));
 assert.deepEqual(result.map(r=>r.results[0].display_name),Array.from({length:6},(_,i)=>'Player '+i));
});
