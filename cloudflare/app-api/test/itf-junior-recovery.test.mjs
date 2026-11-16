import {database} from './itf-junior-recovery-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {recoveryPlan,rankingCycle,failedCategory,RETRY_MS} from '../lib/itf-junior-recovery.mjs';
import {publication,digest,sqlBatches,snapshotChunks} from '../lib/itf-junior-ranking-batch.mjs';
import {publishRecovery} from '../lib/itf-junior-ranking-publish.mjs';
const start='2026-11-10T18:17:00.000Z',cycle=rankingCycle(start);
const base=(category,phase='complete')=>({category,cycle_key:cycle,phase});
const row=(id,rank=1)=>({playerId:id,rank,points:50/rank,playerGivenName:"D'Angelo",playerFamilyName:'Example',playerNationalityCode:'ITA',gender:'M'});
const acquired=(task,items)=>({...task,status:'acquired',rankingDate:'2026-11-09',items,total:items.length,capturedAt:start});

test('normal cycles match Europe Monday/Tuesday 18:17 UTC, including week/year boundary',()=>{
 assert.equal(rankingCycle('2026-11-09T18:16:59Z'),'2026-11-03T18:17:00.000Z');
 assert.equal(rankingCycle('2026-11-09T18:17:00Z'),'2026-11-09T18:17:00.000Z');
 assert.equal(rankingCycle('2026-11-10T18:17:00Z'),cycle);
 assert.equal(rankingCycle('2027-01-01T12:00:00Z'),'2026-12-29T18:17:00.000Z');
});
test('retry only failed category after one hour; successful category untouched; no retry cap',()=>{
 let now=start;const states=[{...base('B','failed'),next_retry_at:'2026-11-10T19:17:00.000Z'},base('G')];
 assert.deepEqual(recoveryPlan(states,'2026-11-10T19:16:59Z'),[]);
 for(let attempt=0;attempt<24;attempt++){
  now=new Date(Date.parse('2026-11-10T19:17:00Z')+attempt*RETRY_MS).toISOString();
  const tasks=recoveryPlan(states,now);assert.equal(tasks.length,1);assert.equal(tasks[0].category,'B');assert.equal(tasks[0].action,'acquire');
  states[0].next_retry_at=failedCategory(tasks[0],now,'source failure').nextRetryAt;
 }
 assert.deepEqual(recoveryPlan([base('B'),base('G')],now),[]);
});
test('saved complete source retries import; a new ordinary cycle checks both categories',()=>{
 const tasks=recoveryPlan([{...base('B','acquired'),next_retry_at:start,content_hash:'hash'},base('G')],start);
 assert.equal(tasks.length,1);assert.equal(tasks[0].action,'import');
 assert.deepEqual(recoveryPlan([base('B'),base('G')],'2026-11-16T18:17:00Z').map(t=>[t.category,t.action]),[['B','acquire'],['G','acquire']]);
 assert.equal(recoveryPlan([base('B'),base('G')],start,{force:true}).length,2);
});
test('Boys acquisition failure still publishes Girls; next plan contains Boys only; completion stops recoveries',async()=>{
 const d=database();try{
  const tasks=recoveryPlan([],start),plan={tasks,startedAt:start};
  const results={B:failedCategory(tasks[0],start,'incapsula_challenge'),G:acquired(tasks[1],[row(800000002)])};
  const first=await publishRecovery(plan,{...d,readResult:async c=>results[c]});assert.equal(first.success,false);
  assert.deepEqual(first.states.map(s=>[s.category,s.phase]),[['B','failed'],['G','complete']]);
  const before=await d.query("SELECT * FROM itf_junior_ranking_publications WHERE category='G'");
  const next=recoveryPlan(first.states,'2026-11-10T19:17:00Z');assert.equal(next.length,1);assert.equal(next[0].category,'B');
  const second=await publishRecovery({tasks:next,startedAt:'2026-11-10T19:17:00Z'},{...d,readResult:async t=>{assert.equal(t,'B');return acquired(next[0],[row(800000001)]);}});
  assert.equal(second.success,true);assert.deepEqual(await d.query("SELECT * FROM itf_junior_ranking_publications WHERE category='G'"),before);
  assert.deepEqual(recoveryPlan(second.states,'2026-11-10T20:17:00Z'),[]);
 }finally{d.close();}
});
test('interrupted D1 import retains cached source and previous complete publication; next attempt imports cache without reacquiring',async()=>{
 const d=database();try{
  const tasks=recoveryPlan([],start);await publishRecovery({tasks,startedAt:start},{...d,readResult:async c=>acquired(tasks.find(t=>t.category===c),[row(c==='B'?800000001:800000002)])});
  const task={category:'B',cycle,action:'acquire'};let interrupted=false;
  const execute=async statements=>{
   if(!interrupted&&statements.some(s=>s.startsWith('INSERT INTO itf_junior_ranking_publications'))){interrupted=true;await d.execute(statements.slice(0,2));throw Error('D1 unavailable after partial import');}
   return d.execute(statements);
  };
  const first=await publishRecovery({tasks:[task],startedAt:start},{query:d.query,execute,readResult:async()=>acquired(task,[row(800000001,9),row(800000003,10)])});assert.equal(first.success,false);
  const stored=(await d.query("SELECT * FROM itf_junior_ranking_recovery WHERE category='B'"))[0];assert.equal(stored.phase,'acquired');
  assert.equal((await d.query("SELECT expected_count FROM itf_junior_ranking_publications WHERE category='B' AND complete=1"))[0].expected_count,1);
  const tasks2=recoveryPlan(await d.query('SELECT * FROM itf_junior_ranking_recovery'),'2026-11-10T19:17:00Z');assert.equal(tasks2[0].action,'import');
  const chunks=await d.query('SELECT data FROM itf_junior_ranking_recovery_chunks WHERE category=? AND snapshot_hash=? ORDER BY seq',['B',stored.snapshot_hash]);
  const saved=chunks.map(c=>c.data).join('');assert.equal(digest(saved),stored.snapshot_hash);
  const second=await publishRecovery({tasks:tasks2,startedAt:'2026-11-10T19:17:00Z',snapshots:{B:{json:saved,hash:stored.snapshot_hash}}},{...d,readResult:async()=>{throw Error('Result artifact missing; use durable D1 cache');}});
  assert.equal(second.success,true);
  assert.ok((await d.query("SELECT expected_count FROM itf_junior_ranking_publications WHERE category='B' AND complete=1")).some(p=>p.expected_count===2));
 }finally{d.close();}
});
test('invalid or partial ranking cannot generate publication SQL; identical import writes zero rows',async()=>{
 assert.throws(()=>publication('B','2026-11-09',[row(800000001)],2,start),/incomplete/);
 assert.throws(()=>publication('B','2026-11-09',[row(800000001),row(800000001)],2,start),/duplicate/);
 const d=database();try{
  const p=publication('B','2026-11-09',[row(800000001)],1,start);await d.execute(p.statements);assert.equal((await d.execute(p.statements)).changes,0);
 }finally{d.close();}
});

