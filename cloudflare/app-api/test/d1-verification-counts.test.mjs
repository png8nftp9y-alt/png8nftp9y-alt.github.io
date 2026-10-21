import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {readVerificationCounts,fullVerificationSql} from '../lib/d1-verification-counts.mjs';
const create=()=>database({identityMapping:true,readChecks:true});
const app=(id,matchId,extra={})=>`INSERT INTO app_matches(seq,player_id,payload) VALUES(${id},'p','${JSON.stringify({circuit:'tennis-europe',matchId,playerId:'p',date:'2026-10-21',tournamentName:'T',opponent:'O',round:'R',...extra}).replaceAll("'","''")}')`;
async function same(d){const full=(await d.query(fullVerificationSql))[0];const actual=await readVerificationCounts(d.query);assert.deepEqual(actual.value,full);return actual}
test('D1_TEST_INITIAL_IMPORT: maintained counts match full SQL after inserts, duplicate matches and invalid/court data',async()=>{
 const d=create();try{
  assert.equal((await same(d)).mode,'full_daily');
  for(const sql of [app(1,'m'),app(2,'m'),app(3,null),app(4,'other',{round:'',court:'1',sourceUrl:'https://official/matches/x',courtMatchNumber:0}),"INSERT INTO matches(id,tournament_id,circuit,payload) VALUES('m','t','tennis-europe','{}')","INSERT INTO app_match_candidates VALUES('p','m','t','2026-10-21','live','{}')","INSERT INTO app_match_candidates VALUES('p2','m','t','2026-10-21','live','{}')"]){d.execute(sql);await same(d)}
  const r=(await same(d)).value;assert.equal(r.appUniqueMatches,2);assert.equal(r.candidateUniqueMatches,1);assert.equal(r.appInvalid,2);assert.equal(r.appMissingCourtMatchNumbers,1);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: updates across circuits/keys, same-key payload updates, deletions and rollbacks preserve distinct counts',async()=>{
 const d=create();try{
  d.execute(app(1,'m'));d.execute(app(2,'m'));await same(d);
  for(const sql of ["UPDATE app_matches SET payload=json_set(payload,'$.matchId','n') WHERE seq=1","UPDATE app_matches SET payload=json_remove(payload,'$.circuit') WHERE seq=2","UPDATE app_matches SET payload=json_set(payload,'$.circuit','tennis-europe') WHERE seq=2","UPDATE app_matches SET payload=json_set(payload,'$.circuit','fitp') WHERE seq=2","UPDATE app_matches SET payload=json_set(payload,'$.opponent','new') WHERE seq=1","DELETE FROM app_matches WHERE seq=1","DELETE FROM app_matches WHERE seq=2"]){d.execute(sql);await same(d)}
  await assert.rejects(d.query("INSERT INTO app_matches(seq,player_id,payload) VALUES(1,'p','invalid json')"));await same(d);
 }finally{d.close()}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: normal repeated verification reads only counters and certificate; next UTC day runs the full SELECT once',async()=>{
 const d=create();try{
  const day=new Date('2026-10-21T00:00:00Z');await readVerificationCounts(d.query,{now:day});const before=d.writes();
  let full=0;const query=async sql=>{if(sql===fullVerificationSql)full++;return d.query(sql)};
  assert.equal((await readVerificationCounts(query,{now:day})).mode,'incremental');assert.equal(d.writes(),before);assert.equal(full,0);
  assert.equal((await readVerificationCounts(query,{now:new Date('2026-10-22T00:00:00Z')})).mode,'full_daily');assert.equal(full,1);
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: drift or missing counters cannot receive a daily success certificate',async()=>{
 const d=create();try{
  d.execute("UPDATE d1_verification_totals SET value=1 WHERE metric='teMatches'");
  await assert.rejects(readVerificationCounts(d.query),/mismatch/);assert.deepEqual(await d.query('SELECT * FROM d1_daily_verification'),[]);
  d.execute("DELETE FROM d1_verification_totals WHERE metric='appInvalid'");await assert.rejects(readVerificationCounts(d.query),/incomplete/);
 }finally{d.close()}
});
test('randomized SQLite counter parity across 300 mixed source mutations, including missing JSON fields',async()=>{
 const {spawnSync}=await import('node:child_process');const fs=await import('node:fs');
 const names=fs.readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort();
 const schema=names.map(n=>fs.readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n');
 const script=`import sqlite3,json,sys,random
p=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row;d.executescript(p['schema']);r=random.Random(7)
for i in range(300):
 seq=r.randrange(20);op=r.randrange(3)
 if op==0:
  v={'circuit':r.choice(['tennis-europe','fitp',None]),'matchId':r.choice(['a','b','c',None,1]),'playerId':'p','date':'2026-10-21','tournamentName':'T','round':r.choice(['R','']),'opponent':'O','court':'1','courtMatchNumber':r.choice([0,1]),'sourceUrl':'https://official/matches/x'}
  if i%5==0:v.pop('circuit')
  d.execute('INSERT INTO app_matches(seq,player_id,payload) VALUES(?,?,?) ON CONFLICT(seq) DO UPDATE SET payload=excluded.payload',(seq,'p',json.dumps(v)))
 elif op==1:d.execute('DELETE FROM app_matches WHERE seq=?',(seq,))
 else:d.execute("UPDATE app_matches SET payload=json_set(payload,'$.matchId',?) WHERE seq=?",(r.choice(['a','b',None]),seq))
 actual=dict(d.execute(p['full']).fetchone());counts={x['metric']:x['value'] for x in d.execute('SELECT metric,value FROM d1_verification_totals')}
 assert actual==counts,(i,actual,counts)
print('300 randomized mutations: complete parity')`;
 const run=spawnSync('python3',['-c',script],{encoding:'utf8',input:JSON.stringify({schema,full:fullVerificationSql})});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/complete parity/);
});
