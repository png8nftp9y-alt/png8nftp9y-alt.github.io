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
  const docs={fitp_participant_cache:{tournaments:{T1:{...tournament,participants:[{membershipCard:'12345678',full1:'Fitp Person'}]}}},itf_participant_cache:{participants:[{...tournament,worldTennisId:'800000001',name:'Itf Person'}]},tennis_europe_participant_cache:{status:'tennis_europe_participant_cache_complete',tournaments:{T1:{...tournament,participants:[{participantId:id,playerName:'Known Person'}]}}}};
  for(const [name,doc]of Object.entries(docs))await fs.writeFile(path.join(dir,'tmp/opponent-entries/'+name+'.json.gz'),gzipSync(JSON.stringify(doc)));
  const db=path.join(dir,'db.sqlite');
  const python=`import sqlite3,json,sys\nx=json.load(sys.stdin);c=sqlite3.connect(x['db']);c.execute('CREATE TABLE IF NOT EXISTS opponent_entry_profiles(circuit TEXT,source_player_id TEXT,normalized_name TEXT,display_name TEXT,payload TEXT,updated_at TEXT,PRIMARY KEY(circuit,source_player_id))');c.execute('CREATE TABLE IF NOT EXISTS app_state(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)');before=c.total_changes\nfor sql in x.get('sql',[]):c.executescript(sql)\nc.commit();c.row_factory=sqlite3.Row;print(json.dumps({'changes':c.total_changes-before,'rows':[dict(r) for r in c.execute('SELECT * FROM opponent_entry_profiles')]}))`;
  const execute=sql=>{const r=spawnSync('python',['-c',python],{input:JSON.stringify({db,sql}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)};
  let state=execute(["INSERT INTO opponent_entry_profiles VALUES('tennis-europe','name:known person','known person','Known Person','old historical tournaments','old');"]);
  async function generate(){await fs.writeFile(path.join(dir,'tmp/opponent-entry-remote.json'),JSON.stringify(state));const r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const sql=await Promise.all((await fs.readdir(path.join(dir,'seed-opponent-entries'))).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join(dir,'seed-opponent-entries',f),'utf8')));return{state:execute(sql),stdout:r.stdout}}
  let result=await generate();state=result.state;assert.equal(state.rows.length,4);assert.equal(state.rows.find(r=>r.source_player_id===old.source_player_id).payload,'old historical tournaments');assert.match(result.stdout,/"retainedLegacyAliases":1/);
  result=await generate();assert.equal(result.state.changes,0);assert.match(result.stdout,/"inserted":0,"changed":0,"deleted":0/);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
