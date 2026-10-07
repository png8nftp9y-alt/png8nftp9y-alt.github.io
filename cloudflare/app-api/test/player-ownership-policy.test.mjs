import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ownershipSelect, ownershipErrors} from '../scripts/player-ownership-policy.mjs';
const fixture = `
import sqlite3,json,sys
db=sqlite3.connect(':memory:')
db.row_factory=sqlite3.Row
db.executescript("""
CREATE TABLE app_players(id TEXT PRIMARY KEY);
CREATE TABLE user_app_players(user_id TEXT,courtwatch_id TEXT,PRIMARY KEY(user_id,courtwatch_id));
CREATE TABLE user_app_player_removals(user_id TEXT,courtwatch_id TEXT);
CREATE TABLE user_app_player_additions(user_id TEXT,courtwatch_id TEXT);
""")
data=json.loads(sys.argv[1])
owner='user-federico-181099'
db.executemany('INSERT INTO app_players VALUES(?)',[(x,) for x in data['base']])
for table,key in [('user_app_players','links'),('user_app_player_removals','removed'),('user_app_player_additions','personal')]:
 db.executemany('INSERT INTO '+table+' VALUES(?,?)',[(owner,x) for x in data[key]])
print(json.dumps(dict(db.execute('SELECT '+sys.argv[2]).fetchone())))
`;
function verify(data) {
 const result=spawnSync('python3',['-c',fixture,JSON.stringify(data),ownershipSelect],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return ownershipErrors(JSON.parse(result.stdout));
}
test('23 generated rows, removal and two durable additions reproduce the failed aggregate but pass ID parity',()=>{
 const base=Array.from({length:23},(_,i)=>'p'+i);
 assert.deepEqual(verify({base,links:[...base.slice(1),'added1','added2'],removed:['p0'],personal:['added1','added2']}),[]);
});
test('player growth has no fixed count or cap',()=>{
 const base=Array.from({length:2000},(_,i)=>'p'+i);
 assert.deepEqual(verify({base,links:base,removed:[],personal:[]}),[]);
});
test('equal counts cannot hide wrong IDs',()=>{
 const errors=verify({base:['a','b'],links:['a','unknown'],removed:[],personal:[]});
 assert.equal(errors.length,2);
 assert.ok(errors.some(x=>x.includes('ownerMissingBaseLinks=1')));
 assert.ok(errors.some(x=>x.includes('ownerUnresolvedLinks=1')));
});
test('personal additions require active links; removals remain respected',()=>{
 assert.equal(verify({base:[],links:[],removed:[],personal:['added']}).length,1);
 assert.deepEqual(verify({base:['a'],links:['a','added'],removed:['a','added'],personal:['added']}),[]);
});
test('missing query fields do not pass as zero',()=>assert.equal(ownershipErrors({}).length,3));
