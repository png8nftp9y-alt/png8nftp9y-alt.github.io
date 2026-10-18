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
