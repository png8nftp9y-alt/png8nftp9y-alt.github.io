import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {opponentEntryPageQuery} from '../lib/opponent-entry-page.mjs';
test('D1_TEST_READ_BUDGET: keyset pages return the same 120000 profiles with indexed seeks and far less work',()=>{
 const count=120000,size=5000,queries=[];
 for(let offset=0;offset<count;offset+=size)queries.push(opponentEntryPageQuery(offset?{circuit:'fitp',source_player_id:String(offset-1).padStart(8,'0')}:null,size));
 const py=`import sqlite3,json,sys\nqueries=json.load(sys.stdin);db=sqlite3.connect(':memory:');db.execute('CREATE TABLE opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,display_name TEXT,payload TEXT,PRIMARY KEY(circuit,source_player_id))');db.executemany('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?)',[('fitp',str(i).zfill(8),'person','Person','{}') for i in range(120000)]);steps=[0]\ndef tick():\n steps[0]+=1\n return 0\ndb.set_progress_handler(tick,100);new=[]\nfor q in queries:new.extend(db.execute(q).fetchall())\nseek=steps[0];steps[0]=0;old=[]\nfor offset in range(0,120000,5000):old.extend(db.execute('SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles ORDER BY circuit,source_player_id LIMIT 5000 OFFSET '+str(offset)).fetchall())\nassert old==new\nprint(json.dumps({'rows':len(new),'seekSteps':seek*100,'offsetSteps':steps[0]*100,'plan':[r[3] for r in db.execute('EXPLAIN QUERY PLAN '+queries[1])]}))`;
 const r=spawnSync('python3',['-c',py],{input:JSON.stringify(queries),encoding:'utf8'});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
 assert.equal(result.rows,count);assert.match(result.plan.join(' '),/SEARCH.*INDEX/);assert.ok(result.seekSteps<result.offsetSteps*.4,JSON.stringify(result));
 console.log('OPPONENT_PAGE_BENCHMARK='+JSON.stringify(result));
});
test('cursor literals are escaped and invalid page sizes rejected',()=>{
 assert.ok(opponentEntryPageQuery({circuit:"f'itp",source_player_id:"id'1"}).includes("('f''itp','id''1')"));
 for(const size of [0,-1,5001,1.5])assert.throws(()=>opponentEntryPageQuery(null,size));
});
