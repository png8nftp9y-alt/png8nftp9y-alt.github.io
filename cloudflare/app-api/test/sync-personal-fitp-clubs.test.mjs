import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {database} from './search-sqlite-fixture.mjs';
import {personalMissingClubsSql,personalFitpClubCard,clubUpdateSql} from '../scripts/sync-personal-fitp-clubs.mjs';
const row={user_id:'owner',courtwatch_id:'player',payload:JSON.stringify({id:'player',name:'Camilla Frigerio',membershipCard:'123',club:''})};
function execute(sql,{payload=row.payload,removed=false}={}){
 const python=`import json,sqlite3,sys
p=json.load(sys.stdin);db=sqlite3.connect(':memory:')
db.executescript("CREATE TABLE user_app_player_additions(user_id TEXT,courtwatch_id TEXT,payload TEXT);CREATE TABLE user_app_players(user_id TEXT,courtwatch_id TEXT);CREATE TABLE user_app_player_removals(user_id TEXT,courtwatch_id TEXT);")
db.execute('INSERT INTO user_app_player_additions VALUES(?,?,?)',('owner','player',p['payload']))
db.execute("INSERT INTO user_app_players VALUES('owner','player')")
db.execute("INSERT INTO user_app_player_additions VALUES('owner','other','{}')")
if p['removed']:db.execute("INSERT INTO user_app_player_removals VALUES('owner','player')")
before=db.total_changes
if p['sql']:db.execute(p['sql'])
print(json.dumps({'writes':db.total_changes-before,'player':json.loads(db.execute("SELECT payload FROM user_app_player_additions WHERE courtwatch_id='player'").fetchone()[0]),'other':db.execute("SELECT payload FROM user_app_player_additions WHERE courtwatch_id='other'").fetchone()[0]}))
`;
 const result=spawnSync('python3',['-c',python],{input:JSON.stringify({sql,payload,removed}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
test('D1_TEST_INITIAL_IMPORT: first verified club fills the selected personal profile',()=>{
 const result=execute(clubUpdateSql(row,'Official Club'));
 assert.equal(result.writes,1);assert.equal(result.player.club,'Official Club');assert.equal(result.player.id,'player');
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: populated club is preserved with zero writes',()=>{
 const payload=JSON.stringify({...JSON.parse(row.payload),club:'Official Club'});
 assert.equal(clubUpdateSql({...row,payload},'Official Club'),'');
 assert.equal(execute('',{payload}).writes,0);
});
test('D1_TEST_REAL_DELTAS_ONLY: only the selected missing club changes and concurrent edits survive',()=>{
 const sql=clubUpdateSql(row,'Official Club'),result=execute(sql);
 assert.equal(result.writes,1);assert.equal(result.other,'{}');
 const payload=JSON.stringify({...JSON.parse(row.payload),name:'Updated Name'});
 const concurrent=execute(sql,{payload});assert.equal(concurrent.writes,0);assert.equal(concurrent.player.name,'Updated Name');
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing club cannot overwrite data and removals block delayed updates',()=>{
 assert.throws(()=>clubUpdateSql(row,''),/Incomplete/);
 assert.equal(execute(clubUpdateSql(row,'Official Club'),{removed:true}).writes,0);
});


test('existing Europe selections recover only the FITP card of their unique canonical identity',async()=>{
 const d=database({identityMapping:true});try{
  const sourceKey='selected-europe',profiles=[{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('123456')}];
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['person:test','PLAYER TEST',JSON.stringify({canonicalId:'person:test',name:'Test Player',circuitProfiles:profiles})]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[sourceKey,'person:test','PLAYER TEST','tennis-europe','12345678-1234-1234-1234-123456789abc','TEST PLAYER','Test Player']);
  const before=d.writes();
  assert.equal(await personalFitpClubCard(d.db,{id:'old-selection',sourceKey,name:'Test Player'}),'123456');
  assert.equal(await personalFitpClubCard(d.db,{id:'homonym',sourceKey:'unlinked',name:'Test Player'}),'');
  assert.equal(await personalFitpClubCard(d.db,{id:'conflict',sourceKey,name:'Test Player',membershipCard:'654321'}),'');
  assert.equal(d.writes(),before);
 }finally{d.close()}
});

test('scheduled club recovery includes linked Europe selections and excludes unknown names and removals',()=>{
 const d=database({identityMapping:true});try{
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',['person:test','PLAYER TEST','{}']);
  for(const [sourceKey,circuit,native] of [['selected-europe','tennis-europe','12345678-1234-1234-1234-123456789abc'],['fitp|id:123456','fitp','123456']])d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[sourceKey,'person:test','PLAYER TEST',circuit,native,'TEST PLAYER','Test Player']);
  for(const [id,sourceKey,club] of [['selected','selected-europe',''],['unknown','unlinked',''],['populated','selected-europe','Known Club'],['removed','selected-europe','']]){
   d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',['owner',id,sourceKey+'|'+id,JSON.stringify({id,sourceKey,name:'Test Player',club}),'2026-10-11']);
   d.execute('INSERT INTO user_app_players VALUES(?,?,?)',['owner',id,'2026-10-11']);
  }
  d.execute('INSERT INTO user_app_player_removals VALUES(?,?,?)',['owner','removed','2026-10-11']);
  const before=d.writes(),rows=d.execute(personalMissingClubsSql);
  assert.deepEqual(rows.map(r=>r.courtwatch_id),['selected']);assert.equal(d.writes(),before);
 }finally{d.close()}
});
