import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
test('cold Admin reads current version by full key, without revisiting retained versions',()=>{
 const source=readFileSync(new URL('../lib/admin-runtime-documents.mjs',import.meta.url),'utf8');
 const sql=source.match(/const sql=`([\s\S]*?)`;/)[1].replace(/\$\{paths\.map\([\s\S]*?\)\}/,'?,?');
 const py=String.raw`
import sqlite3,json,sys
c=sqlite3.connect(':memory:');c.executescript('CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE runtime_document_chunks(path TEXT,content_hash TEXT,seq INTEGER,data TEXT,PRIMARY KEY(path,content_hash,seq)) WITHOUT ROWID;')
paths=['dist/v3/diagnostics.json','dist/v3/sync_status.json'];docs=[{'path':p,'hash':'current'} for p in paths]
c.execute('INSERT INTO app_state VALUES(?,?)',('runtimeDocumentRelease',json.dumps({'documents':docs})))
c.executemany('INSERT INTO runtime_document_chunks VALUES(?,?,0,?)',[(p,'old'+str(i),'old') for p in paths for i in range(10000)]+[(p,'current','correct') for p in paths])
sql=sys.stdin.read();steps=[0]
def tick():steps[0]+=1;return 0
c.set_progress_handler(tick,100);rows=c.execute(sql,paths).fetchall();c.set_progress_handler(None,0)
plan=[x[3] for x in c.execute('EXPLAIN QUERY PLAN '+sql,paths)]
assert len(rows)==3 and all(x[3]=='correct' for x in rows if x[0]=='chunk'),rows
assert steps[0]<30,(steps,plan)
assert any('path=? AND content_hash=?' in x for x in plan),plan
print(json.dumps({'steps100':steps[0],'plan':plan}))
`;
 const r=spawnSync('python3',['-c',py],{input:sql,encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log(JSON.parse(r.stdout));
});
test('ranking publication verification uses bounded indexes with exactly the same category counts',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const py=String.raw`
import sqlite3,json,sys,pathlib
p=pathlib.Path(sys.argv[1]);c=sqlite3.connect(':memory:');c.executescript((p/'migrations/0017_tennis_europe_ranking_history.sql').read_text())
rows=[]
for pub in range(20):
 for cat in ['B14','G14','B16','G16']:
  for player in range(250):rows.append((str(player),f'2026-10-{pub+1:02}',str(pub),'week',cat,player+1,None,'Name','name','ITA','official','now'))
c.executemany('INSERT INTO tennis_europe_ranking_history VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',rows)
sql='SELECT category,COUNT(*) FROM tennis_europe_ranking_history WHERE publication_id=(SELECT publication_id FROM tennis_europe_ranking_history ORDER BY ranking_date DESC,captured_at DESC LIMIT 1) GROUP BY category ORDER BY category'
def run():
 steps=[0]
 def tick():steps[0]+=1;return 0
 c.set_progress_handler(tick,100);result=c.execute(sql).fetchall();c.set_progress_handler(None,0);return result,steps[0]
before,old=run()
# Only ranking indexes: recovery tables are created separately in their test.
m=(p/'migrations/0047_ranking_recovery_name_index.sql').read_text()
for statement in m.split(';'):
 if 'CREATE INDEX' in statement and 'te_ranking_' in statement:c.executescript(statement+';')
after,new=run();assert before==after and len(after)==4
assert new*10<old,(old,new)
plan=[r[3] for r in c.execute('EXPLAIN QUERY PLAN '+sql)]
assert any('te_ranking_publication_category' in r for r in plan),plan
assert any('te_ranking_latest_publication' in r for r in plan),plan
print(json.dumps({'beforeSteps100':old,'afterSteps100':new,'sameCounts':True,'plan':plan}))
`;
 const r=spawnSync('python3',['-c',py,root],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);console.log(JSON.parse(r.stdout));
});
