import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {itfParticipantSQL} from './itf-match-participants.mjs';
test('legacy accepted payload backfill is guarded, restores native IDs and replay writes zero',()=>{
const match={id:'match-test',generatedAt:'legacy',teams:[{players:[{id:'800000001',name:'Official One'}]},{players:[{id:'800000002',name:'Official Two'}]}],winnerTeam:0},payload=JSON.stringify(match),sql=itfParticipantSQL(match,{expectedPayload:payload}).join('\n');
const py=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:')
d.executescript("CREATE TABLE matches(id TEXT PRIMARY KEY,circuit TEXT,payload TEXT);CREATE TABLE match_participants(match_id TEXT,participant_key TEXT,source_player_id TEXT,display_name TEXT,normalized_name TEXT,nationality TEXT,team_index INTEGER,is_winner INTEGER,payload TEXT,PRIMARY KEY(match_id,participant_key));")
d.execute("INSERT INTO matches VALUES('match-test','itf',?)",(x['payload'],));before=d.total_changes;d.executescript(x['sql']);first=d.total_changes-before;before=d.total_changes;d.executescript(x['sql']);second=d.total_changes-before
d.execute("DELETE FROM match_participants");d.execute("UPDATE matches SET payload='changed accepted source'");before=d.total_changes;d.executescript(x['sql']);stale=d.total_changes-before
print(json.dumps({'first':first,'second':second,'stale':stale}))
`;const r=spawnSync('python',['-c',py],{input:JSON.stringify({payload,sql}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{first:2,second:0,stale:0});
});
