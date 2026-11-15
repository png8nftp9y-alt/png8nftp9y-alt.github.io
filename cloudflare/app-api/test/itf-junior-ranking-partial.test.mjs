import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './itf-junior-recovery-fixture.mjs';
import {publishPartialRanking} from '../lib/itf-junior-ranking-partial.mjs';
import {readItfRankingTargets} from '../lib/itf-junior-ranking-reader.mjs';
import {createRankingCapture} from '../lib/itf-junior-partial-capture.mjs';
import {publication} from '../lib/itf-junior-ranking-batch.mjs';
import {publishRecovery} from '../lib/itf-junior-ranking-publish.mjs';
import {recoveryPlan} from '../lib/itf-junior-recovery.mjs';
const stamp='2026-11-15T13:17:00Z',row=(id,rank=1)=>({playerId:id,rank,points:100/rank,playerGivenName:'Example',playerFamilyName:'Player',playerNationalityCode:'ITA',gender:'M'});
const partial=(items,date='2026-11-09',total=10)=>({category:'B',status:'partial',rankingDate:date,capturedAt:stamp,total,items,error:'incapsula_challenge'});
export const adapter=d=>({prepare(sql){return {bind(...values){return {all:async()=>({results:await d.query(sql,values)})}}};}});
test('D1_TEST_INITIAL_IMPORT: validated partial rows become visible, unacquired players stay pending, category remains incomplete',async()=>{
 const d=database();try{
  await publishPartialRanking(partial([row(800000001),row(800000002,2)]),d);
  const values=await readItfRankingTargets(adapter(d),[{playerId:'800000001',category:'B'},{playerId:'800000003',category:'B'}]);
  assert.equal(values[0].ranking,1);assert.equal(values[0].partial,true);assert.equal(values[0].rankingDate,'2026-11-09');assert.equal(values[1].status,'pending');
  assert.equal((await d.query('SELECT COUNT(*) AS n FROM itf_junior_ranking_publications WHERE complete=1'))[0].n,0);
 }finally{d.close();}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated identical partial publication writes no rows or metadata',async()=>{
 const d=database();try{const value=partial([row(800000001)]);await publishPartialRanking(value,d);let changes=0;await publishPartialRanking({...value,capturedAt:'2026-11-15T14:17:00Z'},{query:d.query,execute:async sql=>{const result=await d.execute(sql);changes+=result.changes;}});assert.equal(changes,0);}finally{d.close();}
});
test('D1_TEST_REAL_DELTAS_ONLY: interruption resumes only missing IDs and complete publication later overrides partial evidence',async()=>{
 const d=database();try{
  const value=partial([row(800000001),row(800000002,2)]);let first=true;
  await assert.rejects(publishPartialRanking(value,{query:d.query,execute:async statements=>{if(first){first=false;await d.execute(statements.slice(0,2));throw Error('D1 interrupted');}return d.execute(statements);}}),/interrupted/);
  const hidden=await readItfRankingTargets(adapter(d),[{playerId:'800000001',category:'B'}]);assert.equal(hidden[0].ranking,null);
  await publishPartialRanking(value,d);
  await d.execute(publication('B','2026-11-09',[row(800000002,1)],1,'2026-11-15T15:00:00Z').statements);
  const values=await readItfRankingTargets(adapter(d),[{playerId:'800000001',category:'B'},{playerId:'800000002',category:'B'}]);
  assert.equal(values[0].status,'unranked');assert.equal(values[0].ranking,null);assert.equal(values[1].ranking,1);assert.equal(values[1].partial,false);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: malformed, conflicting, unverified or duplicate partial rows cannot be published',async()=>{
 const d=database();try{
  for(const value of [{...partial([row(800000001)]),status:'failure'},partial([row(800000001),row(800000001)]),partial([{...row(800000001),rank:0}]),partial([row(1)])])await assert.rejects(publishPartialRanking(value,d));
  assert.equal((await d.query('SELECT COUNT(*) AS n FROM itf_junior_ranking_history'))[0].n,0);
  const capture=createRankingCapture('B'),url=new URL('https://www.world.tennis/?skip=0');
  capture.add(url,{rankDate:'09 November 2026',totalItems:10,items:[row(800000001)]});assert.equal(capture.snapshot().items.length,1);
  assert.throws(()=>capture.add(new URL('https://www.world.tennis/?skip=1'),{rankDate:'16 November 2026',totalItems:10,items:[row(800000002,2)]}),/changed/);assert.equal(capture.snapshot(),null);
 }finally{d.close();}
});
test('partial source failure publishes validated positions while retaining hourly recovery and a red overall result',async()=>{
 const d=database();try{
  const tasks=recoveryPlan([],stamp),result=await publishRecovery({tasks,startedAt:stamp},{...d,readResult:async category=>({...partial([row(category==='B'?800000001:800000002)]),category})});
  assert.equal(result.success,false);assert.ok(result.states.every(s=>s.phase==='failed'&&s.next_retry_at));
  assert.match(result.states[0].last_error,/partial ranking visible/);
  assert.equal((await readItfRankingTargets(adapter(d),[{playerId:'800000001',category:'B'}]))[0].ranking,1);
 }finally{d.close();}
});
test('actual acquisition command preserves validated pages when a later request is challenged',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'cw-partial-command-'));try{
  mkdirSync(join(dir,'itf-junior-work'));writeFileSync(join(dir,'itf-junior-work/plan.json'),JSON.stringify({startedAt:stamp,tasks:[{category:'B',action:'acquire'},{category:'G',action:'acquire'}]}));
  const script=new URL('../scripts/acquire-itf-junior-recovery.mjs',import.meta.url).href;
  const source=`import timers from 'node:timers/promises';import {syncBuiltinESMExports} from 'node:module';timers.setTimeout=async()=>{};syncBuiltinESMExports();globalThis.fetch=async url=>{if(url.searchParams.get('playerTypeCode')!=='B')throw Error('Unexpected Girls fetch');const skip=Number(url.searchParams.get('skip'));return {ok:true,text:async()=>skip>=200?'Incapsula challenge':JSON.stringify({rankDate:'09 November 2026',totalItems:300,items:Array.from({length:100},(_,i)=>({playerId:800000001+skip+i,rank:skip+i+1,points:300-skip-i}))})};};await import(${JSON.stringify(script)});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:dir,env:{...process.env,ITF_CATEGORY:'B'},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const saved=JSON.parse(readFileSync(join(dir,'itf-junior-work/B.json'),'utf8'));assert.equal(saved.status,'partial');assert.equal(saved.total,300);assert.equal(saved.items.length,200);assert.equal(saved.rankingDate,'2026-11-09');assert.match(saved.error,/incapsula/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('D1_TEST_INITIAL_IMPORT: complementary validated partials certify the full union and stop category retries',async()=>{
 const d=database();try{
  const tasks=recoveryPlan([],stamp);
  await publishPartialRanking(partial([row(800000001)],'2026-11-09',2),d);
  const result=await publishRecovery({tasks,startedAt:stamp},{...d,readResult:async category=>category==='B'?partial([row(800000002,2)],'2026-11-09',2):({...partial([row(800000003)],'2026-11-09',2),category:'G',status:'acquired',total:1})});
  assert.equal(result.success,true);assert.ok(result.states.every(s=>s.phase==='complete'&&s.next_retry_at===null&&s.last_error===''));
  const value=(await readItfRankingTargets(adapter(d),[{playerId:'800000001',category:'B'}]))[0];assert.equal(value.partial,false);assert.equal(value.ranking,1);
  assert.equal(recoveryPlan(result.states,stamp).length,0);
 }finally{d.close();}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: replaying a certified union changes no publication or position',async()=>{
 const d=database();try{
  const value=partial([row(800000001)],'2026-11-09',1);await publishPartialRanking(value,d);let changes=0;
  await publishPartialRanking(value,{query:d.query,execute:async sql=>{const r=await d.execute(sql);changes+=r.changes;}});assert.equal(changes,0);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: changed totals and conflicting identities cannot certify a union',async()=>{
 for(const conflict of ['total','rank']){const d=database();try{
  await publishPartialRanking(partial([row(800000001)],'2026-11-09',3),d);
  await assert.rejects(publishPartialRanking(partial(conflict==='rank'?[row(800000001,2),row(800000002,3)]:[row(800000002,2)],'2026-11-09',conflict==='total'?2:3),d),/Conflicting/);
  assert.equal((await d.query('SELECT COUNT(*) n FROM itf_junior_ranking_publications WHERE complete=1'))[0].n,0);
 }finally{d.close();}}
});
test('D1_TEST_REAL_DELTAS_ONLY: different dates, categories and unready imports cannot fill a missing identity',async()=>{
 const d=database();try{
  await publishPartialRanking({...partial([row(800000002,2)],'2026-11-02',2),category:'G'},d);
  await publishPartialRanking(partial([row(800000002,2)],'2026-11-09',2),d);await d.execute(['UPDATE itf_junior_ranking_partial_publications SET ready=0;']);
  const value=await publishPartialRanking(partial([row(800000001)],'2026-11-09',2),d);
  assert.equal(value.complete,false);assert.equal(value.acquired,1);
  const result=await publishRecovery({tasks:recoveryPlan([],stamp),startedAt:stamp},{...d,readResult:async category=>category==='B'?partial([row(800000002,2)],'2026-11-09',2):({category,status:'failure',error:'independent source failure'})});
  assert.equal(result.success,false);assert.equal(result.states.find(s=>s.category==='B').phase,'complete');assert.equal(result.states.find(s=>s.category==='G').phase,'failed');
 }finally{d.close();}
});
test('D1_TEST_REAL_DELTAS_ONLY: interrupted union promotion resumes without falsely certifying completion',async()=>{
 const d=database();try{
  await publishPartialRanking(partial([row(800000001)],'2026-11-09',2),d);
  const value=partial([row(800000002,2)],'2026-11-09',2);let interrupted=false;
  await assert.rejects(publishPartialRanking(value,{query:d.query,execute:async statements=>{
   if(statements.some(s=>s.includes('SET complete=1'))){await d.execute(statements.slice(0,2));interrupted=true;throw Error('Promotion interrupted');}return d.execute(statements);
  }}),/Promotion interrupted/);
  assert.equal(interrupted,true);assert.equal((await d.query('SELECT COUNT(*) n FROM itf_junior_ranking_publications WHERE complete=1'))[0].n,0);
  const completed=await publishPartialRanking(value,d);assert.equal(completed.complete,true);assert.equal(completed.acquired,2);
 }finally{d.close();}
});
