import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {birthYearUpdateSql,resolveConfirmedYears} from '../scripts/sync-confirmed-personal-birth-years.mjs';
const row={user_id:'owner',courtwatch_id:'player',observed_source_key:'fitp|id:123',payload:JSON.stringify({id:'player',name:'Camilla Frigerio',membershipCard:'123',club:'Tennis Club Lecco'})};
function execute(sql,{payload=row.payload,removed=false}={}){
 const python=`import json,sqlite3,sys
p=json.load(sys.stdin);db=sqlite3.connect(':memory:')
db.executescript("CREATE TABLE user_app_player_additions(user_id TEXT,courtwatch_id TEXT,observed_source_key TEXT,payload TEXT);CREATE TABLE user_app_players(user_id TEXT,courtwatch_id TEXT);CREATE TABLE user_app_player_removals(user_id TEXT,courtwatch_id TEXT);")
db.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?)',('owner','player','fitp|id:123',p['payload']))
db.execute("INSERT INTO user_app_players VALUES('owner','player')")
db.execute("INSERT INTO user_app_player_additions VALUES('owner','other','fitp|id:456','{}')")
if p['removed']:db.execute("INSERT INTO user_app_player_removals VALUES('owner','player')")
before=db.total_changes
if p['sql']:db.execute(p['sql'])
print(json.dumps({'writes':db.total_changes-before,'player':json.loads(db.execute("SELECT payload FROM user_app_player_additions WHERE courtwatch_id='player'").fetchone()[0]),'other':db.execute("SELECT payload FROM user_app_player_additions WHERE courtwatch_id='other'").fetchone()[0]}))
`;
 const result=spawnSync('python3',['-c',python],{input:JSON.stringify({sql,payload,removed}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
test('D1_TEST_INITIAL_IMPORT: confirmed year updates only the selected identity',()=>{
 const result=execute(birthYearUpdateSql(row,2017));assert.equal(result.writes,1);assert.equal(result.player.birthYear,2017);assert.equal(result.player.club,'Tennis Club Lecco');assert.equal(result.other,'{}');
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: identical confirmed-year replay writes zero',()=>{
 const payload=JSON.stringify({...JSON.parse(row.payload),birthYear:2017,birthYearSource:'user-confirmed:2026-10-08'});
 assert.equal(birthYearUpdateSql({...row,payload},2017),'');assert.equal(execute('',{payload}).writes,0);
});
test('D1_TEST_REAL_DELTAS_ONLY: concurrent edits and removed selections survive delayed patch',()=>{
 const sql=birthYearUpdateSql(row,2017),payload=JSON.stringify({...JSON.parse(row.payload),ranking:'4.2'});
 assert.equal(execute(sql,{payload}).writes,0);assert.equal(execute(sql,{removed:true}).writes,0);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: identity, conflicts and ambiguous targets reject writes',()=>{
 assert.throws(()=>birthYearUpdateSql({...row,observed_source_key:'fitp|id:999'},2017),/identity/);
 assert.throws(()=>birthYearUpdateSql({...row,payload:JSON.stringify({...JSON.parse(row.payload),birthYear:1989})},2017),/Conflicting/);
 assert.throws(()=>resolveConfirmedYears([row,row]),/Ambiguous/);
 assert.equal(resolveConfirmedYears([]).length,0);
});
