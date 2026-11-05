import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {database} from './search-sqlite-fixture.mjs';
import {sharedPlayerHistories} from '../lib/shared-player-history.mjs';
import {personalCircuitHistory,personalItfHistory,participantSourceKey} from '../lib/personal-tennis-europe-history.mjs';

const guid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
function counted(d,log){return{prepare(sql){const stmt=values=>({bind:(...v)=>stmt(v),all:async()=>{log.push({sql,values});return d.db.prepare(sql).bind(...values).all()}});return stmt([])}}}
async function fixture(d,{dense=false}={}){
 const players=Array.from({length:39},(_,i)=>({id:'cw'+i,name:'Player '+i,sourceCircuit:'fitp',sourcePlayerId:String(1234567+i),worldTennisId:String(800000000+i)}));
 players[0]={...players[0],name:'Alice Example',profileSync:{tennisEurope:{profileId:guid}}};
 const statements=[];
 for(const c of ['fitp','tennis-europe','itf'])statements.push(`INSERT INTO tournaments VALUES('t-${c}','${c}','T','2026-01-01','2026-01-08','{}');`);
 for(let i=0;i<players.length;i++)for(const c of ['fitp','itf',...(i===0?['tennis-europe']:[])]){
  const p=players[i],native=c==='fitp'?p.sourcePlayerId:c==='itf'?p.worldTennisId:guid;
  const count=i===0&&c==='tennis-europe'?262:dense?80:1;
  for(let n=0;n<count;n++){
   const mid=c+'-'+i+'-'+String(n).padStart(4,'0'),local=c==='tennis-europe'&&n===261;
   statements.push(`INSERT INTO matches VALUES('${mid}','t-${c}','${c}','2026-01-02','{"event":"GS14","score":"6-2 6-3"}');`);
   statements.push(`INSERT INTO match_participants VALUES('${mid}','self','${local?'49':native}','${p.name}','${p.name.toLowerCase()}','ITA',0,1,'{}');`);
   statements.push(`INSERT INTO match_participants VALUES('${mid}','opponent','other','Other Player','other player','FRA',1,0,'{}');`);
  }
 }
 // Same-name, unproven local participant must not be attached to Alice.
 statements.push(`INSERT INTO matches VALUES('wrong-local','t-tennis-europe','tennis-europe','2026-01-02','{}');`);
 statements.push(`INSERT INTO match_participants VALUES('wrong-local','self','50','Alice Example','alice example','BEL',0,0,'{}');`);
 await d.query(statements.join('\n'));
 players[0].sourceKey=await participantSourceKey('tennis-europe',{payload:'{}',display_name:'Alice Example',source_player_id:'49',nationality:'ITA'});
 return players;
}
test('39-player shared reads preserve all circuits, full pages, aliases and isolation while reducing actual requests', {timeout:120000}, async()=>{
 const d=database({identityMapping:true});try{
  const players=await fixture(d);
  for(const name of ['0021_tennis_europe_identity_indexes.sql','0031_player_history_lookup_index.sql','0040_personal_history_read_indexes.sql'])await d.query(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const baseline=d.writes(),oldCalls=[],newCalls=[];
  const expected=await Promise.all(players.map(p=>personalCircuitHistory(counted(d,oldCalls),p)));
  const actual=await sharedPlayerHistories(counted(d,newCalls),players);
  assert.deepEqual(actual,expected);assert.equal(actual[0].matches.length,264);
  assert.ok(!actual[0].matches.some(m=>m.id==='wrong-local'));
  assert.equal(d.writes(),baseline);
  assert.ok(newCalls.length<oldCalls.length/4,`${newCalls.length} shared vs ${oldCalls.length} separate requests`);
  assert.ok(newCalls.every(c=>c.values.length<100));
  console.log(`SHARED_HISTORY_PARITY players=39 oldRequests=${oldCalls.length} sharedRequests=${newCalls.length} matches=${actual.reduce((n,h)=>n+h.matches.length,0)}`);
  // Execute the exact production statements with D1's real compound limit,
  // and verify both participant branches use player indexes, not global scans.
  const file=d.execute('PRAGMA database_list').find(r=>r.name==='main').file;
  const script=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(x['file']);d.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5);d.setlimit(sqlite3.SQLITE_LIMIT_FUNCTION_ARG,32);d.setlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER,100)
totals=[]
for cases in [x['old'],x['shared']]:
 ticks=[0]
 def step():ticks[0]+=1;return 0
 d.set_progress_handler(step,1)
 for c in cases:d.execute(c['sql'],c['values']).fetchall()
 d.set_progress_handler(None,0);totals.append(ticks[0])
for c in x['shared']:
 if 'candidate_matches' not in c['sql'] and 'SELECT q.slot AS history_slot' not in c['sql']:continue
 plan=[r[3] for r in d.execute('EXPLAIN QUERY PLAN '+c['sql'],c['values'])]
 assert not any(r.startswith('SCAN p') for r in plan),plan
 if 'CROSS JOIN match_participants p' in c['sql']:assert any('SEARCH p USING' in r for r in plan),plan
print(json.dumps(totals))`;
  const r=spawnSync('python3',['-c',script],{input:JSON.stringify({file,old:oldCalls,shared:newCalls}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const [oldSteps,sharedSteps]=JSON.parse(r.stdout);
  console.log(`SHARED_HISTORY_SQL oldSteps=${oldSteps} sharedSteps=${sharedSteps}`);
  assert.ok(sharedSteps<oldSteps*2,'shared requests must not hide a broad participant scan');
 }finally{d.close()}
});
test('configured players keep ITF-only scope; no-native fallback, empty names and absent identity tables preserve output',async()=>{
 const d=database();try{
  const players=await fixture(d),configuredIds=new Set(players.map(p=>p.id));
  const small=[players[0],{id:'fallback',name:'Player 1',sourceCircuit:'fitp'},{id:'empty',name:'',sourceCircuit:'itf'},{id:'none',name:'No Profile'}];
  const expected=await Promise.all(small.map(p=>configuredIds.has(p.id)?personalItfHistory(d.db,p):personalCircuitHistory(d.db,p)));
  assert.deepEqual(await sharedPlayerHistories(d.db,small,{configuredIds}),expected);
  assert.deepEqual(await sharedPlayerHistories(d.db,[]),[]);
 }finally{d.close()}
});
test('shared read errors stop queued groups, never retry and never certify partial history',async()=>{
 let calls=0;const db={prepare(){return{bind(){return{all:async()=>{calls++;throw Error('7500')}}}}}};
 const players=Array.from({length:200},(_,i)=>({id:'p'+i,name:'Player '+i,sourceCircuit:'itf',sourcePlayerId:'800000001'}));
 await assert.rejects(sharedPlayerHistories(db,players),/7500/);assert.equal(calls,4);
});

test('dense 39-player histories keep page seeks bounded and output identical without a global scan', {timeout:120000}, async()=>{
 const d=database({identityMapping:true});try{
  const players=await fixture(d,{dense:true});
  for(const name of ['0021_tennis_europe_identity_indexes.sql','0031_player_history_lookup_index.sql','0040_personal_history_read_indexes.sql'])await d.query(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const oldCalls=[],newCalls=[],before=d.writes();
  const expected=await Promise.all(players.map(p=>personalCircuitHistory(counted(d,oldCalls),p)));
  const actual=await sharedPlayerHistories(counted(d,newCalls),players);
  assert.deepEqual(actual,expected);assert.equal(d.writes(),before);assert.ok(newCalls.length<oldCalls.length/2);
  const file=d.execute('PRAGMA database_list').find(r=>r.name==='main').file;
  const script=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(x['file']);d.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,5)
totals=[]
for cases in [x['old'],x['shared']]:
 ticks=[0]
 def step():ticks[0]+=1;return 0
 d.set_progress_handler(step,100)
 for c in cases:d.execute(c['sql'],c['values']).fetchall()
 d.set_progress_handler(None,0);totals.append(ticks[0]*100)
print(json.dumps(totals))`;
  const r=spawnSync('python3',['-c',script],{input:JSON.stringify({file,old:oldCalls,shared:newCalls}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const [oldSteps,sharedSteps]=JSON.parse(r.stdout);assert.ok(sharedSteps<oldSteps*2,`${oldSteps} vs ${sharedSteps}`);
  console.log(`SHARED_DENSE_HISTORY matches=${actual.reduce((n,h)=>n+h.matches.length,0)} oldRequests=${oldCalls.length} sharedRequests=${newCalls.length} oldSteps=${oldSteps} sharedSteps=${sharedSteps}`);
 }finally{d.close()}
});
