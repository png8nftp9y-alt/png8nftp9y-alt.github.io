// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {database} from './search-sqlite-fixture.mjs';
import {fullVerificationSql} from '../lib/d1-verification-counts.mjs';
test('real incremental OOP SQL replays without writes, updates exactly changed evidence and preserves verification counters',async()=>{
 const d=database({identityMapping:true,readChecks:true}),root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-oop-'));
 try{
  const cwd=path.join(root,'cloudflare/app-api'),dist=path.join(root,'dist/v3');await fs.mkdir(cwd,{recursive:true});await fs.mkdir(dist,{recursive:true});
  const tournament={competitionId:'TEST',name:'Test',startDate:'2026-10-21',endDate:'2026-10-21'};
  const match={id:'test-match',competitionId:'TEST',date:'2026-10-21',status:'completed',score:'6-1',players:[{id:'a',name:'A',nationality:'ITA'},{id:'b',name:'B',nationality:'ITA'}],winnerPlayerIds:['a'],winnerTeamIndex:0,teams:[['a'],['b']]};
  const historical={status:'green',tournaments:[],matches:[]},live={status:'green',tournaments:[tournament],matches:[match]};
  const generate=async()=>{for(const [name,doc] of [['historical',historical],['live',live]])await fs.writeFile(path.join(dist,'tennis_europe_oop_'+name+'.json'),JSON.stringify(doc));const r=spawnSync(process.execPath,[new URL('../scripts/generate-tennis-europe-oop-seed.mjs',import.meta.url).pathname],{cwd,env:{...process.env,TE_INCREMENTAL:'1'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);const dir=path.join(cwd,'seed-tennis-europe-oop');return(await Promise.all((await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join(dir,f),'utf8')))).join('\n')};
  let sql=await generate();assert.doesNotMatch(sql,/INSERT OR REPLACE/);await d.query(sql);
  const counts=()=>Object.fromEntries(d.execute('SELECT metric,value FROM d1_verification_totals').map(r=>[r.metric,r.value]));
  assert.deepEqual(counts(),d.execute(fullVerificationSql)[0]);const before=d.writes();await d.query(await generate());assert.equal(d.writes(),before);
  match.score='6-2';await d.query(await generate());assert.deepEqual(counts(),d.execute(fullVerificationSql)[0]);assert.match(d.execute("SELECT payload FROM matches WHERE id='test-match'")[0].payload,/6-2/);
  Object.assign(match,{score:'6-0 3-0',retirementChecked:true,retired:true,retirementSource:'official_match_message',retirementLabel:'Retired',retirementSourceUrl:'https://te.tournamentsoftware.com/tournament/TEST/matches/20261021'});
  await d.query(await generate());
  for(const table of ['matches','results']){const stored=JSON.parse(d.execute('SELECT payload FROM '+table)[0].payload);assert.equal(stored.retired,true);assert.equal(stored.retirementSource,'official_match_message');}
  const afterRetirement=d.writes();await d.query(await generate());assert.equal(d.writes(),afterRetirement);
  const registry={players:[{id:'a',name:'A',circuits:['Tennis Europe']}]};await fs.writeFile(path.join(root,'players.json'),JSON.stringify(registry));await fs.writeFile(path.join(dist,'manual_matches.json'),JSON.stringify({matches:[]}));
  const appLive={...live,matches:Array.from({length:149},(_,i)=>({...match,id:'app-'+i,time:'10:00',court:'Court 1',courtMatchNumber:i+1,event:'BS14 - Boys Singles 14 Main Draw',round:'Final',sourceUrl:'https://te.tournamentsoftware.com/tournament/TEST/matches/20261021'}))};await fs.writeFile(path.join(dist,'tennis_europe_oop_live.json'),JSON.stringify(appLive));
  const app=spawnSync(process.execPath,[new URL('../scripts/generate-tennis-europe-app-candidates.mjs',import.meta.url).pathname],{cwd,env:{...process.env,TE_INCREMENTAL:'1'},encoding:'utf8'});assert.equal(app.status,0,app.stderr);
  const appSql=await fs.readFile(path.join(cwd,'seed-tennis-europe-oop/05-app-matches.sql'),'utf8');assert.match(appSql,/"retired":true/);assert.match(appSql,/"retirementSource":"official_match_message"/);
  live.status='incomplete';for(const [name,doc] of [['historical',historical],['live',live]])await fs.writeFile(path.join(dist,'tennis_europe_oop_'+name+'.json'),JSON.stringify(doc));const failed=spawnSync(process.execPath,[new URL('../scripts/generate-tennis-europe-oop-seed.mjs',import.meta.url).pathname],{cwd,encoding:'utf8'});assert.notEqual(failed.status,0);
 }finally{d.close();await fs.rm(root,{recursive:true,force:true})}
});
test('verified undated draw result reaches matches/results/participants, creates no schedule, replay writes zero',async()=>{
 const {parseDrawResults}=await import('../../../src/v3/tennis-europe-draw-results.mjs');
 const id='F065F194-9CF9-46A7-92C9-E97A47ECA6EA',html=JSON.parse(await fs.readFile(new URL('../../../src/v3/fixtures/europe-draw-results/pages.json',import.meta.url),'utf8'))['romania-first.html'];
 const match=parseDrawResults({html,competitionId:id,drawId:'1',event:'BS14 Main Draw',sourceUrl:`https://te.tournamentsoftware.com/tournament/${id}/Draw/1/GetMatchesContent?tabindex=1`,startDate:'2026-02-14',endDate:'2026-02-22',allowUndated:true,asOf:'2026-11-04'}).matches.find(m=>m.round==='Final');
 const d=database({identityMapping:true,readChecks:true}),root=await fs.mkdtemp(path.join(os.tmpdir(),'cw-undated-'));
 try{
 const cwd=path.join(root,'cloudflare/app-api'),dist=path.join(root,'dist/v3');await fs.mkdir(cwd,{recursive:true});await fs.mkdir(dist,{recursive:true});
 const historical={status:'green',tournaments:[{competitionId:id,tournamentName:'Romania',startDate:'2026-02-14',endDate:'2026-02-22'}],matches:[match]},live={status:'green',tournaments:[],matches:[]};
 const generate=async()=>{for(const [n,x] of [['historical',historical],['live',live]])await fs.writeFile(path.join(dist,'tennis_europe_oop_'+n+'.json'),JSON.stringify(x));const r=spawnSync(process.execPath,[new URL('../scripts/generate-tennis-europe-oop-seed.mjs',import.meta.url).pathname],{cwd,env:{...process.env,TE_SYNC_HISTORICAL:'1'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);const dir=path.join(cwd,'seed-tennis-europe-oop');return(await Promise.all((await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join(dir,f),'utf8')))).join('\n');};
 await d.query(await generate());assert.equal(d.execute('SELECT COUNT(*) AS n FROM matches')[0].n,1);assert.equal(d.execute('SELECT COUNT(*) AS n FROM results')[0].n,1);assert.equal(d.execute('SELECT COUNT(*) AS n FROM match_participants')[0].n,2);assert.equal(d.execute('SELECT COUNT(*) AS n FROM schedules')[0].n,0);const stored=JSON.parse(d.execute('SELECT payload FROM matches')[0].payload);assert.equal(stored.date,'');assert.equal(stored.dateSource,'official_draw_undated');assert.deepEqual(stored.winnerPlayerIds,['90']);
 const before=d.writes();await d.query(await generate());assert.equal(d.writes(),before);assert.deepEqual(Object.fromEntries(d.execute('SELECT metric,value FROM d1_verification_totals').map(r=>[r.metric,r.value])),d.execute(fullVerificationSql)[0]);
 const manifest=JSON.parse(await fs.readFile(path.join(cwd,'seed-tennis-europe-oop/manifest.json'),'utf8'));assert.equal(manifest.counts.matches,1);assert.equal(manifest.counts.schedules,0);
 await fs.writeFile(path.join(root,'players.json'),JSON.stringify({players:[{id:'farkxodov',name:'Saidaslam FARKXODOV',circuits:['Tennis Europe']}]}));await fs.writeFile(path.join(dist,'manual_matches.json'),JSON.stringify({matches:[]}));
 await fs.writeFile(path.join(dist,'tennis_europe_oop_live.json'),JSON.stringify({...live,matches:Array.from({length:149},(_,i)=>({...match,id:'dated-app-'+i,date:'2026-02-16',time:'10:00',court:'Court 1',courtMatchNumber:i+1}))}));
 const app=spawnSync(process.execPath,[new URL('../scripts/generate-tennis-europe-app-candidates.mjs',import.meta.url).pathname],{cwd,env:{...process.env,TE_INCREMENTAL:'1'},encoding:'utf8'});assert.equal(app.status,0,app.stderr);const agenda=JSON.parse(await fs.readFile(path.join(cwd,'seed-tennis-europe-oop/app-match-candidates-manifest.json'),'utf8'));assert.equal(agenda.counts.playerMatchOccurrences,149);const appSql=await fs.readFile(path.join(cwd,'seed-tennis-europe-oop/05-app-matches.sql'),'utf8');assert(!appSql.includes(match.id));

 }finally{d.close();await fs.rm(root,{recursive:true,force:true});}
});
