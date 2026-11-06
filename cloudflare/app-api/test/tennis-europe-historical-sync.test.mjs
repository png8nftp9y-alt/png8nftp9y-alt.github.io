import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {sourceUnits,planDelta,decodeReceipts,receiptFiles,prefix} from '../lib/tennis-europe-import-delta.mjs';
import {validateFile} from '../scripts/import-tennis-europe-query.mjs';

const schema=`
CREATE TABLE tournaments(id PRIMARY KEY,circuit,source_tournament_id,start_date,end_date,payload);
CREATE TABLE matches(id PRIMARY KEY,tournament_id,circuit,played_date,payload);
CREATE TABLE tennis_europe_players(identity_key PRIMARY KEY,display_name,normalized_name,nationality,occurrences,first_match_date,last_match_date,payload);
CREATE TABLE schedules(id PRIMARY KEY,tournament_id,match_id,circuit,local_date,payload);
CREATE TABLE results(id PRIMARY KEY,tournament_id,match_id,circuit,played_date,payload);
CREATE TABLE match_participants(match_id,participant_key,source_player_id,display_name,normalized_name,nationality,team_index,is_winner,payload,PRIMARY KEY(match_id,participant_key));
CREATE TABLE tennis_europe_changed_matches(id PRIMARY KEY);
CREATE TABLE app_match_candidates(match_id);
CREATE TABLE app_state(key PRIMARY KEY,value,updated_at);
CREATE TABLE mutations(kind);
`;
async function fixture(t,env,liveCount=1,edit=()=>{}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'te-historical-sync-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const cwd=path.join(root,'cloudflare/app-api');await fs.mkdir(cwd,{recursive:true});await fs.mkdir(path.join(root,'dist/v3'),{recursive:true});
 const tournament={competitionId:'A',startDate:'2026-06-01',endDate:'2026-06-07'};
 const match=i=>({id:'match:'+i,competitionId:'A',date:'20260607',status:'completed',round:'Final',score:'W/O',winnerTeamIndex:0,winnerPlayerIds:['1'],teams:[['1'],['2']],players:[{id:'1',name:"O'Brien; A",nationality:'ITA'},{id:'2',name:'B',nationality:'ITA'}]});
 const historical={status:'green',tournaments:[tournament],matches:Array.from({length:201},(_,i)=>match(i))},live={status:'green',tournaments:[tournament],matches:Array.from({length:liveCount},(_,i)=>match(200+i))};
 edit(historical,live);
 for(const [name,data] of [['historical',historical],['live',live]])await fs.writeFile(path.join(root,'dist/v3/tennis_europe_oop_'+name+'.json'),JSON.stringify(data));
 const generator=new URL('../scripts/generate-tennis-europe-oop-seed.mjs',import.meta.url);
 await fs.mkdir(path.join(cwd,'scripts'),{recursive:true});
 await fs.mkdir(path.join(root,'src/v3'),{recursive:true});
 await fs.copyFile(new URL('../../../src/v3/tennis-europe-retirement.mjs',import.meta.url),path.join(root,'src/v3/tennis-europe-retirement.mjs'));
 for(const name of ['tennis-europe-draw-results.mjs','tennis-europe-metadata.mjs'])await fs.copyFile(new URL('../../../src/v3/'+name,import.meta.url),path.join(root,'src/v3',name));
 await fs.copyFile(generator,path.join(cwd,'scripts/generate.mjs'));
 const run=spawnSync(process.execPath,['scripts/generate.mjs'],{cwd,env:{...process.env,TE_INCREMENTAL:'1',TE_SYNC_HISTORICAL:'0',...env},encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const directory=path.join(cwd,'seed-tennis-europe-oop');
 const files={};for(const name of (await fs.readdir(directory)).filter(n=>n.endsWith('.sql')).sort())files[name]=await fs.readFile(path.join(directory,name),'utf8');
 return {files,sql:Object.values(files),match,tournament,manifest:JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'))};
}
test('ordinary runs continue to select live matches only',async t=>{
 const f=await fixture(t,{});assert.equal(f.manifest.incremental,true);assert.equal(f.manifest.historicalSync,false);assert.equal(f.manifest.imported.matches,1);
 assert.deepEqual(f.sql[0].trim(),'PRAGMA foreign_keys=ON;');
});
test('full archive repairs missing children and preserves existing and unrelated data; replay writes no domain rows',async t=>{
 const f=await fixture(t,{TE_SYNC_HISTORICAL:'1'}),db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(schema);
 for(const table of ['tournaments','matches','tennis_europe_players','schedules','results','match_participants','app_match_candidates','app_state'])for(const action of ['INSERT','UPDATE','DELETE'])db.exec(`CREATE TRIGGER watch_${table}_${action} AFTER ${action} ON ${table} BEGIN INSERT INTO mutations VALUES('${table}:${action}'); END;`);
 const m=f.match(0);
 db.prepare('INSERT INTO matches VALUES(?,?,?,?,?)').run(m.id,'te-oop:A','tennis-europe','2026-06-07',JSON.stringify(m));
 db.prepare('INSERT INTO matches VALUES(?,?,?,?,?)').run('unrelated','other','fitp','2026-06-07','{}');
 db.prepare('INSERT INTO tournaments VALUES(?,?,?,?,?,?)').run('unrelated','fitp','other','','','{}');
 assert.equal(f.manifest.imported.matches,201);assert.equal(f.manifest.historicalSync,true);
 for(const sql of f.sql){const n=(sql.match(/INSERT OR IGNORE INTO tennis_europe_changed_matches/g)||[]).length;assert.ok(n<=25,'historical batch exceeds 25 matches');}
 assert.equal(f.sql[0].trim(),'PRAGMA foreign_keys=ON;');
 const apply=()=>{for(const sql of f.sql)db.exec('BEGIN;\n'+sql+'\nCOMMIT;');};apply();
 assert.equal(db.prepare("SELECT count(*) n FROM matches WHERE circuit='tennis-europe'").get().n,201);
 for(const table of ['results','schedules'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,201);
 assert.equal(db.prepare('SELECT count(*) n FROM match_participants').get().n,402);
 assert.ok(db.prepare("SELECT id FROM matches WHERE id='unrelated'").get());assert.ok(db.prepare("SELECT id FROM tournaments WHERE id='unrelated'").get());
 db.exec('DELETE FROM mutations');apply();assert.equal(db.prepare('SELECT count(*) n FROM mutations').get().n,0);
 // Repair an otherwise unchanged match with a missing result.
 db.exec("DELETE FROM results WHERE match_id='match:0'; DELETE FROM mutations;");apply();
 assert.equal(db.prepare("SELECT count(*) n FROM results WHERE match_id='match:0'").get().n,1);
 assert.equal(db.prepare("SELECT count(*) n FROM mutations WHERE kind='matches:DELETE'").get().n,0);
});
test('legacy full mode also uses guarded sync and emits no archive reset',async t=>{
 const f=await fixture(t,{TE_INCREMENTAL:'0'});assert.equal(f.manifest.incremental,true);assert.equal(f.manifest.historicalSync,true);assert.equal(f.manifest.imported.matches,201);assert.equal(f.sql[0].trim(),'PRAGMA foreign_keys=ON;');
});

test('ordinary live imports bound each atomic request to 25 matches and preserve every child and zero-write replay',async t=>{
 const f=await fixture(t,{},201),db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(schema);
 assert.equal(f.manifest.historicalSync,false);assert.equal(f.manifest.imported.matches,201);
 const batches=f.sql.filter(sql=>sql.includes('DELETE FROM tennis_europe_changed_matches;'));
 assert.ok(batches.length>0);
 for(const sql of batches){const count=(sql.match(/INSERT OR IGNORE INTO tennis_europe_changed_matches/g)||[]).length;assert.ok(count<=25,'live atomic request exceeds 25 matches');assert.ok(sql.includes('DELETE FROM match_participants WHERE match_id IN'));assert.ok(sql.includes('INSERT INTO matches'));}
 for(const table of ['tournaments','matches','tennis_europe_players','schedules','results','match_participants','app_match_candidates','app_state'])for(const action of ['INSERT','UPDATE','DELETE'])db.exec(`CREATE TRIGGER watch_${table}_${action} AFTER ${action} ON ${table} BEGIN INSERT INTO mutations VALUES('${table}:${action}'); END;`);
 const apply=()=>{for(const sql of f.sql)db.exec('BEGIN;\n'+sql+'\nCOMMIT;');};apply();
 assert.equal(db.prepare('SELECT count(*) n FROM matches').get().n,201);
 for(const table of ['results','schedules'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,201);
 assert.equal(db.prepare('SELECT count(*) n FROM match_participants').get().n,402);
 db.exec('DELETE FROM mutations');apply();assert.equal(db.prepare('SELECT count(*) n FROM mutations').get().n,0);
 // The match change detection, cleanup and insertion stay one transaction.
 const fresh=new DatabaseSync(':memory:');try{fresh.exec(schema);assert.throws(()=>fresh.exec('BEGIN;'+batches[0]+'INSERT INTO missing_table VALUES(1);COMMIT;'));fresh.exec('ROLLBACK;');assert.equal(fresh.prepare('SELECT count(*) n FROM matches').get().n,0);assert.equal(fresh.prepare('SELECT count(*) n FROM tennis_europe_changed_matches').get().n,0);}finally{fresh.close();}
});

function applyFiles(db,files){for(const [name,sql]of Object.entries(files).sort(([a],[b])=>a.localeCompare(b))){validateFile(sql,name);db.exec('BEGIN;\n'+sql+'\nCOMMIT;');}}
function receipts(db){return decodeReceipts(db.prepare('SELECT key,value FROM app_state WHERE key GLOB ?').all(prefix+'*'));}
function queryFixture(db){const queries=[];return{queries,query:async(sql,params)=>{assert.match(sql,/^WITH wanted AS /);assert.equal(params.length,1);queries.push(sql);return db.prepare(sql).all(...params)}};}
test('verified historical baseline, missing child recovery, zero unchanged imports, one changed match and interrupted revert',async t=>{
 const f=await fixture(t,{TE_SYNC_HISTORICAL:'1'}),db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(schema);applyFiles(db,f.files);
 db.exec("DELETE FROM results WHERE id='result:match:17'");
 const units=sourceUnits(f.files),checks=queryFixture(db),initial=await planDelta(units,new Map(),checks.query);
 assert.equal(initial.stats.selectedMatches,1);assert.equal(initial.stats.importFiles,1);
 assert.match(Object.values(initial.files)[0],/VALUES\('match:17'\)/);assert.doesNotMatch(Object.values(initial.files)[0],/VALUES\('match:18'\)/);
 applyFiles(db,initial.files);assert.equal(db.prepare('SELECT count(*) AS n FROM results').get().n,201);
 applyFiles(db,receiptFiles(initial.invalidated,initial.next));const verified=receipts(db);
 const unchanged=await planDelta(units,verified,()=>{throw Error('unchanged sources must not query domain rows')});
 assert.deepEqual(unchanged.files,{});assert.deepEqual(receiptFiles(verified,unchanged.next),{});
 const changed=await fixture(t,{TE_SYNC_HISTORICAL:'1'},1,h=>{h.matches[17].score='6-0 6-0'});
 const delta=await planDelta(sourceUnits(changed.files),verified,()=>{throw Error('known changed fingerprint needs no probe')});
 assert.equal(delta.stats.selectedMatches,1);assert.equal(delta.stats.importFiles,1);
 applyFiles(db,receiptFiles(verified,delta.invalidated));applyFiles(db,delta.files);
 assert.equal(JSON.parse(db.prepare("SELECT payload FROM results WHERE id='result:match:17'").get().payload).score,'6-0 6-0');
 // Simulate interruption after the write, before parity: the old receipt is gone.
 const reverted=await planDelta(units,receipts(db),checks.query);
 assert.equal(reverted.stats.comparedD1,1);assert.equal(reverted.stats.selectedMatches,1);applyFiles(db,reverted.files);
 assert.equal(JSON.parse(db.prepare("SELECT payload FROM results WHERE id='result:match:17'").get().payload).score,'W/O');
});
test('live receipts and full historical receipts use the same match key and content; explicit audit repairs missing children',async t=>{
 const full=await fixture(t,{TE_SYNC_HISTORICAL:'1'}),live=await fixture(t,{}),db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(schema);applyFiles(db,full.files);
 const units=sourceUnits(full.files),liveMatch=sourceUnits(live.files).find(u=>u.kind==='match');
 assert.equal(units.find(u=>u.key===liveMatch.key).fingerprint,liveMatch.fingerprint);
 const first=await planDelta(units,new Map(),queryFixture(db).query);assert.deepEqual(first.files,{});
 db.exec("DELETE FROM schedules WHERE id='oop:match:20'");
 const audit=await planDelta(units,first.next,queryFixture(db).query,{fullCheck:true});assert.equal(audit.stats.selectedMatches,1);applyFiles(db,audit.files);
 assert.equal(db.prepare('SELECT count(*) AS n FROM schedules').get().n,201);
});
test('an invalid or failed read cannot select a destructive fallback import',async t=>{
 const full=await fixture(t,{TE_SYNC_HISTORICAL:'1'}),units=sourceUnits(full.files);
 await assert.rejects(planDelta(units,new Map(),async()=>{throw Error('D1 unavailable')}),/D1 unavailable/);
 await assert.rejects(planDelta(units,new Map(),async()=>[{key:'unexpected'}]),/INVALID_PROBE/);
});
