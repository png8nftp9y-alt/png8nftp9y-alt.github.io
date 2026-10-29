import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('ranking and alias triggers preserve invalidation while avoiding repeated full identity scans',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const r=spawnSync('python3',['-c',String.raw`
import sqlite3,json,sys,pathlib
p=pathlib.Path(sys.argv[1]);c=sqlite3.connect(':memory:')
for migration in sorted((p/'migrations').glob('*.sql')):
 if migration.name<'0047':c.executescript(migration.read_text())
rows=[(str(i),str(i),'person '+str(i),'tennis-europe','','','person '+str(i),'Person '+str(i),None,'') for i in range(20000)]
rows += [('target','target','target','tennis-europe','','','TARGET NAME','Target Name',None,''),('native','native','target','tennis-europe','','https://official/','TARGET NAME','Target Name',None,''),('other','other','target','fitp','','','TARGET NAME','Target Name',None,'')]
c.executemany('INSERT INTO player_circuit_identities VALUES(?,?,?,?,?,?,?,?,?,?)',rows)
c.executemany("INSERT INTO player_profile_recovery_checked(source_table,source_key,source_payload,evidence_version) VALUES('observed_players',?,'{}',1)",[(x[0],) for x in rows])
lookup="SELECT source_key FROM player_circuit_identities WHERE circuit='tennis-europe' AND profile_url='' AND lower(normalized_name)=lower('Target Name')"
def bench():
 steps=[0]
 def tick():steps[0]+=1;return 0
 c.set_progress_handler(tick,100)
 for i in range(40):c.execute('INSERT INTO tennis_europe_player_aliases VALUES(?,?,?,?,?)',(str(i),'Target Name','UKR',None,'now'))
 c.set_progress_handler(None,0)
 return steps[0]
beforePlan=[x[3] for x in c.execute('EXPLAIN QUERY PLAN '+lookup)];before=bench()
result1=list(c.execute('SELECT source_key,evidence_version FROM player_profile_recovery_checked ORDER BY source_key'))
c.execute('DELETE FROM tennis_europe_player_aliases');c.execute('UPDATE player_profile_recovery_checked SET evidence_version=1')
m=(p/'migrations/0047_ranking_recovery_name_index.sql').read_text();c.executescript(m);c.executescript(m)
afterPlan=[x[3] for x in c.execute('EXPLAIN QUERY PLAN '+lookup)];after=bench()
updatePlan=[x[3] for x in c.execute("EXPLAIN QUERY PLAN UPDATE player_profile_recovery_checked SET evidence_version=0 WHERE evidence_version<>0 AND source_key IN ("+lookup+")")]
result2=list(c.execute('SELECT source_key,evidence_version FROM player_profile_recovery_checked ORDER BY source_key'))
assert result1==result2
assert dict(result2)['target']==0 and dict(result2)['native']==1 and dict(result2)['other']==1
c.execute("UPDATE player_profile_recovery_checked SET evidence_version=1 WHERE source_key='target'")
c.execute("INSERT INTO tennis_europe_ranking_history VALUES('rank-id','2026-10-27','54448','44','G14',100,NULL,'Target Name','target name','UKR','https://official/','now')")
assert c.execute("SELECT evidence_version FROM player_profile_recovery_checked WHERE source_key='target'").fetchone()[0]==0
assert any('identity_missing_profile_circuit_lower_name' in x and 'SEARCH' in x for x in afterPlan)
assert any('profile_recovery_checked_active_source' in x and 'SEARCH' in x for x in updatePlan)
assert after*100<before,(before,after)
print(json.dumps({'beforeSteps100':before,'afterSteps100':after,'beforePlan':beforePlan,'afterPlan':afterPlan,'updatePlan':updatePlan,'sameInvalidation':True}))
`,root],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.sameInvalidation,true);console.log(result);
});