test('multibyte checkpoints survive chunk boundaries; SQL batches stay below D1 byte limits',()=>{
 const text='a'.repeat(23999)+'🎾'+"D'Angelo".repeat(10000);const chunks=snapshotChunks(text);assert.equal(chunks.join(''),text);assert.equal(digest(chunks.join('')),digest(text));
 const statements=Array.from({length:1600},()=>"SELECT '"+'é'.repeat(900)+"';");const batches=sqlBatches(statements);
 assert.ok(batches.length>1);assert.equal(batches.flat().length,statements.length);
 for(const batch of batches){assert.ok(batch.length<=400);assert.ok(Buffer.byteLength(batch.join('\n')+'\n')<=1000000);}
});
test('both source failures and an interrupted source job never produce a successful import or erase history',async()=>{
 const d=database();try{
  const tasks=recoveryPlan([],start);
  await d.execute(publication('G','2026-11-02',[row(800000002)],1,start).statements);
  const result=await publishRecovery({tasks,startedAt:start},{...d,readResult:async category=>{if(category==='B')throw Error('Runner interrupted');return failedCategory(tasks[1],start,'HTTP 503');}});
  assert.equal(result.success,false);assert.equal(result.states.filter(s=>s.phase==='failed').length,2);
  assert.equal((await d.query("SELECT COUNT(*) AS total FROM itf_junior_ranking_publications WHERE complete=1"))[0].total,1);
  assert.equal(recoveryPlan(result.states,'2026-11-10T19:17:00Z').length,2);
 }finally{d.close();}
});
test('workflow acquires categories independently outside D1 lease and imports under the shared lease only when work is due',()=>{
 const flow=readFileSync(new URL('../../../.github/workflows/courtwatch-itf-junior-rankings.yml',import.meta.url),'utf8');
 assert.match(flow,/cron: '17 \* \* \* \*'/);assert.match(flow,/fail-fast: false/);
 const acquire=flow.slice(flow.indexOf('  acquire:'),flow.indexOf('  publish:'));
 assert.doesNotMatch(acquire,/courtwatch-d1-writes/);assert.match(acquire,/ITF_CATEGORY: \$\{\{ matrix.category \}\}/);
 assert.match(flow,/group: courtwatch-d1-writes\n      cancel-in-progress: false/);
 assert.match(flow,/needs.plan.outputs.due == 'true'/);assert.match(flow,/pending-status:/);
});

