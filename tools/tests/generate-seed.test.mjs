import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {database} from '../../cloudflare/app-api/test/search-sqlite-fixture.mjs';
const generator=fileURLToPath(new URL('../../cloudflare/app-api/scripts/generate-seed.mjs',import.meta.url));
async function fixture(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-seed-')),cwd=path.join(root,'cloudflare/app-api');await fs.mkdir(cwd,{recursive:true});
 const write=async(p,value)=>{const f=path.join(root,p);await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify(value));};
 const rows=Array.from({length:203},(_,i)=>({id:'t'+i,circuit:'fitp',sourceTournamentId:'source'+i,startDate:'2026-01-01',endDate:'2026-01-02',name:"d'Italia",source:{observedAt:'2026-01-01T00:00:00Z'}}));
 for(const name of ['players','entries','schedules','matches','results'])await write('dist/v3/universal/'+name+'.json',{[name]:[]});
 await write('dist/v3/universal/manifest.json',{version:'fixture',generatedAt:'2026-01-01',counts:{tournaments:203}});for(const p of ['data.json','players.json','dist/v3/tournaments.json'])await write(p,{});
 async function generate(value=rows){await write('dist/v3/universal/tournaments.json',{tournaments:value});const result=spawnSync(process.execPath,[generator],{cwd,env:{...process.env,D1_SKIP_OBSERVED:'1'},encoding:'utf8'});return result;}
 const sql=async()=>{const dir=path.join(cwd,'seed-universal');return(await Promise.all((await fs.readdir(dir)).filter(p=>p.endsWith('.sql')).sort().map(p=>fs.readFile(path.join(dir,p),'utf8')))).join('\n');};
 try{await fn({rows,generate,sql,root,cwd,write});}finally{await fs.rm(root,{recursive:true,force:true});}
}
test('D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES / D1_TEST_REAL_DELTAS_ONLY: actual generated seed retains all catalogue rows, skips identical tournament writes and updates one delta',()=>fixture(async({rows,generate,sql})=>{
 const d=database();try{let r=await generate();assert.equal(r.status,0,r.stderr);await d.query(await sql());assert.equal(d.execute('SELECT COUNT(*) AS n FROM tournaments')[0].n,203);
 // Track actual table writes independently from the generation-marker refresh.
 d.execute('CREATE TABLE tournament_changes(id TEXT)');d.execute('CREATE TRIGGER changed_tournament AFTER UPDATE ON tournaments BEGIN INSERT INTO tournament_changes VALUES(new.id); END');
 await d.query(await sql());assert.equal(d.execute('SELECT COUNT(*) AS n FROM tournament_changes')[0].n,0);
 const changed=rows.map((r,i)=>i===100?{...r,name:'New'}:r);r=await generate(changed);assert.equal(r.status,0,r.stderr);await d.query(await sql());assert.deepEqual(d.execute('SELECT id FROM tournament_changes'),[{id:'t100'}]);
 const value=JSON.parse(d.execute("SELECT payload FROM tournaments WHERE id='t0'")[0].payload);assert.deepEqual(value.source,{});
 }finally{d.close();}
}));
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: invalid catalogue identity stops seed generation before publish',()=>fixture(async({generate})=>{const r=await generate([{circuit:'fitp'}]);assert.notEqual(r.status,0);assert.match(r.stderr,/invalid_tournament_seed_row|invalid_cleanup_input/);}));

test('actual generator omits unchanged catalogue operations using only completed remote section hashes',()=>fixture(async({rows,generate,sql,write,cwd})=>{
 let r=await generate();assert.equal(r.status,0,r.stderr);const first=JSON.parse(r.stdout.trim());assert.equal(first.counts.seedPlanVersion,2);
 await write('remote-generation.json',[{results:[{counts_json:JSON.stringify(first.counts)}]}]);
 const before=process.env.D1_REMOTE_GENERATION_FILE;process.env.D1_REMOTE_GENERATION_FILE='../../remote-generation.json';
 try{r=await generate();assert.equal(r.status,0,r.stderr);let planned=await sql();assert.doesNotMatch(planned,/DELETE FROM tournaments|INSERT INTO tournaments/);assert.equal(JSON.parse(r.stdout.trim()).controlStatements,0);
  const changed=rows.map((r,i)=>i===100?{...r,name:'changed'}:r);r=await generate(changed);assert.equal(r.status,0,r.stderr);planned=await sql();assert.match(planned,/INSERT INTO tournaments/);assert.doesNotMatch(planned,/DELETE FROM entries|INSERT INTO players/);
 }finally{if(before===undefined)delete process.env.D1_REMOTE_GENERATION_FILE;else process.env.D1_REMOTE_GENERATION_FILE=before;}
}));

