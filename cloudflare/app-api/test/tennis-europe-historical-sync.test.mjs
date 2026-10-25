import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';

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
async function fixture(t,env){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'te-historical-sync-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const cwd=path.join(root,'cloudflare/app-api');await fs.mkdir(cwd,{recursive:true});await fs.mkdir(path.join(root,'dist/v3'),{recursive:true});
 const tournament={competitionId:'A',startDate:'2026-06-01',endDate:'2026-06-07'};
 const match=i=>({id:'match:'+i,competitionId:'A',date:'20260607',status:'completed',round:'Final',score:'W/O',winnerTeamIndex:0,winnerPlayerIds:['1'],teams:[['1'],['2']],players:[{id:'1',name:"O'Brien; A",nationality:'ITA'},{id:'2',name:'B',nationality:'ITA'}]});
 const historical={status:'green',tournaments:[tournament],matches:Array.from({length:201},(_,i)=>match(i))},live={status:'green',tournaments:[tournament],matches:[match(200)]};
 for(const [name,data] of [['historical',historical],['live',live]])await fs.writeFile(path.join(root,'dist/v3/tennis_europe_oop_'+name+'.json'),JSON.stringify(data));
 const generator=new URL('../scripts/generate-tennis-europe-oop-seed.mjs',import.meta.url);
 await fs.copyFile(generator,path.join(cwd,'generate.mjs'));
 const run=spawnSync(process.execPath,['generate.mjs'],{cwd,env:{...process.env,TE_INCREMENTAL:'1',TE_SYNC_HISTORICAL:'0',...env},encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const directory=path.join(cwd,'seed-tennis-europe-oop');
 const sql=[];for(const name of (await fs.readdir(directory)).filter(n=>n.endsWith('.sql')).sort())sql.push(await fs.readFile(path.join(directory,name),'utf8'));
 return {sql,match,tournament,manifest:JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'))};
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
