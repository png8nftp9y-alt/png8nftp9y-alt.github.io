import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {database} from './itf-junior-recovery-fixture.mjs';
import {publishPartialRanking} from '../lib/itf-junior-ranking-partial.mjs';
import {publication} from '../lib/itf-junior-ranking-batch.mjs';
import {rankingGaps,targetedPages,acquireTargetedRanking,readRankingSeed,planTargetedRecovery} from '../lib/itf-junior-targeted-recovery.mjs';
import {publishRecovery} from '../lib/itf-junior-ranking-publish.mjs';
import {recoveryPlan} from '../lib/itf-junior-recovery.mjs';
const row=(n,rank=n)=>({playerId:800000000+n,rank,points:100/rank,playerGivenName:'Name',playerFamilyName:String(n),playerNationalityCode:'ITA',gender:'F'});
const seed=(items,total=5)=>({category:'G',rankingDate:'2026-11-16',total,items,capturedAt:'2026-11-18T01:00:00Z'});
const response=items=>({ok:true,json:{rankDate:'16 November 2026',totalItems:5,items}});
test('real failure shape localizes all 13 missing identities to the 223-way tie at rank 4351',()=>{
 const items=[...Array.from({length:4350},(_,i)=>row(i+1)),...Array.from({length:210},(_,i)=>row(4351+i,4351)),...Array.from({length:625},(_,i)=>row(4574+i))];
 const s=seed(items,5198);
 assert.deepEqual(rankingGaps(s),[{start:4350,end:4573,missing:13,rank:4351}]);
 const pages=targetedPages(s);assert.deepEqual(pages.map(p=>p.skip),[4350,4400,4450,4500,4550]);
 assert.ok(pages.every(p=>p.skip>=4350&&p.skip+p.take<=4573));
});
test('only missing groups are requested; complementary passes accumulate and complete without rereading the prefix',async()=>{
 let saved=seed([row(1),row(2,2),row(5)]);
 // Rank 2 covers positions 2..4, so two unknown IDs belong to this tie.
 assert.deepEqual(rankingGaps(saved),[{start:1,end:4,missing:2,rank:2}]);
 const calls=[];
 const result=await acquireTargetedRanking(saved,async url=>{calls.push(Number(url.searchParams.get('skip')));return response([row(2,2),row(3,2),row(4,2)]);},{onProgress:r=>saved=r});
 assert.deepEqual(calls,[1]);assert.equal(result.status,'acquired');assert.equal(result.items.length,5);
 assert.equal(saved.items.length,5);assert.deepEqual(rankingGaps(saved),[]);
});
test('repeated tied pages cannot certify completion and preserve every cached player',async()=>{
 const known=Array.from({length:100},(_,i)=>row(i+2,2));
 const s=seed([row(1),...known,row(152)],152);
 const result=await acquireTargetedRanking(s,async url=>({ok:true,json:{rankDate:'16 November 2026',totalItems:152,items:known.slice(0,Number(url.searchParams.get('take')))}}));
 assert.equal(result.status,'partial');assert.equal(result.items.length,102);assert.equal(rankingGaps(result)[0].missing,50);
 await assert.rejects(acquireTargetedRanking(seed([row(1),row(2,2),row(5)]),async()=>response([row(2,2),row(3,2),row(2,2)])),/duplicate/);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: source rollover cannot merge old/new dates and substantive conflicts do not enter progress',async()=>{
 const s=seed([row(1),row(2,2),row(5)]);let progress=0;
 await assert.rejects(acquireTargetedRanking(s,async()=>({ok:true,json:{rankDate:'23 November 2026',totalItems:5,items:[row(2,2),row(3,2),row(4,2)]}})),e=>e.code==='NEW_RANKING_PUBLICATION');
 await assert.rejects(acquireTargetedRanking(s,async()=>response([{...row(2,2),points:9},row(3,2),row(4,2)]),{onProgress:()=>progress++}),/Conflicting/);
 assert.equal(progress,0);
 await assert.rejects(acquireTargetedRanking(s,async()=>({ok:true,json:{...response([]).json,totalItems:6,items:[row(2,2),row(3,2),row(4,2)]}})),/total changed/);
});
test('D1_TEST_REAL_DELTAS_ONLY: verified D1 partial union is the seed, complete and unready snapshots stay correctly separated',async()=>{
 const d=database();try{
  const a={...seed([row(1),row(2,2),row(5)]),status:'partial'};await publishPartialRanking(a,d);
  const loaded=await readRankingSeed('G',d.query);assert.equal(loaded.items.length,3);assert.deepEqual(rankingGaps(loaded),[{start:1,end:4,missing:2,rank:2}]);
  const newer={...seed([row(1)],1),rankingDate:'2026-11-23',status:'partial'};
  const pub=publication('G',newer.rankingDate,newer.items,1,newer.capturedAt,{allowPartial:true});await d.execute(pub.statements);
  assert.equal((await readRankingSeed('G',d.query)).rankingDate,'2026-11-16');
  const completed=await acquireTargetedRanking(loaded,async()=>response([row(2,2),row(3,2),row(4,2)]));
  const promoted=await publishPartialRanking({...completed,status:'partial'},d);assert.equal(promoted.complete,true);
  assert.equal((await readRankingSeed('G',d.query)).items.length,5);
 }finally{d.close();}
});
test('acquisition command starts at the target group, preserves a gained page on challenge, and never requests Boys',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cw-target-command-'));try{
  mkdirSync(join(dir,'itf-junior-work'));
  // A large tie requires several windows; the first contributes one new ID.
  const s=seed([row(1),row(2,2),row(202)],202);
  const plan={tasks:[{category:'G',cycle:'2026-11-17T18:17:00Z',action:'acquire'}],startedAt:'2026-11-18T01:17:00Z',recoveryTargets:{G:s}};
  writeFileSync(join(dir,'itf-junior-work/plan.json'),JSON.stringify(plan));
  const script=new URL('../scripts/acquire-itf-junior-recovery.mjs',import.meta.url).href;
  const source=`import timers from 'node:timers/promises';import {syncBuiltinESMExports} from 'node:module';timers.setTimeout=async()=>{};syncBuiltinESMExports();let calls=0;globalThis.fetch=async url=>{if(url.searchParams.get('playerTypeCode')!=='G'||Number(url.searchParams.get('skip'))<1)throw Error('Unexpected full acquisition');calls++;return {ok:true,text:async()=>calls===1?JSON.stringify({rankDate:'16 November 2026',totalItems:202,items:Array.from({length:100},(_,i)=>(${row.toString()})(i+2,2))}):'Incapsula challenge'};};await import(${JSON.stringify(script)});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:dir,encoding:'utf8',env:{...process.env,ITF_CATEGORY:'G'}});assert.equal(result.status,0,result.stderr);
  const value=JSON.parse(readFileSync(join(dir,'itf-junior-work/G.json'),'utf8'));
  assert.equal(value.status,'partial');assert.equal(value.items.length,102);assert.ok(value.items.some(p=>p.playerId===800000202));assert.match(value.error,/incapsula/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('D1_TEST_IDENTICAL_ZERO_WRITES: planner restores an already complete Boys publication without a source request while targeting only Girls; force/new week retain ordinary acquisition',async()=>{
 const d=database();try{
  await d.execute(publication('B','2026-11-16',[row(1)],1,'2026-11-16T12:00:00Z').statements);
  await publishPartialRanking({...seed([row(1),row(2,2),row(5)]),status:'partial'},d);
  const tasks=['B','G'].map(category=>({category,cycle:'2026-11-17T18:17:00.000Z',action:'acquire'}));
  const planned=await planTargetedRecovery(tasks,{query:d.query,startedAt:'2026-11-18T01:00:00Z'});
  assert.equal(tasks[0].action,'import');assert.equal(tasks[1].action,'acquire');
  assert.deepEqual(Object.keys(planned.recoveryTargets),['G']);assert.ok(planned.snapshots.B);
  let rankingChanges=0;
  const published=await publishRecovery({tasks:[tasks[0]],startedAt:'2026-11-18T01:00:00Z',snapshots:planned.snapshots},{...d,execute:async sql=>{const r=await d.execute(sql);if(sql.some(s=>s.startsWith('INSERT INTO itf_junior_ranking_publications')))rankingChanges+=r.changes;return r;},readResult:async()=>{throw Error('use the existing saved publication');}});
  assert.equal(published.states.find(s=>s.category==='B').phase,'complete');assert.equal(rankingChanges,0);
  assert.ok(recoveryPlan(published.states,'2026-11-18T02:00:00Z').every(t=>t.category!=='B'));
  const forced=['B','G'].map(category=>({category,action:'acquire'}));
  await planTargetedRecovery(forced,{force:true,startedAt:'2026-11-18T01:00:00Z',query:()=>{throw Error('force must not read old seeds');}});
  assert.ok(forced.every(t=>t.action==='acquire'));
  const nextWeek=await planTargetedRecovery([{category:'G',action:'acquire'}],{query:d.query,startedAt:'2026-11-23T19:00:00Z'});
  assert.deepEqual(nextWeek.recoveryTargets,{});
 }finally{d.close();}
});

test('actual command abandons the old target on source rollover and never mixes old identities into the new publication',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cw-target-rollover-'));try{
  mkdirSync(join(dir,'itf-junior-work'));
  writeFileSync(join(dir,'itf-junior-work/plan.json'),JSON.stringify({tasks:[{category:'G',cycle:'2026-11-17T18:17:00Z',action:'acquire'}],startedAt:'2026-11-18T01:17:00Z',recoveryTargets:{G:seed([row(1),row(2,2),row(5)])}}));
  const script=new URL('../scripts/acquire-itf-junior-recovery.mjs',import.meta.url).href;
  const source=`import timers from 'node:timers/promises';import {syncBuiltinESMExports} from 'node:module';timers.setTimeout=async()=>{};syncBuiltinESMExports();globalThis.fetch=async url=>({ok:true,text:async()=>JSON.stringify({rankDate:'23 November 2026',totalItems:3,items:Array.from({length:3},(_,i)=>(${row.toString()})(100+i,i+1))})});await import(${JSON.stringify(script)});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:dir,encoding:'utf8',env:{...process.env,ITF_CATEGORY:'G'}});assert.equal(result.status,0,result.stderr);
  const value=JSON.parse(readFileSync(join(dir,'itf-junior-work/G.json'),'utf8'));
  assert.equal(value.status,'acquired');assert.equal(value.rankingDate,'2026-11-23');assert.deepEqual(value.items.map(p=>p.playerId),[800000100,800000101,800000102]);
  assert.match(result.stdout,/new_publication/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('D1_TEST_INITIAL_IMPORT: complementary targeted attempts persist partial gains, reach the full union, and stop all retries',async()=>{
 const d=database();try{
  const now='2026-11-18T01:17:00.000Z',cycle='2026-11-17T18:17:00.000Z';
  const boys={category:'B',cycle,action:'acquire'};
  await publishRecovery({tasks:[boys],startedAt:now},{...d,readResult:async()=>({...seed([row(500)],1),category:'B',status:'acquired'})});
  await publishPartialRanking({...seed([row(1),...Array.from({length:100},(_,i)=>row(i+2,2)),row(105)],105),status:'partial'},d);
  let s=await readRankingSeed('G',d.query),last;
  for(const n of [102,103,104]){
   const known=s.items.filter(p=>p.rank===2),fresh=row(n,2),calls=[];
   const captured=await acquireTargetedRanking(s,async url=>{
    calls.push(Number(url.searchParams.get('skip')));
    return {ok:true,json:{rankDate:'16 November 2026',totalItems:105,items:[fresh,...known].slice(0,Number(url.searchParams.get('take')))}};
   });
   assert.ok(calls.every(skip=>skip>=1&&skip<104));
   last=await publishRecovery({tasks:[{category:'G',cycle,action:'acquire'}],startedAt:now},{...d,readResult:async()=>captured});
   s=await readRankingSeed('G',d.query);assert.equal(s.items.length,n+1);
   assert.equal(last.success,n===104);
  }
  assert.deepEqual(recoveryPlan(last.states,'2026-11-18T03:17:00Z'),[]);
 }finally{d.close();}
});
