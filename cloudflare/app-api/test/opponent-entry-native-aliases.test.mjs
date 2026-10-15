import test from 'node:test';import assert from 'node:assert/strict';
import {retainedNativeNameAliases,selectOpponentEntryProfiles} from '../lib/opponent-entry-native-aliases.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
const id='12345678-1234-1234-1234-123456789abc',second='22345678-1234-1234-1234-123456789abc';
const old={circuit:'tennis-europe',source_player_id:'name:known person',normalized_name:'known person',display_name:'Known Person',payload:'old historical tournaments'};
const native={circuit:'tennis-europe',sourcePlayerId:id,normalizedName:'known person',displayName:'Known Person',payload:'current tournaments'};
const norm=r=>({key:r.circuit+'|'+(r.source_player_id||r.sourcePlayerId),payload:r.payload});
function plan(current,incoming,complete=true){const aliases=retainedNativeNameAliases(current,incoming,{sourceComplete:complete});return buildIncrementalSyncPlan({current:current.map(norm),incoming:incoming.map(norm).concat(aliases.map(norm)),keyOf:r=>r.key,sourceComplete:complete})}
test('D1_TEST_INITIAL_IMPORT: official profiles import normally and alias migration preserves historical source records',()=>{
 assert.equal(plan([], [native]).inserts.length,1);const p=plan([old],[native]);assert.equal(p.inserts.length,1);assert.equal(p.deletes.length,0);assert.equal(p.unchanged.length,1);
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: replay does not rewrite retained aliases or unchanged native profiles',()=>{
 const p=plan([old,{circuit:native.circuit,source_player_id:id,normalized_name:native.normalizedName,payload:native.payload}],[native]);assert.equal(p.writes,0);
});
test('D1_TEST_REAL_DELTAS_ONLY: native update changes only its own row and unrelated disappearance still hits the deletion guard',()=>{
 const p=plan([old,{circuit:native.circuit,source_player_id:id,normalized_name:native.normalizedName,payload:'previous'}],[native]);assert.equal(p.updates.length,1);assert.equal(p.deletes.length,0);
 const lost=Array.from({length:600},(_,i)=>({...old,source_player_id:'name:unrelated '+i,normalized_name:'unrelated '+i}));assert.throws(()=>plan(lost,[native]),/deletions exceed safe limit/);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: absent complete source cannot retain aliases or apply a migration',()=>{
 assert.throws(()=>plan([old],[native],false),/source incomplete/);assert.equal(retainedNativeNameAliases([old],[{...native,sourcePlayerId:'7'}],{sourceComplete:true}).length,0);
});
test('native lookup is not made ambiguous by retained aliases; genuine homonyms still require an exact ID',()=>{
 const a={...old,source_player_id:id},b={...old,source_player_id:second};
 assert.equal(selectOpponentEntryProfiles([old,a])[0].source_player_id,id);assert.equal(selectOpponentEntryProfiles([old,a,b]).length,0);
 assert.equal(selectOpponentEntryProfiles([old,a,b],id.toUpperCase())[0].source_player_id,id);assert.equal(selectOpponentEntryProfiles([old,a],old.source_player_id)[0],old);
});
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gzipSync} from 'node:zlib';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('generator SQL preserves aliases, imports all three circuits, and identical replay applies zero SQLite changes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'entry-alias-'));const script=fileURLToPath(new URL('../scripts/generate-opponent-entry-seed.mjs',import.meta.url));
 try{
  await fs.mkdir(path.join(dir,'tmp/opponent-entries'),{recursive:true});
  const tournament={competitionId:'T1',startDate:'2026-10-01',endDate:'2026-10-20',tournamentName:'Example'};
  const docs={fitp_participant_cache:{tournaments:{T1:{...tournament,participants:[{membershipCard:'12345678',full1:'Fitp Person'},{membershipCard:'87654321',full1:'Retained Fitp Person'}]}}},itf_participant_cache:{participants:[{...tournament,worldTennisId:'800000001',name:'Itf Person'}]},tennis_europe_participant_cache:{status:'tennis_europe_participant_cache_complete',tournaments:{T1:{...tournament,participants:[{participantId:id,playerName:'Known Person'}]}}}};
  for(const [name,doc]of Object.entries(docs))await fs.writeFile(path.join(dir,'tmp/opponent-entries/'+name+'.json.gz'),gzipSync(JSON.stringify(doc)));
  await fs.writeFile(path.join(dir,'tmp/opponent-entries/itf_draw_target_db.json'),JSON.stringify({tournaments:{T1:{...tournament,eventCache:{'B-S-M-KO':{populated:true,players:[{id:'800000001',name:'Itf Person'}]}}}}}));
  const db=path.join(dir,'db.sqlite');
  const python=`import sqlite3,json,sys\nx=json.load(sys.stdin);c=sqlite3.connect(x['db']);c.execute('CREATE TABLE IF NOT EXISTS opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,display_name TEXT,payload TEXT,updated_at TEXT,PRIMARY KEY(circuit,source_player_id))');c.execute('CREATE TABLE IF NOT EXISTS app_state(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)');before=c.total_changes\nfor sql in x.get('sql',[]):c.executescript(sql)\nc.commit();c.row_factory=sqlite3.Row;print(json.dumps({'changes':c.total_changes-before,'rows':[dict(r) for r in c.execute('SELECT * FROM opponent_entry_profiles')]}))`;
  const execute=sql=>{const r=spawnSync('python3',['-c',python],{input:JSON.stringify({db,sql}),encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)};
  let state=execute(["INSERT INTO opponent_entry_profiles VALUES('tennis-europe','name:known person','known person','Known Person','old historical tournaments','old');"]);
  async function generate(){await fs.writeFile(path.join(dir,'tmp/opponent-entry-remote.json'),JSON.stringify(state));const r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);const sql=await Promise.all((await fs.readdir(path.join(dir,'seed-opponent-entries'))).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join(dir,'seed-opponent-entries',f),'utf8')));return{state:execute(sql),stdout:r.stdout}}
  let result=await generate();state=result.state;assert.equal(state.rows.length,5);const itfProfile=JSON.parse(state.rows.find(r=>r.source_player_id==='800000001').payload);assert.equal(itfProfile.tournaments[0].drawConfirmed,true);assert.equal(itfProfile.tournaments[0].entryStatus,'official_draw');assert.equal(state.rows.find(r=>r.source_player_id===old.source_player_id).payload,'old historical tournaments');assert.match(result.stdout,/"retainedLegacyAliases":1/);
  result=await generate();assert.equal(result.state.changes,0);assert.match(result.stdout,/"inserted":0,"changed":0,"deleted":0/);
  docs.fitp_participant_cache.tournaments.T1.participants=[{membershipCard:'87654321',full1:'Updated Fitp Person'}];
  await fs.writeFile(path.join(dir,'tmp/opponent-entries/fitp_participant_cache.json.gz'),gzipSync(JSON.stringify(docs.fitp_participant_cache)));
  result=await generate();state=result.state;
  assert.equal(state.rows.some(row=>row.circuit==='fitp'&&row.source_player_id==='12345678'),false);
  assert.equal(state.rows.find(row=>row.source_player_id==='87654321').display_name,'Updated Fitp Person');
  assert.match(result.stdout,/"inserted":0,"changed":1,"deleted":1/);
  const hash=await fs.readFile(path.join(dir,'seed-opponent-entries/hash.txt'),'utf8');
  // Preparation must succeed with no exported D1 state and emit no SQL.
  await fs.rm(path.join(dir,'tmp/opponent-entry-remote.json'));
  let prepared=spawnSync(process.execPath,[script,'--prepare'],{cwd:dir,encoding:'utf8'});
  assert.equal(prepared.status,0,prepared.stderr);
  assert.equal(await fs.readFile(path.join(dir,'seed-opponent-entries/hash.txt'),'utf8'),hash);
  assert.deepEqual(await fs.readdir(path.join(dir,'seed-opponent-entries')),['hash.txt']);
  // Execute the real workflow block: matching hash must never export profiles.
  const workflow=await fs.readFile(new URL('../../../.github/workflows/courtwatch-cloudflare-app-api.yml',import.meta.url),'utf8');
  const step=workflow.split('      - name: Build and import opponent tournament entries\n        run: |\n')[1].split('      - name:')[0].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  await fs.symlink(path.dirname(script),path.join(dir,'scripts'),'dir');
  const bin=path.join(dir,'bin');await fs.mkdir(bin);
  await fs.writeFile(path.join(bin,'npx'),`#!/usr/bin/env node\nconst fs=require('fs');const sql=process.argv.at(-1);if(sql!=="SELECT value FROM app_state WHERE key='opponentEntryHash'")throw Error('Unexpected D1 query: '+sql);process.stdout.write(JSON.stringify([{results:[{value:fs.readFileSync('seed-opponent-entries/hash.txt','utf8').trim()}]}]));\n`,{mode:0o755});
  const unchanged=spawnSync('bash',['-e','-c',step],{cwd:dir,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH},encoding:'utf8'});
  assert.equal(unchanged.status,0,unchanged.stderr);assert.match(unchanged.stdout,/OPPONENT_ENTRY_IMPORT_SKIPPED/);
  assert.equal((await fs.readdir(path.join(dir,'seed-opponent-entries'))).some(name=>name.endsWith('.sql')),false);

  await fs.writeFile(path.join(dir,'tmp/opponent-entry-remote.json'),JSON.stringify(state));
  // Reuse the prepared rows: no second decompression/rebuild of source inputs.
  await fs.rm(path.join(dir,'tmp/opponent-entries'),{recursive:true});
  prepared=spawnSync(process.execPath,[script,'--from-prepared'],{cwd:dir,encoding:'utf8'});
  assert.equal(prepared.status,0,prepared.stderr);
  const preparedSql=await fs.readFile(path.join(dir,'seed-opponent-entries/000.sql'),'utf8');
  assert.equal(execute([preparedSql]).changes,0);
  const savedPath=path.join(dir,'tmp/opponent-entry-desired.json'),saved=JSON.parse(await fs.readFile(savedPath,'utf8'));
  saved.rows[0].displayName='tampered';await fs.writeFile(savedPath,JSON.stringify(saved));
  prepared=spawnSync(process.execPath,[script,'--from-prepared'],{cwd:dir,encoding:'utf8'});
  assert.notEqual(prepared.status,0);assert.match(prepared.stderr,/checksum mismatch/);
  saved.complete=false;await fs.writeFile(savedPath,JSON.stringify(saved));
  prepared=spawnSync(process.execPath,[script,'--from-prepared'],{cwd:dir,encoding:'utf8'});
  assert.notEqual(prepared.status,0);assert.match(prepared.stderr,/source incomplete/);

 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
