import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {exactPersonalEntryProfiles} from '../lib/personal-entry-profiles.mjs';
test('all personal entry profiles use one exact native ID read even when names differ; absent mapped profiles stay empty',async()=>{
let calls=0;const DB={prepare(sql){return{bind(params){return{async all(){calls++;const py=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:')
d.executescript("CREATE TABLE opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,payload TEXT);")
d.execute("INSERT INTO opponent_entry_profiles VALUES('itf','800000001','different source name','{}')")
d.execute("INSERT INTO opponent_entry_profiles VALUES('itf','800000099','same player name','{}')")
d.execute("INSERT INTO opponent_entry_profiles VALUES('tennis-europe','12345678-1234-1234-1234-123456789aBc','another spelling','{}')")
d.row_factory=sqlite3.Row;print(json.dumps([dict(r) for r in d.execute(x['sql'],[x['params']])]))
`;const r=spawnSync('python',['-c',py],{input:JSON.stringify({sql,params}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return{results:JSON.parse(r.stdout)};}}}}}};
const out=await exactPersonalEntryProfiles(DB,[{id:'one',sourceCircuit:'itf',sourcePlayerId:'800000001'},{id:'two',sourceCircuit:'itf',sourcePlayerId:'800000002'},{id:'three',sourceCircuit:'tennis-europe',sourcePlayerId:'12345678-1234-1234-1234-123456789abc'}]);assert.equal(calls,1);assert.equal(out.get('one')[0].source_player_id,'800000001');assert.equal(out.get('two').length,0);assert.equal(out.get('three')[0].source_player_id,'12345678-1234-1234-1234-123456789aBc');
});
