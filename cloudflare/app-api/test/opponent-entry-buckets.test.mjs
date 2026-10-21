import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {entryBucket,bucketSql,desiredBucketHashes} from '../lib/opponent-entry-buckets.mjs';
import {exportChangedOpponentEntries} from '../scripts/export-opponent-entry-state.mjs';
const rows=[{circuit:'fitp',sourcePlayerId:'123456',normalizedName:'fitp',displayName:'Fitp',tournaments:[]},{circuit:'itf',sourcePlayerId:'800000001',normalizedName:'itf',displayName:'Itf',tournaments:[]},{circuit:'tennis-europe',sourcePlayerId:'12345678-1234-1234-1234-123456789abc',normalizedName:'europe',displayName:'Europe',tournaments:[]}];
const source={complete:true,rows};
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const create=()=>database({identityMapping:true,readChecks:true});
async function certify(d,state){for(const r of state.scopeBuckets)await d.query(`INSERT INTO opponent_entry_bucket_checks VALUES(${quote(r.circuit)},${r.bucket},${quote(r.hash)}) ON CONFLICT(circuit,bucket) DO UPDATE SET digest=excluded.digest`)}
test('bucket expression is identical for native IDs, punctuation, short and Unicode legacy names; indexed seeks avoid full profile scans',()=>{
 const d=create();try{
  for(const id of ['1','123456','800000001','name:Černá 😀','',rows[2].sourcePlayerId])assert.equal(d.execute('SELECT '+bucketSql('?')+' AS bucket',Array(4).fill(id))[0].bucket,entryBucket(id));
  const plan=d.execute(`EXPLAIN QUERY PLAN SELECT payload FROM opponent_entry_profiles WHERE circuit='fitp' AND ${bucketSql()}=17 AND source_player_id>'' ORDER BY source_player_id LIMIT 1000`).map(r=>r.detail).join('\n');assert.match(plan,/USING INDEX opponent_entry_bucket_lookup/);assert.doesNotMatch(plan,/SCAN opponent_entry_profiles/);
 }finally{d.close()}
});
test('new desired profiles, updates, deletions and external mutations re-read only affected buckets; identical sources read no profiles',async()=>{
 const d=create();try{
  for(const r of rows)d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?,?)',[r.circuit,r.sourcePlayerId,r.normalizedName,r.displayName,JSON.stringify(r),'now']);
  const first=await exportChangedOpponentEntries(d.query,source);assert.equal(first.rows.length,3);await certify(d,first);
  let scans=0;const query=sql=>{if(sql.includes('FROM opponent_entry_profiles'))scans++;return d.query(sql)};
  const replay=await exportChangedOpponentEntries(query,source);assert.equal(scans,0);assert.deepEqual(replay.scopeBuckets,[]);
  const next=structuredClone(source);next.rows[0].displayName='Changed';let changed=await exportChangedOpponentEntries(query,next);assert.equal(changed.scopeBuckets.length,1);assert.equal(changed.rows.length,1);assert.equal(changed.rows[0].circuit,'fitp');
  d.execute("UPDATE opponent_entry_profiles SET payload='changed externally' WHERE circuit='itf'");changed=await exportChangedOpponentEntries(d.query,source);assert.equal(changed.scopeBuckets.length,1);assert.equal(changed.rows[0].circuit,'itf');
  const removed={complete:true,rows:rows.map(r=>r.circuit==='fitp'?{...r,sourcePlayerId:'999999'}:r)};changed=await exportChangedOpponentEntries(d.query,removed);assert.ok(changed.rows.some(r=>r.source_player_id==='123456'));
 }finally{d.close()}
});
test('Europe native-name changes invalidate alias retention evidence across buckets; incomplete sources abort before reading D1',async()=>{
 const a=desiredBucketHashes(rows),b=desiredBucketHashes(rows.map(r=>r.circuit==='tennis-europe'?{...r,normalizedName:'new'}:r));
 assert.equal([...a].filter(([key,v])=>v!==b.get(key)).length,128);
 await assert.rejects(exportChangedOpponentEntries(()=>{throw Error('unexpected read')},{complete:false,rows}),/source incomplete/);
});
test('120000 profiles: one changed FITP bucket returns less than two percent of the archive with an indexed plan',async()=>{
 const {spawnSync}=await import('node:child_process');
 const script=`import sqlite3,json,sys
s=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.execute('CREATE TABLE opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,display_name TEXT,payload TEXT,PRIMARY KEY(circuit,source_player_id))');d.execute('CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)');d.executemany('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?)',[('fitp',str(i).zfill(8),'p','P','{}') for i in range(120000)]);d.executescript(s['migration']);steps=[0]
def tick():
 steps[0]+=100
 return 0
d.set_progress_handler(tick,100);allrows=d.execute('SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles ORDER BY circuit,source_player_id').fetchall();full=steps[0];steps[0]=0;part=d.execute(s['query']).fetchall();print(json.dumps({'fullRows':len(allrows),'bucketRows':len(part),'fullSteps':full,'bucketSteps':steps[0]}))`;
 const fs=await import('node:fs');const q=`SELECT circuit,source_player_id,normalized_name,display_name,payload FROM opponent_entry_profiles WHERE circuit='fitp' AND ${bucketSql()}=${entryBucket('00001234')} ORDER BY source_player_id`;
 const run=spawnSync('python3',['-c',script],{encoding:'utf8',input:JSON.stringify({migration:fs.readFileSync(new URL('../migrations/0045_opponent_entry_bucket_checks.sql',import.meta.url),'utf8'),query:q})});assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.fullRows,120000);assert.ok(result.bucketRows<2400);assert.ok(result.bucketSteps<result.fullSteps/20);console.log('OPPONENT_BUCKET_BENCHMARK='+JSON.stringify(result));
});
