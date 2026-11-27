import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const common=new URL('./itf-common.mjs',import.meta.url).href;
const merger=fileURLToPath(new URL('./merge-itf-tournament-shards.mjs',import.meta.url));
const clock=`const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[process.env.TEST_CLOCK]));}static now(){return new RealDate(process.env.TEST_CLOCK).getTime();}};`;
function run(code,env,cwd){return spawnSync(process.execPath,['--input-type=module','-e',clock+code],{cwd,env:{...process.env,ITF_COVERAGE_FROM:'',ITF_PAST_DAYS:'240',ITF_HORIZON_DAYS:'730',GITHUB_OUTPUT:'',...env},encoding:'utf8'});}
test('original run creation pins Rome coverage across midnight and later attempts; generatedAt stays current',()=>{
 for(const now of ['2026-11-26T22:00:00Z','2026-11-27T02:57:33Z','2026-11-28T12:00:00Z']){
  const r=run(`const x=await import(${JSON.stringify(common)});console.log(JSON.stringify({day:x.TODAY,from:x.FROM,now:x.NOW}));`,{TEST_CLOCK:now,ITF_CALENDAR_RUN_CREATED_AT:'2026-11-26T21:53:09Z'});
  assert.equal(r.status,0,r.stderr);const d=JSON.parse(r.stdout);assert.equal(d.day,'2026-11-26');assert.equal(d.from,'2026-03-31');assert.equal(d.now,new Date(now).toISOString());
 }
 const code=`const x=await import(${JSON.stringify(common)});console.log(x.TODAY);`;
 assert.equal(run(code,{TEST_CLOCK:'2026-11-27T02:57:33Z',ITF_CALENDAR_RUN_CREATED_AT:''}).stdout.trim(),'2026-11-27');
 assert.equal(run(code,{TEST_CLOCK:'2026-11-27T02:57:33Z',ITF_CALENDAR_RUN_CREATED_AT:'2026-11-26T23:30:00Z'}).stdout.trim(),'2026-11-27');
});
test('real merge accepts the original complete window after midnight and retains mixed/missing guards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'itf-calendar-window-'));
 try{
  await mkdir(join(dir,'dist/v3/shards/itf'),{recursive:true});
  const regions=['europe','americas','asia_pacific','africa_middle_east','other'];
  for(const region of regions)await writeFile(join(dir,`dist/v3/shards/itf/tournaments-${region}.json`),JSON.stringify({shard:region,status:'itf_tournament_region_shard_complete',generatedAt:'2026-11-26T22:00:00Z',coverageFrom:'2026-03-31',coverageUntil:'2028-11-25',tournaments:Array.from({length:20},(_,i)=>({competitionId:`${region}-${i}`,name:'Test',startDate:'2026-12-01',endDate:'2026-12-07'})),errors:[]}));
  const env={TEST_CLOCK:'2026-11-27T02:57:33Z',ITF_CALENDAR_RUN_CREATED_AT:'2026-11-26T21:53:09Z'};
  const execute=()=>run(`await import(${JSON.stringify(new URL('file://'+merger).href)});`,env,dir);
  let result=execute();assert.equal(result.status,0,result.stderr+result.stdout);let map=JSON.parse(await readFile(join(dir,'dist/v3/source_itf_tournaments.json'),'utf8'));assert.equal(map.tournaments.length,100);assert.equal(map.coverageUntil,'2028-11-25');
  const path=join(dir,'dist/v3/shards/itf/tournaments-other.json'),data=JSON.parse(await readFile(path,'utf8'));data.coverageFrom='2026-04-01';data.coverageUntil='2028-11-26';await writeFile(path,JSON.stringify(data));result=execute();assert.equal(result.status,2);assert.match(result.stdout,/inconsistent_rolling_coverage/);
  await rm(path);result=execute();assert.equal(result.status,2);assert.match(result.stdout,/missing_shard/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