test('new week cannot discard an already acquired publication awaiting import',()=>{
 const states=[{...base('B','acquired'),content_hash:'retained',next_retry_at:start},base('G')];
 const next=recoveryPlan(states,'2026-11-16T18:17:00Z');
 assert.equal(next[0].action,'import');assert.equal(next[0].cycle,cycle);assert.equal(next[0].contentHash,'retained');
 assert.equal(next[1].action,'acquire');
 const imported=[base('B'),{...base('G'),cycle_key:'2026-11-16T18:17:00.000Z'}];
 assert.deepEqual(recoveryPlan(imported,'2026-11-16T19:17:00Z').map(t=>t.category),['B']);
});

test('ordinary Europe start checks both ITF categories before or after the old fixed cycle boundary',()=>{
 const states=[base('B'),{...base('G','failed'),next_retry_at:'2026-11-16T23:00:00Z'}];
 for(const now of ['2026-11-16T17:20:00Z','2026-11-16T18:20:00Z']){
  assert.deepEqual(recoveryPlan(states,now,{force:true}).map(t=>[t.category,t.action]),[['B','acquire'],['G','acquire']]);
 }
 const cached=[{...base('B','acquired'),content_hash:'saved',next_retry_at:'2026-11-16T23:00:00Z'},base('G')];
 assert.deepEqual(recoveryPlan(cached,'2026-11-16T17:20:00Z',{force:true}).map(t=>[t.category,t.action]),[['B','import'],['G','acquire']]);
});
test('Europe and ITF have independent schedules at the same ordinary time and hourly ITF recovery',()=>{
 const read=name=>readFileSync(new URL('../../../.github/workflows/'+name,import.meta.url),'utf8');
 const europe=read('courtwatch-tennis-europe-rankings.yml'),itf=read('courtwatch-itf-junior-rankings.yml');
 for(const flow of [europe,itf])assert.match(flow,/cron: '17 18 \* \* 1,2'/);
 assert.doesNotMatch(europe,/itf-junior:/);
 assert.doesNotMatch(itf,/workflow_call:|workflow_run:/);
 assert.ok(itf.includes("ITF_FORCE: ${{ inputs.force || (github.event_name == 'schedule' && github.event.schedule == '17 18 * * 1,2') }}"));
 assert.match(itf,/cron: '17 0-17,19-23 \* \* \*'/);
 assert.match(itf,/cron: '17 18 \* \* 0,3-6'/);
 assert.match(itf,/group: courtwatch-d1-writes/);
});
