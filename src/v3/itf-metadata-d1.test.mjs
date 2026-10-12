// D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY D1_TEST_INCOMPLETE_SOURCE_GUARD
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {metadataRows,metadataPlan,metadataSQL,verifyMetadata} from './itf-metadata-d1.mjs';
const catalogue={status:'itf_global_tournament_map_complete',tournaments:[{competitionId:'J-J30-SUI-2026-004',tournamentName:'J30 Agno',startDate:'2025-12-29',endDate:'2026-01-03',sourceUrl:'https://www.itftennis.com/en/tournament/j30-agno/sui/2026/j-j30-sui-2026-004/',location:'Agno, Switzerland',surface:'Hard',indoorOutdoor:'Indoor'}]};
const rows=metadataRows([catalogue],{tournaments:{'J-J30-SUI-2026-004':{venueName:'Official Club',address:"Via d'Agno 1",qualificationStartDate:'2025-12-27'}}});
test('D1 initial import, unchanged replay and guarded field deltas preserve other payload data',()=>{
 const initial=metadataPlan(rows,[]);
 assert.equal(initial.inserts.length,1);
 const current=initial.inserts.map(r=>({...r,payload:JSON.stringify({...JSON.parse(r.payload),status:'archived',extra:'preserved'})}));
 assert.equal(metadataPlan(rows,current).writes,0);
 const changed=rows.map(r=>({...r,facts:{...r.facts,address:'New official address'}}));
 const plan=metadataPlan(changed,current);assert.equal(plan.updates.length,1);assert.equal(JSON.parse(plan.updates[0].after.payload).extra,'preserved');assert.equal(JSON.parse(plan.updates[0].after.payload).status,'archived');assert.deepEqual(plan.deletes,[]);
 const sql=metadataSQL(initial).join('\n'),updates=metadataSQL(plan).join('\n');
 const script=`import sqlite3,json,sys\nx=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row\ndb.execute('CREATE TABLE tournaments(id TEXT PRIMARY KEY,circuit TEXT,source_tournament_id TEXT,start_date TEXT,end_date TEXT,payload TEXT)')\ndb.executescript(x['insert']);assert db.execute('select count(*) from tournaments').fetchone()[0]==1\ndb.executescript(x['insert']);assert db.execute('select count(*) from tournaments').fetchone()[0]==1\nr=x['current'];db.execute('UPDATE tournaments SET payload=? WHERE id=?',(r['payload'],r['id']));db.commit()\ndb.executescript(x['updates']);assert json.loads(db.execute('select payload from tournaments').fetchone()[0])['extra']=='preserved'\nbefore=db.total_changes;db.executescript(x['updates']);assert db.total_changes==before\ndb.execute('UPDATE tournaments SET payload=? WHERE id=?',(json.dumps({'concurrent':'keep'}),r['id']));db.commit();before=db.total_changes;db.executescript(x['updates']);assert db.total_changes==before\nprint('SQLite import/replay/delta/concurrent guard passed')`;
 const result=spawnSync('python3',['-c',script],{input:JSON.stringify({insert:sql,updates,current:current[0]}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(verifyMetadata(rows,initial.inserts),1);assert.throws(()=>verifyMetadata(rows,[]));
});
test('incomplete catalogues and identity conflicts are blocked before writes',()=>{
 assert.throws(()=>metadataRows([{...catalogue,status:'partial'}],{}));
 const current=metadataPlan(rows,[]).inserts.map(r=>({...r,circuit:'fitp'}));assert.throws(()=>metadataPlan(rows,current));
});
test('subsequent draw imports preserve factsheet fields and unchanged imports write zero rows',()=>{
 const source=readFileSync(new URL('./build-itf-draw-d1-seed.mjs',import.meta.url),'utf8');
 const clause=source.match(/payload=json_patch\(tournaments.payload,excluded.payload\) WHERE (.*?)\;`\);/)[0].replace(';`);','');
 assert.ok(clause.includes('json_patch(tournaments.payload,excluded.payload) IS NOT tournaments.payload'));
 const script="import sqlite3,json\ndb=sqlite3.connect(':memory:');db.execute('CREATE TABLE tournaments(id TEXT PRIMARY KEY,circuit TEXT,source_tournament_id TEXT,start_date TEXT,end_date TEXT,payload TEXT)')\na={'id':'t','venueName':'Official Club','address':'Address','qualificationStartDate':'2026-10-01'};b={'id':'t','name':'Tournament','surface':'Hard'}\ndb.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',('t','itf','J-TEST','','',json.dumps(a)));db.commit()\nq=\"INSERT INTO tournaments VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=json_patch(tournaments.payload,excluded.payload) WHERE json_patch(tournaments.payload,excluded.payload) IS NOT tournaments.payload\"\ndb.execute(q,('t','itf','J-TEST','','',json.dumps(b)));p=json.loads(db.execute('SELECT payload FROM tournaments').fetchone()[0]);assert p['venueName']=='Official Club' and p['qualificationStartDate']=='2026-10-01'\nn=db.total_changes;db.execute(q,('t','itf','J-TEST','','',json.dumps(b)));assert db.total_changes==n\n";
 const result=spawnSync('python3',['-c',script],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