test('observation-only syncs keep stored timestamps and write no entries/tournaments; a real withdrawal or registration change writes only its row',()=>fixture(async({rows,generate,sql,write})=>{
 const d=database();
 const entries=Array.from({length:2},(_,i)=>({id:'e'+i,tournamentId:'t'+i,playerId:'p0',circuit:'fitp',state:'active',lastObservedAt:'2026-10-29T00:00:00Z',subscriptionRegistrations:[{category:'SM14',subscriptionDate:'2026-10-01'}]}));
 const app=Array.from({length:2},(_,i)=>({id:'app'+i,playerId:'p0',circuit:'fitp',competitionId:'source'+i,lastV3EntrySync:'2026-10-29T00:00:00Z',subscriptionRegistrations:[{category:'SM14',subscriptionDate:'2026-10-01'}]}));
 const inputs=async(e,t)=>{await write('dist/v3/universal/players.json',{players:[{id:'p0',displayName:'Case Player'}]});await write('players.json',{players:[{id:'p0',name:'Case Player'}]});await write('dist/v3/universal/entries.json',{entries:e});await write('dist/v3/tournaments.json',{tournaments:t});};
 try{
  await inputs(entries,app);let r=await generate(rows);assert.equal(r.status,0,r.stderr);const initial=JSON.parse(r.stdout).counts;await d.query(await sql());
  d.execute('CREATE TABLE observation_changes(kind TEXT,id TEXT)');
  d.execute("CREATE TRIGGER observation_entry_update AFTER UPDATE ON entries BEGIN INSERT INTO observation_changes VALUES('entry',new.id); END");
  d.execute("CREATE TRIGGER observation_tournament_update AFTER UPDATE ON app_tournaments BEGIN INSERT INTO observation_changes VALUES('tournament',new.competition_id); END");
  const newerEntries=entries.map(x=>({...x,lastObservedAt:'2026-10-30T22:00:00Z'})),newerApp=app.map(x=>({...x,lastV3EntrySync:'2026-10-30T22:00:00Z'}));
  await inputs(newerEntries,newerApp);r=await generate(rows);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).counts.importHash,initial.importHash);await d.query(await sql());assert.deepEqual(d.execute('SELECT * FROM observation_changes'),[]);
  assert.equal(JSON.parse(d.execute("SELECT payload FROM entries WHERE id='e0'")[0].payload).lastObservedAt,entries[0].lastObservedAt);
  assert.equal(JSON.parse(d.execute('SELECT payload FROM app_tournaments WHERE seq=1')[0].payload).lastV3EntrySync,app[0].lastV3EntrySync);
  newerEntries[1].state='withdrawn';newerApp[1].subscriptionRegistrations[0]={category:'SF14',subscriptionDate:'2026-10-02'};
  await inputs(newerEntries,newerApp);r=await generate(rows);assert.equal(r.status,0,r.stderr);assert.notEqual(JSON.parse(r.stdout).counts.importHash,initial.importHash);await d.query(await sql());
  assert.deepEqual(d.execute('SELECT * FROM observation_changes ORDER BY kind'),[{kind:'entry',id:'e1'},{kind:'tournament',id:'source1'}]);
  assert.equal(JSON.parse(d.execute("SELECT payload FROM entries WHERE id='e1'")[0].payload).lastObservedAt,newerEntries[1].lastObservedAt);
  assert.equal(d.execute("SELECT state FROM entries WHERE id='e1'")[0].state,'withdrawn');
  const before=d.execute('SELECT COUNT(*) AS n FROM observation_changes')[0].n;await d.query(await sql());assert.equal(d.execute('SELECT COUNT(*) AS n FROM observation_changes')[0].n,before);
  newerEntries.push({...entries[0],id:'e2',tournamentId:'t2'});newerApp.push({...app[0],id:'app2',competitionId:'source2'});
  await inputs(newerEntries,newerApp);r=await generate(rows);assert.equal(r.status,0,r.stderr);await d.query(await sql());assert.equal(d.execute("SELECT state FROM entries WHERE id='e2'")[0].state,'active');
  await inputs(newerEntries.filter(x=>x.id!=='e0'),newerApp.filter(x=>x.id!=='app0'));r=await generate(rows);assert.equal(r.status,0,r.stderr);await d.query(await sql());assert.deepEqual(d.execute('SELECT id FROM entries ORDER BY id'),[{id:'e1'},{id:'e2'}]);assert.deepEqual(d.execute('SELECT competition_id FROM app_tournaments ORDER BY seq'),[{competition_id:'source1'},{competition_id:'source2'}]);
  d.execute("UPDATE entries SET payload='invalid-json' WHERE id='e1'");d.execute("UPDATE app_tournaments SET payload='invalid-json' WHERE seq=1");await d.query(await sql());assert.equal(JSON.parse(d.execute("SELECT payload FROM entries WHERE id='e1'")[0].payload).state,'withdrawn');assert.equal(JSON.parse(d.execute('SELECT payload FROM app_tournaments WHERE seq=1')[0].payload).competitionId,'source1');

 }finally{d.close();}
}));
