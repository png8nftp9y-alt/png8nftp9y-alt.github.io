import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {personalUnreleasedTournamentHistory} from '../lib/personal-unreleased-tournaments.mjs';
test('all native ITF and FITP tournaments are read once, without match payloads or scores and without another identity leakage',async()=>{
let calls=0;
const DB={prepare(sql){assert.ok(!sql.includes('match_payload'));return{bind(params){return{async all(){calls++;const py=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:')
d.executescript("CREATE TABLE match_participants(match_id TEXT,source_player_id TEXT);CREATE TABLE matches(id TEXT,tournament_id TEXT,circuit TEXT);CREATE TABLE tournaments(id TEXT,source_tournament_id TEXT,payload TEXT);")
for i in range(320):
 d.execute("INSERT INTO matches VALUES(?,?,?)",(str(i),'t'+str(i%8),'itf'));d.execute("INSERT INTO match_participants VALUES(?,?)",(str(i),'800000001'))
for i in range(8):d.execute("INSERT INTO tournaments VALUES(?,?,?)",('t'+str(i),'ITF-'+str(i),json.dumps({'name':'Official '+str(i)})))
d.execute("INSERT INTO matches VALUES('foreign','other','itf')");d.execute("INSERT INTO match_participants VALUES('foreign','800000099')");d.execute("INSERT INTO tournaments VALUES('other','OTHER','{}')")
d.row_factory=sqlite3.Row;print(json.dumps([dict(r) for r in d.execute(x['sql'],[x['params']])]))
`;const r=spawnSync('python3',['-c',py],{input:JSON.stringify({sql,params}),encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return{results:JSON.parse(r.stdout)};}}}}}};
const out=await personalUnreleasedTournamentHistory(DB,[{id:'owned',sourceCircuit:'itf',sourcePlayerId:'800000001'}]);assert.equal(calls,1);assert.equal(out.length,8);assert.ok(out.every(t=>t.playerId==='owned'&&t.calendarState==='draw_confirmed'));assert.equal(out.some(t=>t.competitionId==='OTHER'),false);
});
