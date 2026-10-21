// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
// Existing real generator/SQLite regression covers source completeness, aliases,
// official draws, exact replay and prepared-state checksum protection.
import './opponent-entry-native-aliases.test.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {entryBucket,desiredBucketHashes} from '../lib/opponent-entry-buckets.mjs';
import {database} from './search-sqlite-fixture.mjs';
test('scoped real SQL modifies one changed bucket, preserves other circuits, checkpoints last and replays without writes',async()=>{
 const d=database({identityMapping:true,readChecks:true}),dir=await fs.mkdtemp(path.join(os.tmpdir(),'cw-entry-scope-'));
 try{
  const rows=[{circuit:'fitp',sourcePlayerId:'123456',normalizedName:'fitp',displayName:'Updated',tournaments:[]},{circuit:'itf',sourcePlayerId:'800000001',normalizedName:'itf',displayName:'Itf',tournaments:[]},{circuit:'tennis-europe',sourcePlayerId:'12345678-1234-1234-1234-123456789abc',normalizedName:'te',displayName:'Te',tournaments:[]}];
  for(const r of rows)d.execute('INSERT INTO opponent_entry_profiles VALUES(?,?,?,?,?,?)',[r.circuit,r.sourcePlayerId,r.normalizedName,r.circuit==='fitp'?'Old':r.displayName,JSON.stringify({circuit:r.circuit,sourcePlayerId:r.sourcePlayerId,normalizedName:r.normalizedName,displayName:r.circuit==='fitp'?'Old':r.displayName,tournaments:[]}), 'now']);
  const bucket=entryBucket('123456'),hash=desiredBucketHashes(rows).get(JSON.stringify(['fitp',bucket]));
  const desired={rows,complete:true,hash:crypto.createHash('sha256').update(JSON.stringify({version:'native-aliases-v1',rows})).digest('hex')};
  await fs.mkdir(path.join(dir,'tmp'));await fs.writeFile(path.join(dir,'tmp/opponent-entry-desired.json'),JSON.stringify(desired));
  const remote={rows:d.execute("SELECT * FROM opponent_entry_profiles WHERE circuit='fitp'"),scopeBuckets:[{circuit:'fitp',bucket,hash}]};
  const generate=async()=>{await fs.writeFile(path.join(dir,'tmp/opponent-entry-remote.json'),JSON.stringify(remote));const r=spawnSync(process.execPath,[new URL('../scripts/generate-opponent-entry-seed.mjs',import.meta.url).pathname,'--from-prepared'],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return(await Promise.all((await fs.readdir(path.join(dir,'seed-opponent-entries'))).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join(dir,'seed-opponent-entries',f),'utf8')))).join('\n')};
  let sql=await generate();assert.doesNotMatch(sql,/DELETE FROM opponent_entry_profiles/);assert.doesNotMatch(sql,/VALUES\('itf'|VALUES\('tennis-europe'/);
  // execscript must execute CREATE TRIGGER bodies in the fixture schema, then
  // ordinary generated statements use the shared guarded SQL executor.
  await d.query(sql);assert.equal(d.execute('SELECT COUNT(*) n FROM opponent_entry_profiles')[0].n,3);
  assert.equal(d.execute("SELECT display_name FROM opponent_entry_profiles WHERE circuit='fitp'")[0].display_name,'Updated');assert.equal(d.execute("SELECT digest FROM opponent_entry_bucket_checks WHERE circuit='fitp' AND bucket=?",[bucket])[0].digest,hash);
  remote.rows=d.execute("SELECT * FROM opponent_entry_profiles WHERE circuit='fitp'");sql=await generate();const before=d.writes();await d.query(sql);assert.equal(d.writes(),before);
 }finally{d.close();await fs.rm(dir,{recursive:true,force:true})}
});
